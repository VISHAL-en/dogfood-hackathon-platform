import crypto from 'crypto';
import { getDatabase } from '../../database/db';
import { generateId } from '../../utils/crypto';
import {
  NormalizationRun,
  NormalizationRunDetail,
  NormalizationResult,
  NormalizedSubmissionScore,
  JudgeCriterionStat,
  NormalizationProofMetadata,
  NormalizationVerificationResult,
  UserRole
} from '../../../shared/types';

export class NormalizationServiceError extends Error {
  constructor(
    message: string,
    public code: 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'UNAUTHORIZED' = 'BAD_REQUEST'
  ) {
    super(message);
    this.name = 'NormalizationServiceError';
  }
}

/**
 * Rounds a floating point number to 8 decimal places for deterministic precision.
 */
export function round8(num: number): number {
  return Math.round(num * 1e8) / 1e8;
}

/**
 * Canonicalizes a JavaScript object or primitive into a deterministic JSON string.
 * - Recursively sorts object keys lexicographically.
 * - Formats numbers consistently (integers as integers, floats rounded to 8 decimal places).
 * - Preserves deterministic array order.
 * - Produces consistent UTF-8 string output for SHA-256 hashing.
 */
export function canonicalizeJson(val: unknown): string {
  if (val === null || val === undefined) {
    return 'null';
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) {
      return 'null';
    }
    if (Number.isInteger(val)) {
      return val.toString();
    }
    return Number(val.toFixed(8)).toString();
  }
  if (typeof val === 'string') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map(item => canonicalizeJson(item)).join(',') + ']';
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    return '{' + sortedKeys.map(k => JSON.stringify(k) + ':' + canonicalizeJson(obj[k])).join(',') + '}';
  }
  return JSON.stringify(val);
}

export class NormalizationService {
  /**
   * Verifies that the user has organizer or admin permissions for the specified event.
   */
  private static verifyOrganizerOrAdmin(eventId: string, userId: string, userRole: UserRole): void {
    if (userRole !== 'organizer' && userRole !== 'admin') {
      throw new NormalizationServiceError(
        'Access denied: Only event organizers or administrators can perform normalization operations',
        'FORBIDDEN'
      );
    }

    const db = getDatabase();
    const event = db.prepare('SELECT id, organizer_id FROM events WHERE id = ?').get(eventId) as
      | { id: string; organizer_id: string }
      | undefined;

    if (!event) {
      throw new NormalizationServiceError(`Event "${eventId}" not found`, 'NOT_FOUND');
    }

    if (userRole !== 'admin' && event.organizer_id !== userId) {
      throw new NormalizationServiceError(
        'Access denied: You are not the organizer of this event',
        'FORBIDDEN'
      );
    }
  }

  /**
   * Executes a new normalization run for an event.
   * Never modifies raw judge scores; produces separate immutable normalization results.
   */
  static createNormalizationRun(
    eventId: string,
    userId: string,
    userRole: UserRole
  ): NormalizationRunDetail {
    this.verifyOrganizerOrAdmin(eventId, userId, userRole);

    const db = getDatabase();

    // 1. Locate active or locked rubric
    const rubric = db
      .prepare(`
        SELECT id, name, version, status
        FROM rubrics
        WHERE event_id = ? AND status IN ('active', 'locked')
        ORDER BY version DESC
        LIMIT 1
      `)
      .get(eventId) as { id: string; name: string; version: number; status: string } | undefined;

    if (!rubric) {
      throw new NormalizationServiceError(
        'An active or locked rubric is required for normalization',
        'BAD_REQUEST'
      );
    }

    // 2. Load rubric criteria
    const criteria = db
      .prepare(`
        SELECT id, rubric_id, name, weight, max_score, position
        FROM rubric_criteria
        WHERE rubric_id = ?
        ORDER BY position ASC, id ASC
      `)
      .all(rubric.id) as Array<{
        id: string;
        rubric_id: string;
        name: string;
        weight: number;
        max_score: number;
        position: number;
      }>;

    if (criteria.length === 0) {
      throw new NormalizationServiceError(
        'The active rubric has no criteria defined',
        'BAD_REQUEST'
      );
    }

    const criteriaMap = new Map<string, typeof criteria[0]>();
    criteria.forEach(c => criteriaMap.set(c.id, c));
    const requiredCriteriaCount = criteria.length;

    // 3. Create initial running normalization run record
    const runId = generateId('nrun');
    const createdAt = new Date().toISOString();
    const method = 'zscore';
    const methodVersion = 'zscore-population-v1';
    const formulaVersion = 'zscore-population-weighted-v1';

    db.prepare(`
      INSERT INTO normalization_runs (
        id, event_id, rubric_id, method, method_version, status,
        created_by, created_at, input_score_count, judge_count, submission_count
      ) VALUES (?, ?, ?, ?, ?, 'running', ?, ?, 0, 0, 0)
    `).run(runId, eventId, rubric.id, method, methodVersion, userId, createdAt);

    try {
      // 4. Gather eligible assignments and check completeness
      const allAssignments = db
        .prepare(`
          SELECT ja.id, ja.judge_id, ja.submission_id, ja.status, s.status as submission_status
          FROM judge_assignments ja
          JOIN submissions s ON ja.submission_id = s.id
          WHERE ja.event_id = ? AND s.event_id = ?
        `)
        .all(eventId, eventId) as Array<{
          id: string;
          judge_id: string;
          submission_id: string;
          status: string;
          submission_status: string;
        }>;

      interface EligibleScore {
        assignmentId: string;
        judgeId: string;
        submissionId: string;
        criterionId: string;
        score: number;
      }

      const eligibleScores: EligibleScore[] = [];
      let excludedIncompleteAssignmentCount = 0;

      for (const asgn of allAssignments) {
        // Exclude draft submissions
        if (asgn.submission_status !== 'submitted') {
          continue;
        }

        // Must be marked completed
        if (asgn.status !== 'completed') {
          excludedIncompleteAssignmentCount++;
          continue;
        }

        // Check scores for active rubric criteria
        const scores = db
          .prepare(`
            SELECT criterion_id, score, judge_id, submission_id
            FROM judge_scores
            WHERE assignment_id = ?
          `)
          .all(asgn.id) as Array<{
            criterion_id: string;
            score: number;
            judge_id: string;
            submission_id: string;
          }>;

        // Filter to only criteria belonging to the active rubric
        const validCriteriaScores = scores.filter(
          s => criteriaMap.has(s.criterion_id) && s.judge_id === asgn.judge_id
        );

        // Assignment must have evaluated ALL required criteria
        if (validCriteriaScores.length < requiredCriteriaCount) {
          excludedIncompleteAssignmentCount++;
          continue;
        }

        for (const s of validCriteriaScores) {
          eligibleScores.push({
            assignmentId: asgn.id,
            judgeId: asgn.judge_id,
            submissionId: asgn.submission_id,
            criterionId: s.criterion_id,
            score: s.score
          });
        }
      }

      // Counts
      const eligibleJudgeIds = Array.from(new Set(eligibleScores.map(s => s.judgeId))).sort();
      const eligibleSubmissionIds = Array.from(new Set(eligibleScores.map(s => s.submissionId))).sort();

      // 5. Calculate per-judge, per-criterion population mean and population standard deviation
      const judgeCriterionStats: JudgeCriterionStat[] = [];
      // Map for fast lookup: `${judgeId}:${criterionId}` -> JudgeCriterionStat
      const statMap = new Map<string, JudgeCriterionStat>();

      for (const judgeId of eligibleJudgeIds) {
        for (const criterion of criteria) {
          const criterionScores = eligibleScores.filter(
            s => s.judgeId === judgeId && s.criterionId === criterion.id
          );

          const count = criterionScores.length;
          if (count === 0) {
            continue;
          }

          const sum = criterionScores.reduce((acc, curr) => acc + curr.score, 0);
          const rawMean = sum / count;

          // Population variance = average((score - mean)^2)
          const varianceSum = criterionScores.reduce(
            (acc, curr) => acc + Math.pow(curr.score - rawMean, 2),
            0
          );
          const rawVariance = varianceSum / count;
          const rawStddev = Math.sqrt(rawVariance);

          // Zero-variance handling
          const isZeroVariance = rawStddev === 0 || rawStddev < 1e-12;
          const stat: JudgeCriterionStat = {
            judgeId,
            criterionId: criterion.id,
            count,
            mean: round8(rawMean),
            populationStddev: isZeroVariance ? 0 : round8(rawStddev),
            zeroVariance: isZeroVariance
          };

          judgeCriterionStats.push(stat);
          statMap.set(`${judgeId}:${criterion.id}`, stat);
        }
      }

      // Deterministic sort: judgeId ASC, criterionId ASC
      judgeCriterionStats.sort((a, b) => {
        if (a.judgeId !== b.judgeId) {
          return a.judgeId.localeCompare(b.judgeId);
        }
        return a.criterionId.localeCompare(b.criterionId);
      });

      const zeroVarianceCount = judgeCriterionStats.filter(s => s.zeroVariance).length;

      // 6. Calculate normalized scores for each eligible raw score
      const resultsToInsert: NormalizationResult[] = [];

      for (const es of eligibleScores) {
        const stat = statMap.get(`${es.judgeId}:${es.criterionId}`);
        const criterion = criteriaMap.get(es.criterionId)!;

        let zScore = 0;
        if (stat && !stat.zeroVariance && stat.populationStddev > 0) {
          zScore = (es.score - stat.mean) / stat.populationStddev;
        } else {
          // Zero-variance deterministic fallback: z = 0
          zScore = 0;
        }

        zScore = round8(zScore);
        const criterionWeight = criterion.weight;
        const weightedNormalizedScore = round8(zScore * (criterionWeight / 100));

        resultsToInsert.push({
          id: generateId('nres'),
          normalizationRunId: runId,
          judgeId: es.judgeId,
          submissionId: es.submissionId,
          criterionId: es.criterionId,
          rawScore: es.score,
          judgeMean: stat ? stat.mean : 0,
          judgeStddev: stat ? stat.populationStddev : 0,
          zScore,
          criterionWeight,
          weightedNormalizedScore,
          createdAt
        });
      }

      // Sort results deterministically: submissionId ASC, judgeId ASC, criterionId ASC
      resultsToInsert.sort((a, b) => {
        if (a.submissionId !== b.submissionId) {
          return a.submissionId.localeCompare(b.submissionId);
        }
        if (a.judgeId !== b.judgeId) {
          return a.judgeId.localeCompare(b.judgeId);
        }
        return a.criterionId.localeCompare(b.criterionId);
      });

      // 7. Calculate submission-level aggregate normalized scores
      const submissionScoresToInsert: NormalizedSubmissionScore[] = [];

      for (const subId of eligibleSubmissionIds) {
        // Collect all results for this submission
        const subResults = resultsToInsert.filter(r => r.submissionId === subId);
        const subJudges = Array.from(new Set(subResults.map(r => r.judgeId))).sort();

        // Calculate judge_weighted_z for each judge
        const judgeWeightedZList: number[] = [];

        for (const jId of subJudges) {
          const judgeSubResults = subResults.filter(r => r.judgeId === jId);
          const judgeTotalWeightedZ = judgeSubResults.reduce(
            (acc, curr) => acc + curr.weightedNormalizedScore,
            0
          );
          judgeWeightedZList.push(judgeTotalWeightedZ);
        }

        // Project aggregate z = arithmetic mean of all eligible judge_weighted_z values
        const aggregateZ =
          judgeWeightedZList.length > 0
            ? judgeWeightedZList.reduce((acc, curr) => acc + curr, 0) / judgeWeightedZList.length
            : 0;

        // Presentation transformation: clamp(50 + (aggregate_z * 10), 0, 100)
        const unconstrainedScore = 50 + aggregateZ * 10;
        const presentationScore = Math.min(100, Math.max(0, unconstrainedScore));

        submissionScoresToInsert.push({
          id: generateId('nsub'),
          normalizationRunId: runId,
          submissionId: subId,
          aggregateZ: round8(aggregateZ),
          presentationScore: round8(presentationScore),
          judgeCount: subJudges.length,
          createdAt
        });
      }

      // 8. Construct Proof Metadata and compute Canonical SHA-256 Proof Hash
      const proofMetadata: NormalizationProofMetadata = {
        runId,
        eventId,
        rubricId: rubric.id,
        method,
        methodVersion,
        formulaVersion,
        eligibleScoreCount: eligibleScores.length,
        eligibleJudgeCount: eligibleJudgeIds.length,
        eligibleSubmissionCount: eligibleSubmissionIds.length,
        excludedIncompleteAssignmentCount,
        zeroVarianceCount,
        judgeCriterionStats,
        resultCount: resultsToInsert.length,
        deterministicOrdering: 'judgeId ASC, criterionId ASC, submissionId ASC',
        createdAt
      };

      const canonicalProofString = canonicalizeJson(proofMetadata);
      const proofHash = crypto.createHash('sha256').update(canonicalProofString, 'utf8').digest('hex');
      const completedAt = new Date().toISOString();

      // 9. Atomic database persistence
      const insertRunResults = db.transaction(() => {
        // Insert normalization_results
        const insertResultStmt = db.prepare(`
          INSERT INTO normalization_results (
            id, normalization_run_id, judge_id, submission_id, criterion_id,
            raw_score, judge_mean, judge_stddev, z_score, criterion_weight,
            weighted_normalized_score, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const res of resultsToInsert) {
          insertResultStmt.run(
            res.id,
            res.normalizationRunId,
            res.judgeId,
            res.submissionId,
            res.criterionId,
            res.rawScore,
            res.judgeMean,
            res.judgeStddev,
            res.zScore,
            res.criterionWeight,
            res.weightedNormalizedScore,
            res.createdAt
          );
        }

        // Insert normalization_submission_scores
        const insertSubScoreStmt = db.prepare(`
          INSERT INTO normalization_submission_scores (
            id, normalization_run_id, submission_id, aggregate_z,
            presentation_score, judge_count, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const subScore of submissionScoresToInsert) {
          insertSubScoreStmt.run(
            subScore.id,
            subScore.normalizationRunId,
            subScore.submissionId,
            subScore.aggregateZ,
            subScore.presentationScore,
            subScore.judgeCount,
            subScore.createdAt
          );
        }

        // Mark run completed
        db.prepare(`
          UPDATE normalization_runs
          SET status = 'completed',
              completed_at = ?,
              input_score_count = ?,
              judge_count = ?,
              submission_count = ?,
              proof_hash = ?,
              metadata_json = ?
          WHERE id = ?
        `).run(
          completedAt,
          eligibleScores.length,
          eligibleJudgeIds.length,
          eligibleSubmissionIds.length,
          proofHash,
          canonicalProofString,
          runId
        );
      });

      insertRunResults();

      return {
        id: runId,
        eventId,
        rubricId: rubric.id,
        method,
        methodVersion,
        status: 'completed',
        createdBy: userId,
        createdAt,
        completedAt,
        inputScoreCount: eligibleScores.length,
        judgeCount: eligibleJudgeIds.length,
        submissionCount: eligibleSubmissionIds.length,
        proofHash,
        metadataJson: canonicalProofString,
        errorMessage: null,
        proofMetadata,
        submissionScores: submissionScoresToInsert,
        summaryStatistics: {
          totalEligibleScores: eligibleScores.length,
          totalEligibleJudges: eligibleJudgeIds.length,
          totalEligibleSubmissions: eligibleSubmissionIds.length,
          zeroVarianceCriteria: zeroVarianceCount,
          meanPresentationScore:
            submissionScoresToInsert.length > 0
              ? round8(
                  submissionScoresToInsert.reduce((a, b) => a + b.presentationScore, 0) /
                    submissionScoresToInsert.length
                )
              : 50
        }
      };
    } catch (err) {
      // Mark run as failed if an unhandled error occurred
      const errorMessage = err instanceof Error ? err.message : 'Unknown normalization error';
      try {
        db.prepare(`
          UPDATE normalization_runs
          SET status = 'failed',
              error_message = ?,
              completed_at = ?
          WHERE id = ?
        `).run(errorMessage, new Date().toISOString(), runId);
      } catch {
        // Ignore fallback failure
      }
      throw err;
    }
  }

  /**
   * Lists all normalization runs for an event.
   */
  static getNormalizationRuns(
    eventId: string,
    userId: string,
    userRole: UserRole
  ): NormalizationRun[] {
    this.verifyOrganizerOrAdmin(eventId, userId, userRole);

    const db = getDatabase();
    const rows = db
      .prepare(`
        SELECT
          id, event_id, rubric_id, method, method_version, status,
          created_by, created_at, completed_at, input_score_count,
          judge_count, submission_count, proof_hash, metadata_json, error_message
        FROM normalization_runs
        WHERE event_id = ?
        ORDER BY created_at DESC
      `)
      .all(eventId) as Array<{
        id: string;
        event_id: string;
        rubric_id: string;
        method: string;
        method_version: string;
        status: 'running' | 'completed' | 'failed';
        created_by: string;
        created_at: string;
        completed_at: string | null;
        input_score_count: number;
        judge_count: number;
        submission_count: number;
        proof_hash: string | null;
        metadata_json: string | null;
        error_message: string | null;
      }>;

    return rows.map(r => ({
      id: r.id,
      eventId: r.event_id,
      rubricId: r.rubric_id,
      method: r.method,
      methodVersion: r.method_version,
      status: r.status,
      createdBy: r.created_by,
      createdAt: r.created_at,
      completedAt: r.completed_at,
      inputScoreCount: r.input_score_count,
      judgeCount: r.judge_count,
      submissionCount: r.submission_count,
      proofHash: r.proof_hash,
      metadataJson: r.metadata_json,
      errorMessage: r.error_message
    }));
  }

  /**
   * Retrieves detail for a specific normalization run including parsed proof metadata.
   */
  static getNormalizationRunById(
    runId: string,
    eventId: string,
    userId: string,
    userRole: UserRole
  ): NormalizationRunDetail {
    this.verifyOrganizerOrAdmin(eventId, userId, userRole);

    const db = getDatabase();
    const row = db
      .prepare(`
        SELECT
          id, event_id, rubric_id, method, method_version, status,
          created_by, created_at, completed_at, input_score_count,
          judge_count, submission_count, proof_hash, metadata_json, error_message
        FROM normalization_runs
        WHERE id = ? AND event_id = ?
      `)
      .get(runId, eventId) as
      | {
          id: string;
          event_id: string;
          rubric_id: string;
          method: string;
          method_version: string;
          status: 'running' | 'completed' | 'failed';
          created_by: string;
          created_at: string;
          completed_at: string | null;
          input_score_count: number;
          judge_count: number;
          submission_count: number;
          proof_hash: string | null;
          metadata_json: string | null;
          error_message: string | null;
        }
      | undefined;

    if (!row) {
      throw new NormalizationServiceError(`Normalization run "${runId}" not found for this event`, 'NOT_FOUND');
    }

    let proofMetadata: NormalizationProofMetadata | null = null;
    if (row.metadata_json) {
      try {
        proofMetadata = JSON.parse(row.metadata_json) as NormalizationProofMetadata;
      } catch {
        proofMetadata = null;
      }
    }

    const submissionScores = db
      .prepare(`
        SELECT id, normalization_run_id, submission_id, aggregate_z, presentation_score, judge_count, created_at
        FROM normalization_submission_scores
        WHERE normalization_run_id = ?
        ORDER BY presentation_score DESC
      `)
      .all(runId) as Array<{
        id: string;
        normalization_run_id: string;
        submission_id: string;
        aggregate_z: number;
        presentation_score: number;
        judge_count: number;
        created_at: string;
      }>;

    const mappedSubScores: NormalizedSubmissionScore[] = submissionScores.map(s => ({
      id: s.id,
      normalizationRunId: s.normalization_run_id,
      submissionId: s.submission_id,
      aggregateZ: s.aggregate_z,
      presentationScore: s.presentation_score,
      judgeCount: s.judge_count,
      createdAt: s.created_at
    }));

    return {
      id: row.id,
      eventId: row.event_id,
      rubricId: row.rubric_id,
      method: row.method,
      methodVersion: row.method_version,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      inputScoreCount: row.input_score_count,
      judgeCount: row.judge_count,
      submissionCount: row.submission_count,
      proofHash: row.proof_hash,
      metadataJson: row.metadata_json,
      errorMessage: row.error_message,
      proofMetadata,
      submissionScores: mappedSubScores,
      summaryStatistics: {
        totalEligibleScores: row.input_score_count,
        totalEligibleJudges: row.judge_count,
        totalEligibleSubmissions: row.submission_count,
        zeroVarianceCriteria: proofMetadata?.zeroVarianceCount || 0,
        meanPresentationScore:
          mappedSubScores.length > 0
            ? round8(
                mappedSubScores.reduce((a, b) => a + b.presentationScore, 0) / mappedSubScores.length
              )
            : 50
      }
    };
  }

  /**
   * Retrieves individual normalized results for a run, with optional filtering.
   */
  static getNormalizationResults(
    runId: string,
    eventId: string,
    userId: string,
    userRole: UserRole,
    filters?: {
      submissionId?: string;
      judgeId?: string;
      criterionId?: string;
    }
  ): { results: NormalizationResult[]; submissionScores: NormalizedSubmissionScore[] } {
    this.verifyOrganizerOrAdmin(eventId, userId, userRole);

    const db = getDatabase();

    // Verify run exists and belongs to event
    const run = db
      .prepare('SELECT id FROM normalization_runs WHERE id = ? AND event_id = ?')
      .get(runId, eventId) as { id: string } | undefined;

    if (!run) {
      throw new NormalizationServiceError(`Normalization run "${runId}" not found for this event`, 'NOT_FOUND');
    }

    let query = `
      SELECT
        id, normalization_run_id, judge_id, submission_id, criterion_id,
        raw_score, judge_mean, judge_stddev, z_score, criterion_weight,
        weighted_normalized_score, created_at
      FROM normalization_results
      WHERE normalization_run_id = ?
    `;
    const params: unknown[] = [runId];

    if (filters?.submissionId) {
      query += ' AND submission_id = ?';
      params.push(filters.submissionId);
    }
    if (filters?.judgeId) {
      query += ' AND judge_id = ?';
      params.push(filters.judgeId);
    }
    if (filters?.criterionId) {
      query += ' AND criterion_id = ?';
      params.push(filters.criterionId);
    }

    query += ' ORDER BY submission_id ASC, judge_id ASC, criterion_id ASC';

    const rawResults = db.prepare(query).all(...params) as Array<{
      id: string;
      normalization_run_id: string;
      judge_id: string;
      submission_id: string;
      criterion_id: string;
      raw_score: number;
      judge_mean: number;
      judge_stddev: number;
      z_score: number;
      criterion_weight: number;
      weighted_normalized_score: number;
      created_at: string;
    }>;

    const results: NormalizationResult[] = rawResults.map(r => ({
      id: r.id,
      normalizationRunId: r.normalization_run_id,
      judgeId: r.judge_id,
      submissionId: r.submission_id,
      criterionId: r.criterion_id,
      rawScore: r.raw_score,
      judgeMean: r.judge_mean,
      judgeStddev: r.judge_stddev,
      zScore: r.z_score,
      criterionWeight: r.criterion_weight,
      weightedNormalizedScore: r.weighted_normalized_score,
      createdAt: r.created_at
    }));

    // Retrieve submission scores as well (filtered if submissionId was specified)
    let subScoresQuery = `
      SELECT id, normalization_run_id, submission_id, aggregate_z, presentation_score, judge_count, created_at
      FROM normalization_submission_scores
      WHERE normalization_run_id = ?
    `;
    const subParams: unknown[] = [runId];
    if (filters?.submissionId) {
      subScoresQuery += ' AND submission_id = ?';
      subParams.push(filters.submissionId);
    }
    subScoresQuery += ' ORDER BY presentation_score DESC';

    const rawSubScores = db.prepare(subScoresQuery).all(...subParams) as Array<{
      id: string;
      normalization_run_id: string;
      submission_id: string;
      aggregate_z: number;
      presentation_score: number;
      judge_count: number;
      created_at: string;
    }>;

    const submissionScores: NormalizedSubmissionScore[] = rawSubScores.map(s => ({
      id: s.id,
      normalizationRunId: s.normalization_run_id,
      submissionId: s.submission_id,
      aggregateZ: s.aggregate_z,
      presentationScore: s.presentation_score,
      judgeCount: s.judge_count,
      createdAt: s.created_at
    }));

    return { results, submissionScores };
  }

  /**
   * Verifies the cryptographic proof of a normalization run.
   * Reconstructs the canonical proof from the stored metadata and re-computes SHA-256.
   */
  static verifyNormalizationRun(
    runId: string,
    eventId: string,
    userId: string,
    userRole: UserRole
  ): NormalizationVerificationResult {
    this.verifyOrganizerOrAdmin(eventId, userId, userRole);

    const db = getDatabase();
    const run = db
      .prepare(`
        SELECT id, proof_hash, metadata_json
        FROM normalization_runs
        WHERE id = ? AND event_id = ?
      `)
      .get(runId, eventId) as
      | { id: string; proof_hash: string | null; metadata_json: string | null }
      | undefined;

    if (!run) {
      throw new NormalizationServiceError(`Normalization run "${runId}" not found for this event`, 'NOT_FOUND');
    }

    if (!run.proof_hash || !run.metadata_json) {
      return {
        verified: false,
        run_id: run.id,
        stored_hash: run.proof_hash || '',
        calculated_hash: ''
      };
    }

    let parsedMetadata: unknown;
    try {
      parsedMetadata = JSON.parse(run.metadata_json);
    } catch {
      return {
        verified: false,
        run_id: run.id,
        stored_hash: run.proof_hash,
        calculated_hash: ''
      };
    }

    const reconstructedCanonical = canonicalizeJson(parsedMetadata);
    const calculatedHash = crypto.createHash('sha256').update(reconstructedCanonical, 'utf8').digest('hex');

    const verified = calculatedHash === run.proof_hash;

    return {
      verified,
      run_id: run.id,
      stored_hash: run.proof_hash,
      calculated_hash: calculatedHash
    };
  }
}

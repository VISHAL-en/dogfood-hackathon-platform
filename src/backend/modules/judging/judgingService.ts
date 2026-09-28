import { getDatabase } from '../../database/db';
import { generateId } from '../../utils/crypto';
import {
  JudgeAssignment,
  Rubric,
  RubricCriterion,
  JudgeScore,
  SubmissionScoresResponse,
  JudgingProgress,
  CreateRubricInput,
  UpdateRubricInput,
  CreateJudgeAssignmentInput,
  SubmitScoreItem,
  UserRole,
  RubricStatus
} from '../../../shared/types';

export class JudgingServiceError extends Error {
  constructor(
    message: string,
    public code: 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'UNAUTHORIZED' = 'BAD_REQUEST'
  ) {
    super(message);
    this.name = 'JudgingServiceError';
  }
}

export class JudgingService {
  /**
   * Sanitizes a string for CSV output, neutralizing potential formula injection attacks.
   * Prepends a single quote if the field begins with =, +, -, or @.
   */
  static sanitizeCsvField(field: unknown): string {
    if (field === null || field === undefined) {
      return '';
    }
    let str = String(field);
    if (/^[=+\-@]/.test(str)) {
      str = `'${str}`;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  // --------------------------------------------------------------------------
  // RUBRICS & CRITERIA
  // --------------------------------------------------------------------------

  /**
   * Creates a rubric for an event with criteria.
   * Only organizers of the event or admins can create rubrics.
   */
  static createRubric(
    eventId: string,
    userId: string,
    userRole: UserRole,
    input: CreateRubricInput
  ): Rubric {
    const db = getDatabase();

    // Verify organizer or admin
    if (userRole !== 'admin') {
      const event = db.prepare('SELECT organizer_id FROM events WHERE id = ?').get(eventId) as { organizer_id: string } | undefined;
      if (!event) {
        throw new JudgingServiceError(`Event "${eventId}" not found`, 'NOT_FOUND');
      }
      if (event.organizer_id !== userId) {
        throw new JudgingServiceError('Only the event organizer or an admin can create rubrics', 'FORBIDDEN');
      }
    }

    if (!input.name || input.name.trim().length === 0) {
      throw new JudgingServiceError('Rubric name is required', 'BAD_REQUEST');
    }

    const criteria = input.criteria || [];
    if (criteria.length === 0) {
      throw new JudgingServiceError('Rubric must contain at least one criterion', 'BAD_REQUEST');
    }

    // Validate each criterion
    let totalWeight = 0;
    for (const crit of criteria) {
      if (!crit.name || crit.name.trim().length === 0) {
        throw new JudgingServiceError('Criterion name is required', 'BAD_REQUEST');
      }
      if (typeof crit.weight !== 'number' || crit.weight <= 0) {
        throw new JudgingServiceError(`Criterion "${crit.name}" must have a weight greater than 0`, 'BAD_REQUEST');
      }
      if (typeof crit.maxScore !== 'number' || crit.maxScore <= 0) {
        throw new JudgingServiceError(`Criterion "${crit.name}" must have a maxScore greater than 0`, 'BAD_REQUEST');
      }
      totalWeight += crit.weight;
    }

    const status: RubricStatus = input.status || 'draft';
    if (status === 'active' && Math.abs(totalWeight - 100) > 0.001) {
      throw new JudgingServiceError(
        `Total criterion weights for an active rubric must sum to 100 (current total: ${totalWeight})`,
        'BAD_REQUEST'
      );
    }

    return db.transaction(() => {
      const rubricId = generateId('rubric');
      const nowIso = new Date().toISOString();

      // If making active, deactivate any existing active rubric
      if (status === 'active') {
        db.prepare(`
          UPDATE rubrics SET status = 'locked', updated_at = ? WHERE event_id = ? AND status = 'active'
        `).run(nowIso, eventId);
      }

      db.prepare(`
        INSERT INTO rubrics (id, event_id, name, description, version, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      `).run(rubricId, eventId, input.name.trim(), (input.description || '').trim(), status, nowIso, nowIso);

      const insertedCriteria: RubricCriterion[] = [];
      const insertCritStmt = db.prepare(`
        INSERT INTO rubric_criteria (id, rubric_id, name, description, weight, max_score, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < criteria.length; i++) {
        const c = criteria[i];
        const critId = generateId('crit');
        const pos = c.position !== undefined ? c.position : i + 1;
        insertCritStmt.run(critId, rubricId, c.name.trim(), (c.description || '').trim(), c.weight, c.maxScore, pos, nowIso, nowIso);
        insertedCriteria.push({
          id: critId,
          rubricId,
          name: c.name.trim(),
          description: (c.description || '').trim(),
          weight: c.weight,
          maxScore: c.maxScore,
          position: pos,
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }

      return {
        id: rubricId,
        eventId,
        name: input.name.trim(),
        description: (input.description || '').trim(),
        version: 1,
        status: status as RubricStatus,
        criteria: insertedCriteria,
        createdAt: nowIso,
        updatedAt: nowIso
      };
    })();
  }

  /**
   * Activates a rubric after verifying total criterion weights sum to 100.
   */
  static activateRubric(rubricId: string, userId: string, userRole: UserRole): Rubric {
    const db = getDatabase();

    return db.transaction((): Rubric => {
      const rubric = db.prepare('SELECT * FROM rubrics WHERE id = ?').get(rubricId) as {
        id: string;
        event_id: string;
        name: string;
        description: string;
        version: number;
        status: RubricStatus;
        created_at: string;
        updated_at: string;
      } | undefined;

      if (!rubric) {
        throw new JudgingServiceError(`Rubric "${rubricId}" not found`, 'NOT_FOUND');
      }

      if (userRole !== 'admin') {
        const event = db.prepare('SELECT organizer_id FROM events WHERE id = ?').get(rubric.event_id) as { organizer_id: string } | undefined;
        if (!event || event.organizer_id !== userId) {
          throw new JudgingServiceError('Only the event organizer or an admin can activate rubrics', 'FORBIDDEN');
        }
      }

      if (rubric.status === 'locked') {
        throw new JudgingServiceError('Locked rubrics cannot be activated', 'BAD_REQUEST');
      }

      const criteria = db.prepare(`
        SELECT * FROM rubric_criteria WHERE rubric_id = ? ORDER BY position ASC
      `).all(rubricId) as Array<{
        id: string;
        rubric_id: string;
        name: string;
        description: string;
        weight: number;
        max_score: number;
        position: number;
        created_at: string;
        updated_at: string;
      }>;

      if (criteria.length === 0) {
        throw new JudgingServiceError('Rubric must have criteria before activation', 'BAD_REQUEST');
      }

      const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
      if (Math.abs(totalWeight - 100) > 0.001) {
        throw new JudgingServiceError(
          `Total criterion weights must sum to 100 before activation (current sum: ${totalWeight})`,
          'BAD_REQUEST'
        );
      }

      const nowIso = new Date().toISOString();

      // Deactivate any currently active rubric for this event
      db.prepare(`
        UPDATE rubrics SET status = 'locked', updated_at = ? WHERE event_id = ? AND status = 'active'
      `).run(nowIso, rubric.event_id);

      db.prepare(`
        UPDATE rubrics SET status = 'active', updated_at = ? WHERE id = ?
      `).run(nowIso, rubricId);

      return {
        id: rubric.id,
        eventId: rubric.event_id,
        name: rubric.name,
        description: rubric.description,
        version: rubric.version,
        status: 'active' as RubricStatus,
        criteria: criteria.map((c) => ({
          id: c.id,
          rubricId: c.rubric_id,
          name: c.name,
          description: c.description,
          weight: c.weight,
          maxScore: c.max_score,
          position: c.position,
          createdAt: c.created_at,
          updatedAt: c.updated_at
        })),
        createdAt: rubric.created_at,
        updatedAt: nowIso
      };
    })();
  }

  /**
   * Retrieves the currently active rubric for an event.
   */
  static getActiveRubric(eventId: string): Rubric | null {
    const db = getDatabase();

    const event = db.prepare('SELECT id FROM events WHERE id = ? OR slug = ?').get(eventId, eventId) as { id: string } | undefined;
    const resolvedEventId = event ? event.id : eventId;

    let rubric = db.prepare(`
      SELECT * FROM rubrics WHERE event_id = ? AND status = 'active'
    `).get(resolvedEventId) as {
      id: string;
      event_id: string;
      name: string;
      description: string;
      version: number;
      status: 'active';
      created_at: string;
      updated_at: string;
    } | undefined;

    if (!rubric) {
      // Fallback: If no event-specific active rubric is found, check for standard platform active rubric
      rubric = db.prepare(`
        SELECT * FROM rubrics WHERE status = 'active' ORDER BY created_at ASC LIMIT 1
      `).get() as any;
    }

    if (!rubric) {
      return null;
    }

    const criteria = db.prepare(`
      SELECT * FROM rubric_criteria WHERE rubric_id = ? ORDER BY position ASC
    `).all(rubric.id) as Array<{
      id: string;
      rubric_id: string;
      name: string;
      description: string;
      weight: number;
      max_score: number;
      position: number;
      created_at: string;
      updated_at: string;
    }>;

    return {
      id: rubric.id,
      eventId: rubric.event_id,
      name: rubric.name,
      description: rubric.description,
      version: rubric.version,
      status: rubric.status,
      criteria: criteria.map((c) => ({
        id: c.id,
        rubricId: c.rubric_id,
        name: c.name,
        description: c.description,
        weight: c.weight,
        maxScore: c.max_score,
        position: c.position,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      })),
      createdAt: rubric.created_at,
      updatedAt: rubric.updated_at
    };
  }

  // --------------------------------------------------------------------------
  // JUDGE ASSIGNMENTS
  // --------------------------------------------------------------------------

  /**
   * Creates a judge assignment.
   * Only organizers or admins can assign judges.
   */
  static createAssignment(
    eventId: string,
    organizerId: string,
    userRole: UserRole,
    input: CreateJudgeAssignmentInput
  ): JudgeAssignment {
    const db = getDatabase();

    const event = db.prepare('SELECT id, organizer_id FROM events WHERE id = ? OR slug = ?').get(eventId, eventId) as { id: string; organizer_id: string } | undefined;
    if (!event) {
      throw new JudgingServiceError(`Event "${eventId}" not found`, 'NOT_FOUND');
    }

    if (userRole !== 'admin') {
      if (event.organizer_id !== organizerId) {
        throw new JudgingServiceError('Only the event organizer or an admin can assign judges', 'FORBIDDEN');
      }
    }

    const resolvedEventId = event.id;

    const { judgeId, submissionId } = input;
    if (!judgeId || !submissionId) {
      throw new JudgingServiceError('judgeId and submissionId are required', 'BAD_REQUEST');
    }

    // Verify judge exists and has role 'judge'
    const judge = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(judgeId) as { id: string; name: string; role: string } | undefined;
    if (!judge) {
      throw new JudgingServiceError(`User "${judgeId}" not found`, 'NOT_FOUND');
    }
    if (judge.role !== 'judge') {
      throw new JudgingServiceError(`User "${judgeId}" does not have the 'judge' role`, 'BAD_REQUEST');
    }

    // Verify submission exists, belongs to same event, and is 'submitted'
    const submission = db.prepare(`
      SELECT s.id, s.event_id, s.title, s.status, tm.name as team_name
      FROM submissions s
      JOIN teams tm ON s.team_id = tm.id
      WHERE s.id = ?
    `).get(submissionId) as { id: string; event_id: string; title: string; status: string; team_name: string } | undefined;

    if (!submission) {
      throw new JudgingServiceError(`Submission "${submissionId}" not found`, 'NOT_FOUND');
    }

    if (submission.event_id !== resolvedEventId) {
      throw new JudgingServiceError('Submission belongs to another event', 'BAD_REQUEST');
    }

    if (submission.status !== 'submitted') {
      throw new JudgingServiceError('Cannot assign judges to a draft submission', 'BAD_REQUEST');
    }

    // Verify duplicate assignment
    const existing = db.prepare(`
      SELECT id FROM judge_assignments WHERE judge_id = ? AND submission_id = ?
    `).get(judgeId, submissionId);

    if (existing) {
      throw new JudgingServiceError('Judge is already assigned to this submission', 'CONFLICT');
    }

    const id = generateId('asgn');
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO judge_assignments (id, event_id, judge_id, submission_id, status, assigned_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'assigned', ?, ?, ?)
    `).run(id, resolvedEventId, judgeId, submissionId, nowIso, nowIso, nowIso);

    return {
      id,
      eventId: resolvedEventId,
      judgeId,
      judgeName: judge.name,
      submissionId,
      submissionTitle: submission.title,
      teamName: submission.team_name,
      status: 'assigned',
      assignedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    };
  }

  /**
   * Retrieves all assignments for a specific judge.
   * Constrained strictly to judgeId for backend isolation.
   */
  static getJudgeAssignments(judgeId: string): JudgeAssignment[] {
    const db = getDatabase();

    const rows = db.prepare(`
      SELECT
        ja.id,
        ja.event_id,
        e.name as event_name,
        ja.judge_id,
        u.name as judge_name,
        u.email as judge_email,
        ja.submission_id,
        s.title as submission_title,
        s.slug as submission_slug,
        tm.name as team_name,
        ja.status,
        ja.assigned_at,
        ja.created_at,
        ja.updated_at
      FROM judge_assignments ja
      JOIN events e ON ja.event_id = e.id
      JOIN users u ON ja.judge_id = u.id
      JOIN submissions s ON ja.submission_id = s.id
      JOIN teams tm ON s.team_id = tm.id
      WHERE ja.judge_id = ?
      ORDER BY ja.assigned_at DESC
    `).all(judgeId) as Array<{
      id: string;
      event_id: string;
      event_name: string;
      judge_id: string;
      judge_name: string;
      judge_email: string;
      submission_id: string;
      submission_title: string;
      submission_slug: string;
      team_name: string;
      status: 'assigned' | 'completed';
      assigned_at: string;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      eventId: r.event_id,
      eventName: r.event_name,
      judgeId: r.judge_id,
      judgeName: r.judge_name,
      judgeEmail: r.judge_email,
      submissionId: r.submission_id,
      submissionTitle: r.submission_title,
      submissionSlug: r.submission_slug,
      teamName: r.team_name,
      status: r.status,
      assignedAt: r.assigned_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  /**
   * Retrieves a single assignment, enforcing strict judge isolation.
   */
  static getJudgeAssignmentById(assignmentId: string, judgeId: string): JudgeAssignment {
    const db = getDatabase();

    const row = db.prepare(`
      SELECT
        ja.id,
        ja.event_id,
        ja.judge_id,
        u.name as judge_name,
        ja.submission_id,
        s.title as submission_title,
        s.slug as submission_slug,
        tm.name as team_name,
        ja.status,
        ja.assigned_at,
        ja.created_at,
        ja.updated_at
      FROM judge_assignments ja
      JOIN users u ON ja.judge_id = u.id
      JOIN submissions s ON ja.submission_id = s.id
      JOIN teams tm ON s.team_id = tm.id
      WHERE ja.id = ?
    `).get(assignmentId) as {
      id: string;
      event_id: string;
      judge_id: string;
      judge_name: string;
      submission_id: string;
      submission_title: string;
      submission_slug: string;
      team_name: string;
      status: 'assigned' | 'completed';
      assigned_at: string;
      created_at: string;
      updated_at: string;
    } | undefined;

    if (!row) {
      throw new JudgingServiceError(`Assignment "${assignmentId}" not found`, 'NOT_FOUND');
    }

    if (row.judge_id !== judgeId) {
      throw new JudgingServiceError('Access denied: You are not assigned to this submission', 'FORBIDDEN');
    }

    return {
      id: row.id,
      eventId: row.event_id,
      judgeId: row.judge_id,
      judgeName: row.judge_name,
      submissionId: row.submission_id,
      submissionTitle: row.submission_title,
      submissionSlug: row.submission_slug,
      teamName: row.team_name,
      status: row.status,
      assignedAt: row.assigned_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // --------------------------------------------------------------------------
  // JUDGE SCORING & WEIGHTED CALCULATION
  // --------------------------------------------------------------------------

  /**
   * Submits scores for an assignment.
   * Strictly enforces judge ownership, validates criteria against active rubric,
   * validates score ranges, and calculates weighted total.
   */
  static submitAssignmentScores(
    assignmentId: string,
    judgeId: string,
    scoresInput: SubmitScoreItem[]
  ): SubmissionScoresResponse {
    const db = getDatabase();

    return db.transaction(() => {
      // 1. Load assignment and verify judge isolation
      const assignment = db.prepare(`
        SELECT ja.*, s.title as submission_title
        FROM judge_assignments ja
        JOIN submissions s ON ja.submission_id = s.id
        WHERE ja.id = ?
      `).get(assignmentId) as {
        id: string;
        event_id: string;
        judge_id: string;
        submission_id: string;
        status: string;
      } | undefined;

      if (!assignment) {
        throw new JudgingServiceError(`Assignment "${assignmentId}" not found`, 'NOT_FOUND');
      }

      if (assignment.judge_id !== judgeId) {
        throw new JudgingServiceError('Access denied: You are not assigned to this submission', 'FORBIDDEN');
      }

      // 2. Load active rubric for the event
      const rubric = this.getActiveRubric(assignment.event_id);
      if (!rubric || !rubric.criteria || rubric.criteria.length === 0) {
        throw new JudgingServiceError('No active rubric found for this event', 'BAD_REQUEST');
      }

      const criteriaMap = new Map<string, RubricCriterion>();
      for (const crit of rubric.criteria) {
        criteriaMap.set(crit.id, crit);
      }

      if (!Array.isArray(scoresInput) || scoresInput.length === 0) {
        throw new JudgingServiceError('Scores array cannot be empty', 'BAD_REQUEST');
      }

      const nowIso = new Date().toISOString();
      const insertOrUpdateScore = db.prepare(`
        INSERT INTO judge_scores (id, assignment_id, criterion_id, judge_id, submission_id, score, comment, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(assignment_id, criterion_id) DO UPDATE SET
          score = excluded.score,
          comment = excluded.comment,
          updated_at = excluded.updated_at
      `);

      for (const item of scoresInput) {
        const criterion = criteriaMap.get(item.criterionId);
        if (!criterion) {
          throw new JudgingServiceError(
            `Criterion "${item.criterionId}" is invalid or does not belong to active rubric`,
            'BAD_REQUEST'
          );
        }

        if (typeof item.score !== 'number' || isNaN(item.score)) {
          throw new JudgingServiceError(`Score for "${criterion.name}" must be a valid number`, 'BAD_REQUEST');
        }

        if (item.score < 0 || item.score > criterion.maxScore) {
          throw new JudgingServiceError(
            `Score for "${criterion.name}" must be between 0 and ${criterion.maxScore} (received: ${item.score})`,
            'BAD_REQUEST'
          );
        }

        const scoreId = generateId('scr');
        insertOrUpdateScore.run(
          scoreId,
          assignmentId,
          item.criterionId,
          judgeId,
          assignment.submission_id,
          item.score,
          item.comment || null,
          nowIso,
          nowIso
        );
      }

      // 3. Load all current scores for this assignment to compute weighted total and completion status
      const allScores = db.prepare(`
        SELECT
          js.id,
          js.assignment_id,
          js.criterion_id,
          rc.name as criterion_name,
          rc.weight as criterion_weight,
          rc.max_score,
          js.judge_id,
          js.submission_id,
          js.score,
          js.comment,
          js.created_at,
          js.updated_at
        FROM judge_scores js
        JOIN rubric_criteria rc ON js.criterion_id = rc.id
        WHERE js.assignment_id = ?
        ORDER BY rc.position ASC
      `).all(assignmentId) as Array<{
        id: string;
        assignment_id: string;
        criterion_id: string;
        criterion_name: string;
        criterion_weight: number;
        max_score: number;
        judge_id: string;
        submission_id: string;
        score: number;
        comment: string | null;
        created_at: string;
        updated_at: string;
      }>;

      let totalWeightedScore = 0;
      const formattedScores: JudgeScore[] = allScores.map((s) => {
        const normalized = s.score / s.max_score;
        const weightedScore = normalized * s.criterion_weight;
        totalWeightedScore += weightedScore;
        return {
          id: s.id,
          assignmentId: s.assignment_id,
          criterionId: s.criterion_id,
          criterionName: s.criterion_name,
          criterionWeight: s.criterion_weight,
          maxScore: s.max_score,
          judgeId: s.judge_id,
          submissionId: s.submission_id,
          score: s.score,
          weightedScore,
          comment: s.comment,
          createdAt: s.created_at,
          updatedAt: s.updated_at
        };
      });

      // 4. Update assignment completion state if all criteria have been scored
      let assignmentStatus: 'assigned' | 'completed' = 'assigned';
      if (allScores.length >= rubric.criteria.length) {
        assignmentStatus = 'completed';
        db.prepare(`
          UPDATE judge_assignments SET status = 'completed', updated_at = ? WHERE id = ?
        `).run(nowIso, assignmentId);
      }

      return {
        assignmentId,
        submissionId: assignment.submission_id,
        judgeId,
        scores: formattedScores,
        totalWeightedScore,
        status: assignmentStatus
      };
    })();
  }

  /**
   * Retrieves scores belonging ONLY to the authenticated judge.
   * Strictly filtered by judgeId.
   */
  static getJudgeScores(
    judgeId: string,
    filters?: { eventId?: string; submissionId?: string; assignmentId?: string }
  ): JudgeScore[] {
    const db = getDatabase();

    const conditions = ['js.judge_id = ?'];
    const params: any[] = [judgeId];

    if (filters?.eventId) {
      conditions.push('ja.event_id = ?');
      params.push(filters.eventId);
    }
    if (filters?.submissionId) {
      conditions.push('js.submission_id = ?');
      params.push(filters.submissionId);
    }
    if (filters?.assignmentId) {
      conditions.push('js.assignment_id = ?');
      params.push(filters.assignmentId);
    }

    const rows = db.prepare(`
      SELECT
        js.id,
        js.assignment_id,
        js.criterion_id,
        rc.name as criterion_name,
        rc.weight as criterion_weight,
        rc.max_score,
        js.judge_id,
        js.submission_id,
        js.score,
        (js.score / rc.max_score) * rc.weight as weighted_score,
        js.comment,
        js.created_at,
        js.updated_at
      FROM judge_scores js
      JOIN judge_assignments ja ON js.assignment_id = ja.id
      JOIN rubric_criteria rc ON js.criterion_id = rc.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY js.created_at DESC
    `).all(...params) as Array<{
      id: string;
      assignment_id: string;
      criterion_id: string;
      criterion_name: string;
      criterion_weight: number;
      max_score: number;
      judge_id: string;
      submission_id: string;
      score: number;
      weighted_score: number;
      comment: string | null;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      assignmentId: r.assignment_id,
      criterionId: r.criterion_id,
      criterionName: r.criterion_name,
      criterionWeight: r.criterion_weight,
      maxScore: r.max_score,
      judgeId: r.judge_id,
      submissionId: r.submission_id,
      score: r.score,
      weightedScore: r.weighted_score,
      comment: r.comment,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  // --------------------------------------------------------------------------
  // ORGANIZER JUDGING PROGRESS
  // --------------------------------------------------------------------------

  /**
   * Retrieves aggregate judging progress for an event.
   * Only accessible by organizers and admins.
   */
  static getJudgingProgress(eventId: string, userId: string, userRole: UserRole): JudgingProgress {
    const db = getDatabase();

    const event = db.prepare('SELECT id, organizer_id FROM events WHERE id = ? OR slug = ?').get(eventId, eventId) as { id: string; organizer_id: string } | undefined;
    if (!event) {
      throw new JudgingServiceError(`Event "${eventId}" not found`, 'NOT_FOUND');
    }

    if (userRole !== 'admin') {
      if (event.organizer_id !== userId) {
        throw new JudgingServiceError('Access denied: Only event organizers or admins can view judging progress', 'FORBIDDEN');
      }
    }

    const resolvedEventId = event.id;

    const counts = db.prepare(`
      SELECT
        COUNT(*) as total_assignments,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_assignments,
        COUNT(DISTINCT judge_id) as assigned_judges_count,
        COUNT(DISTINCT submission_id) as assigned_submissions_count
      FROM judge_assignments
      WHERE event_id = ?
    `).get(resolvedEventId) as {
      total_assignments: number;
      completed_assignments: number | null;
      assigned_judges_count: number;
      assigned_submissions_count: number;
    };

    const total = counts.total_assignments || 0;
    const completed = counts.completed_assignments || 0;
    const pending = total - completed;
    const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      eventId: resolvedEventId,
      totalAssignments: total,
      completedAssignments: completed,
      pendingAssignments: pending,
      assignedJudgesCount: counts.assigned_judges_count || 0,
      assignedSubmissionsCount: counts.assigned_submissions_count || 0,
      completionPercentage
    };
  }

  /**
   * Lists all users with the judge role.
   */
  static listJudges(): Array<{ id: string; name: string; email: string; role: string }> {
    const db = getDatabase();
    return db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE role = 'judge'
      ORDER BY name ASC
    `).all() as Array<{ id: string; name: string; email: string; role: string }>;
  }

  // --------------------------------------------------------------------------
  // CSV SCORE EXPORT
  // --------------------------------------------------------------------------

  /**
   * Generates CSV score export.
   * Only accessible by organizers or admins.
   * Includes CSV formula injection protection.
   */
  static exportScoresCSV(userRole: UserRole, eventId?: string): string {
    if (userRole !== 'organizer' && userRole !== 'admin') {
      throw new JudgingServiceError('Access denied: Only organizers and admins can export scores', 'FORBIDDEN');
    }

    const db = getDatabase();

    const conditions: string[] = [];
    const params: any[] = [];

    if (eventId) {
      conditions.push('ja.event_id = ?');
      params.push(eventId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db.prepare(`
      SELECT
        e.name as event_name,
        s.title as submission_title,
        tm.name as team_name,
        u.name as judge_name,
        rc.name as criterion_name,
        js.score,
        rc.max_score,
        rc.weight,
        ROUND((js.score / rc.max_score) * rc.weight, 2) as weighted_score,
        js.comment,
        ja.status as assignment_status
      FROM judge_scores js
      JOIN judge_assignments ja ON js.assignment_id = ja.id
      JOIN events e ON ja.event_id = e.id
      JOIN submissions s ON js.submission_id = s.id
      JOIN teams tm ON s.team_id = tm.id
      JOIN users u ON js.judge_id = u.id
      JOIN rubric_criteria rc ON js.criterion_id = rc.id
      ${whereClause}
      ORDER BY e.name ASC, s.title ASC, u.name ASC, rc.position ASC
    `).all(...params) as Array<{
      event_name: string;
      submission_title: string;
      team_name: string;
      judge_name: string;
      criterion_name: string;
      score: number;
      max_score: number;
      weight: number;
      weighted_score: number;
      comment: string | null;
      assignment_status: string;
    }>;

    const header = 'event,submission,team,judge,criterion,score,max_score,weight,weighted_score,comment,assignment_status';

    const lines = rows.map((r) => [
      this.sanitizeCsvField(r.event_name),
      this.sanitizeCsvField(r.submission_title),
      this.sanitizeCsvField(r.team_name),
      this.sanitizeCsvField(r.judge_name),
      this.sanitizeCsvField(r.criterion_name),
      r.score,
      r.max_score,
      r.weight,
      r.weighted_score,
      this.sanitizeCsvField(r.comment || ''),
      this.sanitizeCsvField(r.assignment_status)
    ].join(','));

    return [header, ...lines].join('\n');
  }
}

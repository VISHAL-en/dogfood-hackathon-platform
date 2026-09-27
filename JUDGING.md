# DOGFOOD 2026 — Judging Foundation & Score Isolation

This document outlines the architecture, data models, security invariants, and scoring calculations implemented in Step 7 of the DOGFOOD 2026 hackathon platform.

---

## 1. Assignment Model

Judge assignments (`judge_assignments`) link an authenticated user with the `judge` role to an individual submitted project (`status = 'submitted'`).

### Invariants & Rules
* **Organizer / Admin Authority**: Only the event organizer or a platform administrator can create assignments. Judges cannot assign projects to themselves or to other judges.
* **Eligible Submissions**: Only submissions with `status = 'submitted'` belonging to the same event can be assigned. Draft projects cannot be assigned.
* **Unique Assignment**: Each judge can only be assigned once per submission (`UNIQUE(judge_id, submission_id)`).
* **Lifecycle State**: An assignment begins in `assigned` status and automatically transitions to `completed` once all criteria of the active rubric have been scored.

---

## 2. Rubric Lifecycle & Immutability

Rubrics (`rubrics`) and their criteria (`rubric_criteria`) define the standardized scoring dimensions for an event.

### Lifecycle States
* **`draft`**: Organizers can add, update, reorder, or delete criteria.
* **`active`**: Validated and currently in use for scoring. Only one rubric per event can be active at a time.
* **`locked`**: Deactivated when a new rubric is activated or finalized. Locked rubrics cannot be modified or re-activated.

### Activation Validation
To transition from `draft` to `active`:
* The rubric must contain at least one criterion.
* The sum of all criterion weights must equal **`100`** exactly.
* Activating a rubric atomically locks any previous active rubric for that event.

---

## 3. Criterion Weights & Score Bounds

Each criterion defines:
* `weight`: Relative importance (e.g. 40, 25, 20, 15).
* `max_score`: Upper bound for raw scores (e.g. 10.0). Must be strictly $> 0$.
* Raw scores must satisfy $0 \le \text{score} \le \text{max\_score}$. Out-of-bounds scores are rejected with `400 Bad Request`.

### Default Seed Rubric (`rubric_dogfood_2026`)
1. **Tier Completion & Correctness**: Weight `40`, Max Score `10`
2. **Judging Integrity**: Weight `25`, Max Score `10`
3. **Adoptability & Operability**: Weight `20`, Max Score `10`
4. **Code Quality & Innovation**: Weight `15`, Max Score `10`
* **Total Weight**: `100`

---

## 4. Weighted Score Calculation

The server deterministically computes weighted scores using raw criterion scores submitted by the judge. Client-supplied totals or weighted scores are strictly ignored.

### Formula
For each criterion $i$:
$$\text{normalized}_i = \frac{\text{score}_i}{\text{max\_score}_i}$$
$$\text{weighted contribution}_i = \text{normalized}_i \times \text{weight}_i$$

$$\text{Final Score} = \sum_{i} \text{weighted contribution}_i$$

With weights summing to $100$, the final score is on a $0 - 100$ scale.
Raw scores are preserved in `judge_scores.score` without premature rounding.

---

## 5. Judge Isolation Model

Strict backend isolation guarantees that judges cannot view or manipulate peer evaluations.

* **Identity Derivation**: `judge_id` is derived exclusively from the verified server-side session (`req.user.id`). Any `judge_id` sent in the request body or query parameters is rejected or ignored.
* **Assignment Access**: A judge can only access assignments where `assignment.judge_id === req.user.id`.
* **Score Access**: All queries to `judge_scores` filter strictly by `WHERE judge_id = req.user.id`.
* **Peer Score Restriction**: Endpoints such as `GET /judge/scores/peer` reject judges and participants with `403 Forbidden`.
* **Participant Access**: Participants attempting to query `/judge/scores` or `/judge/scores/peer` receive `403 Forbidden`.

---

## 6. Organizer Progress Model

Organizers and administrators can query aggregate progress (`GET /events/:eventId/judging/progress`) without exposing individual peer scores:
* Total assignments
* Completed assignments
* Pending assignments
* Unique assigned judges count
* Unique assigned submissions count
* Overall completion percentage

Judges and participants attempting to query this endpoint receive `403 Forbidden`.

---

## 7. CSV Export Behavior

Organizers and administrators can export complete scoring records via `GET /exports/scores.csv`.

* **MIME Type**: `Content-Type: text/csv; charset=utf-8`
* **Header Row**: `event,submission,team,judge,criterion,score,max_score,weight,weighted_score,comment,assignment_status`
* **Formula Injection Neutralization**: Any textual field starting with `=`, `+`, `-`, or `@` is prefixed with `'` to neutralize spreadsheet execution.
* **Role Guard**: Requests from participants or judges return `403 Forbidden`.

---

## 8. Cross-Judge Normalization & Proof/Audit Engine

Step 8 introduces the **cross-judge normalization engine** and reproducible audit/proof foundation.

> **Key Design Invariant**: The normalized score is a derived analytical result. It does not replace the underlying judge score. Raw judge scores (`judge_scores`) are immutable historical evidence and are **never overwritten or mutated** during normalization.

### 8.1. Data Flow Architecture

$$\text{Raw Judge Scores} \longrightarrow \text{Eligibility Filter} \longrightarrow \text{Per-Judge/Criterion Stats} \longrightarrow \text{Z-Score Normalization} \longrightarrow \text{Rubric Weighting} \longrightarrow \text{Multi-Judge Aggregation} \longrightarrow \text{0--100 Presentation Transformation} \longrightarrow \text{Immutable Run \& Proof Hash}$$

### 8.2. Eligible Population Rules

Normalization operates strictly on a deterministically filtered population:
* Only submissions with `status = 'submitted'` belonging to the target event are eligible.
* Draft submissions (`status = 'draft'`) and deleted submissions are excluded.
* Only scores belonging to the event's currently active or locked rubric are eligible (`rubric_criteria.rubric_id = rubric.id`).
* Only completed judge assignments (`judge_assignments.status = 'completed'`) are eligible.
* Assignments must have evaluated **all** required criteria in the active rubric. Incomplete assignments (or assignments missing required criteria scores) are excluded from the population.
* The proof metadata tracks `excludedIncompleteAssignmentCount`.
* Only scores submitted by the authenticated judge assigned to the project are eligible.
* Raw score values are utilized exactly as stored in `judge_scores`.

### 8.3. Deterministic Z-Score Normalization Algorithm

The platform implements **deterministic population z-score normalization** (`method = 'zscore'`, `version = 'zscore-population-v1'`).

For each judge $j$ and criterion $c$:
1. Collect all eligible raw scores $S_{j, c} = \{s_1, s_2, \dots, s_N\}$ where $N = |S_{j, c}|$.
2. Compute the population mean:
   $$\mu_{j, c} = \frac{1}{N} \sum_{k=1}^N s_k$$
3. Compute the population variance:
   $$\sigma^2_{j, c} = \frac{1}{N} \sum_{k=1}^N (s_k - \mu_{j, c})^2$$
4. Compute the population standard deviation:
   $$\sigma_{j, c} = \sqrt{\sigma^2_{j, c}}$$
   *(Note: Population standard deviation with denominator $N$ is required; sample standard deviation with $N-1$ is not used).*

5. Compute individual criterion z-scores:
   $$z = \frac{s - \mu_{j, c}}{\sigma_{j, c}}$$

### 8.4. Zero-Variance Handling

If a judge awards the exact same score to all eligible projects for a criterion, or has only one evaluation, $\sigma_{j, c} = 0$. Division by zero must never occur.

* **Neutral Fallback**: When $\sigma_{j, c} = 0$, $z = 0$ for every score from that judge and criterion.
* **Rationale**: *A zero-variance judge/criterion contributes a neutral z-score of 0 because the judge provided no within-criterion score differentiation.*
* The judge is not discarded or silently excluded.
* The zero-variance condition is explicitly recorded in `judgeCriterionStats` (`zeroVariance: true`) and tracked in the overall `zeroVarianceCount` in proof metadata.

### 8.5. Criterion Weighting & Judge Aggregation

Active rubric criteria weights are authoritative:
* For criterion $i$ with weight $w_i \in (0, 100]$:
  $$\text{weighted\_z}_i = z_i \times \frac{w_i}{100}$$
* For a submission $p$ evaluated by judge $j$:
  $$\text{judge\_weighted\_z}_{j, p} = \sum_{i \in \text{criteria}} \text{weighted\_z}_{j, p, i}$$

### 8.6. Cross-Judge Aggregation

For projects evaluated by multiple judges:
* Aggregate judge contributions using the **arithmetic mean**:
  $$\text{aggregate\_z}_p = \frac{1}{|J_p|} \sum_{j \in J_p} \text{judge\_weighted\_z}_{j, p}$$
  where $J_p$ is the set of all eligible judges who evaluated submission $p$.

### 8.7. 0–100 Presentation Transformation

To produce a human-readable score centered around 50 without distorting the underlying z-scores:
$$\text{presentation\_score} = \text{clamp}(50 + (\text{aggregate\_z}_p \times 10), 0, 100)$$
* Underlying z-score values are permanently preserved in `normalization_results` and `normalization_submission_scores`.
* The 0–100 presentation score is clearly documented as a **presentation transformation**, not a raw score.

### 8.8. Normalization Run Lifecycle & Immutability

* **Organizer / Admin Only**: Runs are initiated via `POST /events/:eventId/judging/normalization`.
* **Lifecycle States**: `running` $\to$ `completed` (or `failed` with recorded `error_message`).
* **Multi-Run Preservation**: Re-running normalization creates a brand-new run record with a unique ID (e.g. `nrun_...`). Previous runs remain immutable, intact, and auditable.
* Results are written to `normalization_results` with a unique constraint:
  `UNIQUE(normalization_run_id, judge_id, submission_id, criterion_id)`

### 8.9. Reproducible Proof Metadata & Canonical SHA-256 Hash

Every completed run records structured proof metadata in `normalization_runs.metadata_json`:
* `runId`, `eventId`, `rubricId`
* `method: 'zscore'`, `methodVersion: 'zscore-population-v1'`, `formulaVersion: 'zscore-population-weighted-v1'`
* `eligibleScoreCount`, `eligibleJudgeCount`, `eligibleSubmissionCount`
* `excludedIncompleteAssignmentCount`, `zeroVarianceCount`
* `judgeCriterionStats`: Array of `{ judgeId, criterionId, count, mean, populationStddev, zeroVariance }` sorted by `judgeId ASC, criterionId ASC`
* `resultCount`, `deterministicOrdering`, `createdAt`
* **Zero Secrets**: Contains no user credentials, session tokens, password hashes, or emails.

**Canonical Proof Hash Generation**:
1. All JSON object keys are sorted lexicographically at every recursive depth.
2. Floating-point numbers are rounded to 8 decimal places for deterministic precision across platforms.
3. Arrays are sorted deterministically.
4. Output is serialized to deterministic UTF-8 canonical JSON.
5. The proof hash is calculated using SHA-256:
   $$\text{proof\_hash} = \text{SHA-256}(\text{canonical\_proof})$$

### 8.10. Verification Endpoint

Organizers/admins can verify the cryptographic proof of any run via:
`POST /events/:eventId/judging/normalization/:runId/verify`

The server:
1. Loads the stored run.
2. Re-parses `metadata_json` and reconstructs the canonical string.
3. Computes the SHA-256 hash.
4. Compares the calculated hash against `proof_hash`.
5. Returns `{ verified: boolean, run_id, stored_hash, calculated_hash }`.
If database records or metadata have been altered, verification fails (`verified: false`).

### 8.11. Limitations & Exclusions

* **Bradley-Terry / Pairwise Ranking**: Not in scope (deterministic population z-score normalization is the sole authoritative method).
* **Judge Score Secrecy**: Raw judge scores, individual criteria assessments, and z-score calculations remain strictly confidential to organizers and administrators.

---

## 9. T3 Community Voting vs. Internal Judging Isolation (Step 10)

Community voting (`voting_rounds`, `community_votes`) is strictly separated from the internal judge scoring and normalization system.

### 9.1. System & Data Model Separation
* **Separate Tables**: Community votes are persisted in `community_votes` and tied to `voting_candidates`, never referencing `judge_scores` or `normalization_results`.
* **Zero Score Reuse**: Judge evaluations and community votes are never mingled or converted into one another. Community voting is an independent community sentiment signal.
* **Organizer / Admin Guard**: The normalization endpoint (`GET /events/:eventId/judging/normalization/:runId/results`) remains strictly restricted to authenticated organizers and admins. Public voters, participants, and judges cannot access normalization results.

### 9.2. Anti-Anchoring Public Result Boundary
Public community voting results (`GET /events/:eventId/voting/:roundId/results`) enforce strict anti-anchoring:
* **Pre-Publication Secrecy**: While a voting round is in `draft`, `voting_open`, or `voting_closed`, the results endpoint unconditionally returns HTTP `403 Forbidden`. Vote tallies are not leaked while voting is active or being audited.
* **Publication State**: Only when the round status is transitioned to `results_published` by the organizer do aggregated community results become accessible.
* **Data Sanitization**: Published community results return solely community aggregate tallies (`submissionId`, `title`, `slug`, `teamName`, `voteCount`, `rank`). Under no circumstances do community result endpoints expose:
  - Judge identities or reviewer names
  - Raw judge scores or criteria breakdowns
  - Weighted judge scores
  - Normalization $z$-scores
  - Normalization proof metadata or cryptographic hashes
  - Internal judge assignment status

### 9.3. Anti-Abuse & Randomization
* **Ballot Randomization**: Prevents position and recency bias by cryptographically shuffling candidate order (`crypto.randomInt` + Fisher-Yates) and persisting the permutation per voter ballot (`ballot_candidates`).
* **Voter Key Privacy**: Server issues a random 256-bit token; only the SHA-256 hash is recorded in SQLite. Raw client IPs and device identifiers are never stored.
* **Abuse Protection**: Duplicate voting is rejected by SQLite constraints (`UNIQUE(voting_round_id, voter_key_hash, candidate_id)`) and persistent rate limits (30 votes / 10m, 10 comments / 10m) trigger HTTP `429 Too Many Requests`.

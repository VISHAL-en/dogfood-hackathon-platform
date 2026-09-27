# DOGFOOD Hackathon Platform — Architecture

## Overview
DOGFOOD 2026 is an open-source, self-hostable hackathon management, submission, and evaluation portal. It operates completely offline with zero hosted/external cloud dependencies.

## Core Principles
* **Self-Contained Persistence**: Embedded SQLite via `better-sqlite3` with WAL mode and foreign key enforcement enabled.
* **Server-Side Authorization**: Complete RBAC enforced in Express middleware (`requireAuth`, `requireRole`, team captain checks). No client-side trust.
* **Server Clock Authority**: All deadline checks, submission timestamps, and event lifecycle transitions use server UTC timestamps (`Date.now()`).
* **Design Truth Preservation**: The Stitch bundle in `stitch_dogfood_hackathon_platform_portal/` remains untouched as the visual baseline.

## Submission & Gallery System (Step 6)

### Lifecycle
1. **Draft Creation (`POST /events/:eventId/teams/:teamId/submission` or `POST /submissions`)**:
   - Only the team captain can create the submission.
   - Enforces single submission per team per event (`UNIQUE(event_id, team_id)`).
   - Validates that the event is open and current server time $\le$ `submission_deadline`.
   - Initial state: `status = 'draft'`, `submitted_at = null`.
2. **Draft Editing (`PATCH /submissions/:submissionId`)**:
   - Only team captain (or admin) can edit.
   - Allowed while current server time $\le$ `submission_deadline` and event status is active.
3. **Project Finalization (`POST /submissions/:submissionId/submit`)**:
   - Only team captain can submit.
   - Transitions `status = 'submitted'`.
   - Assigns immutable server UTC timestamp to `submitted_at`.
4. **Public Gallery (`GET /gallery`)**:
   - Publicly accessible without authentication.
   - Strictly exposes `submitted` projects from public events.
   - Draft submissions and private events are never returned.
   - Supports case-insensitive text search (`title`, `short_description`, `description`).
   - Supports filtering by event ID/slug and track ID/slug.
   - Bounded pagination (`page`, `limit` capped at 50).
5. **Project Detail (`GET /gallery/:idOrSlug`)**:
   - Publicly accessible without authentication.
   - Returns public project metadata, track info, event info, and public team member names/roles.
   - Strictly omits internal user credentials, session hashes, and audit tokens.

## Judging Foundation & Score Isolation (Step 7)

### Core Components
1. **Rubrics (`POST /events/:eventId/judging/rubrics`, `POST .../activate`)**:
   - Standardized weighted criteria (summing to 100 for active rubrics).
   - Three-state lifecycle: `draft` -> `active` -> `locked`.
2. **Assignments (`POST /events/:eventId/judging/assignments`)**:
   - Created exclusively by organizers or administrators.
   - Links a judge to a submitted project (`UNIQUE(judge_id, submission_id)`).
   - State: `assigned` -> `completed`.
3. **Score Submission (`PUT /judge/assignments/:assignmentId/scores`)**:
   - Strictly scoped to the authenticated judge (`assignment.judge_id === req.user.id`).
   - Validates bounds ($0 \le \text{score} \le \text{max\_score}$).
   - Computes server-side weighted score deterministically.
4. **Backend Judge Isolation**:
   - Judge endpoints (`GET /judge/scores`, `GET /judge/assignments`) constrain all queries by `judge_id = req.user.id`.
   - Peer scores endpoint (`GET /judge/scores/peer`) rejects non-authorized requests with `403 Forbidden`.
5. **Organizer Progress (`GET /events/:eventId/judging/progress`)**:
   - Aggregate metrics without leaking individual judge peer scores.
6. **CSV Export (`GET /exports/scores.csv`)**:
   - Restricted to organizers and admins (`Content-Type: text/csv`).
   - Automated sanitization against CSV formula injection (`=`, `+`, `-`, `@`).

## Cross-Judge Normalization & Proof/Audit Backend (Step 8)

The normalization engine operates as a strictly pure, non-destructive analytical pipeline.

### Processing Pipeline Flow

```text
Raw Judge Scores (judge_scores)
       ↓
Eligibility Filter (status = submitted, completed assignments, active rubric)
       ↓
Per-Judge / Per-Criterion Statistics (mean, population stddev, zero-variance check)
       ↓
Z-Score Normalization ((score - mean) / stddev, fallback z = 0 on zero variance)
       ↓
Rubric Weighting (weighted_z = z * weight / 100)
       ↓
Cross-Judge Aggregation (arithmetic mean across eligible judge contributions)
       ↓
0–100 Presentation Transformation (clamp(50 + aggregate_z * 10, 0, 100))
       ↓
Immutable Normalization Run (normalization_runs + normalization_results + scores)
       ↓
Proof Metadata + Canonical SHA-256 Hash (proof_hash)
```

### Data Layer Separation

* **Source Data (Historical Evidence)**:
  - `judge_scores`: The immutable ground truth. Normalization never updates, replaces, or mutates raw score records.
  - `submissions`: Validated submissions providing target metadata.
  - `rubrics` & `rubric_criteria`: Authoritative evaluation dimensions and weights.
  - `judge_assignments`: Verification of judge eligibility and completion status.
* **Derived Data (Analytical Results)**:
  - `normalization_results`: Per-judge, per-criterion, per-submission normalized $z$-scores and weighted contributions.
  - `normalization_submission_scores`: Project-level aggregate $z$-scores and scaled $0-100$ presentation scores.
  - Each normalization run produces a distinct, immutable set of derived records tied to that run's ID.
* **Audit Evidence (Cryptographic Proof)**:
  - `normalization_runs.metadata_json`: Deterministic canonical JSON containing input score counts, judge/criterion population statistics, zero-variance flags, and deterministic ordering.
  - `normalization_runs.proof_hash`: SHA-256 digest of the canonical proof string.
  - Re-computable on demand via `POST /events/:eventId/judging/normalization/:runId/verify` to verify that scoring data and proof metadata have not been altered.

## T3 Community Voting & Anti-Abuse System (Step 10)

Community voting operates as a distinct, public-facing evaluation layer completely isolated from the internal judge scoring and normalization engine.

### Core Architectural Principles
1. **Complete Data & Authorization Isolation**:
   - Community voting operates on its own dedicated tables (`voting_rounds`, `voting_candidates`, `voting_ballots`, `ballot_candidates`, `community_votes`, `community_comments`, `voting_rate_limits`, `voting_audit_log`).
   - Public voters never query normalization internals or raw judge scores.
   - Internal judge normalization routes (`GET /events/:eventId/judging/normalization/:runId/results`) remain strictly restricted to organizers and admins.

2. **Authoritative Server Time & Identity**:
   - The server clock is strictly authoritative. Client-supplied timestamps or voter identifiers from JSON request bodies are never trusted.
   - Voter identity is derived server-side via a high-entropy 256-bit token issued as an `HttpOnly`, `SameSite=Lax` cookie (`voter_token`) or custom `X-Voter-Token` header.
   - SQLite stores only the cryptographic SHA-256 hash of the token (`voter_key_hash`), preserving voter privacy and omitting raw IPs or device identifiers.

3. **Voting Lifecycle**:
   - Strict unidirectional state machine: `draft` → `voting_open` → `voting_closed` → `results_published`.
   - `draft`: Organizer/admin can configure eligible candidates from submitted event projects. Ballots and votes are unavailable.
   - `voting_open`: Public ballots can be created/retrieved, community votes can be cast, and public comments can be submitted.
   - `voting_closed`: Voting and new comments are closed. Results remain strictly hidden.
   - `results_published`: Community voting aggregates become public.
   - Only one active voting round (`draft`, `voting_open`, or `voting_closed`) may exist per event.

4. **Randomized Ballots & Position Bias Mitigation**:
   - To eliminate position bias when community members evaluate projects, ballots are shuffled server-side using native cryptographic randomness (`crypto.randomInt` and Fisher-Yates).
   - The resulting permutation order is persisted in `ballot_candidates(ballot_id, candidate_id, position)`.
   - Subsequent ballot requests by the same voter return the identical stable ordering. Client-supplied ordering arrays are rejected.

5. **Anti-Abuse Defense-in-Depth**:
   - **Duplicate Prevention**: SQLite unique constraint `UNIQUE(voting_round_id, voter_key_hash, candidate_id)` enforces one vote per project per voter. Voters may vote for multiple distinct projects on their ballot.
   - **Persistent Rate Limiting**: Managed via `voting_rate_limits` in SQLite across 10-minute deterministic windows (30 votes / 10m, 10 comments / 10m). Exceeding the limit returns HTTP `429 Too Many Requests`.
   - **Audit Trail**: High-risk actions (`voting_round_created`, `voting_round_opened`, `ballot_created`, `vote_cast`, `duplicate_vote_rejected`, `vote_rate_limited`, `comment_created`, `comment_hidden`, `comment_deleted`, `voting_round_closed`, `results_published`) are logged to `voting_audit_log` with sanitized metadata.

6. **Public Result Boundary (Anti-Anchoring)**:
   - `GET /events/:eventId/voting/:roundId/results` returns HTTP `403 Forbidden` while the round is in `draft`, `voting_open`, or `voting_closed`.
   - When `results_published`, it returns community aggregates only (`submissionId`, `title`, `slug`, `teamName`, `voteCount`, `rank`).
   - Zero judge scores, normalization $z$-scores, or judge identities are ever exposed.

7. **Community Comments & Moderation**:
   - Supports feedback on candidate submissions with strict size limits (max 1000 characters).
   - Comment statuses: `visible`, `hidden`, `deleted`.
   - Public comment queries strictly exclude hidden and deleted comments.
   - Comment authors can delete their own comments; event organizers and admins can moderate (hide/delete) comments.

> Note: T3 frontend pages are intentionally deferred to subsequent steps. Step 10 provides the complete backend and database foundation.

# DOGFOOD Hackathon Platform — Data Model

SQLite schema specification for the self-hosted DOGFOOD platform.

## Entities

### `users`
* `id TEXT PRIMARY KEY`: Prefixed user identifier (e.g., `usr_...`).
* `email TEXT UNIQUE NOT NULL COLLATE NOCASE`: User email address.
* `name TEXT NOT NULL`: Full display name.
* `role TEXT NOT NULL CHECK(role IN ('visitor', 'participant', 'judge', 'organizer', 'admin'))`.
* `password_hash TEXT NOT NULL`: Scrypt-hashed password format (`salt:hash`).
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `updated_at TEXT NOT NULL`: ISO 8601 UTC timestamp.

### `sessions`
* `id TEXT PRIMARY KEY`: Prefixed session identifier (`sess_...`).
* `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`.
* `token_hash TEXT UNIQUE NOT NULL`: SHA-256 hash of plaintext bearer/cookie token.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `expires_at TEXT NOT NULL`: ISO 8601 UTC timestamp.

### `events`
* `id TEXT PRIMARY KEY`: Prefixed event identifier (`event_...`).
* `organizer_id TEXT NOT NULL REFERENCES users(id)`.
* `name TEXT NOT NULL`: Event title.
* `slug TEXT UNIQUE NOT NULL COLLATE NOCASE`: URL-friendly unique event slug.
* `description TEXT NOT NULL`: Event description.
* `status TEXT NOT NULL CHECK(status IN ('draft', 'published', 'registration_open', 'registration_closed', 'judging_open', 'judging_closed', 'results_published', 'archived'))`.
* `registration_start TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `registration_end TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `submission_deadline TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `judging_start TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `judging_end TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `results_publish_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `updated_at TEXT NOT NULL`: ISO 8601 UTC timestamp.

### `event_tracks`
* `id TEXT PRIMARY KEY`: Prefixed track identifier (`track_...`).
* `event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE`.
* `name TEXT NOT NULL`: Track name.
* `slug TEXT NOT NULL COLLATE NOCASE`: URL-friendly track slug.
* `description TEXT NOT NULL`: Track scope and focus.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `updated_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* Constraints: `UNIQUE(event_id, slug)`, `UNIQUE(event_id, name)`.

### `event_prizes`
* `id TEXT PRIMARY KEY`: Prefixed prize identifier (`prize_...`).
* `event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE`.
* `name TEXT NOT NULL`: Prize name.
* `description TEXT NOT NULL`: Prize criteria.
* `amount INTEGER NOT NULL CHECK(amount >= 0)`: Cash value in whole units.
* `currency TEXT NOT NULL DEFAULT 'USD'`: ISO 4217 currency code.
* `position INTEGER NOT NULL DEFAULT 0`: Sort order position.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `updated_at TEXT NOT NULL`: ISO 8601 UTC timestamp.

### `teams`
* `id TEXT PRIMARY KEY`: Prefixed team identifier (`team_...`).
* `event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE`.
* `name TEXT NOT NULL`: Team name.
* `slug TEXT NOT NULL COLLATE NOCASE`: URL-friendly team slug.
* `created_by TEXT NOT NULL REFERENCES users(id)`: User who founded the team.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `updated_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* Constraints: `UNIQUE(event_id, name)`, `UNIQUE(event_id, slug)`.

### `team_members`
* `id TEXT PRIMARY KEY`: Prefixed membership identifier (`tm_...`).
* `team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE`.
* `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`.
* `event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE`.
* `role TEXT NOT NULL CHECK(role IN ('captain', 'member'))`.
* `joined_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* Constraints: `UNIQUE(team_id, user_id)`, `UNIQUE(event_id, user_id)`.

### `team_invitations`
* `id TEXT PRIMARY KEY`: Prefixed invite identifier (`inv_...`).
* `team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE`.
* `invited_by TEXT NOT NULL REFERENCES users(id)`.
* `token_hash TEXT UNIQUE NOT NULL`: SHA-256 hash of plaintext invite token.
* `expires_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'revoked', 'expired'))`.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `accepted_at TEXT`: ISO 8601 UTC timestamp when accepted.
* `accepted_by TEXT REFERENCES users(id)`.

### `submissions`
* `id TEXT PRIMARY KEY`: Prefixed submission identifier (`sub_...`).
* `event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE`.
* `team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE`.
* `track_id TEXT REFERENCES event_tracks(id) ON DELETE SET NULL`.
* `title TEXT NOT NULL`: Submission title (non-empty, non-whitespace).
* `slug TEXT NOT NULL`: URL-safe normalized slug, unique per event.
* `short_description TEXT NOT NULL`: High-level summary for gallery previews.
* `description TEXT NOT NULL`: Full markdown project documentation.
* `repo_url TEXT`: Valid http:// or https:// code repository URL.
* `demo_url TEXT`: Valid http:// or https:// live demo URL.
* `video_url TEXT`: Valid http:// or https:// presentation video URL.
* `status TEXT NOT NULL CHECK(status IN ('draft', 'submitted'))`.
* `submitted_at TEXT`: ISO 8601 UTC timestamp assigned by server on finalization.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `updated_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* Constraints: `UNIQUE(event_id, team_id)`, `UNIQUE(event_id, slug)`.

### `judge_assignments`
* `id TEXT PRIMARY KEY`: Prefixed assignment identifier (`asgn_...`).
* `event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE`.
* `judge_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`.
* `submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE`.
* `status TEXT NOT NULL CHECK(status IN ('assigned', 'completed'))`.
* `assigned_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `updated_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* Constraints: `UNIQUE(judge_id, submission_id)`.

### `judge_invitations`
* `id TEXT PRIMARY KEY`: Prefixed identifier (`jinv_...`).
* `event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE`.
* `email TEXT`: Optional target judge email.
* `token_hash TEXT UNIQUE NOT NULL`: SHA-256 hash of plaintext invite token.
* `expires_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'revoked', 'expired'))`.
* `invited_by TEXT NOT NULL REFERENCES users(id)`.
* `accepted_at TEXT`: ISO 8601 UTC timestamp.
* `accepted_by TEXT REFERENCES users(id)`.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.

### `rubrics`
* `id TEXT PRIMARY KEY`: Prefixed rubric identifier (`rubric_...`).
* `event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE`.
* `name TEXT NOT NULL`: Display name.
* `description TEXT NOT NULL`: Evaluation guidelines.
* `version INTEGER NOT NULL DEFAULT 1`: Version increment.
* `status TEXT NOT NULL CHECK(status IN ('draft', 'active', 'locked'))`.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `updated_at TEXT NOT NULL`: ISO 8601 UTC timestamp.

### `rubric_criteria`
* `id TEXT PRIMARY KEY`: Prefixed criterion identifier (`crit_...`).
* `rubric_id TEXT NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE`.
* `name TEXT NOT NULL`: Criterion category title.
* `description TEXT NOT NULL`: Scoring instructions.
* `weight REAL NOT NULL CHECK(weight > 0)`: Relative weight (active rubric sum = 100).
* `max_score REAL NOT NULL CHECK(max_score > 0)`: Upper score limit.
* `position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0)`: Sort position.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `updated_at TEXT NOT NULL`: ISO 8601 UTC timestamp.

### `judge_scores`
* `id TEXT PRIMARY KEY`: Prefixed score identifier (`scr_...`).
* `assignment_id TEXT NOT NULL REFERENCES judge_assignments(id) ON DELETE CASCADE`.
* `criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE`.
* `judge_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`.
* `submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE`.
* `score REAL NOT NULL CHECK(score >= 0)`: Raw criterion score.
* `comment TEXT`: Optional evaluation remarks.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `updated_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* Constraints: `UNIQUE(assignment_id, criterion_id)`.

### `normalization_runs`
* `id TEXT PRIMARY KEY`: Prefixed run identifier (`nrun_...`).
* `event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE`: Target hackathon event.
* `rubric_id TEXT NOT NULL REFERENCES rubrics(id)`: Rubric utilized for evaluation.
* `method TEXT NOT NULL`: Normalization algorithm (`zscore`).
* `method_version TEXT NOT NULL`: Algorithm version identifier (`zscore-population-v1`).
* `status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed'))`: Execution lifecycle state.
* `created_by TEXT NOT NULL REFERENCES users(id)`: Organizer or admin who initiated the run.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `completed_at TEXT`: ISO 8601 UTC timestamp of execution completion.
* `input_score_count INTEGER NOT NULL`: Total count of eligible raw scores processed.
* `judge_count INTEGER NOT NULL`: Count of distinct eligible judges contributing.
* `submission_count INTEGER NOT NULL`: Count of distinct eligible submissions evaluated.
* `proof_hash TEXT`: SHA-256 cryptographic digest computed over canonical proof metadata.
* `metadata_json TEXT`: Canonical JSON payload containing deterministic audit and statistical evidence.
* `error_message TEXT`: Safe error message recorded if the run failed.
* Invariants: Immutable once marked `completed`. Re-running normalization creates a separate new run record.

### `normalization_results`
* `id TEXT PRIMARY KEY`: Prefixed result identifier (`nres_...`).
* `normalization_run_id TEXT NOT NULL REFERENCES normalization_runs(id) ON DELETE CASCADE`.
* `judge_id TEXT NOT NULL REFERENCES users(id)`: Judge who submitted the evaluated score.
* `submission_id TEXT NOT NULL REFERENCES submissions(id)`: Evaluated project submission.
* `criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id)`: Evaluated rubric dimension.
* `raw_score REAL NOT NULL`: Immutable copy of raw score for audit traceability.
* `judge_mean REAL NOT NULL`: Population mean $\mu$ for that judge and criterion across eligible submissions.
* `judge_stddev REAL NOT NULL`: Population standard deviation $\sigma$ (0 in zero-variance fallback).
* `z_score REAL NOT NULL`: Normalized z-score $(s - \mu) / \sigma$ (or $0$ on zero variance).
* `criterion_weight REAL NOT NULL`: Rubric weight $w_i$.
* `weighted_normalized_score REAL NOT NULL`: Criterion weighted contribution $z \times (w_i / 100)$.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* Constraints: `UNIQUE(normalization_run_id, judge_id, submission_id, criterion_id)`.
* Invariants: Fully derived and immutable. Never modifies or replaces records in `judge_scores`.

### `normalization_submission_scores`
* `id TEXT PRIMARY KEY`: Prefixed score identifier (`nsub_...`).
* `normalization_run_id TEXT NOT NULL REFERENCES normalization_runs(id) ON DELETE CASCADE`.
* `submission_id TEXT NOT NULL REFERENCES submissions(id)`: Project submission.
* `aggregate_z REAL NOT NULL`: Arithmetic mean of all eligible judge weighted z-score contributions.
* `presentation_score REAL NOT NULL`: Scaled 0–100 score $\text{clamp}(50 + (\text{aggregate\_z} \times 10), 0, 100)$.
* `judge_count INTEGER NOT NULL`: Number of distinct eligible judges evaluating the submission.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* Constraints: `UNIQUE(normalization_run_id, submission_id)`.

## T3 Community Voting Entities (Step 10)

### `voting_rounds`
* `id TEXT PRIMARY KEY`: Prefixed voting round identifier (`vround_...`).
* `event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE`.
* `status TEXT NOT NULL CHECK(status IN ('draft', 'voting_open', 'voting_closed', 'results_published'))`.
* `starts_at TEXT`: ISO 8601 UTC timestamp when voting opens.
* `ends_at TEXT`: ISO 8601 UTC timestamp when voting closes.
* `results_published_at TEXT`: ISO 8601 UTC timestamp when results are officially published.
* `created_by TEXT NOT NULL REFERENCES users(id)`: Organizer or admin who created the round.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `updated_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* Constraints: `CHECK(starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at)`.
* Partial Index: `UNIQUE(event_id) WHERE status IN ('draft', 'voting_open', 'voting_closed')` ensures only one active voting round per event.

### `voting_candidates`
* `id TEXT PRIMARY KEY`: Prefixed candidate identifier (`vcand_...`).
* `voting_round_id TEXT NOT NULL REFERENCES voting_rounds(id) ON DELETE CASCADE`.
* `submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE`.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* Constraints: `UNIQUE(voting_round_id, submission_id)`. Submissions must belong to the same event and have `status = 'submitted'`.

### `voting_ballots`
* `id TEXT PRIMARY KEY`: Prefixed ballot identifier (`vballot_...`).
* `voting_round_id TEXT NOT NULL REFERENCES voting_rounds(id) ON DELETE CASCADE`.
* `voter_key_hash TEXT NOT NULL`: SHA-256 hash of the 256-bit server voter token. Never stores raw token or IP address.
* `ordering_seed TEXT NOT NULL`: Cryptographic seed generated at ballot initialization.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `last_activity_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* Constraints: `UNIQUE(voting_round_id, voter_key_hash)`.

### `ballot_candidates`
* `id TEXT PRIMARY KEY`: Prefixed candidate order identifier (`bcand_...`).
* `ballot_id TEXT NOT NULL REFERENCES voting_ballots(id) ON DELETE CASCADE`.
* `candidate_id TEXT NOT NULL REFERENCES voting_candidates(id) ON DELETE CASCADE`.
* `position INTEGER NOT NULL`: 0-indexed randomized display position.
* Constraints: `UNIQUE(ballot_id, candidate_id)`, `UNIQUE(ballot_id, position)`.
* Purpose: Persists cryptographic Fisher-Yates shuffle to reduce position bias while ensuring voter ballot stability.

### `community_votes`
* `id TEXT PRIMARY KEY`: Prefixed vote identifier (`cvote_...`).
* `voting_round_id TEXT NOT NULL REFERENCES voting_rounds(id) ON DELETE CASCADE`.
* `ballot_id TEXT NOT NULL REFERENCES voting_ballots(id) ON DELETE CASCADE`.
* `candidate_id TEXT NOT NULL REFERENCES voting_candidates(id) ON DELETE CASCADE`.
* `voter_key_hash TEXT NOT NULL`: SHA-256 hash of voter token.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* Constraints: `UNIQUE(voting_round_id, voter_key_hash, candidate_id)`.
* Rule: Exactly one vote per project per voter, permitting multi-vote community ballots.

### `community_comments`
* `id TEXT PRIMARY KEY`: Prefixed comment identifier (`ccomment_...`).
* `voting_round_id TEXT NOT NULL REFERENCES voting_rounds(id) ON DELETE CASCADE`.
* `submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE`.
* `author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`: Nullable authenticated author ID.
* `author_display_name TEXT NOT NULL`: Sanitized display name (max 100 characters).
* `body TEXT NOT NULL`: Comment text content (1–1000 characters).
* `status TEXT NOT NULL CHECK(status IN ('visible', 'hidden', 'deleted')) DEFAULT 'visible'`.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* `updated_at TEXT NOT NULL`: ISO 8601 UTC timestamp.

### `voting_rate_limits`
* `id TEXT PRIMARY KEY`: Prefixed rate limit identifier (`vrl_...`).
* `voting_round_id TEXT NOT NULL REFERENCES voting_rounds(id) ON DELETE CASCADE`.
* `action TEXT NOT NULL`: Rate limited action (`vote` or `comment`).
* `actor_key_hash TEXT NOT NULL`: SHA-256 hash of actor/voter token.
* `window_started_at TEXT NOT NULL`: ISO 8601 UTC timestamp aligned to 10-minute deterministic intervals.
* `request_count INTEGER NOT NULL DEFAULT 1`: Number of requests recorded in current window.
* `updated_at TEXT NOT NULL`: ISO 8601 UTC timestamp.
* Constraints: `UNIQUE(voting_round_id, action, actor_key_hash, window_started_at)`.
* Limits: 30 requests per 10 minutes for votes; 10 requests per 10 minutes for comments. Returns HTTP 429 when exceeded.

### `voting_audit_log`
* `id TEXT PRIMARY KEY`: Prefixed audit log identifier (`vlog_...`).
* `voting_round_id TEXT REFERENCES voting_rounds(id) ON DELETE SET NULL`.
* `actor_key_hash TEXT`: Cryptographic hash of voter/actor token (nullable).
* `actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL`: Authenticated user ID if present (nullable).
* `action TEXT NOT NULL`: Security-sensitive action descriptor.
* `target_type TEXT NOT NULL`: Target entity type (e.g. `voting_round`, `community_vote`, `community_comment`).
* `target_id TEXT NOT NULL`: ID of target entity.
* `metadata_json TEXT`: Bounded and sanitized JSON payload.
* `created_at TEXT NOT NULL`: ISO 8601 UTC timestamp.

import Database from 'better-sqlite3';

/**
 * Runs SQLite schema migrations for the platform.
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('visitor', 'participant', 'judge', 'organizer', 'admin')),
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      organizer_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL COLLATE NOCASE,
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN (
        'draft', 'published', 'registration_open', 'registration_closed',
        'judging_open', 'judging_closed', 'results_published', 'archived'
      )),
      registration_start TEXT NOT NULL,
      registration_end TEXT NOT NULL,
      submission_deadline TEXT NOT NULL,
      judging_start TEXT NOT NULL,
      judging_end TEXT NOT NULL,
      results_publish_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
    CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
    CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

    CREATE TABLE IF NOT EXISTS event_tracks (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL COLLATE NOCASE,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(event_id, slug),
      UNIQUE(event_id, name)
    );

    CREATE INDEX IF NOT EXISTS idx_event_tracks_event ON event_tracks(event_id);

    CREATE TABLE IF NOT EXISTS event_prizes (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount >= 0),
      currency TEXT NOT NULL DEFAULT 'USD',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_event_prizes_event ON event_prizes(event_id);

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL COLLATE NOCASE,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(event_id, name),
      UNIQUE(event_id, slug)
    );

    CREATE INDEX IF NOT EXISTS idx_teams_event ON teams(event_id);
    CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('captain', 'member')),
      joined_at TEXT NOT NULL,
      UNIQUE(team_id, user_id),
      UNIQUE(event_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_event ON team_members(event_id);

    CREATE TABLE IF NOT EXISTS team_invitations (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      invited_by TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'revoked', 'expired')),
      created_at TEXT NOT NULL,
      accepted_at TEXT,
      accepted_by TEXT REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token_hash);
    CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(team_id);

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      track_id TEXT REFERENCES event_tracks(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      short_description TEXT NOT NULL,
      description TEXT NOT NULL,
      repo_url TEXT,
      demo_url TEXT,
      video_url TEXT,
      status TEXT NOT NULL CHECK(status IN ('draft', 'submitted')),
      submitted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(event_id, team_id),
      UNIQUE(event_id, slug)
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_event ON submissions(event_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_team ON submissions(team_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_track ON submissions(track_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
    CREATE INDEX IF NOT EXISTS idx_submissions_slug ON submissions(slug);

    CREATE TABLE IF NOT EXISTS judge_assignments (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      judge_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('assigned', 'completed')),
      assigned_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(judge_id, submission_id)
    );

    CREATE INDEX IF NOT EXISTS idx_judge_assignments_event ON judge_assignments(event_id);
    CREATE INDEX IF NOT EXISTS idx_judge_assignments_judge ON judge_assignments(judge_id);
    CREATE INDEX IF NOT EXISTS idx_judge_assignments_submission ON judge_assignments(submission_id);
    CREATE INDEX IF NOT EXISTS idx_judge_assignments_status ON judge_assignments(status);

    CREATE TABLE IF NOT EXISTS judge_invitations (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      email TEXT,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'revoked', 'expired')),
      invited_by TEXT NOT NULL REFERENCES users(id),
      accepted_at TEXT,
      accepted_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_judge_invitations_token ON judge_invitations(token_hash);
    CREATE INDEX IF NOT EXISTS idx_judge_invitations_event ON judge_invitations(event_id);

    CREATE TABLE IF NOT EXISTS rubrics (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL CHECK(status IN ('draft', 'active', 'locked')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rubrics_event ON rubrics(event_id);
    CREATE INDEX IF NOT EXISTS idx_rubrics_status ON rubrics(status);

    CREATE TABLE IF NOT EXISTS rubric_criteria (
      id TEXT PRIMARY KEY,
      rubric_id TEXT NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      weight REAL NOT NULL CHECK(weight > 0),
      max_score REAL NOT NULL CHECK(max_score > 0),
      position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric ON rubric_criteria(rubric_id);

    CREATE TABLE IF NOT EXISTS judge_scores (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES judge_assignments(id) ON DELETE CASCADE,
      criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
      judge_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      score REAL NOT NULL CHECK(score >= 0),
      comment TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(assignment_id, criterion_id)
    );

    CREATE INDEX IF NOT EXISTS idx_judge_scores_assignment ON judge_scores(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_judge_scores_judge ON judge_scores(judge_id);
    CREATE INDEX IF NOT EXISTS idx_judge_scores_submission ON judge_scores(submission_id);
    CREATE INDEX IF NOT EXISTS idx_judge_scores_criterion ON judge_scores(criterion_id);

    CREATE TABLE IF NOT EXISTS normalization_runs (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      rubric_id TEXT NOT NULL REFERENCES rubrics(id),
      method TEXT NOT NULL,
      method_version TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      completed_at TEXT,
      input_score_count INTEGER NOT NULL,
      judge_count INTEGER NOT NULL,
      submission_count INTEGER NOT NULL,
      proof_hash TEXT,
      metadata_json TEXT,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_norm_runs_event ON normalization_runs(event_id);
    CREATE INDEX IF NOT EXISTS idx_norm_runs_status ON normalization_runs(status);

    CREATE TABLE IF NOT EXISTS normalization_results (
      id TEXT PRIMARY KEY,
      normalization_run_id TEXT NOT NULL REFERENCES normalization_runs(id) ON DELETE CASCADE,
      judge_id TEXT NOT NULL REFERENCES users(id),
      submission_id TEXT NOT NULL REFERENCES submissions(id),
      criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id),
      raw_score REAL NOT NULL,
      judge_mean REAL NOT NULL,
      judge_stddev REAL NOT NULL,
      z_score REAL NOT NULL,
      criterion_weight REAL NOT NULL,
      weighted_normalized_score REAL NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(normalization_run_id, judge_id, submission_id, criterion_id)
    );

    CREATE INDEX IF NOT EXISTS idx_norm_results_run ON normalization_results(normalization_run_id);
    CREATE INDEX IF NOT EXISTS idx_norm_results_judge ON normalization_results(judge_id);
    CREATE INDEX IF NOT EXISTS idx_norm_results_sub ON normalization_results(submission_id);
    CREATE INDEX IF NOT EXISTS idx_norm_results_crit ON normalization_results(criterion_id);

    CREATE TABLE IF NOT EXISTS normalization_submission_scores (
      id TEXT PRIMARY KEY,
      normalization_run_id TEXT NOT NULL REFERENCES normalization_runs(id) ON DELETE CASCADE,
      submission_id TEXT NOT NULL REFERENCES submissions(id),
      aggregate_z REAL NOT NULL,
      presentation_score REAL NOT NULL,
      judge_count INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(normalization_run_id, submission_id)
    );

    CREATE INDEX IF NOT EXISTS idx_norm_sub_scores_run ON normalization_submission_scores(normalization_run_id);
    CREATE INDEX IF NOT EXISTS idx_norm_sub_scores_sub ON normalization_submission_scores(submission_id);

    -- ------------------------------------------------------------------------
    -- T3 COMMUNITY VOTING & ANTI-ABUSE TABLES
    -- ------------------------------------------------------------------------

    CREATE TABLE IF NOT EXISTS voting_rounds (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('draft', 'voting_open', 'voting_closed', 'results_published')),
      starts_at TEXT,
      ends_at TEXT,
      results_published_at TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK(starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at)
    );

    CREATE INDEX IF NOT EXISTS idx_voting_rounds_event ON voting_rounds(event_id);
    CREATE INDEX IF NOT EXISTS idx_voting_rounds_status ON voting_rounds(status);

    -- Enforce only one active voting round per event
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_voting_round
    ON voting_rounds(event_id)
    WHERE status IN ('draft', 'voting_open', 'voting_closed');

    CREATE TABLE IF NOT EXISTS voting_candidates (
      id TEXT PRIMARY KEY,
      voting_round_id TEXT NOT NULL REFERENCES voting_rounds(id) ON DELETE CASCADE,
      submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE(voting_round_id, submission_id)
    );

    CREATE INDEX IF NOT EXISTS idx_voting_candidates_round ON voting_candidates(voting_round_id);
    CREATE INDEX IF NOT EXISTS idx_voting_candidates_submission ON voting_candidates(submission_id);

    CREATE TABLE IF NOT EXISTS voting_ballots (
      id TEXT PRIMARY KEY,
      voting_round_id TEXT NOT NULL REFERENCES voting_rounds(id) ON DELETE CASCADE,
      voter_key_hash TEXT NOT NULL,
      ordering_seed TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_activity_at TEXT NOT NULL,
      UNIQUE(voting_round_id, voter_key_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_voting_ballots_round ON voting_ballots(voting_round_id);
    CREATE INDEX IF NOT EXISTS idx_voting_ballots_voter ON voting_ballots(voter_key_hash);

    CREATE TABLE IF NOT EXISTS ballot_candidates (
      id TEXT PRIMARY KEY,
      ballot_id TEXT NOT NULL REFERENCES voting_ballots(id) ON DELETE CASCADE,
      candidate_id TEXT NOT NULL REFERENCES voting_candidates(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      UNIQUE(ballot_id, candidate_id),
      UNIQUE(ballot_id, position)
    );

    CREATE INDEX IF NOT EXISTS idx_ballot_candidates_ballot ON ballot_candidates(ballot_id);
    CREATE INDEX IF NOT EXISTS idx_ballot_candidates_candidate ON ballot_candidates(candidate_id);

    CREATE TABLE IF NOT EXISTS community_votes (
      id TEXT PRIMARY KEY,
      voting_round_id TEXT NOT NULL REFERENCES voting_rounds(id) ON DELETE CASCADE,
      ballot_id TEXT NOT NULL REFERENCES voting_ballots(id) ON DELETE CASCADE,
      candidate_id TEXT NOT NULL REFERENCES voting_candidates(id) ON DELETE CASCADE,
      voter_key_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(voting_round_id, voter_key_hash, candidate_id)
    );

    CREATE INDEX IF NOT EXISTS idx_community_votes_round ON community_votes(voting_round_id);
    CREATE INDEX IF NOT EXISTS idx_community_votes_ballot ON community_votes(ballot_id);
    CREATE INDEX IF NOT EXISTS idx_community_votes_candidate ON community_votes(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_community_votes_voter ON community_votes(voter_key_hash);

    CREATE TABLE IF NOT EXISTS community_comments (
      id TEXT PRIMARY KEY,
      voting_round_id TEXT NOT NULL REFERENCES voting_rounds(id) ON DELETE CASCADE,
      submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      author_display_name TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('visible', 'hidden', 'deleted')) DEFAULT 'visible',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_community_comments_round ON community_comments(voting_round_id);
    CREATE INDEX IF NOT EXISTS idx_community_comments_sub ON community_comments(submission_id);
    CREATE INDEX IF NOT EXISTS idx_community_comments_status ON community_comments(status);

    CREATE TABLE IF NOT EXISTS voting_rate_limits (
      id TEXT PRIMARY KEY,
      voting_round_id TEXT NOT NULL REFERENCES voting_rounds(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      actor_key_hash TEXT NOT NULL,
      window_started_at TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      UNIQUE(voting_round_id, action, actor_key_hash, window_started_at)
    );

    CREATE INDEX IF NOT EXISTS idx_voting_rate_limits_lookup ON voting_rate_limits(voting_round_id, action, actor_key_hash);
    CREATE INDEX IF NOT EXISTS idx_voting_rate_limits_window ON voting_rate_limits(window_started_at);

    CREATE TABLE IF NOT EXISTS voting_audit_log (
      id TEXT PRIMARY KEY,
      voting_round_id TEXT REFERENCES voting_rounds(id) ON DELETE SET NULL,
      actor_key_hash TEXT,
      actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_voting_audit_round ON voting_audit_log(voting_round_id);
    CREATE INDEX IF NOT EXISTS idx_voting_audit_action ON voting_audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_voting_audit_created ON voting_audit_log(created_at);
  `);
}

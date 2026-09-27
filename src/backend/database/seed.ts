import Database from 'better-sqlite3';
import { hashPassword, hashSessionToken } from '../utils/crypto';
import { UserRole, EventStatus, TeamMemberRole, InvitationStatus } from '../../shared/types';

export interface SeedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password: string;
  seedToken: string;
}

export interface SeedTrack {
  id: string;
  eventId: string;
  name: string;
  slug: string;
  description: string;
}

export interface SeedPrize {
  id: string;
  eventId: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  position: number;
}

export interface SeedEvent {
  id: string;
  organizerId: string;
  name: string;
  slug: string;
  description: string;
  status: EventStatus;
  registrationStart: string;
  registrationEnd: string;
  submissionDeadline: string;
  judgingStart: string;
  judgingEnd: string;
  resultsPublishAt: string;
  tracks: SeedTrack[];
  prizes: SeedPrize[];
}

export interface SeedTeamMember {
  id: string;
  teamId: string;
  userId: string;
  eventId: string;
  role: TeamMemberRole;
}

export interface SeedTeamInvitation {
  id: string;
  teamId: string;
  invitedBy: string;
  tokenHash: string;
  seedToken: string;
  status: InvitationStatus;
}

export interface SeedTeam {
  id: string;
  eventId: string;
  name: string;
  slug: string;
  createdBy: string;
  members: SeedTeamMember[];
  invitations: SeedTeamInvitation[];
}

export interface SeedSubmission {
  id: string;
  eventId: string;
  teamId: string;
  trackId: string | null;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  repoUrl: string | null;
  demoUrl: string | null;
  videoUrl: string | null;
  status: 'draft' | 'submitted';
  submittedAt: string | null;
}

export interface SeedRubricCriterion {
  id: string;
  rubricId: string;
  name: string;
  description: string;
  weight: number;
  maxScore: number;
  position: number;
}

export interface SeedRubric {
  id: string;
  eventId: string;
  name: string;
  description: string;
  version: number;
  status: 'draft' | 'active' | 'locked';
  criteria: SeedRubricCriterion[];
}

export interface SeedJudgeAssignment {
  id: string;
  eventId: string;
  judgeId: string;
  submissionId: string;
  status: 'assigned' | 'completed';
  assignedAt: string;
}

export interface SeedJudgeScore {
  id: string;
  assignmentId: string;
  criterionId: string;
  judgeId: string;
  submissionId: string;
  score: number;
  comment: string | null;
}

export const SEED_USERS: SeedUser[] = [
  {
    id: 'usr_organizer_001',
    email: 'organizer@dogfood.local',
    name: 'Lead Organizer',
    role: 'organizer',
    password: 'OrganizerPassword123!',
    seedToken: 'dogfood_token_organizer'
  },
  {
    id: 'usr_judge_a_001',
    email: 'judge_a@dogfood.local',
    name: 'Judge Alice',
    role: 'judge',
    password: 'JudgeAPassword123!',
    seedToken: 'dogfood_token_judge_a'
  },
  {
    id: 'usr_judge_b_001',
    email: 'judge_b@dogfood.local',
    name: 'Judge Bob',
    role: 'judge',
    password: 'JudgeBPassword123!',
    seedToken: 'dogfood_token_judge_b'
  },
  {
    id: 'usr_participant_001',
    email: 'participant@dogfood.local',
    name: 'Pat Participant',
    role: 'participant',
    password: 'ParticipantPassword123!',
    seedToken: 'dogfood_token_participant'
  },
  {
    id: 'usr_participant_002',
    email: 'participant2@dogfood.local',
    name: 'Sam Second',
    role: 'participant',
    password: 'Participant2Password123!',
    seedToken: 'dogfood_token_participant_2'
  },
  {
    id: 'usr_participant_003',
    email: 'participant3@dogfood.local',
    name: 'Taylor Third',
    role: 'participant',
    password: 'Participant3Password123!',
    seedToken: 'dogfood_token_participant_3'
  },
  {
    id: 'usr_participant_004',
    email: 'participant4@dogfood.local',
    name: 'Morgan Fourth',
    role: 'participant',
    password: 'Participant4Password123!',
    seedToken: 'dogfood_token_participant_4'
  },
  {
    id: 'usr_participant_005',
    email: 'participant5@dogfood.local',
    name: 'Casey Fifth',
    role: 'participant',
    password: 'Participant5Password123!',
    seedToken: 'dogfood_token_participant_5'
  },
  {
    id: 'usr_participant_006',
    email: 'participant6@dogfood.local',
    name: 'Robin Sixth',
    role: 'participant',
    password: 'Participant6Password123!',
    seedToken: 'dogfood_token_participant_6'
  },
  {
    id: 'usr_participant_007',
    email: 'participant7@dogfood.local',
    name: 'Alex Seventh',
    role: 'participant',
    password: 'Participant7Password123!',
    seedToken: 'dogfood_token_participant_7'
  },
  {
    id: 'usr_participant_008',
    email: 'participant8@dogfood.local',
    name: 'Jordan Eighth',
    role: 'participant',
    password: 'Participant8Password123!',
    seedToken: 'dogfood_token_participant_8'
  },
  {
    id: 'usr_admin_001',
    email: 'admin@dogfood.local',
    name: 'Platform Administrator',
    role: 'admin',
    password: 'AdminPassword123!',
    seedToken: 'dogfood_token_admin'
  }
];

export const SEED_EVENTS: SeedEvent[] = [
  {
    id: 'event_dogfood_2026',
    organizerId: 'usr_organizer_001',
    name: 'DOGFOOD Hackathon 2026',
    slug: 'dogfood-2026',
    description: 'The official self-hosted open-source hackathon evaluation tournament.',
    status: 'registration_open',
    registrationStart: '2026-09-01T00:00:00.000Z',
    registrationEnd: '2026-10-01T00:00:00.000Z',
    submissionDeadline: '2026-10-05T23:59:59.000Z',
    judgingStart: '2026-10-06T00:00:00.000Z',
    judgingEnd: '2026-10-10T23:59:59.000Z',
    resultsPublishAt: '2026-10-12T12:00:00.000Z',
    tracks: [
      {
        id: 'track_ai_agents',
        eventId: 'event_dogfood_2026',
        name: 'Autonomous Agents',
        slug: 'ai-agents',
        description: 'Agents with perception, reasoning, and tool invocation capabilities.'
      },
      {
        id: 'track_infra_systems',
        eventId: 'event_dogfood_2026',
        name: 'Systems & Infrastructure',
        slug: 'systems-infra',
        description: 'Resilient offline, self-hosted, distributed infrastructure.'
      },
      {
        id: 'track_developer_tooling',
        eventId: 'event_dogfood_2026',
        name: 'Developer Experience',
        slug: 'developer-tooling',
        description: 'Developer productivity suites, IDE plugins, and CLI automation.'
      }
    ],
    prizes: [
      {
        id: 'prize_grand',
        eventId: 'event_dogfood_2026',
        name: 'Grand Champion',
        description: 'First overall place across all tracks.',
        amount: 10000,
        currency: 'USD',
        position: 1
      },
      {
        id: 'prize_runner_up',
        eventId: 'event_dogfood_2026',
        name: 'Runner-Up',
        description: 'Second overall place.',
        amount: 5000,
        currency: 'USD',
        position: 2
      },
      {
        id: 'prize_track_winner',
        eventId: 'event_dogfood_2026',
        name: 'Track Winner',
        description: 'Highest scoring project in each designated track.',
        amount: 2500,
        currency: 'USD',
        position: 3
      }
    ]
  },
  {
    id: 'event_closed_fixture',
    organizerId: 'usr_organizer_001',
    name: 'Closed Retrospective Hackathon',
    slug: 'closed-hackathon',
    description: 'A past hackathon event with expired submission deadline for testing deadline enforcement.',
    status: 'judging_closed',
    registrationStart: '2026-01-01T00:00:00.000Z',
    registrationEnd: '2026-01-15T00:00:00.000Z',
    submissionDeadline: '2026-01-20T23:59:59.000Z',
    judgingStart: '2026-01-21T00:00:00.000Z',
    judgingEnd: '2026-01-25T23:59:59.000Z',
    resultsPublishAt: '2026-01-26T12:00:00.000Z',
    tracks: [
      {
        id: 'track_legacy_core',
        eventId: 'event_closed_fixture',
        name: 'Legacy Systems',
        slug: 'legacy-systems',
        description: 'Legacy software maintenance and evolution.'
      }
    ],
    prizes: [
      {
        id: 'prize_closed_first',
        eventId: 'event_closed_fixture',
        name: 'First Place',
        description: 'Top scoring historical project.',
        amount: 3000,
        currency: 'USD',
        position: 1
      }
    ]
  }
];

export const SEED_TEAMS: SeedTeam[] = [
  {
    id: 'team_alpha_001',
    eventId: 'event_dogfood_2026',
    name: 'Alpha Agents',
    slug: 'alpha-agents',
    createdBy: 'usr_participant_001',
    members: [
      {
        id: 'tm_alpha_captain',
        teamId: 'team_alpha_001',
        userId: 'usr_participant_001',
        eventId: 'event_dogfood_2026',
        role: 'captain'
      },
      {
        id: 'tm_alpha_second',
        teamId: 'team_alpha_001',
        userId: 'usr_participant_002',
        eventId: 'event_dogfood_2026',
        role: 'member'
      }
    ],
    invitations: [
      {
        id: 'inv_alpha_pending',
        teamId: 'team_alpha_001',
        invitedBy: 'usr_participant_001',
        seedToken: 'dogfood_invite_alpha',
        tokenHash: hashSessionToken('dogfood_invite_alpha'),
        status: 'pending'
      }
    ]
  },
  {
    id: 'team_beta_002',
    eventId: 'event_dogfood_2026',
    name: 'Beta Builders',
    slug: 'beta-builders',
    createdBy: 'usr_participant_006',
    members: [
      {
        id: 'tm_beta_captain',
        teamId: 'team_beta_002',
        userId: 'usr_participant_006',
        eventId: 'event_dogfood_2026',
        role: 'captain'
      }
    ],
    invitations: []
  },
  {
    id: 'team_gamma_003',
    eventId: 'event_dogfood_2026',
    name: 'Gamma Guild',
    slug: 'gamma-guild',
    createdBy: 'usr_participant_007',
    members: [
      {
        id: 'tm_gamma_captain',
        teamId: 'team_gamma_003',
        userId: 'usr_participant_007',
        eventId: 'event_dogfood_2026',
        role: 'captain'
      }
    ],
    invitations: []
  },
  {
    id: 'team_closed_001',
    eventId: 'event_closed_fixture',
    name: 'Past Challengers',
    slug: 'past-challengers',
    createdBy: 'usr_participant_008',
    members: [
      {
        id: 'tm_closed_captain',
        teamId: 'team_closed_001',
        userId: 'usr_participant_008',
        eventId: 'event_closed_fixture',
        role: 'captain'
      }
    ],
    invitations: []
  }
];

export const SEED_SUBMISSIONS: SeedSubmission[] = [
  {
    id: 'sub_alpha_001',
    eventId: 'event_dogfood_2026',
    teamId: 'team_alpha_001',
    trackId: 'track_ai_agents',
    title: 'Fixture Project Alpha',
    slug: 'fixture-project-alpha',
    shortDescription: 'Autonomous agent workflow engine for platform operations and automated testing.',
    description: 'Fixture Project Alpha implements resilient autonomous agents with tool orchestration, observation loops, and deterministic fallback pipelines.',
    repoUrl: 'https://github.com/dogfood/fixture-project-alpha',
    demoUrl: 'https://demo.dogfood.local/fixture-alpha',
    videoUrl: 'https://video.dogfood.local/fixture-alpha',
    status: 'submitted',
    submittedAt: '2026-09-20T12:00:00.000Z'
  },
  {
    id: 'sub_beta_002',
    eventId: 'event_dogfood_2026',
    teamId: 'team_beta_002',
    trackId: 'track_infra_systems',
    title: 'Infrastructure Sentinel',
    slug: 'infrastructure-sentinel',
    shortDescription: 'Distributed offline-first resilience monitor and mesh coordination system.',
    description: 'Infrastructure Sentinel provides decentralized heartbeat monitoring, consensus-backed health checks, and autonomous system recovery without external dependencies.',
    repoUrl: 'https://github.com/dogfood/infra-sentinel',
    demoUrl: 'https://demo.dogfood.local/infra-sentinel',
    videoUrl: null,
    status: 'submitted',
    submittedAt: '2026-09-21T15:30:00.000Z'
  },
  {
    id: 'sub_gamma_draft',
    eventId: 'event_dogfood_2026',
    teamId: 'team_gamma_003',
    trackId: 'track_developer_tooling',
    title: 'Secret Unfinished Draft',
    slug: 'secret-unfinished-draft',
    shortDescription: 'Work in progress developer tools prototype still being drafted.',
    description: 'Draft submission with incomplete specifications. This must not appear in the public gallery.',
    repoUrl: 'https://github.com/dogfood/secret-draft',
    demoUrl: null,
    videoUrl: null,
    status: 'draft',
    submittedAt: null
  }
];

export const SEED_RUBRICS: SeedRubric[] = [
  {
    id: 'rubric_dogfood_2026',
    eventId: 'event_dogfood_2026',
    name: 'DOGFOOD 2026 Official Rubric',
    description: 'Standard weighted evaluation rubric for DOGFOOD 2026 project submissions.',
    version: 1,
    status: 'active',
    criteria: [
      {
        id: 'crit_tier_correctness',
        rubricId: 'rubric_dogfood_2026',
        name: 'Tier Completion & Correctness',
        description: 'Functional completeness and correctness of core tier requirements.',
        weight: 40,
        maxScore: 10,
        position: 1
      },
      {
        id: 'crit_judging_integrity',
        rubricId: 'rubric_dogfood_2026',
        name: 'Judging Integrity',
        description: 'Strict backend score isolation, RBAC enforcement, and data consistency.',
        weight: 25,
        maxScore: 10,
        position: 2
      },
      {
        id: 'crit_adoptability',
        rubricId: 'rubric_dogfood_2026',
        name: 'Adoptability & Operability',
        description: 'Self-hosting ease, zero cloud dependencies, and operational clarity.',
        weight: 20,
        maxScore: 10,
        position: 3
      },
      {
        id: 'crit_code_innovation',
        rubricId: 'rubric_dogfood_2026',
        name: 'Code Quality & Innovation',
        description: 'Maintainability, modular software architecture, and engineering craftsmanship.',
        weight: 15,
        maxScore: 10,
        position: 4
      }
    ]
  }
];

export const SEED_JUDGE_ASSIGNMENTS: SeedJudgeAssignment[] = [
  {
    id: 'asgn_judge_a_sub_alpha',
    eventId: 'event_dogfood_2026',
    judgeId: 'usr_judge_a_001',
    submissionId: 'sub_alpha_001',
    status: 'completed',
    assignedAt: '2026-09-22T09:00:00.000Z'
  },
  {
    id: 'asgn_judge_a_sub_beta',
    eventId: 'event_dogfood_2026',
    judgeId: 'usr_judge_a_001',
    submissionId: 'sub_beta_002',
    status: 'assigned',
    assignedAt: '2026-09-22T09:15:00.000Z'
  },
  {
    id: 'asgn_judge_b_sub_alpha',
    eventId: 'event_dogfood_2026',
    judgeId: 'usr_judge_b_001',
    submissionId: 'sub_alpha_001',
    status: 'completed',
    assignedAt: '2026-09-22T09:30:00.000Z'
  }
];

export const SEED_JUDGE_SCORES: SeedJudgeScore[] = [
  // Judge A scores on sub_alpha_001
  {
    id: 'scr_ja_alpha_1',
    assignmentId: 'asgn_judge_a_sub_alpha',
    criterionId: 'crit_tier_correctness',
    judgeId: 'usr_judge_a_001',
    submissionId: 'sub_alpha_001',
    score: 9.0,
    comment: 'Exemplary completion of all baseline tiers.'
  },
  {
    id: 'scr_ja_alpha_2',
    assignmentId: 'asgn_judge_a_sub_alpha',
    criterionId: 'crit_judging_integrity',
    judgeId: 'usr_judge_a_001',
    submissionId: 'sub_alpha_001',
    score: 9.5,
    comment: 'Flawless server-side role isolation.'
  },
  {
    id: 'scr_ja_alpha_3',
    assignmentId: 'asgn_judge_a_sub_alpha',
    criterionId: 'crit_adoptability',
    judgeId: 'usr_judge_a_001',
    submissionId: 'sub_alpha_001',
    score: 8.5,
    comment: 'Clean offline docker compose experience.'
  },
  {
    id: 'scr_ja_alpha_4',
    assignmentId: 'asgn_judge_a_sub_alpha',
    criterionId: 'crit_code_innovation',
    judgeId: 'usr_judge_a_001',
    submissionId: 'sub_alpha_001',
    score: 9.0,
    comment: 'Exceptional TypeScript craftsmanship.'
  },
  // Judge B scores on sub_alpha_001
  {
    id: 'scr_jb_alpha_1',
    assignmentId: 'asgn_judge_b_sub_alpha',
    criterionId: 'crit_tier_correctness',
    judgeId: 'usr_judge_b_001',
    submissionId: 'sub_alpha_001',
    score: 8.0,
    comment: 'Solid implementation of all required tiers.'
  },
  {
    id: 'scr_jb_alpha_2',
    assignmentId: 'asgn_judge_b_sub_alpha',
    criterionId: 'crit_judging_integrity',
    judgeId: 'usr_judge_b_001',
    submissionId: 'sub_alpha_001',
    score: 8.5,
    comment: 'Good access control.'
  },
  {
    id: 'scr_jb_alpha_3',
    assignmentId: 'asgn_judge_b_sub_alpha',
    criterionId: 'crit_adoptability',
    judgeId: 'usr_judge_b_001',
    submissionId: 'sub_alpha_001',
    score: 8.0,
    comment: 'Easy to run locally.'
  },
  {
    id: 'scr_jb_alpha_4',
    assignmentId: 'asgn_judge_b_sub_alpha',
    criterionId: 'crit_code_innovation',
    judgeId: 'usr_judge_b_001',
    submissionId: 'sub_alpha_001',
    score: 8.0,
    comment: 'Modular codebase.'
  }
];

/**
 * Seeds deterministic authentication, event, and team fixtures into SQLite.
 */
export function seedAuthFixtures(db: Database.Database): void {
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      role = excluded.role,
      password_hash = excluded.password_hash,
      updated_at = excluded.updated_at
  `);

  const insertSession = db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(token_hash) DO UPDATE SET
      expires_at = excluded.expires_at
  `);

  const insertEvent = db.prepare(`
    INSERT INTO events (
      id, organizer_id, name, slug, description, status,
      registration_start, registration_end, submission_deadline,
      judging_start, judging_end, results_publish_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      slug = excluded.slug,
      description = excluded.description,
      status = excluded.status,
      registration_start = excluded.registration_start,
      registration_end = excluded.registration_end,
      submission_deadline = excluded.submission_deadline,
      judging_start = excluded.judging_start,
      judging_end = excluded.judging_end,
      results_publish_at = excluded.results_publish_at,
      updated_at = excluded.updated_at
  `);

  const insertTrack = db.prepare(`
    INSERT INTO event_tracks (id, event_id, name, slug, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      slug = excluded.slug,
      description = excluded.description,
      updated_at = excluded.updated_at
  `);

  const insertPrize = db.prepare(`
    INSERT INTO event_prizes (id, event_id, name, description, amount, currency, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      amount = excluded.amount,
      currency = excluded.currency,
      position = excluded.position,
      updated_at = excluded.updated_at
  `);

  const insertTeam = db.prepare(`
    INSERT INTO teams (id, event_id, name, slug, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      slug = excluded.slug,
      updated_at = excluded.updated_at
  `);

  const insertTeamMember = db.prepare(`
    INSERT INTO team_members (id, team_id, user_id, event_id, role, joined_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(team_id, user_id) DO UPDATE SET
      role = excluded.role
  `);

  const insertInvitation = db.prepare(`
    INSERT INTO team_invitations (id, team_id, invited_by, token_hash, expires_at, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(token_hash) DO UPDATE SET
      status = excluded.status,
      expires_at = excluded.expires_at
  `);

  const insertSubmission = db.prepare(`
    INSERT INTO submissions (
      id, event_id, team_id, track_id, title, slug,
      short_description, description, repo_url, demo_url, video_url,
      status, submitted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      track_id = excluded.track_id,
      title = excluded.title,
      slug = excluded.slug,
      short_description = excluded.short_description,
      description = excluded.description,
      repo_url = excluded.repo_url,
      demo_url = excluded.demo_url,
      video_url = excluded.video_url,
      status = excluded.status,
      submitted_at = excluded.submitted_at,
      updated_at = excluded.updated_at
  `);

  const insertRubric = db.prepare(`
    INSERT INTO rubrics (id, event_id, name, description, version, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      version = excluded.version,
      status = excluded.status,
      updated_at = excluded.updated_at
  `);

  const insertCriterion = db.prepare(`
    INSERT INTO rubric_criteria (id, rubric_id, name, description, weight, max_score, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      weight = excluded.weight,
      max_score = excluded.max_score,
      position = excluded.position,
      updated_at = excluded.updated_at
  `);

  const insertAssignment = db.prepare(`
    INSERT INTO judge_assignments (id, event_id, judge_id, submission_id, status, assigned_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(judge_id, submission_id) DO UPDATE SET
      status = excluded.status,
      updated_at = excluded.updated_at
  `);

  const insertScore = db.prepare(`
    INSERT INTO judge_scores (id, assignment_id, criterion_id, judge_id, submission_id, score, comment, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(assignment_id, criterion_id) DO UPDATE SET
      score = excluded.score,
      comment = excluded.comment,
      updated_at = excluded.updated_at
  `);

  const now = new Date();
  const nowIso = now.toISOString();
  // Set far-future expiration for seeded test sessions & invites (1 year)
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const seedTransaction = db.transaction(() => {
    // 1. Seed Users & Sessions
    for (const user of SEED_USERS) {
      const passwordHash = hashPassword(user.password);
      insertUser.run(user.id, user.email, user.name, user.role, passwordHash, nowIso, nowIso);

      const tokenHash = hashSessionToken(user.seedToken);
      const sessionId = `sess_${user.id}`;
      insertSession.run(sessionId, user.id, tokenHash, nowIso, expiresAt);
    }

    // 2. Seed Events, Tracks, and Prizes
    for (const event of SEED_EVENTS) {
      insertEvent.run(
        event.id,
        event.organizerId,
        event.name,
        event.slug,
        event.description,
        event.status,
        event.registrationStart,
        event.registrationEnd,
        event.submissionDeadline,
        event.judgingStart,
        event.judgingEnd,
        event.resultsPublishAt,
        nowIso,
        nowIso
      );

      for (const track of event.tracks) {
        insertTrack.run(track.id, track.eventId, track.name, track.slug, track.description, nowIso, nowIso);
      }

      for (const prize of event.prizes) {
        insertPrize.run(
          prize.id,
          prize.eventId,
          prize.name,
          prize.description,
          prize.amount,
          prize.currency,
          prize.position,
          nowIso,
          nowIso
        );
      }
    }

    // 3. Seed Teams, Members, and Invitations
    for (const team of SEED_TEAMS) {
      insertTeam.run(team.id, team.eventId, team.name, team.slug, team.createdBy, nowIso, nowIso);

      for (const member of team.members) {
        insertTeamMember.run(member.id, member.teamId, member.userId, member.eventId, member.role, nowIso);
      }

      for (const invite of team.invitations) {
        insertInvitation.run(invite.id, invite.teamId, invite.invitedBy, invite.tokenHash, expiresAt, invite.status, nowIso);
      }
    }

    // 4. Seed Submissions
    for (const sub of SEED_SUBMISSIONS) {
      insertSubmission.run(
        sub.id,
        sub.eventId,
        sub.teamId,
        sub.trackId,
        sub.title,
        sub.slug,
        sub.shortDescription,
        sub.description,
        sub.repoUrl,
        sub.demoUrl,
        sub.videoUrl,
        sub.status,
        sub.submittedAt,
        nowIso,
        nowIso
      );
    }

    // 5. Seed Rubrics & Criteria
    for (const r of SEED_RUBRICS) {
      insertRubric.run(r.id, r.eventId, r.name, r.description, r.version, r.status, nowIso, nowIso);
      for (const c of r.criteria) {
        insertCriterion.run(c.id, c.rubricId, c.name, c.description, c.weight, c.maxScore, c.position, nowIso, nowIso);
      }
    }

    // 6. Seed Judge Assignments
    for (const a of SEED_JUDGE_ASSIGNMENTS) {
      insertAssignment.run(a.id, a.eventId, a.judgeId, a.submissionId, a.status, a.assignedAt, nowIso, nowIso);
    }

    // 7. Seed Judge Scores
    for (const s of SEED_JUDGE_SCORES) {
      insertScore.run(s.id, s.assignmentId, s.criterionId, s.judgeId, s.submissionId, s.score, s.comment, nowIso, nowIso);
    }
  });

  seedTransaction();
}

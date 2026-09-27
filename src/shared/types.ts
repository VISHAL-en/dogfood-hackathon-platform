/**
 * Shared types foundation for the DOGFOOD Hackathon Platform.
 */

export type UserRole = 'visitor' | 'participant' | 'judge' | 'organizer' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  message?: string;
}

export type EventStatus =
  | 'draft'
  | 'published'
  | 'registration_open'
  | 'registration_closed'
  | 'judging_open'
  | 'judging_closed'
  | 'results_published'
  | 'archived';

export interface HackathonEvent {
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
  createdAt: string;
  updatedAt: string;
  organizerName?: string;
}

export interface EventTrack {
  id: string;
  eventId: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventPrize {
  id: string;
  eventId: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventDetail extends HackathonEvent {
  tracks: EventTrack[];
  prizes: EventPrize[];
}

export interface CreateEventInput {
  name: string;
  slug: string;
  description: string;
  status?: EventStatus;
  registrationStart: string;
  registrationEnd: string;
  submissionDeadline: string;
  judgingStart: string;
  judgingEnd: string;
  resultsPublishAt: string;
}

export interface UpdateEventInput {
  name?: string;
  slug?: string;
  description?: string;
  status?: EventStatus;
  registrationStart?: string;
  registrationEnd?: string;
  submissionDeadline?: string;
  judgingStart?: string;
  judgingEnd?: string;
  resultsPublishAt?: string;
}

export interface CreateTrackInput {
  name: string;
  slug?: string;
  description: string;
}

export interface UpdateTrackInput {
  name?: string;
  slug?: string;
  description?: string;
}

export interface CreatePrizeInput {
  name: string;
  description: string;
  amount: number;
  currency?: string;
  position?: number;
}

export interface UpdatePrizeInput {
  name?: string;
  description?: string;
  amount?: number;
  currency?: string;
  position?: number;
}

// ----------------------------------------------------------------------------
// TEAMS, MEMBERS & INVITATIONS
// ----------------------------------------------------------------------------

export type TeamMemberRole = 'captain' | 'member';

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  role: TeamMemberRole;
  joinedAt: string;
}

export interface Team {
  id: string;
  eventId: string;
  name: string;
  slug: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  members?: TeamMember[];
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface TeamInvitation {
  id: string;
  teamId: string;
  teamName?: string;
  invitedBy: string;
  expiresAt: string;
  status: InvitationStatus;
  createdAt: string;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
}

export interface CreateTeamInput {
  name: string;
  slug?: string;
}

export interface UpdateTeamInput {
  name?: string;
  slug?: string;
}

export interface CreateInvitationInput {
  expiresInHours?: number;
}

// ----------------------------------------------------------------------------
// PROJECT SUBMISSIONS & PUBLIC GALLERY
// ----------------------------------------------------------------------------

export type SubmissionStatus = 'draft' | 'submitted';

export interface ProjectSubmission {
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
  status: SubmissionStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionMemberInfo {
  id: string;
  userId: string;
  userName: string;
  role: TeamMemberRole;
}

export interface SubmissionDetail extends ProjectSubmission {
  teamName: string;
  eventName: string;
  eventSlug: string;
  trackName: string | null;
  trackSlug: string | null;
  members: SubmissionMemberInfo[];
}

export interface GalleryItem {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  teamId: string;
  teamName: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  trackId: string | null;
  trackName: string | null;
  trackSlug: string | null;
  repoUrl: string | null;
  demoUrl: string | null;
  videoUrl: string | null;
  submittedAt: string;
  createdAt: string;
}

export interface GalleryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GalleryResponse {
  items: GalleryItem[];
  pagination: GalleryPagination;
}

export interface CreateSubmissionInput {
  title: string;
  slug?: string;
  shortDescription: string;
  description: string;
  trackId?: string | null;
  repoUrl?: string | null;
  demoUrl?: string | null;
  videoUrl?: string | null;
  eventId?: string;
  teamId?: string;
}

export interface UpdateSubmissionInput {
  title?: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  trackId?: string | null;
  repoUrl?: string | null;
  demoUrl?: string | null;
  videoUrl?: string | null;
}

// ----------------------------------------------------------------------------
// JUDGING, RUBRICS & SCORES
// ----------------------------------------------------------------------------

export type AssignmentStatus = 'assigned' | 'completed';

export interface JudgeAssignment {
  id: string;
  eventId: string;
  judgeId: string;
  judgeName?: string;
  judgeEmail?: string;
  submissionId: string;
  submissionTitle?: string;
  submissionSlug?: string;
  teamName?: string;
  status: AssignmentStatus;
  assignedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface JudgeInvitation {
  id: string;
  eventId: string;
  email: string | null;
  tokenHash: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  invitedBy: string;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  createdAt: string;
}

export type RubricStatus = 'draft' | 'active' | 'locked';

export interface RubricCriterion {
  id: string;
  rubricId: string;
  name: string;
  description: string;
  weight: number;
  maxScore: number;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Rubric {
  id: string;
  eventId: string;
  name: string;
  description: string;
  version: number;
  status: RubricStatus;
  criteria?: RubricCriterion[];
  createdAt: string;
  updatedAt: string;
}

export interface JudgeScore {
  id: string;
  assignmentId: string;
  criterionId: string;
  criterionName?: string;
  criterionWeight?: number;
  maxScore?: number;
  judgeId: string;
  submissionId: string;
  score: number;
  weightedScore?: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionScoresResponse {
  assignmentId: string;
  submissionId: string;
  judgeId: string;
  scores: JudgeScore[];
  totalWeightedScore: number;
  status: AssignmentStatus;
}

export interface JudgingProgress {
  eventId: string;
  totalAssignments: number;
  completedAssignments: number;
  pendingAssignments: number;
  assignedJudgesCount: number;
  assignedSubmissionsCount: number;
  completionPercentage: number;
}

export interface CreateRubricCriterionInput {
  name: string;
  description: string;
  weight: number;
  maxScore: number;
  position?: number;
}

export interface CreateRubricInput {
  name: string;
  description: string;
  status?: RubricStatus;
  criteria?: CreateRubricCriterionInput[];
}

export interface UpdateRubricInput {
  name?: string;
  description?: string;
  status?: RubricStatus;
}

export interface CreateJudgeAssignmentInput {
  judgeId: string;
  submissionId: string;
}

export interface SubmitScoreItem {
  criterionId: string;
  score: number;
  comment?: string | null;
}

export interface SubmitScoresInput {
  scores: SubmitScoreItem[];
}

// ----------------------------------------------------------------------------
// CROSS-JUDGE NORMALIZATION & PROOF/AUDIT
// ----------------------------------------------------------------------------

export type NormalizationRunStatus = 'running' | 'completed' | 'failed';

export interface JudgeCriterionStat {
  judgeId: string;
  criterionId: string;
  count: number;
  mean: number;
  populationStddev: number;
  zeroVariance: boolean;
}

export interface NormalizationProofMetadata {
  runId: string;
  eventId: string;
  rubricId: string;
  method: string;
  methodVersion: string;
  formulaVersion: string;
  eligibleScoreCount: number;
  eligibleJudgeCount: number;
  eligibleSubmissionCount: number;
  excludedIncompleteAssignmentCount: number;
  zeroVarianceCount: number;
  judgeCriterionStats: JudgeCriterionStat[];
  resultCount: number;
  deterministicOrdering: string;
  createdAt: string;
}

export interface NormalizationRun {
  id: string;
  eventId: string;
  rubricId: string;
  method: string;
  methodVersion: string;
  status: NormalizationRunStatus;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  inputScoreCount: number;
  judgeCount: number;
  submissionCount: number;
  proofHash: string | null;
  metadataJson: string | null;
  errorMessage: string | null;
}

export interface NormalizationRunDetail extends NormalizationRun {
  proofMetadata?: NormalizationProofMetadata | null;
  submissionScores?: NormalizedSubmissionScore[];
  summaryStatistics?: {
    totalEligibleScores: number;
    totalEligibleJudges: number;
    totalEligibleSubmissions: number;
    zeroVarianceCriteria: number;
    meanPresentationScore: number;
  };
}

export interface NormalizationResult {
  id: string;
  normalizationRunId: string;
  judgeId: string;
  submissionId: string;
  criterionId: string;
  rawScore: number;
  judgeMean: number;
  judgeStddev: number;
  zScore: number;
  criterionWeight: number;
  weightedNormalizedScore: number;
  createdAt: string;
}

export interface NormalizedSubmissionScore {
  id: string;
  normalizationRunId: string;
  submissionId: string;
  aggregateZ: number;
  presentationScore: number;
  judgeCount: number;
  createdAt: string;
}

export interface NormalizationVerificationResult {
  verified: boolean;
  run_id: string;
  stored_hash: string;
  calculated_hash: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  database: {
    connected: boolean;
    path: string;
  };
}

export interface ApiErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

// Frontend convenience type aliases
export type EventListItem = HackathonEvent;
export type EventWithDetails = EventDetail;
export type TeamWithDetails = Team;

// ----------------------------------------------------------------------------
// T3 COMMUNITY VOTING & ANTI-ABUSE
// ----------------------------------------------------------------------------

export type VotingRoundStatus = 'draft' | 'voting_open' | 'voting_closed' | 'results_published';

export interface VotingRound {
  id: string;
  eventId: string;
  status: VotingRoundStatus;
  startsAt: string | null;
  endsAt: string | null;
  resultsPublishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  candidateCount?: number;
}

export interface VotingCandidate {
  id: string;
  votingRoundId: string;
  submissionId: string;
  title?: string;
  slug?: string;
  shortDescription?: string;
  teamName?: string;
  createdAt: string;
}

export interface VotingBallotItem {
  candidateId: string;
  submissionId: string;
  title: string;
  slug: string;
  shortDescription: string;
  teamName: string;
  position: number;
  hasVoted?: boolean;
}

export interface VotingBallot {
  id: string;
  votingRoundId: string;
  candidates: VotingBallotItem[];
  createdAt: string;
  lastActivityAt: string;
}

export interface CommunityVote {
  id: string;
  votingRoundId: string;
  ballotId: string;
  candidateId: string;
  submissionId: string;
  createdAt: string;
}

export type CommunityCommentStatus = 'visible' | 'hidden' | 'deleted';

export interface CommunityComment {
  id: string;
  votingRoundId: string;
  submissionId: string;
  authorUserId: string | null;
  authorDisplayName: string;
  body: string;
  status: CommunityCommentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VotingAuditLogEntry {
  id: string;
  votingRoundId: string | null;
  actorKeyHash: string | null;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PublicVotingResult {
  submissionId: string;
  title: string;
  slug: string;
  teamName: string;
  voteCount: number;
  rank: number;
}

export interface PublicVotingResultsResponse {
  votingRoundId: string;
  eventId: string;
  resultsPublishedAt: string;
  totalVotes: number;
  results: PublicVotingResult[];
}

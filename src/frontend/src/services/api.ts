import {
  AuthUser,
  EventWithDetails,
  EventListItem,
  TeamWithDetails,
  ProjectSubmission,
  SubmissionDetail,
  GalleryItem,
  JudgeAssignment,
  Rubric,
  JudgingProgress,
  SubmissionScoresResponse,
  NormalizationRun,
  NormalizationRunDetail,
  NormalizationResult,
  NormalizedSubmissionScore,
  NormalizationVerificationResult,
  HealthResponse,
  CreateEventInput,
  UpdateEventInput,
  CreateTeamInput,
  SubmitScoreItem,
  VotingRound,
  VotingRoundStatus,
  VotingBallot,
  CommunityVote,
  CommunityComment,
  PublicVotingResultsResponse
} from '../../../shared/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Ensure same-origin credentials (cookies) are sent with every request
  const config: RequestInit = {
    ...options,
    headers,
    credentials: options.credentials || 'include'
  };

  const response = await fetch(endpoint, config);

  if (response.status === 204) {
    return {} as T;
  }

  // Handle CSV export endpoint
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    const text = await response.text();
    if (!response.ok) {
      throw new ApiError('Failed to download CSV', response.status);
    }
    return text as unknown as T;
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response
    if (!response.ok) {
      throw new ApiError(`Request failed with status ${response.status}`, response.status);
    }
    return {} as T;
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || `HTTP error ${response.status}`;
    const code = data?.error?.code || data?.code;
    throw new ApiError(message, response.status, code, data?.error?.details);
  }

  return data as T;
}

export const api = {
  // --------------------------------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------------------------------
  auth: {
    async getCurrentUser(): Promise<AuthUser | null> {
      try {
        const res = await request<{ user: AuthUser }>('/auth/me');
        return res.user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          return null;
        }
        return null;
      }
    },

    async login(email: string, password: string): Promise<AuthUser> {
      const res = await request<{ user: AuthUser; token?: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      return res.user;
    },

    async register(data: { email: string; name: string; password: string }): Promise<AuthUser> {
      const res = await request<{ user: AuthUser; token?: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return res.user;
    },

    async logout(): Promise<void> {
      await request<{ ok: boolean }>('/auth/logout', {
        method: 'POST'
      });
    }
  },

  // --------------------------------------------------------------------------
  // EVENTS
  // --------------------------------------------------------------------------
  events: {
    async list(params?: { status?: string; search?: string }): Promise<EventListItem[]> {
      const query = new URLSearchParams();
      if (params?.status) query.set('status', params.status);
      if (params?.search) query.set('search', params.search);
      const queryString = query.toString() ? `?${query.toString()}` : '';
      const res = await request<{ events: EventListItem[] }>(`/events${queryString}`);
      return res.events;
    },

    async getByIdOrSlug(idOrSlug: string): Promise<EventWithDetails> {
      const res = await request<{ event: EventWithDetails }>(`/events/${idOrSlug}`);
      return res.event;
    },

    async create(input: CreateEventInput): Promise<EventWithDetails> {
      const res = await request<{ event: EventWithDetails }>('/events', {
        method: 'POST',
        body: JSON.stringify(input)
      });
      return res.event;
    },

    async update(eventId: string, input: UpdateEventInput): Promise<EventWithDetails> {
      const res = await request<{ event: EventWithDetails }>(`/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(input)
      });
      return res.event;
    },

    async addTrack(eventId: string, track: { name: string; description: string; slug?: string }) {
      const res = await request<{ track: any }>(`/events/${eventId}/tracks`, {
        method: 'POST',
        body: JSON.stringify(track)
      });
      return res.track;
    },

    async addPrize(eventId: string, prize: { name: string; description: string; amount: number; currency?: string; position?: number }) {
      const res = await request<{ prize: any }>(`/events/${eventId}/prizes`, {
        method: 'POST',
        body: JSON.stringify(prize)
      });
      return res.prize;
    }
  },

  // --------------------------------------------------------------------------
  // TEAMS
  // --------------------------------------------------------------------------
  teams: {
    async listByEvent(eventId: string): Promise<TeamWithDetails[]> {
      const res = await request<{ teams: TeamWithDetails[] }>(`/events/${eventId}/teams`);
      return res.teams;
    },

    async create(eventId: string, input: CreateTeamInput): Promise<TeamWithDetails> {
      const res = await request<{ team: TeamWithDetails }>(`/events/${eventId}/teams`, {
        method: 'POST',
        body: JSON.stringify(input)
      });
      return res.team;
    },

    async getById(teamId: string): Promise<TeamWithDetails> {
      const res = await request<{ team: TeamWithDetails }>(`/teams/${teamId}`);
      return res.team;
    },

    async createInvitation(teamId: string, expiresInHours?: number): Promise<{ invitation: any; token: string }> {
      const res = await request<{ invitation: any; token: string }>(`/teams/${teamId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ expiresInHours })
      });
      return res;
    },

    async acceptInvitation(token: string): Promise<{ team: TeamWithDetails }> {
      const res = await request<{ team: TeamWithDetails }>(`/team-invitations/${token}/accept`, {
        method: 'POST'
      });
      return res;
    },

    async removeMember(teamId: string, userId: string): Promise<void> {
      await request(`/teams/${teamId}/members/${userId}`, {
        method: 'DELETE'
      });
    }
  },

  // --------------------------------------------------------------------------
  // SUBMISSIONS
  // --------------------------------------------------------------------------
  submissions: {
    async createDraft(
      eventId: string,
      teamId: string,
      data: {
        title: string;
        trackId?: string | null;
        shortDescription: string;
        description: string;
        repoUrl?: string | null;
        demoUrl?: string | null;
        videoUrl?: string | null;
      }
    ): Promise<ProjectSubmission> {
      const res = await request<{ submission: ProjectSubmission }>(`/events/${eventId}/teams/${teamId}/submission`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return res.submission;
    },

    async updateDraft(
      submissionId: string,
      data: {
        title?: string;
        trackId?: string | null;
        shortDescription?: string;
        description?: string;
        repoUrl?: string | null;
        demoUrl?: string | null;
        videoUrl?: string | null;
      }
    ): Promise<ProjectSubmission> {
      const res = await request<{ submission: ProjectSubmission }>(`/submissions/${submissionId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
      return res.submission;
    },

    async submit(submissionId: string): Promise<ProjectSubmission> {
      const res = await request<{ submission: ProjectSubmission }>(`/submissions/${submissionId}/submit`, {
        method: 'POST'
      });
      return res.submission;
    },

    async getById(submissionId: string): Promise<SubmissionDetail> {
      const res = await request<{ submission: SubmissionDetail }>(`/submissions/${submissionId}`);
      return res.submission;
    }
  },

  // --------------------------------------------------------------------------
  // PUBLIC GALLERY
  // --------------------------------------------------------------------------
  gallery: {
    async list(params?: {
      search?: string;
      event?: string;
      track?: string;
      page?: number;
      limit?: number;
    }): Promise<{ items: GalleryItem[]; total: number; page: number; limit: number; totalPages: number }> {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.event) query.set('event', params.event);
      if (params?.track) query.set('track', params.track);
      if (params?.page) query.set('page', params.page.toString());
      if (params?.limit) query.set('limit', params.limit.toString());
      const qs = query.toString() ? `?${query.toString()}` : '';
      const res = await request<{ items: GalleryItem[]; total: number; page: number; limit: number; totalPages: number }>(`/gallery${qs}`);
      return res;
    },

    async getDetail(idOrSlug: string): Promise<SubmissionDetail> {
      const res = await request<{ item: SubmissionDetail }>(`/gallery/${idOrSlug}`);
      return res.item;
    }
  },

  // --------------------------------------------------------------------------
  // JUDGING & SCORING
  // --------------------------------------------------------------------------
  judging: {
    async getMyAssignments(): Promise<JudgeAssignment[]> {
      const res = await request<{ assignments: JudgeAssignment[] }>('/judge/assignments');
      return res.assignments;
    },

    async getAssignmentById(assignmentId: string): Promise<JudgeAssignment> {
      const res = await request<{ assignment: JudgeAssignment }>(`/judge/assignments/${assignmentId}`);
      return res.assignment;
    },

    async submitScores(assignmentId: string, scores: SubmitScoreItem[]): Promise<SubmissionScoresResponse> {
      const res = await request<SubmissionScoresResponse>(`/judge/assignments/${assignmentId}/scores`, {
        method: 'PUT',
        body: JSON.stringify({ scores })
      });
      return res;
    },

    async getMyScores(params?: { event?: string; submission?: string; assignment?: string }) {
      const query = new URLSearchParams();
      if (params?.event) query.set('event', params.event);
      if (params?.submission) query.set('submission', params.submission);
      if (params?.assignment) query.set('assignment', params.assignment);
      const qs = query.toString() ? `?${query.toString()}` : '';
      const res = await request<{ scores: any[] }>(`/judge/scores${qs}`);
      return res.scores;
    },

    async getActiveRubric(eventId: string): Promise<Rubric> {
      const res = await request<{ rubric: Rubric }>(`/events/${eventId}/judging/rubrics/active`);
      return res.rubric;
    },

    async createRubric(eventId: string, input: { name: string; description: string; criteria: any[] }): Promise<Rubric> {
      const res = await request<{ rubric: Rubric }>(`/events/${eventId}/judging/rubrics`, {
        method: 'POST',
        body: JSON.stringify(input)
      });
      return res.rubric;
    },

    async activateRubric(eventId: string, rubricId: string): Promise<Rubric> {
      const res = await request<{ rubric: Rubric }>(`/events/${eventId}/judging/rubrics/${rubricId}/activate`, {
        method: 'POST'
      });
      return res.rubric;
    },

    async createAssignment(eventId: string, judgeId: string, submissionId: string): Promise<JudgeAssignment> {
      const res = await request<{ assignment: JudgeAssignment }>(`/events/${eventId}/judging/assignments`, {
        method: 'POST',
        body: JSON.stringify({ judgeId, submissionId })
      });
      return res.assignment;
    },

    async getProgress(eventId: string): Promise<JudgingProgress> {
      const res = await request<{ progress: JudgingProgress }>(`/events/${eventId}/judging/progress`);
      return res.progress;
    },

    async exportScoresCsv(eventId?: string): Promise<string> {
      const qs = eventId ? `?eventId=${eventId}` : '';
      const res = await request<string>(`/exports/scores.csv${qs}`);
      return res;
    }
  },

  // --------------------------------------------------------------------------
  // NORMALIZATION & AUDIT PROOF
  // --------------------------------------------------------------------------
  normalization: {
    async createRun(eventId: string): Promise<NormalizationRunDetail> {
      const res = await request<{ run: NormalizationRunDetail }>(`/events/${eventId}/judging/normalization`, {
        method: 'POST'
      });
      return res.run;
    },

    async listRuns(eventId: string): Promise<NormalizationRun[]> {
      const res = await request<{ runs: NormalizationRun[] }>(`/events/${eventId}/judging/normalization`);
      return res.runs;
    },

    async getRunDetail(eventId: string, runId: string): Promise<NormalizationRunDetail> {
      const res = await request<{ run: NormalizationRunDetail }>(`/events/${eventId}/judging/normalization/${runId}`);
      return res.run;
    },

    async getResults(
      eventId: string,
      runId: string,
      filters?: { submission?: string; judge?: string; criterion?: string }
    ): Promise<{ results: NormalizationResult[]; submissionScores: NormalizedSubmissionScore[] }> {
      const query = new URLSearchParams();
      if (filters?.submission) query.set('submission', filters.submission);
      if (filters?.judge) query.set('judge', filters.judge);
      if (filters?.criterion) query.set('criterion', filters.criterion);
      const qs = query.toString() ? `?${query.toString()}` : '';
      const res = await request<{ results: NormalizationResult[]; submissionScores: NormalizedSubmissionScore[] }>(
        `/events/${eventId}/judging/normalization/${runId}/results${qs}`
      );
      return res;
    },

    async verifyProof(eventId: string, runId: string): Promise<NormalizationVerificationResult> {
      const res = await request<NormalizationVerificationResult>(
        `/events/${eventId}/judging/normalization/${runId}/verify`,
        { method: 'POST' }
      );
      return res;
    }
  },

  // --------------------------------------------------------------------------
  // T3 COMMUNITY VOTING & ANTI-ABUSE
  // --------------------------------------------------------------------------
  voting: {
    async getRounds(eventId: string): Promise<VotingRound[]> {
      const res = await request<{ votingRounds: VotingRound[] }>(`/events/${eventId}/voting`);
      return res.votingRounds;
    },

    async getRound(eventId: string, roundId: string): Promise<VotingRound> {
      const res = await request<{ votingRound: VotingRound }>(`/events/${eventId}/voting/${roundId}`);
      return res.votingRound;
    },

    async getStatus(
      eventId: string,
      roundId: string
    ): Promise<{
      votingRoundId: string;
      eventId: string;
      status: VotingRoundStatus;
      startsAt: string | null;
      endsAt: string | null;
      candidateCount: number;
    }> {
      return request(`/events/${eventId}/voting/${roundId}/status`);
    },

    async getBallot(eventId: string, roundId: string): Promise<VotingBallot> {
      const res = await request<{ ballot: VotingBallot; voterToken?: string }>(
        `/events/${eventId}/voting/${roundId}/ballot`
      );
      return res.ballot;
    },

    async castVote(eventId: string, roundId: string, candidateId: string): Promise<CommunityVote> {
      const res = await request<{ vote: CommunityVote }>(`/events/${eventId}/voting/${roundId}/votes`, {
        method: 'POST',
        body: JSON.stringify({ candidateId })
      });
      return res.vote;
    },

    async getComments(eventId: string, roundId: string, submissionId: string): Promise<CommunityComment[]> {
      const res = await request<{ comments: CommunityComment[] }>(
        `/events/${eventId}/voting/${roundId}/submissions/${submissionId}/comments`
      );
      return res.comments;
    },

    async createComment(
      eventId: string,
      roundId: string,
      submissionId: string,
      body: string,
      authorDisplayName?: string
    ): Promise<CommunityComment> {
      const res = await request<{ comment: CommunityComment }>(
        `/events/${eventId}/voting/${roundId}/submissions/${submissionId}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ body, authorDisplayName })
        }
      );
      return res.comment;
    },

    async deleteComment(eventId: string, roundId: string, commentId: string): Promise<void> {
      await request(`/events/${eventId}/voting/${roundId}/comments/${commentId}`, {
        method: 'DELETE'
      });
    },

    async getResults(eventId: string, roundId: string): Promise<PublicVotingResultsResponse> {
      return request<PublicVotingResultsResponse>(`/events/${eventId}/voting/${roundId}/results`);
    },

    // Organizer actions
    async createRound(
      eventId: string,
      data?: { startsAt?: string; endsAt?: string }
    ): Promise<VotingRound> {
      const res = await request<{ votingRound: VotingRound }>(`/events/${eventId}/voting`, {
        method: 'POST',
        body: JSON.stringify(data || {})
      });
      return res.votingRound;
    },

    async autoPopulateCandidates(eventId: string, roundId: string) {
      const res = await request<{ candidates: unknown[] }>(
        `/events/${eventId}/voting/${roundId}/candidates/auto-populate`,
        { method: 'POST' }
      );
      return res.candidates;
    },

    async openRound(eventId: string, roundId: string): Promise<VotingRound> {
      const res = await request<{ votingRound: VotingRound }>(`/events/${eventId}/voting/${roundId}/open`, {
        method: 'POST'
      });
      return res.votingRound;
    },

    async closeRound(eventId: string, roundId: string): Promise<VotingRound> {
      const res = await request<{ votingRound: VotingRound }>(`/events/${eventId}/voting/${roundId}/close`, {
        method: 'POST'
      });
      return res.votingRound;
    },

    async publishResults(eventId: string, roundId: string): Promise<VotingRound> {
      const res = await request<{ votingRound: VotingRound }>(`/events/${eventId}/voting/${roundId}/publish`, {
        method: 'POST'
      });
      return res.votingRound;
    }
  },

  // --------------------------------------------------------------------------
  // SYSTEM HEALTH
  // --------------------------------------------------------------------------
  system: {
    async getHealth(): Promise<HealthResponse> {
      const res = await request<HealthResponse>('/health');
      return res;
    }
  }
};

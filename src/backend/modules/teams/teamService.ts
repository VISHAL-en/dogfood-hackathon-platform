import { getDatabase } from '../../database/db';
import { generateId, generateSessionToken, hashSessionToken } from '../../utils/crypto';
import {
  Team,
  TeamMember,
  TeamInvitation,
  CreateTeamInput,
  UpdateTeamInput,
  CreateInvitationInput,
  UserRole
} from '../../../shared/types';

export class TeamServiceError extends Error {
  constructor(
    message: string,
    public code: 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' = 'BAD_REQUEST'
  ) {
    super(message);
    this.name = 'TeamServiceError';
  }
}

export const MAX_TEAM_SIZE = 4;
export const MIN_TEAM_SIZE = 1;

export class TeamService {
  /**
   * Validates team slug format.
   */
  static validateSlug(slug: string): void {
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slug || !slugRegex.test(slug)) {
      throw new TeamServiceError(
        'Slug must consist only of lowercase alphanumeric characters separated by hyphens',
        'BAD_REQUEST'
      );
    }
  }

  /**
   * Checks whether the event exists and is currently open for registration/team formation.
   */
  static verifyEventAllowsRegistration(eventId: string): any {
    const db = getDatabase();
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
    if (!event) {
      throw new TeamServiceError('Event not found', 'NOT_FOUND');
    }

    if (event.status !== 'registration_open') {
      throw new TeamServiceError(
        `Event registration is not open (current status: "${event.status}")`,
        'BAD_REQUEST'
      );
    }

    const now = new Date().toISOString();
    if (now < event.registration_start || now > event.registration_end) {
      throw new TeamServiceError('Event registration window is closed', 'BAD_REQUEST');
    }

    return event;
  }

  /**
   * Creates a team and registers the creator as initial captain atomically.
   */
  static createTeam(eventId: string, userId: string, input: CreateTeamInput): Team {
    if (!input.name || typeof input.name !== 'string' || !input.name.trim()) {
      throw new TeamServiceError('Team name is required', 'BAD_REQUEST');
    }

    const rawSlug = input.slug || input.name;
    const slug = rawSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    this.validateSlug(slug);

    const db = getDatabase();

    // Verify creator exists
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      throw new TeamServiceError('User not found', 'NOT_FOUND');
    }

    let createdTeam: Team;

    const createTransaction = db.transaction(() => {
      // 1. Verify event permits registration
      this.verifyEventAllowsRegistration(eventId);

      // 2. Verify participant is not already in a team for this event
      const existingMembership = db
        .prepare('SELECT team_id FROM team_members WHERE event_id = ? AND user_id = ?')
        .get(eventId, userId) as any;
      if (existingMembership) {
        throw new TeamServiceError('You are already a member of a team in this event', 'CONFLICT');
      }

      // 3. Verify team name and slug uniqueness within this event
      const nameConflict = db
        .prepare('SELECT id FROM teams WHERE event_id = ? AND (slug = ? OR name = ?)')
        .get(eventId, slug, input.name.trim()) as any;
      if (nameConflict) {
        throw new TeamServiceError('A team with this name or slug already exists in this event', 'CONFLICT');
      }

      const teamId = generateId('team');
      const memberId = generateId('tm');
      const now = new Date().toISOString();

      // 4. Insert team
      db.prepare(`
        INSERT INTO teams (id, event_id, name, slug, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(teamId, eventId, input.name.trim(), slug, userId, now, now);

      // 5. Insert initial captain membership
      db.prepare(`
        INSERT INTO team_members (id, team_id, user_id, event_id, role, joined_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(memberId, teamId, userId, eventId, 'captain', now);

      const captainMember: TeamMember = {
        id: memberId,
        teamId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        role: 'captain',
        joinedAt: now
      };

      createdTeam = {
        id: teamId,
        eventId,
        name: input.name.trim(),
        slug,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        memberCount: 1,
        members: [captainMember]
      };
    });

    createTransaction();
    return createdTeam!;
  }

  /**
   * Retrieves a team with full membership details.
   */
  static getTeamById(teamId: string): Team | null {
    const db = getDatabase();
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
    if (!team) return null;

    const members = db
      .prepare(`
        SELECT
          tm.id,
          tm.team_id,
          tm.user_id,
          u.name as user_name,
          u.email as user_email,
          tm.role,
          tm.joined_at
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ?
        ORDER BY CASE tm.role WHEN 'captain' THEN 0 ELSE 1 END, tm.joined_at ASC
      `)
      .all(teamId) as any[];

    return {
      id: team.id,
      eventId: team.event_id,
      name: team.name,
      slug: team.slug,
      createdBy: team.created_by,
      createdAt: team.created_at,
      updatedAt: team.updated_at,
      memberCount: members.length,
      members: members.map((m) => ({
        id: m.id,
        teamId: m.team_id,
        userId: m.user_id,
        userName: m.user_name,
        userEmail: m.user_email,
        role: m.role,
        joinedAt: m.joined_at
      }))
    };
  }

  /**
   * Lists all teams for a specific hackathon event.
   */
  static listTeamsByEvent(eventId: string): Team[] {
    const db = getDatabase();
    const teams = db
      .prepare(`
        SELECT
          t.*,
          count(tm.id) as member_count
        FROM teams t
        LEFT JOIN team_members tm ON t.id = tm.team_id
        WHERE t.event_id = ?
        GROUP BY t.id
        ORDER BY t.created_at ASC
      `)
      .all(eventId) as any[];

    return teams.map((t) => ({
      id: t.id,
      eventId: t.event_id,
      name: t.name,
      slug: t.slug,
      createdBy: t.created_by,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      memberCount: t.member_count
    }));
  }

  /**
   * Lists all teams that the given user belongs to (as captain or normal member),
   * optionally filtered by eventId. Includes event and submission context.
   */
  static getUserTeams(userId: string, eventId?: string): Team[] {
    const db = getDatabase();
    const conditions = ['tm.user_id = ?'];
    const params: any[] = [userId];

    if (eventId) {
      conditions.push('(t.event_id = ? OR e.slug = ?)');
      params.push(eventId, eventId);
    }

    const sql = `
      SELECT
        t.*,
        tm.role as my_role,
        e.name as event_name,
        e.slug as event_slug,
        e.status as event_status,
        s.id as submission_id,
        s.title as submission_title,
        s.status as submission_status,
        s.slug as submission_slug
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      JOIN events e ON t.event_id = e.id
      LEFT JOIN submissions s ON t.id = s.team_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY t.created_at DESC
    `;

    const rows = db.prepare(sql).all(...params) as any[];

    const membersStmt = db.prepare(`
      SELECT
        tm.id,
        tm.team_id,
        tm.user_id,
        u.name as user_name,
        u.email as user_email,
        tm.role,
        tm.joined_at
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY CASE tm.role WHEN 'captain' THEN 0 ELSE 1 END, tm.joined_at ASC
    `);

    return rows.map((r) => {
      const members = membersStmt.all(r.id) as any[];
      return {
        id: r.id,
        eventId: r.event_id,
        name: r.name,
        slug: r.slug,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        memberCount: members.length,
        members: members.map((m) => ({
          id: m.id,
          teamId: m.team_id,
          userId: m.user_id,
          userName: m.user_name,
          userEmail: m.user_email,
          role: m.role,
          joinedAt: m.joined_at
        })),
        myRole: r.my_role,
        eventName: r.event_name,
        eventSlug: r.event_slug,
        eventStatus: r.event_status,
        submissionId: r.submission_id || undefined,
        submissionTitle: r.submission_title || undefined,
        submissionStatus: r.submission_status || undefined,
        submissionSlug: r.submission_slug || undefined
      };
    });
  }

  /**
   * Retrieves the authenticated user's team for a specific event (or null if not in a team).
   */
  static getUserTeamForEvent(userId: string, eventId: string): Team | null {
    const teams = this.getUserTeams(userId, eventId);
    return teams.length > 0 ? teams[0] : null;
  }

  /**
   * Updates team metadata (captain or admin only).
   */
  static updateTeam(
    teamId: string,
    userId: string,
    userRole: UserRole,
    input: UpdateTeamInput
  ): Team {
    const db = getDatabase();
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
    if (!team) throw new TeamServiceError('Team not found', 'NOT_FOUND');

    // Verify user is captain or admin
    const membership = db
      .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(teamId, userId) as any;
    const isCaptain = membership?.role === 'captain';
    const isAdmin = userRole === 'admin';

    if (!isCaptain && !isAdmin) {
      throw new TeamServiceError('Forbidden: Only the team captain can update team details', 'FORBIDDEN');
    }

    const newName = input.name !== undefined ? input.name.trim() : team.name;
    const rawSlug = input.slug !== undefined ? input.slug : newName;
    const newSlug = rawSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    this.validateSlug(newSlug);

    // Check conflict
    const conflict = db
      .prepare('SELECT id FROM teams WHERE event_id = ? AND id != ? AND (slug = ? OR name = ?)')
      .get(team.event_id, teamId, newSlug, newName) as any;
    if (conflict) {
      throw new TeamServiceError('A team with this name or slug already exists in this event', 'CONFLICT');
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE teams SET name = ?, slug = ?, updated_at = ? WHERE id = ?').run(
      newName,
      newSlug,
      now,
      teamId
    );

    return this.getTeamById(teamId)!;
  }

  /**
   * Generates a team invitation with hashed token storage (captain only).
   */
  static createInvitation(
    teamId: string,
    userId: string,
    userRole: UserRole,
    input: CreateInvitationInput = {}
  ): { invitation: TeamInvitation; rawToken: string; inviteUrl: string } {
    const db = getDatabase();
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId) as any;
    if (!team) throw new TeamServiceError('Team not found', 'NOT_FOUND');

    // Verify captain or admin
    const membership = db
      .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(teamId, userId) as any;
    if (membership?.role !== 'captain' && userRole !== 'admin') {
      throw new TeamServiceError('Forbidden: Only the team captain can invite new members', 'FORBIDDEN');
    }

    // Verify team is not full
    const countRow = db
      .prepare('SELECT count(*) as count FROM team_members WHERE team_id = ?')
      .get(teamId) as any;
    if (countRow.count >= MAX_TEAM_SIZE) {
      throw new TeamServiceError(`Team has already reached the maximum size of ${MAX_TEAM_SIZE} members`, 'BAD_REQUEST');
    }

    // Generate token and hash
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const inviteId = generateId('inv');
    const now = new Date();
    const nowIso = now.toISOString();

    const hours = input.expiresInHours && input.expiresInHours > 0 ? input.expiresInHours : 48;
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO team_invitations (id, team_id, invited_by, token_hash, expires_at, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `).run(inviteId, teamId, userId, tokenHash, expiresAt, nowIso);

    const invitation: TeamInvitation = {
      id: inviteId,
      teamId,
      teamName: team.name,
      invitedBy: userId,
      expiresAt,
      status: 'pending',
      createdAt: nowIso
    };

    const inviteUrl = `/team-invitations/${rawToken}/accept`;

    return {
      invitation,
      rawToken,
      inviteUrl
    };
  }

  /**
   * Accepts an invitation atomically and joins the participant to the team.
   */
  static acceptInvitation(rawToken: string, userId: string): Team {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new TeamServiceError('Invitation token is required', 'BAD_REQUEST');
    }

    const tokenHash = hashSessionToken(rawToken.trim());
    const db = getDatabase();

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as any;
    if (!user) throw new TeamServiceError('User not found', 'NOT_FOUND');

    let updatedTeam: Team;

    const acceptTransaction = db.transaction(() => {
      // 1. Find invitation by token hash
      const invitation = db
        .prepare('SELECT * FROM team_invitations WHERE token_hash = ?')
        .get(tokenHash) as any;
      if (!invitation) {
        throw new TeamServiceError('Invitation not found', 'NOT_FOUND');
      }

      if (invitation.status !== 'pending') {
        throw new TeamServiceError(`Invitation is no longer valid (status: ${invitation.status})`, 'BAD_REQUEST');
      }

      const now = new Date().toISOString();
      if (now > invitation.expires_at) {
        db.prepare("UPDATE team_invitations SET status = 'expired' WHERE id = ?").run(invitation.id);
        throw new TeamServiceError('Invitation has expired', 'BAD_REQUEST');
      }

      // 2. Verify team exists
      const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(invitation.team_id) as any;
      if (!team) {
        throw new TeamServiceError('Team no longer exists', 'NOT_FOUND');
      }

      // 3. Verify event permits registration
      this.verifyEventAllowsRegistration(team.event_id);

      // 4. Verify user is not already in a team for this event
      const existingMember = db
        .prepare('SELECT team_id FROM team_members WHERE event_id = ? AND user_id = ?')
        .get(team.event_id, userId) as any;
      if (existingMember) {
        throw new TeamServiceError('You are already a member of a team in this event', 'CONFLICT');
      }

      // 5. Verify team capacity
      const memberCountRow = db
        .prepare('SELECT count(*) as count FROM team_members WHERE team_id = ?')
        .get(team.id) as any;
      if (memberCountRow.count >= MAX_TEAM_SIZE) {
        throw new TeamServiceError(`Team has reached the maximum size of ${MAX_TEAM_SIZE} members`, 'BAD_REQUEST');
      }

      // 6. Atomically add member
      const memberId = generateId('tm');
      db.prepare(`
        INSERT INTO team_members (id, team_id, user_id, event_id, role, joined_at)
        VALUES (?, ?, ?, ?, 'member', ?)
      `).run(memberId, team.id, userId, team.event_id, now);

      // 7. Mark invitation accepted
      db.prepare(`
        UPDATE team_invitations SET
          status = 'accepted',
          accepted_at = ?,
          accepted_by = ?
        WHERE id = ?
      `).run(now, userId, invitation.id);

      updatedTeam = this.getTeamById(team.id)!;
    });

    acceptTransaction();
    return updatedTeam!;
  }

  /**
   * Revokes a pending invitation (captain or admin only).
   */
  static revokeInvitation(invitationId: string, userId: string, userRole: UserRole): boolean {
    const db = getDatabase();
    const invitation = db.prepare('SELECT * FROM team_invitations WHERE id = ?').get(invitationId) as any;
    if (!invitation) throw new TeamServiceError('Invitation not found', 'NOT_FOUND');

    // Verify captain or admin
    const membership = db
      .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(invitation.team_id, userId) as any;
    if (membership?.role !== 'captain' && userRole !== 'admin') {
      throw new TeamServiceError('Forbidden: Only the team captain can revoke invitations', 'FORBIDDEN');
    }

    db.prepare("UPDATE team_invitations SET status = 'revoked' WHERE id = ?").run(invitationId);
    return true;
  }

  /**
   * Removes a member from a team (captain or admin only).
   */
  static removeMember(
    teamId: string,
    targetUserId: string,
    requestingUserId: string,
    requestingUserRole: UserRole
  ): boolean {
    const db = getDatabase();
    const membership = db
      .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(teamId, requestingUserId) as any;
    if (membership?.role !== 'captain' && requestingUserRole !== 'admin') {
      throw new TeamServiceError('Forbidden: Only the captain can remove team members', 'FORBIDDEN');
    }

    if (targetUserId === requestingUserId) {
      throw new TeamServiceError('Captain cannot remove themselves via member-removal; use the leave endpoint instead', 'BAD_REQUEST');
    }

    const target = db
      .prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(teamId, targetUserId) as any;
    if (!target) {
      throw new TeamServiceError('Target user is not a member of this team', 'NOT_FOUND');
    }

    db.prepare('DELETE FROM team_members WHERE id = ?').run(target.id);
    return true;
  }

  /**
   * Allows a user to leave a team.
   * Captains cannot leave if other members remain. If a solo captain leaves, the team is cleanly removed.
   */
  static leaveTeam(teamId: string, userId: string): { left: boolean; teamDeleted: boolean } {
    const db = getDatabase();
    const member = db
      .prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?')
      .get(teamId, userId) as any;
    if (!member) {
      throw new TeamServiceError('You are not a member of this team', 'NOT_FOUND');
    }

    const allMembers = db
      .prepare('SELECT id, role FROM team_members WHERE team_id = ?')
      .all(teamId) as any[];

    if (member.role === 'captain') {
      if (allMembers.length > 1) {
        throw new TeamServiceError(
          'Captain cannot leave the team while other members remain. Disband the team or remove members first.',
          'BAD_REQUEST'
        );
      }

      // Solo captain leaves -> clean up team and memberships
      db.prepare('DELETE FROM teams WHERE id = ?').run(teamId);
      return { left: true, teamDeleted: true };
    }

    // Normal member leaves
    db.prepare('DELETE FROM team_members WHERE id = ?').run(member.id);
    return { left: true, teamDeleted: false };
  }
}

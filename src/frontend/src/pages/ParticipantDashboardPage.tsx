import React, { useState, useEffect } from 'react';
import { Link } from '../router/Router';
import { useAuth } from '../context/AuthContext';
import { EventListItem, TeamWithDetails } from '../../../shared/types';
import { api } from '../services/api';
import { StatusPill } from '../components/StatusPill';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';

export const ParticipantDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [myTeams, setMyTeams] = useState<TeamWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsData, teamsData] = await Promise.all([
        api.events.list(),
        api.teams.getMyTeams().catch(() => [])
      ]);
      setEvents(eventsData);
      setMyTeams(teamsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load hackathons');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge" style={{ background: 'rgba(53, 189, 246, 0.12)', color: '#0284c7', border: '1px solid rgba(53, 189, 246, 0.25)' }}>
              Arbiter Participant Portal
            </span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Welcome back, {user?.name}</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Your Projects on Arbiter</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '6px' }}>
            Manage your project submissions, explore registered events, and review team rosters.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link to="/events" className="button button-outline" style={{ textDecoration: 'none' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>explore</span>
            Browse Events
          </Link>
          <Link to="/gallery" className="button button-primary" style={{ textDecoration: 'none' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>grid_view</span>
            Public Gallery
          </Link>
        </div>
      </header>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Quick Action Cards */}
      <div className="grid grid-cols-3" style={{ gap: '20px' }}>
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(0,102,204,0.1)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined">rocket_launch</span>
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Active Hackathons</h3>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Available challenges</span>
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700 }} className="tnum">
            {events.length}
          </div>
          <Link to="/events" style={{ display: 'inline-block', marginTop: '12px', fontSize: '13px', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
            Find competitions &rarr;
          </Link>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(52,199,89,0.1)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined">group</span>
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>My Projects & Teams</h3>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Squad affiliations</span>
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700 }} className="tnum">
            {myTeams.length}
          </div>
          <a href="#my-projects" style={{ display: 'inline-block', marginTop: '12px', fontSize: '13px', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
            View your projects &darr;
          </a>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,149,0,0.1)', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined">workspace_premium</span>
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Certificates</h3>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Credentials & Awards</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 12px 0' }}>
            Access verifiable cryptographically signed credentials.
          </p>
          <Link to="/certificates" style={{ display: 'inline-block', fontSize: '13px', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
            Certificate Center &rarr;
          </Link>
        </div>
      </div>

      {/* My Projects & Teams Section */}
      <section id="my-projects">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>My Projects & Teams</h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
              Teams you belong to, active project drafts, and published submissions.
            </p>
          </div>
          <Link to="/events" className="button button-outline" style={{ textDecoration: 'none' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
            Join Another Hackathon
          </Link>
        </div>

        {loading ? (
          <LoadingState message="Loading your teams and projects..." />
        ) : myTeams.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
              group_off
            </span>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px 0' }}>No Projects or Teams Yet</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '0 0 16px 0' }}>
              Register for an active hackathon to form or join a team and submit your project.
            </p>
            <Link to="/events" className="button button-primary" style={{ textDecoration: 'none' }}>
              Browse Competitions
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {myTeams.map((team) => (
              <div key={team.id} className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span className="badge" style={{ background: 'rgba(0,102,204,0.1)', color: 'var(--color-primary)', fontWeight: 600 }}>
                        {team.eventName || 'Hackathon Event'}
                      </span>
                      {team.eventStatus && <StatusPill status={team.eventStatus} />}
                      <span className="badge" style={{ background: team.myRole === 'captain' ? 'rgba(52,199,89,0.15)' : 'rgba(142,142,147,0.15)', color: team.myRole === 'captain' ? 'var(--color-success)' : 'inherit', fontWeight: 600 }}>
                        {team.myRole === 'captain' ? 'Captain' : 'Member'}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px 0' }}>{team.name}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                      Squad Slug: <code>{team.slug}</code> • {team.members?.length || team.memberCount || 1} Member(s):{' '}
                      <strong>{team.members?.map((m) => m.userName).join(', ') || 'Self'}</strong>
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Link to={`/teams/${team.id}`} className="button button-outline" style={{ textDecoration: 'none' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>group</span>
                      Manage Team
                    </Link>
                    <Link to={`/events/${team.eventId}/submission`} className="button button-primary" style={{ textDecoration: 'none' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {team.submissionStatus === 'submitted' ? 'visibility' : 'edit_note'}
                      </span>
                      {team.submissionStatus === 'submitted' ? 'View Submission' : team.submissionStatus === 'draft' ? 'Edit Draft' : 'Create Submission'}
                    </Link>
                  </div>
                </div>

                {/* Submission Sub-Card */}
                <div style={{ background: 'var(--color-bg)', padding: '14px 18px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="material-symbols-outlined" style={{ color: team.submissionStatus === 'submitted' ? 'var(--color-success)' : team.submissionStatus === 'draft' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                      {team.submissionStatus === 'submitted' ? 'task_alt' : team.submissionStatus === 'draft' ? 'draft' : 'upload_file'}
                    </span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>
                        {team.submissionTitle ? team.submissionTitle : 'No project submission drafted yet'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {team.submissionStatus === 'submitted'
                          ? 'Submitted & published to the event gallery'
                          : team.submissionStatus === 'draft'
                          ? 'Draft saved privately — submit before the deadline'
                          : 'You have formed your squad! Next, create a project submission.'}
                      </div>
                    </div>
                  </div>

                  {team.submissionSlug && team.submissionStatus === 'submitted' && (
                    <Link to={`/gallery/${team.submissionSlug}`} className="button button-outline" style={{ fontSize: '12px', textDecoration: 'none', padding: '6px 12px' }}>
                      Public Gallery View &rarr;
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Events Stream */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Available Competitions</h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
              Explore other hackathons hosted on this platform.
            </p>
          </div>
          <Link to="/events" style={{ fontSize: '13px', color: 'var(--color-primary)', textDecoration: 'none' }}>
            View all ({events.length}) &rarr;
          </Link>
        </div>

        {loading ? (
          <LoadingState message="Loading events..." />
        ) : events.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>No competitions currently active.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {events.map((ev) => {
              const userTeam = myTeams.find((t) => t.eventId === ev.id);
              return (
                <div key={ev.id} className="card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{ev.name}</h3>
                      <StatusPill status={ev.status || 'draft'} />
                      {userTeam && (
                        <span className="badge" style={{ background: 'rgba(52,199,89,0.1)', color: 'var(--color-success)', fontWeight: 600 }}>
                          Registered: {userTeam.name}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, maxWidth: '650px' }}>
                      {ev.description || 'No description provided.'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Link to={`/events/${ev.id}`} className="button button-outline" style={{ textDecoration: 'none' }}>
                      Details
                    </Link>
                    {userTeam ? (
                      <>
                        <Link to={`/teams/${userTeam.id}`} className="button button-outline" style={{ textDecoration: 'none' }}>
                          Manage {userTeam.name}
                        </Link>
                        <Link to={`/events/${ev.id}/submission`} className="button button-primary" style={{ textDecoration: 'none' }}>
                          Project Submission
                        </Link>
                      </>
                    ) : (
                      <Link to={`/events/${ev.id}/register`} className="button button-primary" style={{ textDecoration: 'none' }}>
                        Register / Team
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

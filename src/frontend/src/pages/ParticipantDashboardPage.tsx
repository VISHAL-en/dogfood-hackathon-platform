import React, { useState, useEffect } from 'react';
import { Link } from '../router/Router';
import { useAuth } from '../context/AuthContext';
import { EventListItem } from '../../../shared/types';
import { api } from '../services/api';
import { StatusPill } from '../components/StatusPill';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';

export const ParticipantDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.events.list();
      setEvents(data);
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
            <span className="badge" style={{ background: 'rgba(0,102,204,0.1)', color: 'var(--color-primary)' }}>
              Participant Portal
            </span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Welcome back, {user?.name}</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Hacker Dashboard</h1>
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
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>My Teams</h3>
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Team affiliations</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 12px 0' }}>
            Form a squad, invite co-creators, or manage existing membership.
          </p>
          <Link to="/events" style={{ display: 'inline-block', fontSize: '13px', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
            Manage team in event &rarr;
          </Link>
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

      {/* Events Stream */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Available Competitions</h2>
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
            {events.map((ev) => (
              <div key={ev.id} className="card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{ev.name}</h3>
                    <StatusPill status={ev.status || 'draft'} />
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, maxWidth: '650px' }}>
                    {ev.description || 'No description provided.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link to={`/events/${ev.id}`} className="button button-outline" style={{ textDecoration: 'none' }}>
                    Details
                  </Link>
                  <Link to={`/events/${ev.id}/register`} className="button button-primary" style={{ textDecoration: 'none' }}>
                    Register / Team
                  </Link>
                  <Link to={`/events/${ev.id}/submission`} className="button button-outline" style={{ textDecoration: 'none' }}>
                    Submission
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

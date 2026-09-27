import React, { useEffect, useState } from 'react';
import { useParams, Link } from '../router/Router';
import { EventWithDetails, EventTrack, EventPrize } from '../../../shared/types';
import { api } from '../services/api';
import { StatusPill } from '../components/StatusPill';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';

export const EventDetailsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    api.events
      .getByIdOrSlug(eventId)
      .then((data) => {
        setEvent(data);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load event details');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [eventId]);

  if (loading) {
    return <LoadingState message="Loading event details..." />;
  }

  if (error || !event) {
    return (
      <div className="page-container">
        <ErrorBanner message={error || 'Event not found'} />
        <Link to="/events" className="btn btn-secondary btn-sm" style={{ marginTop: '16px' }}>
          Back to Events Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Event Header Banner */}
      <div className="card" style={{ marginBottom: '28px', padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <StatusPill status={event.status} />
              <span className="hash-pill">{event.slug}</span>
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em', marginBottom: '12px' }}>
              {event.name}
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--on-surface-variant)', maxWidth: '800px', lineHeight: 1.6 }}>
              {event.description}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to={`/events/${event.id}/register`} className="btn btn-primary">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>group_add</span>
              <span>Register Team</span>
            </Link>
            <Link to={`/gallery?event=${event.id}`} className="btn btn-secondary">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>grid_view</span>
              <span>Gallery</span>
            </Link>
          </div>
        </div>

        {/* Timeline Strip */}
        <div
          style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid var(--outline-border)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px'
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Registration Opens</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--on-surface)' }} className="tabular-nums">
              {new Date(event.registrationStart).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Registration Closes</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--on-surface)' }} className="tabular-nums">
              {new Date(event.registrationEnd).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--primary)', textTransform: 'uppercase', fontWeight: 700 }}>Submission Deadline</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }} className="tabular-nums">
              {new Date(event.submissionDeadline).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Judging Window</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--on-surface)' }} className="tabular-nums">
              {new Date(event.judgingStart).toLocaleDateString()} – {new Date(event.judgingEnd).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '28px' }}>
        {/* Tracks Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>category</span>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--on-surface)' }}>Competition Tracks</h2>
          </div>

          {event.tracks.length === 0 ? (
            <p style={{ color: 'var(--outline)', fontSize: '13px' }}>No specific tracks specified for this event.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {event.tracks.map((track: EventTrack) => (
                <div key={track.id} className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--on-surface)' }}>{track.name}</h3>
                    <span className="hash-pill">{track.slug}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>{track.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prizes Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span className="material-symbols-outlined" style={{ color: '#d97706' }}>military_tech</span>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--on-surface)' }}>Prizes & Awards</h2>
          </div>

          {event.prizes.length === 0 ? (
            <p style={{ color: 'var(--outline)', fontSize: '13px' }}>No prizes declared for this event.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {event.prizes.map((prize: EventPrize) => (
                <div key={prize.id} className="card" style={{ padding: '20px', borderLeft: '4px solid #d97706' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--on-surface)' }}>{prize.name}</h3>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#d97706' }} className="tabular-nums">
                      ${prize.amount.toLocaleString()} {prize.currency}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>{prize.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

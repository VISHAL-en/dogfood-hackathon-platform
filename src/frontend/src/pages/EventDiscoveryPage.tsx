import React, { useEffect, useState } from 'react';
import { Link } from '../router/Router';
import { EventListItem } from '../../../shared/types';
import { api } from '../services/api';
import { StatusPill } from '../components/StatusPill';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';

export const EventDiscoveryPage: React.FC = () => {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    setLoading(true);
    api.events
      .list({
        search: search.trim() ? search : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      })
      .then((data) => {
        setEvents(data);
      })
      .catch(() => {
        setEvents([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [search, statusFilter]);

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Event Discovery</h1>
          <p className="page-subtitle">
            Browse active hackathons, technical tracks, and evaluation portals hosted on this instance.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '28px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ position: 'relative', width: '320px' }}>
          <span
            className="material-symbols-outlined"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--outline)', fontSize: '18px' }}
          >
            search
          </span>
          <input
            type="text"
            className="input-text"
            placeholder="Search events by title or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        <div className="segmented-control">
          <button
            type="button"
            className={`segmented-item ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Events
          </button>
          <button
            type="button"
            className={`segmented-item ${statusFilter === 'published' ? 'active' : ''}`}
            onClick={() => setStatusFilter('published')}
          >
            Published
          </button>
          <button
            type="button"
            className={`segmented-item ${statusFilter === 'registration_open' ? 'active' : ''}`}
            onClick={() => setStatusFilter('registration_open')}
          >
            Registration Live
          </button>
          <button
            type="button"
            className={`segmented-item ${statusFilter === 'judging_open' ? 'active' : ''}`}
            onClick={() => setStatusFilter('judging_open')}
          >
            Judging
          </button>
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <LoadingState message="Loading events catalog..." />
      ) : events.length === 0 ? (
        <EmptyState
          icon="search_off"
          title="No events matching criteria"
          description="Try clearing your search query or switching your status filter to show all available events."
          action={
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="btn btn-secondary btn-sm"
            >
              Reset Filters
            </button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
          {events.map((ev) => (
            <div
              key={ev.id}
              className="card card-clickable"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <StatusPill status={ev.status} />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--outline)',
                      background: 'var(--surface-container)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)'
                    }}
                  >
                    {ev.slug}
                  </span>
                </div>

                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '8px' }}>
                  {ev.name}
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', lineHeight: 1.5, marginBottom: '20px' }}>
                  {ev.description}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--outline)', background: 'var(--surface-low)', padding: '4px 8px', borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>category</span>
                    <span>{(ev as any).trackCount ?? 'Featured'} Tracks</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--outline)', background: 'var(--surface-low)', padding: '4px 8px', borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>military_tech</span>
                    <span>{(ev as any).prizeCount ?? 'Cash'} Prizes</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  paddingTop: '16px',
                  borderTop: '1px solid var(--outline-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>
                    Submission Deadline
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--on-surface)' }} className="tabular-nums">
                    {new Date(ev.submissionDeadline).toLocaleDateString()}
                  </div>
                </div>

                <Link to={`/events/${ev.id}`} className="btn btn-primary btn-sm">
                  <span>View Details</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

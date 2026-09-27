import React, { useEffect, useState } from 'react';
import { Link } from '../router/Router';
import { EventListItem, GalleryItem } from '../../../shared/types';
import { api } from '../services/api';
import { StatusPill } from '../components/StatusPill';

export const LandingPage: React.FC = () => {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [featuredGallery, setFeaturedGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    Promise.all([
      api.events.list().catch(() => []),
      api.gallery.list({ limit: 3 }).then((res) => res.items).catch(() => [])
    ]).then(([evList, galItems]) => {
      setEvents(evList);
      setFeaturedGallery(galItems);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* HERO SECTION */}
      <section
        style={{
          position: 'relative',
          minHeight: 'calc(100vh - 56px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          padding: '44px 24px 0 24px',
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #eff4fa 0%, #faf8fe 100%)',
          borderBottom: '1px solid var(--outline-border)'
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            width: '100%',
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Main Hero Content Block */}
          <div>
            {/* Micro Status Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(255, 255, 255, 0.9)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: '20px',
                backdropFilter: 'blur(10px)'
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }}></span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
                Self-Hosted Platform • Zero External Dependencies • v2.4.2 Ready
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(0, 113, 227, 0.3)'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>terminal</span>
              </div>
              <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--on-surface)' }}>
                Dogfood
              </span>
              <span style={{ fontSize: '11px', background: 'var(--surface-high)', padding: '2px 8px', borderRadius: 'var(--radius-xs)', color: 'var(--on-surface-variant)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                CORE CONTROL
              </span>
            </div>

            <h1
              style={{
                fontSize: '40px',
                lineHeight: 1.15,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: 'var(--on-surface)',
                maxWidth: '850px',
                marginBottom: '20px'
              }}
            >
              The{' '}
              <span className="editorial-highlight"><span className="highlight-handle handle-tl" aria-hidden="true" />complete<span className="highlight-handle handle-br" aria-hidden="true" /></span>{' '}
              platform for hackathon submissions, judging & evaluation.
            </h1>

            <p
              style={{
                fontSize: '16px',
                lineHeight: 1.6,
                color: 'var(--on-surface-variant)',
                maxWidth: '720px',
                marginBottom: '28px'
              }}
            >
              Engineered for organizations running high-stakes hackathons. From multi-track team registration and sandbox submissions to weighted rubric scoring and reproducible cross-judge normalization with cryptographic proof hashes.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <Link to="/events" className="btn btn-primary btn-lg">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>explore</span>
                <span>Browse Public Events</span>
              </Link>
              <Link to="/gallery" className="btn btn-secondary btn-lg">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>grid_view</span>
                <span>Explore Gallery</span>
              </Link>
              <Link to="/login" className="btn btn-ghost btn-lg">
                <span>Sign In to Instance</span>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
              </Link>
            </div>
          </div>

          {/* Quick Platform Capability Chips */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginTop: 'clamp(84px, 16.5vh, 128px)',
              paddingTop: '28px',
              paddingBottom: 'clamp(72px, 10vh, 112px)',
              borderTop: '1px solid var(--outline-border)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <span className="material-symbols-outlined">security</span>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--on-surface)' }}>Zero Cloud Auth</div>
                <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>Self-contained session hashing</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <span className="material-symbols-outlined">visibility_off</span>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--on-surface)' }}>Blind Score Isolation</div>
                <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>Zero peer score leakage</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <span className="material-symbols-outlined">functions</span>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--primary)' }}>Z-Score Engine</div>
                <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>Deterministic population variance</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <span className="material-symbols-outlined">verified</span>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--on-surface)' }}>SHA-256 Audit Proof</div>
                <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)' }}>Canonical proof verification</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ACTIVE EVENTS PREVIEW */}
      <section className="page-container" style={{ paddingBottom: '48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase' }}>
              Hackathons In Motion
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--on-surface)', marginTop: '4px' }}>
              Live & Upcoming Events
            </h2>
          </div>
          <Link to="/events" className="btn btn-secondary btn-sm">
            <span>View All ({events.length})</span>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--outline)' }}>Loading events catalog...</div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <p>No published events found in local database.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
            {events.slice(0, 3).map((ev) => (
              <div key={ev.id} className="card card-clickable" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <StatusPill status={ev.status} />
                    <span style={{ fontSize: '11px', color: 'var(--outline)', fontFamily: 'var(--font-mono)' }}>
                      {(ev as any).trackCount ? `${(ev as any).trackCount} Tracks` : 'Multi-Track'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '8px' }}>
                    {ev.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', lineHeight: 1.5, marginBottom: '16px' }}>
                    {ev.description}
                  </p>
                </div>

                <div style={{ paddingTop: '16px', borderTop: '1px solid var(--outline-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--outline)' }}>
                    Deadline: {new Date(ev.submissionDeadline).toLocaleDateString()}
                  </span>
                  <Link to={`/events/${ev.id}`} className="btn btn-primary btn-sm">
                    <span>Inspect Event</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FEATURED PROJECTS STRIP */}
      {featuredGallery.length > 0 && (
        <section style={{ background: 'var(--surface-low)', borderTop: '1px solid var(--outline-border)' }}>
          <div className="page-container" style={{ paddingTop: '48px', paddingBottom: '48px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase' }}>
                  Showcase
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--on-surface)', marginTop: '4px' }}>
                  Submitted Projects Gallery
                </h2>
              </div>
              <Link to="/gallery" className="btn btn-secondary btn-sm">
                <span>Explore Full Gallery</span>
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {featuredGallery.map((p) => (
                <div key={p.id} className="card card-clickable">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        background: 'var(--surface-container)',
                        color: 'var(--primary)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        fontWeight: 600,
                        flexShrink: 0,
                        width: 'fit-content',
                        maxWidth: '135px',
                        lineHeight: 1.3
                      }}
                    >
                      {p.trackName || 'General Track'}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--outline)',
                        fontFamily: 'var(--font-mono)',
                        textAlign: 'right'
                      }}
                    >
                      {p.eventName}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '6px' }}>{p.title}</h4>
                  <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', lineHeight: 1.5, marginBottom: '16px' }}>{p.shortDescription}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--on-surface)' }}>Team: {p.teamName}</span>
                    <Link to={`/gallery/${p.slug}`} className="btn btn-ghost btn-sm">
                      <span>View Demo</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

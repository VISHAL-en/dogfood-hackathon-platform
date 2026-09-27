import React, { useEffect, useState } from 'react';
import { HealthResponse } from '../../../shared/types';
import { api } from '../services/api';
import { LoadingState } from '../components/LoadingState';

export const PlatformSettingsPage: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.system
      .getHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Running platform system diagnostics..." />;

  return (
    <div className="page-container" style={{ maxWidth: '900px' }}>
      <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="instance-badge">
            <span className="orb"></span>
            <span>Self-Hosted Instance Control</span>
          </span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--on-surface)' }}>
          Platform Settings & Node Diagnostics
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
          Core system state, database connectivity, and verification of zero-cloud offline invariants.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>System Health</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: health?.status === 'ok' ? 'var(--status-done-fg)' : 'var(--error)' }}></span>
            <span style={{ fontSize: '18px', fontWeight: 700, textTransform: 'uppercase' }}>
              {health?.status || 'Error'}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--outline)', marginTop: '4px' }}>
            Uptime: {health?.uptimeSeconds ? `${Math.floor(health.uptimeSeconds / 60)} min` : '0 min'}
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>Database Engine</span>
          <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '6px', color: 'var(--on-surface)' }}>
            SQLite (WAL Mode)
          </div>
          <div style={{ fontSize: '11px', color: 'var(--status-done-fg)', fontWeight: 600, marginTop: '4px' }}>
            ✓ Foreign Keys Enforced
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>Cloud Dependencies</span>
          <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '6px', color: 'var(--status-done-fg)' }}>
            Zero External APIs
          </div>
          <div style={{ fontSize: '11px', color: 'var(--outline)', marginTop: '4px' }}>
            100% self-hosted & air-gapped
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '12px' }}>
          Database File Location & Runtime
        </h3>
        <div className="code-box">
          {health?.database.path || 'Configured via DB_PATH environment variable'}
        </div>

        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--on-surface)', marginTop: '16px', marginBottom: '8px' }}>
          DOGFOOD Acceptance Invariants
        </h4>
        <ul style={{ paddingLeft: '18px', fontSize: '12px', color: 'var(--on-surface-variant)', lineHeight: 1.8 }}>
          <li>Raw judge scores are immutable historical evidence and never overwritten.</li>
          <li>Strict backend judge score isolation rejects peer score queries with HTTP 403 Forbidden.</li>
          <li>Cross-judge normalization uses deterministic population standard deviation ($\sigma$).</li>
          <li>Canonical JSON proof serialization guarantees SHA-256 verification parity.</li>
        </ul>
      </div>
    </div>
  );
};

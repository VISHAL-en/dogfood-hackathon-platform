import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from '../router/Router';

export const UserProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="page-container" style={{ maxWidth: '500px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '36px' }}>
          <h2>Session Not Active</h2>
          <p style={{ color: 'var(--on-surface-variant)', margin: '12px 0 20px 0' }}>
            Please sign in to inspect your user profile and permissions.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="page-container" style={{ maxWidth: '720px' }}>
      <div className="card" style={{ padding: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(0, 113, 227, 0.3)'
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--on-surface)' }}>{user.name}</h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  background: 'var(--primary-container)',
                  color: 'var(--on-primary-container)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)'
                }}
              >
                {user.role}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '2px' }}>{user.email}</p>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--outline-border)', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>System Identifier</span>
            <div className="code-box" style={{ marginTop: '4px', padding: '10px' }}>{user.id}</div>
          </div>

          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600 }}>Security Invariant</span>
            <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px', lineHeight: 1.5 }}>
              Authentication is backed by server-side SHA-256 session token hashes in SQLite WAL mode.
              Client-side claims are strictly non-authoritative; the Express backend enforces all RBAC rules.
            </p>
          </div>

          <div style={{ paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link to="/settings" className="btn btn-secondary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>monitor_heart</span>
              <span>Platform Health</span>
            </Link>
            <button onClick={handleSignOut} className="btn btn-danger btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

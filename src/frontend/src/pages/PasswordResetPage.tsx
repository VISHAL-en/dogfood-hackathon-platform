import React, { useState } from 'react';
import { Link } from '../router/Router';

/**
 * PasswordResetPage (Stitch: dogfood_password_reset)
 *
 * IMPLEMENTATION STATUS: NOT YET SUPPORTED BY BACKEND / VISUAL ONLY
 * The platform operates offline with local SQLite credentials. No external SMTP
 * or mail delivery subsystem is configured. This interface honestly informs
 * users that automated password recovery is unavailable in this environment.
 */
export const PasswordResetPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 56px)',
        padding: '40px 16px'
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '440px',
          width: '100%',
          padding: '36px',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-window)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>lock_reset</span>
          </div>
          <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--on-surface)' }}>Dogfood</span>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--on-surface)', letterSpacing: '-0.02em', margin: 0 }}>
              Password Recovery
            </h1>
            <span className="badge" style={{ background: 'var(--surface-container)', color: 'var(--outline)', fontSize: '11px' }}>
              UNCONFIGURED
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
            Automated email recovery is not configured for this self-hosted offline deployment.
          </p>
        </div>

        <div style={{ background: 'var(--surface-low)', border: '1px solid var(--outline-border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '20px', fontSize: '12px', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--outline)', marginTop: '1px' }}>info</span>
          <div>
            <strong>Self-Hosted Instance Notice:</strong> No external email delivery or SMTP service is configured for this platform. Please contact your instance administrator for direct credential assistance.
          </div>
        </div>

        {submitted ? (
          <div>
            <div className="alert alert-error" style={{ marginBottom: '16px' }}>
              <span className="material-symbols-outlined">mail_lock</span>
              <div style={{ fontSize: '12px' }}>
                <strong>Feature Unavailable:</strong> Automated password reset is not supported by the backend in this self-hosted environment. No reset emails or tokens can be dispatched for {email}.
              </div>
            </div>
            <Link to="/login" className="btn btn-secondary" style={{ width: '100%', marginTop: '8px' }}>
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="reset-email">
                Account Email
              </label>
              <input
                id="reset-email"
                type="email"
                className="input-text"
                placeholder="name@organization.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-secondary" style={{ width: '100%', height: '40px', marginTop: '8px' }}>
              Check Reset Availability
            </button>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <Link to="/login" style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 500 }}>
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Link, useNavigate } from '../router/Router';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

export const SignInPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const user = await login(email, password);
      // Route intelligently based on role
      if (user.role === 'judge') {
        navigate('/judge');
      } else if (user.role === 'organizer' || user.role === 'admin') {
        navigate('/organizer');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Authentication failed. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 56px)',
        padding: '40px 16px',
        position: 'relative'
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          width: '600px',
          height: '350px',
          background: 'radial-gradient(ellipse at center, rgba(215, 226, 255, 0.4) 0%, rgba(250, 248, 254, 0) 70%)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      <div
        className="card"
        style={{
          maxWidth: '440px',
          width: '100%',
          position: 'relative',
          zIndex: 1,
          padding: '36px',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-window)'
        }}
      >
        {/* Top Identity Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0, 113, 227, 0.25)'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>terminal</span>
            </div>
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--on-surface)' }}>Dogfood</span>
          </div>
          <span className="instance-badge">
            <span className="orb"></span>
            <span>Self-Hosted</span>
          </span>
        </div>

        {/* Title & Description */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            Sign In
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
            Enter your credentials to access your judging dashboard, event portal, or team workspace.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '20px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
            <div style={{ fontSize: '12px' }}>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="email-input">
              Work or Institutional Email
            </label>
            <input
              id="email-input"
              type="email"
              className="input-text"
              placeholder="alex.chen@organization.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" htmlFor="password-input" style={{ marginBottom: 0 }}>
                Password
              </label>
              <Link to="/forgot-password" style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 500 }}>
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                className="input-text"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--outline)',
                  cursor: 'pointer',
                  display: 'flex'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
            <input type="checkbox" id="remember-device" defaultChecked style={{ accentColor: 'var(--primary)' }} />
            <label htmlFor="remember-device" style={{ fontSize: '12px', color: 'var(--on-surface-variant)', cursor: 'pointer' }}>
              Remember session on this device
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', height: '40px', marginTop: '8px' }}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Instance</span>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Switcher */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--outline-border)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--outline)', fontWeight: 600, marginBottom: '8px', textAlign: 'center' }}>
            Instant Evaluation Roles (Deterministic Seed)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('organizer@dogfood.local', 'OrganizerPassword123!')}
            >
              Lead Organizer
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('judge_a@dogfood.local', 'JudgeAPassword123!')}
            >
              Judge Alice
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('judge_b@dogfood.local', 'JudgeBPassword123!')}
            >
              Judge Bob
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('participant@dogfood.local', 'ParticipantPassword123!')}
            >
              Pat Participant
            </button>
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--on-surface-variant)' }}>
          Need an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
};

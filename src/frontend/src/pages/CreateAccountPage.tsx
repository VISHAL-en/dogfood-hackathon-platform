import React, { useState } from 'react';
import { Link, useNavigate } from '../router/Router';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';

/**
 * CreateAccountPage (Stitch: dogfood_create_account)
 *
 * SECURITY INVARIANT:
 * Public self-registration strictly assigns the 'participant' role.
 * Evaluator (judge) and organizer accounts must be provisioned through
 * authorized server-side administrative procedures. No role selector is offered.
 */
export const CreateAccountPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await register({ name, email, password });
      navigate('/dashboard');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Registration failed. Please check your information.');
      }
    } finally {
      setLoading(false);
    }
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
      <div
        className="card"
        style={{
          maxWidth: '460px',
          width: '100%',
          padding: '36px',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-window)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/branding/arbiter-icon.png"
              alt="Arbiter"
              style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
            />
            <span style={{ fontSize: '19px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--on-surface)' }}>Arbiter</span>
          </div>
          <span className="instance-badge">
            <span className="orb"></span>
            <span>Self-Hosted</span>
          </span>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
            Create Your Arbiter Account
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
            Register to join hackathons, build teams, and submit projects.
          </p>
        </div>

        <div style={{ background: 'var(--surface-low)', border: '1px solid var(--outline-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '20px', fontSize: '12px', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--primary)' }}>shield</span>
          <span>Public accounts register as <strong>Hackathon Participants</strong>. Evaluator & organizer accounts are provisioned by administrators.</span>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '20px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
            <div style={{ fontSize: '12px' }}>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="reg-name">
              Full Legal or Display Name
            </label>
            <input
              id="reg-name"
              type="text"
              className="input-text"
              placeholder="e.g. Jordan Miller"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="reg-email">
              Email Address
            </label>
            <input
              id="reg-email"
              type="email"
              className="input-text"
              placeholder="jordan.miller@example.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="reg-password">
              Password
            </label>
            <input
              id="reg-password"
              type="password"
              className="input-text"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', height: '40px', marginTop: '8px' }}
          >
            {loading ? 'Creating Account...' : 'Register as Participant'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--on-surface-variant)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Link, useNavigate } from '../router/Router';
import { useAuth } from '../context/AuthContext';

export const AppHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="top-header">
      <div className="top-header-inner">
        <div className="brand-cluster">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none' }} title="Arbiter — Home">
            <img
              src="/branding/arbiter-icon.png"
              alt="Arbiter"
              style={{
                width: '26px',
                height: '26px',
                objectFit: 'contain',
                borderRadius: '6px'
              }}
            />
            <span className="brand-title" style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--on-surface)' }}>
              Arbiter
            </span>
          </Link>

          <span className="instance-badge" style={{ marginLeft: '12px' }}>
            <span className="orb"></span>
            <span>Self-Hosted</span>
          </span>

          <nav className="top-nav-links">
            <Link to="/events" className="nav-link-btn">Browse Events</Link>
            <Link to="/gallery" className="nav-link-btn">Gallery</Link>
            {user?.role === 'participant' && (
              <Link to="/dashboard" className="nav-link-btn">My Projects</Link>
            )}
            {(user?.role === 'organizer' || user?.role === 'admin') && (
              <Link to="/organizer" className="nav-link-btn">Organizer Console</Link>
            )}
            {(user?.role === 'judge' || user?.role === 'admin') && (
              <Link to="/judge" className="nav-link-btn">Judge Portal</Link>
            )}
            <Link to="/results" className="nav-link-btn">Results</Link>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'var(--primary-container)',
                    color: 'var(--on-primary-container)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: '12px'
                  }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--on-surface)' }}>{user.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--outline)', textTransform: 'capitalize' }}>{user.role}</span>
                </div>
              </Link>
              <button onClick={handleLogout} className="btn btn-ghost btn-sm" title="Sign Out">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Sign In
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Create Account
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

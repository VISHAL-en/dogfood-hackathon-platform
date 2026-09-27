import React from 'react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading workspace data...' }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '16px' }}>
      <svg
        style={{
          width: '32px',
          height: '32px',
          color: 'var(--primary)',
          animation: 'spin 0.8s linear infinite'
        }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
        <path d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" fill="currentColor" />
      </svg>
      <span style={{ fontSize: '13px', color: 'var(--on-surface-variant)', fontWeight: 500 }}>
        {message}
      </span>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

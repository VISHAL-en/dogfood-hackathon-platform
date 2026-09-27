import React from 'react';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss }) => {
  if (!message) return null;

  return (
    <div className="alert alert-error">
      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--error)' }}>
        error
      </span>
      <div style={{ flex: 1 }}>{message}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
        </button>
      )}
    </div>
  );
};

import React, { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  title,
  description,
  action
}) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <span className="material-symbols-outlined" style={{ fontSize: '44px' }}>
          {icon}
        </span>
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-text">{description}</p>
      {action && <div style={{ marginTop: '16px' }}>{action}</div>}
    </div>
  );
};

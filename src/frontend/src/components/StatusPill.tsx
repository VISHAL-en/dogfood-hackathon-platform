import React from 'react';

export type StatusType =
  | 'registration_open'
  | 'registration_closed'
  | 'judging_open'
  | 'judging_closed'
  | 'results_published'
  | 'published'
  | 'draft'
  | 'submitted'
  | 'assigned'
  | 'completed'
  | 'running'
  | 'failed';

interface StatusPillProps {
  status: string;
  label?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, label }) => {
  let statusClass = 'status-draft';
  let displayLabel = label || status.replace(/_/g, ' ');

  switch (status.toLowerCase()) {
    case 'registration_open':
    case 'published':
      statusClass = 'status-registration';
      displayLabel = label || 'Registration Live';
      break;
    case 'submitted':
    case 'submission_open':
      statusClass = 'status-submission';
      displayLabel = label || 'Submitted';
      break;
    case 'judging_open':
    case 'assigned':
    case 'running':
      statusClass = 'status-judging';
      displayLabel = label || (status === 'running' ? 'Running' : 'Judging Live');
      break;
    case 'completed':
    case 'results_published':
    case 'registration_closed':
    case 'judging_closed':
      statusClass = 'status-completed';
      displayLabel = label || (status === 'completed' ? 'Completed' : 'Concluded');
      break;
    case 'draft':
    default:
      statusClass = 'status-draft';
      displayLabel = label || 'Draft';
      break;
  }

  return (
    <span className={`status-pill ${statusClass}`}>
      <span className="orb"></span>
      <span style={{ textTransform: 'capitalize' }}>{displayLabel}</span>
    </span>
  );
};

import React, { useEffect, useState } from 'react';
import { Link } from '../router/Router';
import { GalleryItem } from '../../../shared/types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { StatusPill } from '../components/StatusPill';

export const MySubmissionPage: React.FC = () => {
  const [submission, setSubmission] = useState<GalleryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    setLoading(true);
    // Fetch submissions from gallery or default
    api.gallery
      .list({ limit: 50 })
      .then((res) => {
        // If current user is in a team with a submission
        if (res.items.length > 0) {
          setSubmission(res.items[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <LoadingState message="Checking your project submission..." />;

  if (!submission) {
    return (
      <div className="page-container">
        <EmptyState
          icon="upload_file"
          title="No Project Submission Found"
          description="You do not have an active project submission yet. Register a team for an open hackathon to begin drafting your project."
          action={
            <Link to="/events" className="btn btn-primary btn-sm">
              Browse Events
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '900px' }}>
      <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <StatusPill status="submitted" />
              <span className="hash-pill">{submission.eventName}</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--on-surface)' }}>
              {submission.title}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
              Team: <strong>{submission.teamName}</strong> • Track: {submission.trackName || 'General'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to={`/gallery/${submission.slug}`} className="btn btn-secondary">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
              <span>Public Gallery View</span>
            </Link>
          </div>
        </div>

        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--outline-border)', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {submission.repoUrl && (
            <a href={submission.repoUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>code</span>
              <span>Git Repository</span>
            </a>
          )}
          {submission.demoUrl && (
            <a href={submission.demoUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
              <span>Live Demonstration</span>
            </a>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '12px' }}>
          Project Description
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--on-surface-variant)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {submission.description}
        </p>
      </div>
    </div>
  );
};

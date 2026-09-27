import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from '../router/Router';
import { EventWithDetails, ProjectSubmission, EventTrack } from '../../../shared/types';
import { api, ApiError } from '../services/api';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';
import { StatusPill } from '../components/StatusPill';

export const ProjectSubmissionPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [submission, setSubmission] = useState<ProjectSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form inputs
  const [title, setTitle] = useState('');
  const [trackId, setTrackId] = useState<string>('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [reviewMode, setReviewMode] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    api.events
      .getByIdOrSlug(eventId)
      .then((evData) => {
        setEvent(evData);
        // Find existing team or submission if any
        // Check gallery or my submission
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleSaveDraft = async () => {
    if (!title.trim() || !shortDescription.trim() || !description.trim()) {
      setError('Title, Short Summary, and Project Description are required.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (submission?.id) {
        const updated = await api.submissions.updateDraft(submission.id, {
          title,
          trackId: trackId || null,
          shortDescription,
          description,
          repoUrl: repoUrl || null,
          demoUrl: demoUrl || null,
          videoUrl: videoUrl || null
        });
        setSubmission(updated);
      } else {
        // Find team ID for current user in this event
        // Create draft using team
        alert('To create a submission, ensure you have formed or joined a team for this event first.');
      }
      setSuccessMsg('Draft saved successfully.');
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to save submission draft');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!submission?.id) return;
    if (!confirm('Are you ready to submit your project? Once submitted, the project will enter the public gallery.')) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.submissions.submit(submission.id);
      setSubmission(res);
      navigate(`/gallery/${res.slug}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to submit project');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Loading submission portal..." />;

  if (!event) {
    return (
      <div className="page-container">
        <ErrorBanner message={error || 'Event not found'} />
      </div>
    );
  }

  const isSubmitted = submission?.status === 'submitted';

  return (
    <div className="page-container" style={{ maxWidth: '900px' }}>
      {/* Header Card */}
      <div className="card" style={{ marginBottom: '24px', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <StatusPill status={submission?.status || 'draft'} />
              <span style={{ fontSize: '12px', color: 'var(--outline)' }}>•</span>
              <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>{event.name}</span>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--on-surface)' }}>
              Project Submission Workspace
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
              Deadline: <strong className="tabular-nums">{new Date(event.submissionDeadline).toLocaleString()}</strong> (Server Time Authority)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setReviewMode(!reviewMode)}
              className="btn btn-secondary"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                {reviewMode ? 'edit' : 'preview'}
              </span>
              <span>{reviewMode ? 'Edit Mode' : 'Preview Submission'}</span>
            </button>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {successMsg && (
        <div className="alert alert-success">
          <span className="material-symbols-outlined">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      {reviewMode ? (
        /* Review Mode (Stitch Screen 12) */
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Submission Inspection Review</h2>
            <StatusPill status={submission?.status || 'draft'} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--on-surface)' }}>{title || 'Untitled Project'}</h3>
            <p style={{ fontSize: '14px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>{shortDescription || 'No summary provided.'}</p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
            {repoUrl && (
              <a href={repoUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>code</span>
                <span>Code Repository</span>
              </a>
            )}
            {demoUrl && (
              <a href={demoUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
                <span>Live Demo</span>
              </a>
            )}
            {videoUrl && (
              <a href={videoUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>play_circle</span>
                <span>Demo Video</span>
              </a>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--outline-border)', paddingTop: '20px', marginBottom: '28px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '8px' }}>Project Narrative</h4>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: 1.6, color: 'var(--on-surface-variant)' }}>
              {description || 'No detailed description provided.'}
            </div>
          </div>

          {!isSubmitted && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setReviewMode(false)} className="btn btn-secondary">
                Back to Edit
              </button>
              {submission?.id && (
                <button onClick={handleFinalSubmit} disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Submitting...' : 'Confirm & Finalize Submission'}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Edit Mode (Stitch Screen 11) */
        <div className="card" style={{ padding: '32px' }}>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveDraft(); }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="sub-title">Project Title *</label>
              <input
                id="sub-title"
                type="text"
                className="input-text"
                placeholder="e.g. Autonomous Mesh Sentinel"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitted}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="sub-track">Competition Track</label>
              <select
                id="sub-track"
                className="select-input"
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                disabled={isSubmitted}
              >
                <option value="">-- General / Open Evaluation --</option>
                {event.tracks.map((t: EventTrack) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="sub-short">Short Summary (Gallery Card Preview) *</label>
              <input
                id="sub-short"
                type="text"
                className="input-text"
                placeholder="High-level 1-sentence value proposition"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                disabled={isSubmitted}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="sub-desc">Comprehensive Description & Architecture *</label>
              <textarea
                id="sub-desc"
                className="textarea-input"
                placeholder="Explain the problem, technical architecture, offline resilience, and tools used..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitted}
                style={{ minHeight: '140px' }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="sub-repo">Git Repository URL</label>
                <input
                  id="sub-repo"
                  type="url"
                  className="input-text"
                  placeholder="https://github.com/org/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  disabled={isSubmitted}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="sub-demo">Live Demo URL</label>
                <input
                  id="sub-demo"
                  type="url"
                  className="input-text"
                  placeholder="https://demo.example.org"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  disabled={isSubmitted}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="sub-video">Video Presentation URL</label>
                <input
                  id="sub-video"
                  type="url"
                  className="input-text"
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  disabled={isSubmitted}
                />
              </div>
            </div>

            {!isSubmitted && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="submit" disabled={saving} className="btn btn-secondary">
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => setReviewMode(true)}
                  className="btn btn-primary"
                >
                  Proceed to Review
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

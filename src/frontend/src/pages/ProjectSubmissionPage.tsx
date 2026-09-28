import React, { useEffect, useState } from 'react';
import { useParams, Link } from '../router/Router';
import { EventWithDetails, ProjectSubmission, EventTrack, TeamWithDetails } from '../../../shared/types';
import { api, ApiError } from '../services/api';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';
import { StatusPill } from '../components/StatusPill';

export const ProjectSubmissionPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [team, setTeam] = useState<TeamWithDetails | null>(null);
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


  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    api.events
      .getByIdOrSlug(eventId)
      .then(async (evData) => {
        setEvent(evData);
        // Always use canonical event ID
        const teamData = await api.teams.getMyTeamForEvent(evData.id);
        setTeam(teamData);
        if (teamData) {
          const sub = await api.submissions.getTeamSubmission(evData.id, teamData.id);
          if (sub) {
            setSubmission(sub);
            setTitle(sub.title || '');
            setTrackId(sub.trackId || '');
            setShortDescription(sub.shortDescription || '');
            setDescription(sub.description || '');
            setRepoUrl(sub.repoUrl || '');
            setDemoUrl(sub.demoUrl || '');
            setVideoUrl(sub.videoUrl || '');
          }
        }
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
          title: title.trim(),
          trackId: trackId || null,
          shortDescription: shortDescription.trim(),
          description: description.trim(),
          repoUrl: repoUrl.trim() || null,
          demoUrl: demoUrl.trim() || null,
          videoUrl: videoUrl.trim() || null
        });
        setSubmission(updated);
        setSuccessMsg('Draft updated successfully.');
      } else if (team && event) {
        const created = await api.submissions.createDraft(event.id, team.id, {
          title: title.trim(),
          trackId: trackId || null,
          shortDescription: shortDescription.trim(),
          description: description.trim(),
          repoUrl: repoUrl.trim() || null,
          demoUrl: demoUrl.trim() || null,
          videoUrl: videoUrl.trim() || null
        });
        setSubmission(created);
        setSuccessMsg('Project submission draft created successfully.');
      } else {
        setError('To create a submission, ensure you have formed or joined a team for this event first.');
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to save submission draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitProject = async () => {
    if (!title.trim() || !shortDescription.trim() || !description.trim()) {
      setError('Title, Short Summary, and Project Description are required before submitting.');
      return;
    }

    if (!confirm('Are you ready to submit your project? Once submitted, the project will enter the public gallery and be locked for judge evaluation.')) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let draftId = submission?.id;

      if (draftId) {
        await api.submissions.updateDraft(draftId, {
          title: title.trim(),
          trackId: trackId || null,
          shortDescription: shortDescription.trim(),
          description: description.trim(),
          repoUrl: repoUrl.trim() || null,
          demoUrl: demoUrl.trim() || null,
          videoUrl: videoUrl.trim() || null
        });
      } else if (team && event) {
        const created = await api.submissions.createDraft(event.id, team.id, {
          title: title.trim(),
          trackId: trackId || null,
          shortDescription: shortDescription.trim(),
          description: description.trim(),
          repoUrl: repoUrl.trim() || null,
          demoUrl: demoUrl.trim() || null,
          videoUrl: videoUrl.trim() || null
        });
        draftId = created.id;
        setSubmission(created);
      } else {
        setError('To submit a project, you must belong to a team registered in this event.');
        setSubmitting(false);
        return;
      }

      const submitted = await api.submissions.submit(draftId);
      setSubmission(submitted);
      setSuccessMsg(`Project "${submitted.title}" submitted successfully! Published to the public gallery and queued for judge evaluation.`);
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
      <div style={{ marginBottom: '16px' }}>
        <Link to="/dashboard" style={{ fontSize: '13px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          <span>Back to My Projects</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="card" style={{ marginBottom: '24px', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <StatusPill status={submission?.status || 'draft'} />
              <span style={{ fontSize: '12px', color: 'var(--outline)' }}>•</span>
              <span style={{ fontSize: '12px', color: 'var(--on-surface-variant)' }}>{event.name}</span>
              {team && (
                <>
                  <span style={{ fontSize: '12px', color: 'var(--outline)' }}>•</span>
                  <span className="badge" style={{ background: 'rgba(0,102,204,0.1)', color: 'var(--primary)', fontWeight: 600 }}>
                    Team: {team.name} ({team.myRole === 'captain' ? 'Captain' : 'Member'})
                  </span>
                </>
              )}
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

      {!team && (
        <div className="card" style={{ padding: '20px', marginBottom: '20px', borderLeft: '4px solid #ff9500', background: 'var(--color-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="material-symbols-outlined" style={{ color: '#ff9500', fontSize: '20px' }}>warning</span>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>Team Registration Required</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px 0' }}>
            You are not registered in a squad for this event yet. Submissions are associated with a registered squad.
          </p>
          <Link to={`/events/${eventId}/register`} className="button button-primary" style={{ textDecoration: 'none' }}>
            Create or Join a Team &rarr;
          </Link>
        </div>
      )}

      {isSubmitted && (
        <div className="card" style={{ padding: '20px 24px', marginBottom: '24px', background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.3)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-success)', fontSize: '32px' }}>
                task_alt
              </span>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-success)' }}>
                  Project Submitted & Published
                </div>
                <div style={{ fontSize: '13px', color: 'var(--on-surface-variant)' }}>
                  "{submission?.title}" is officially submitted and locked for judging evaluation.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {submission?.slug && (
                <Link to={`/gallery/${submission.slug}`} className="button button-primary" style={{ textDecoration: 'none' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>visibility</span>
                  <span>View in Public Gallery</span>
                </Link>
              )}
              <Link to="/dashboard" className="button button-outline" style={{ textDecoration: 'none' }}>
                Back to My Projects
              </Link>
            </div>
          </div>
        </div>
      )}

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
              <button onClick={handleSubmitProject} disabled={submitting || saving} className="btn btn-primary" id="btn-confirm-submit">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>rocket_launch</span>
                <span>{submitting ? 'Submitting...' : 'Confirm & Finalize Submission'}</span>
              </button>
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button type="submit" disabled={saving || submitting} className="btn btn-secondary">
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => setReviewMode(true)}
                  className="btn btn-secondary"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>preview</span>
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={handleSubmitProject}
                  disabled={submitting || saving}
                  className="btn btn-primary"
                  id="btn-submit-project"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>rocket_launch</span>
                  <span>{submitting ? 'Submitting...' : 'Submit Project'}</span>
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

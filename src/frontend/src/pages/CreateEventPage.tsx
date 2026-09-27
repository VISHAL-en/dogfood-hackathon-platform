import React, { useState } from 'react';
import { useNavigate, Link } from '../router/Router';
import { api, ApiError } from '../services/api';
import { ErrorBanner } from '../components/ErrorBanner';

export const CreateEventPage: React.FC = () => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');

  // Default dates
  const now = new Date();
  const regStart = now.toISOString().slice(0, 16);
  const regEnd = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 16);
  const subDead = new Date(now.getTime() + 20 * 86400000).toISOString().slice(0, 16);
  const judgeStart = new Date(now.getTime() + 21 * 86400000).toISOString().slice(0, 16);
  const judgeEnd = new Date(now.getTime() + 25 * 86400000).toISOString().slice(0, 16);
  const resultsDate = new Date(now.getTime() + 27 * 86400000).toISOString().slice(0, 16);

  const [registrationStart, setRegistrationStart] = useState(regStart);
  const [registrationEnd, setRegistrationEnd] = useState(regEnd);
  const [submissionDeadline, setSubmissionDeadline] = useState(subDead);
  const [judgingStart, setJudgingStart] = useState(judgeStart);
  const [judgingEnd, setJudgingEnd] = useState(judgeEnd);
  const [resultsPublishAt, setResultsPublishAt] = useState(resultsDate);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !description.trim()) {
      setError('Please provide event name, slug, and description.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await api.events.create({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        registrationStart: new Date(registrationStart).toISOString(),
        registrationEnd: new Date(registrationEnd).toISOString(),
        submissionDeadline: new Date(submissionDeadline).toISOString(),
        judgingStart: new Date(judgingStart).toISOString(),
        judgingEnd: new Date(judgingEnd).toISOString(),
        resultsPublishAt: new Date(resultsPublishAt).toISOString()
      });

      navigate(`/organizer/events/${created.id}/settings`);
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/organizer" style={{ fontSize: '13px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          <span>Back to Organizer Console</span>
        </Link>
      </div>

      <div className="card" style={{ padding: '36px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--on-surface)' }}>Create New Hackathon Event</h1>
          <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
            Initialize an isolated event lifecycle with strict server-side deadline and judging timelines.
          </p>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="ev-name">Event Title *</label>
            <input
              id="ev-name"
              type="text"
              className="input-text"
              placeholder="e.g. Autonomous Agents Global 2026"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
                }
              }}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="ev-slug">URL Slug Identifier *</label>
            <input
              id="ev-slug"
              type="text"
              className="input-text"
              placeholder="e.g. autonomous-agents-2026"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
            <span className="form-sublabel">Must be unique across the instance.</span>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="ev-desc">Overview & Rules *</label>
            <textarea
              id="ev-desc"
              className="textarea-input"
              placeholder="Describe the mission, technical scope, and judging guidelines..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              style={{ minHeight: '110px' }}
            />
          </div>

          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--on-surface)', marginTop: '8px' }}>
            Event Timeline & Clock Authority (UTC)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Registration Opens</label>
              <input
                type="datetime-local"
                className="input-text"
                value={registrationStart}
                onChange={(e) => setRegistrationStart(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Registration Closes</label>
              <input
                type="datetime-local"
                className="input-text"
                value={registrationEnd}
                onChange={(e) => setRegistrationEnd(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Submission Deadline</label>
              <input
                type="datetime-local"
                className="input-text"
                value={submissionDeadline}
                onChange={(e) => setSubmissionDeadline(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Judging Opens</label>
              <input
                type="datetime-local"
                className="input-text"
                value={judgingStart}
                onChange={(e) => setJudgingStart(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Judging Closes</label>
              <input
                type="datetime-local"
                className="input-text"
                value={judgingEnd}
                onChange={(e) => setJudgingEnd(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Results Publication</label>
              <input
                type="datetime-local"
                className="input-text"
                value={resultsPublishAt}
                onChange={(e) => setResultsPublishAt(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <Link to="/organizer" className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Creating Event...' : 'Create Event & Configure Rubric'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

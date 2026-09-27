import React, { useEffect, useState } from 'react';
import { useParams, Link } from '../router/Router';
import { SubmissionDetail, PublicVotingResult, PublicVotingResultsResponse } from '../../../shared/types';
import { api } from '../services/api';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';

export const ResultDetailPage: React.FC = () => {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();

  const [project, setProject] = useState<SubmissionDetail | null>(null);
  const [resultItem, setResultItem] = useState<PublicVotingResult | null>(null);
  const [totalVotes, setTotalVotes] = useState<number | null>(null);
  const [resultsPublishedAt, setResultsPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idOrSlug) return;
    setLoading(true);

    api.gallery
      .getDetail(idOrSlug)
      .then(async (detail) => {
        setProject(detail);

        // Fetch voting rounds for event
        const rounds = await api.voting.getRounds(detail.eventId);
        const published = rounds.find(r => r.status === 'results_published');

        if (published) {
          try {
            const resultsData: PublicVotingResultsResponse = await api.voting.getResults(detail.eventId, published.id);
            setTotalVotes(resultsData.totalVotes);
            setResultsPublishedAt(resultsData.resultsPublishedAt);

            const match = resultsData.results.find(
              r => r.submissionId === detail.id || r.slug === detail.slug
            );
            if (match) {
              setResultItem(match);
            }
          } catch {
            // Results not accessible
          }
        }
      })
      .catch((err) => {
        setError(err.message || 'Project result not found');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [idOrSlug]);

  if (loading) return <LoadingState message="Loading result dossier..." />;

  if (error || !project) {
    return (
      <div className="page-container">
        <ErrorBanner message={error || 'Project result not found'} />
        <Link to="/results" className="btn btn-secondary btn-sm" style={{ marginTop: '16px' }}>
          Back to Standings
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '1000px' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--outline)' }}>
        <Link to="/results" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
          <span>Community Results</span>
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--on-surface)', fontWeight: 500 }}>{project.title}</span>
      </div>

      {/* Community Result Hero Card */}
      <div className="card" style={{ padding: '36px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', background: 'var(--primary-container)', color: 'var(--on-primary-container)', padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 700 }}>
                COMMUNITY VOTING RESULT
              </span>
              <span className="hash-pill">{project.eventName}</span>
            </div>

            <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
              {project.title}
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--on-surface-variant)', lineHeight: 1.5, maxWidth: '720px' }}>
              {project.shortDescription}
            </p>
          </div>

          {/* Standings Metrics Bento */}
          {resultItem ? (
            <div
              style={{
                display: 'flex',
                gap: '16px',
                background: 'var(--surface-container-low)',
                padding: '16px 24px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--outline-border)',
                alignItems: 'center'
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Standing</span>
                <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }} className="tabular-nums">
                  {resultItem.rank === 1 ? '🥇 #1' : resultItem.rank === 2 ? '🥈 #2' : resultItem.rank === 3 ? '🥉 #3' : `#${resultItem.rank}`}
                </div>
              </div>

              <div style={{ width: '1px', height: '40px', background: 'var(--outline-border)' }} />

              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Votes</span>
                <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--on-surface)', marginTop: '2px' }} className="tabular-nums">
                  {resultItem.voteCount}
                  {totalVotes !== null && totalVotes > 0 && (
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--outline)', marginLeft: '4px' }}>
                      / {totalVotes}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-container-low)',
                fontSize: '12px',
                color: 'var(--outline)',
                border: '1px solid var(--outline-border)'
              }}
            >
              Results pending publication
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
          {project.demoUrl && (
            <a href={project.demoUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
              <span>Live Demonstration</span>
            </a>
          )}
          {project.repoUrl && (
            <a href={project.repoUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>code</span>
              <span>Code Repository</span>
            </a>
          )}
          <Link to={`/gallery/${project.slug}`} className="btn btn-secondary btn-sm">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
            <span>View in Gallery</span>
          </Link>
        </div>

        {/* Team Strip */}
        <div
          style={{
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid var(--outline-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div>
            <span style={{ fontSize: '11px', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Crafted by</span>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--on-surface)', marginTop: '2px' }}>
              Team: {project.teamName}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--outline)', marginRight: '6px' }}>Team Roster:</span>
            {project.members.map((m) => (
              <span
                key={m.id}
                style={{
                  fontSize: '11px',
                  background: 'var(--surface-container)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 500
                }}
              >
                {m.userName} {m.role === 'captain' && '★'}
              </span>
            ))}
          </div>

          {resultsPublishedAt && (
            <div style={{ fontSize: '12px', color: 'var(--outline)' }} className="tabular-nums">
              Published: {new Date(resultsPublishedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Technical Summary */}
      <div className="card" style={{ padding: '36px', marginBottom: '28px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '16px' }}>
          Project Narrative & Implementation
        </h2>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.7, color: 'var(--on-surface-variant)' }}>
          {project.description}
        </div>
      </div>

      {/* Security Boundary Clarification */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          background: 'var(--surface-container-low)',
          border: '1px solid var(--outline-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <span className="material-symbols-outlined" style={{ color: 'var(--outline)', fontSize: '20px' }}>
          info
        </span>
        <div style={{ fontSize: '12px', color: 'var(--outline)', lineHeight: 1.4 }}>
          Community Voting results represent public crowd ballots cast during the voting round.
          Internal jury evaluations and normalization proofs are maintained separately by organizers.
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Router, Routes, Route, Link } from './router/Router';
import { AuthProvider } from './context/AuthContext';
import { AppHeader } from './components/AppHeader';

// Public & Auth Pages
import { LandingPage } from './pages/LandingPage';
import { SignInPage } from './pages/SignInPage';
import { CreateAccountPage } from './pages/CreateAccountPage';
import { PasswordResetPage } from './pages/PasswordResetPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { PlatformSettingsPage } from './pages/PlatformSettingsPage';

// Discovery & Public Pages
import { EventDiscoveryPage } from './pages/EventDiscoveryPage';
import { EventDetailsPage } from './pages/EventDetailsPage';
import { PublicGalleryPage } from './pages/PublicGalleryPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { PublicResultsPage } from './pages/PublicResultsPage';
import { ResultDetailPage } from './pages/ResultDetailPage';
import { CertificateCenterPage } from './pages/CertificateCenterPage';
import { ArchivePage } from './pages/ArchivePage';

// Participant & Team Pages
import { ParticipantDashboardPage } from './pages/ParticipantDashboardPage';
import { EventRegistrationPage } from './pages/EventRegistrationPage';
import { TeamManagementPage } from './pages/TeamManagementPage';
import { ProjectSubmissionPage } from './pages/ProjectSubmissionPage';
import { MySubmissionPage } from './pages/MySubmissionPage';

// Judge Pages
import { JudgeDashboardPage } from './pages/JudgeDashboardPage';
import { JudgeProjectViewPage } from './pages/JudgeProjectViewPage';

// Organizer Pages
import { OrganizerDashboardPage } from './pages/OrganizerDashboardPage';
import { CreateEventPage } from './pages/CreateEventPage';
import { EventSettingsPage } from './pages/EventSettingsPage';
import { OrganizerSubmissionsPage } from './pages/OrganizerSubmissionsPage';
import { OrganizerTeamsPage } from './pages/OrganizerTeamsPage';
import { OrganizerJudgesPage } from './pages/OrganizerJudgesPage';
import { OrganizerParticipantsPage } from './pages/OrganizerParticipantsPage';
import { JudgingProgressPage } from './pages/JudgingProgressPage';
import { NormalizationWorkspacePage } from './pages/NormalizationWorkspacePage';
import { NormalizationAuditProofPage } from './pages/NormalizationAuditProofPage';
import { ResultsDashboardPage } from './pages/ResultsDashboardPage';

const NotFoundPage: React.FC = () => (
  <div style={{ maxWidth: '600px', margin: '80px auto', textAlign: 'center', padding: '32px' }} className="card">
    <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
      search_off
    </span>
    <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0' }}>404 — Page Not Found</h2>
    <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
      The requested route does not exist or has moved.
    </p>
    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
      <Link to="/" className="button button-primary">Return to Home</Link>
      <Link to="/events" className="button button-outline">Browse Events</Link>
    </div>
  </div>
);

export const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
          <AppHeader />
          <main className="main-content" style={{ flex: 1, paddingTop: '56px' }}>
            <Routes>
              {/* Home & Auth */}
              <Route path="/" component={<LandingPage />} />
              <Route path="/login" component={<SignInPage />} />
              <Route path="/signin" component={<SignInPage />} />
              <Route path="/register" component={<CreateAccountPage />} />
              <Route path="/signup" component={<CreateAccountPage />} />
              <Route path="/forgot-password" component={<PasswordResetPage />} />
              <Route path="/reset-password" component={<PasswordResetPage />} />
              <Route path="/profile" component={<UserProfilePage />} />
              <Route path="/settings" component={<PlatformSettingsPage />} />

              {/* Public Discovery & Results */}
              <Route path="/events" component={<EventDiscoveryPage />} />
              <Route path="/events/:eventId" component={<EventDetailsPage />} />
              <Route path="/gallery" component={<PublicGalleryPage />} />
              <Route path="/gallery/:idOrSlug" component={<ProjectDetailPage />} />
              <Route path="/projects/:idOrSlug" component={<ProjectDetailPage />} />
              <Route path="/results" component={<PublicResultsPage />} />
              <Route path="/results/:idOrSlug" component={<ResultDetailPage />} />
              <Route path="/events/:eventId/results/public" component={<PublicResultsPage />} />
              <Route path="/events/:eventId/results/:idOrSlug" component={<ResultDetailPage />} />
              <Route path="/certificates" component={<CertificateCenterPage />} />
              <Route path="/certificates/verify" component={<CertificateCenterPage />} />
              <Route path="/archive" component={<ArchivePage />} />

              {/* Participant Portal & Teams */}
              <Route path="/dashboard" component={<ParticipantDashboardPage />} />
              <Route path="/participant" component={<ParticipantDashboardPage />} />
              <Route path="/events/:eventId/register" component={<EventRegistrationPage />} />
              <Route path="/teams/:teamId" component={<TeamManagementPage />} />
              <Route path="/events/:eventId/submission" component={<ProjectSubmissionPage />} />
              <Route path="/submissions/:submissionId" component={<MySubmissionPage />} />
              <Route path="/my-submission" component={<MySubmissionPage />} />

              {/* Judge Evaluation Workflow */}
              <Route path="/judge" component={<JudgeDashboardPage />} />
              <Route path="/judge/dashboard" component={<JudgeDashboardPage />} />
              <Route path="/judge/assignments/:assignmentId" component={<JudgeProjectViewPage />} />

              {/* Organizer Management Workflow */}
              <Route path="/organizer" component={<OrganizerDashboardPage />} />
              <Route path="/organizer/dashboard" component={<OrganizerDashboardPage />} />
              <Route path="/organizer/events/new" component={<CreateEventPage />} />
              <Route path="/organizer/events/:eventId/settings" component={<EventSettingsPage />} />
              <Route path="/organizer/events/:eventId/submissions" component={<OrganizerSubmissionsPage />} />
              <Route path="/organizer/events/:eventId/teams" component={<OrganizerTeamsPage />} />
              <Route path="/organizer/events/:eventId/judges" component={<OrganizerJudgesPage />} />
              <Route path="/organizer/events/:eventId/participants" component={<OrganizerParticipantsPage />} />
              <Route path="/organizer/events/:eventId/judging/progress" component={<JudgingProgressPage />} />
              <Route path="/organizer/events/:eventId/judging/normalization" component={<NormalizationWorkspacePage />} />
              <Route path="/organizer/events/:eventId/judging/normalization/:runId" component={<NormalizationAuditProofPage />} />
              <Route path="/organizer/events/:eventId/results" component={<ResultsDashboardPage />} />
              <Route path="/results/dashboard" component={<ResultsDashboardPage />} />

              {/* Catch-all 404 */}
              <Route path="*" component={<NotFoundPage />} />
            </Routes>
          </main>
          <footer style={{ borderTop: '1px solid var(--outline-border)', padding: '16px 24px', textAlign: 'center', fontSize: '12px', color: 'var(--outline)', background: 'var(--surface-lowest)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <img src="/branding/arbiter-icon.png" alt="Arbiter" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>Arbiter</span>
            <span>&bull;</span>
            <span>Open-source infrastructure for hackathon judging</span>
            <span>&bull;</span>
            <span>Built for DOGFOOD 2026</span>
          </footer>
        </div>
      </AuthProvider>
    </Router>
  );
};

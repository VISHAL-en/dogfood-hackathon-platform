import React, { useState } from 'react';
import { EmptyState } from '../components/EmptyState';

export const CertificateCenterPage: React.FC = () => {
  const [certId, setCertId] = useState('');
  const [verified, setVerified] = useState<boolean | null>(null);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    // Honest: Certificate issuance backend is not yet implemented
    setVerified(false);
  };

  return (
    <div className="page-container" style={{ maxWidth: '800px' }}>
      <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="instance-badge">
            <span className="orb"></span>
            <span>Cryptographic Credential Center</span>
          </span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--on-surface)' }}>
          Certificates & Credential Verification
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
          Official proof-of-participation and award credentials for competitors and jury members.
        </p>
      </div>

      <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '22px' }}>verified</span>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Verify Issued Certificate</h2>
        </div>
        <form onSubmit={handleVerify} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            className="input-text"
            placeholder="Enter certificate identifier or signature (e.g. CERT-2026-...)"
            value={certId}
            onChange={(e) => setCertId(e.target.value)}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary">
            Verify Credential
          </button>
        </form>

        {verified === false && (
          <div className="alert alert-info" style={{ marginTop: '16px' }}>
            <span className="material-symbols-outlined">info</span>
            <div>
              <strong>Feature Notice:</strong> Certificate issuance and verification endpoints are scheduled for subsequent tier expansion and are <em>NOT YET SUPPORTED BY BACKEND</em>. No fake certificates are generated.
            </div>
          </div>
        )}
      </div>

      <EmptyState
        icon="workspace_premium"
        title="No Certificates Issued Yet"
        description="Participation certificates are minted following tournament conclusion and score certification."
      />
    </div>
  );
};

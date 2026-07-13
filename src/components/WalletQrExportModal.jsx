import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { encryptWallet } from '../utils/warthogWalletUtils';
import { encodeWalletQrPayload, getWalletQrCapacityError } from '../utils/walletQr.js';

export default function WalletQrExportModal({ open, wallet, onClose }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [qrPayload, setQrPayload] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setConfirmPassword('');
      setQrPayload(null);
      setError(null);
      setLoading(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [open]);

  if (!open) return null;

  const handleGenerate = async () => {
    setError(null);
    if (!password || password.length < 4) {
      setError('Choose a password with at least 4 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!wallet?.privateKey) {
      setError('Unlock your wallet first — the private key is needed to export');
      return;
    }

    setLoading(true);
    try {
      const encrypted = encryptWallet(wallet, password);
      const capacityErr = getWalletQrCapacityError(encrypted);
      if (capacityErr) {
        setError(capacityErr);
        return;
      }
      setQrPayload(encodeWalletQrPayload(encrypted));
    } catch (err) {
      setError(err?.message || 'Failed to create export QR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bunker-modal-overlay" style={{ zIndex: 9999 }}>
      <div className="bunker-modal" style={{ maxWidth: '28rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 className="bunker-heading">Transfer to Mobile</h2>
        <p className="bunker-text bunker-muted" style={{ marginBottom: '1rem' }}>
          Create a password-encrypted QR code for the mobile Warthog wallet. Scan it on your phone,
          then enter the same password to import.
        </p>

        {!qrPayload ? (
          <>
            <div className="bunker-alert" style={{ marginBottom: '1rem', borderColor: 'rgba(180, 83, 9, 0.4)', background: 'rgba(69, 26, 3, 0.3)', color: 'rgba(253, 230, 138, 0.9)' }}>
              Only generate this on a device you trust. Anyone who scans the QR and knows the
              password can access your wallet.
            </div>

            <div className="mb-4">
              <label className="bunker-label">Export password</label>
              <div className="bunker-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bunker-input"
                  autoComplete="new-password"
                  placeholder="Password for mobile import"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="bunker-input-toggle"
                >
                  {showPassword ? 'hide' : 'show'}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="bunker-label">Confirm password</label>
              <div className="bunker-input-wrap">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bunker-input"
                  autoComplete="new-password"
                  placeholder="Repeat password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="bunker-input-toggle"
                >
                  {showConfirmPassword ? 'hide' : 'show'}
                </button>
              </div>
            </div>

            {error ? (
              <div className="bunker-alert bunker-alert--error" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="bunker-btn"
              style={{ width: '100%', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Encrypting…' : 'Generate QR Code'}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-block', borderRadius: '1rem', background: '#fff', padding: '1rem' }}>
              <QRCode value={qrPayload} size={220} level="M" />
            </div>
            <p className="bunker-text bunker-muted" style={{ marginTop: '1rem', fontSize: '0.75rem' }}>
              Open the mobile app → Login → Scan Wallet QR → enter your export password.
            </p>
            <p className="bunker-text bunker-muted" style={{ marginTop: '0.5rem', fontSize: '0.625rem' }}>
              QR expires when you close this dialog — generate again anytime with the same password.
            </p>
          </div>
        )}

        <div className="flex space-x-2" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(63, 63, 70, 0.8)' }}>
          {qrPayload ? (
            <button
              type="button"
              onClick={() => {
                setQrPayload(null);
                setPassword('');
                setConfirmPassword('');
              }}
              className="bunker-btn bunker-btn--ghost"
              style={{ flex: 1 }}
            >
              New QR
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="bunker-btn bunker-btn--ghost" style={{ flex: 1 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
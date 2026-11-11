/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Case 2: Hostname Immutability & Lifecycle Management Component
 * - State Locking: Hostname locked permanently upon first activation with simple inline message.
 * - Active Edits: Modifications strictly restricted to certificate rotation.
 * - Mode Switching: When switching between managed and self-managed, never clears live certificate data.
 *   Continuously serves legacy certificate until replacement payload validates and deploys.
 */

import React, { useState } from 'react';
import {
  Lock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  KeyRound,
  FileText,
  Loader2,
  RefreshCw,
  X,
  ShieldCheck,
  Check,
  AlertCircle,
  Copy,
  Info,
} from 'lucide-react';
import { CustomDomainItem } from '../App';

interface ActiveDomainCertificateRotationModalProps {
  isOpen: boolean;
  domain: CustomDomainItem;
  onClose: () => void;
  onDeployCertificate: (
    updatedCertType: 'managed' | 'upload',
    newIssuer: string,
    newExpirationDate: string,
    newDays: number
  ) => void;
  showToast: (msg: string) => void;
}

export function ActiveDomainCertificateRotationModal({
  isOpen,
  domain,
  onClose,
  onDeployCertificate,
  showToast,
}: ActiveDomainCertificateRotationModalProps) {
  // Staging Mode State: User can switch modes without affecting live serving certificate
  const initialMode = domain.certManagementType === 'upload' ? 'upload' : 'managed';
  const [stagingMode, setStagingMode] = useState<'managed' | 'upload'>(initialMode);

  // Self-managed staging files / text
  const [certInputMethod, setCertInputMethod] = useState<'upload' | 'text'>('upload');
  const [stagingPemFile, setStagingPemFile] = useState<{ name: string; size: string; content?: string } | null>(null);
  const [stagingKeyFile, setStagingKeyFile] = useState<{ name: string; size: string; content?: string } | null>(null);
  const [stagingPemText, setStagingPemText] = useState('');
  const [stagingKeyText, setStagingKeyText] = useState('');

  // Validation & Deployment State
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validatedPayload, setValidatedPayload] = useState<{
    issuer: string;
    expirationDate: string;
    validDays: number;
    subjectMatch: boolean;
    fingerprintSha256: string;
  } | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);

  if (!isOpen) return null;

  const currentServingIssuer = domain.issuer || (domain.certManagementType === 'managed' ? "Let's Encrypt Authority X3" : 'DigiCert Global Root CA');
  const currentServingExpiry = domain.certExpirationDate || 'Dec 18, 2026';
  const isCurrentlyManaged = domain.certManagementType === 'managed';

  // Step 1 validation of the staging replacement
  const handleValidateStagingPayload = () => {
    setIsValidating(true);
    setValidationError(null);

    setTimeout(() => {
      setIsValidating(false);

      if (stagingMode === 'managed') {
        // Hexnode Managed ACME validation
        setValidatedPayload({
          issuer: "Hexnode Automated CA / Let's Encrypt R3",
          expirationDate: 'Jan 12, 2027 (Valid for 90 days, auto-renewing)',
          validDays: 90,
          subjectMatch: true,
          fingerprintSha256: 'B4:8E:29:5F:73:9A:C1:E4:6D:88:91:20:F3:17:5A:CC',
        });
        showToast('Hexnode Automated ACME challenge verified successfully');
        return;
      }

      // Self-managed PEM validation
      const certText = certInputMethod === 'upload' ? (stagingPemFile?.content || '') : stagingPemText;
      const keyText = certInputMethod === 'upload' ? (stagingKeyFile?.content || '') : stagingKeyText;

      if (certInputMethod === 'upload' && (!stagingPemFile || !stagingKeyFile)) {
        setValidationError('Both Certificate file (.pem/.crt) and Private Key file (.key) are required.');
        setValidatedPayload(null);
        return;
      }

      if (certInputMethod === 'text' && (!certText.trim() || !keyText.trim())) {
        setValidationError('Both Certificate chain text and Private Key text are required.');
        setValidatedPayload(null);
        return;
      }

      // Check PEM markers
      if (certText && !certText.includes('-----BEGIN CERTIFICATE-----')) {
        setValidationError('Certificate missing marker "-----BEGIN CERTIFICATE-----".');
        setValidatedPayload(null);
        return;
      }

      if (keyText && !keyText.includes('-----BEGIN PRIVATE KEY-----') && !keyText.includes('-----BEGIN RSA PRIVATE KEY-----')) {
        setValidationError('Private key missing marker "-----BEGIN PRIVATE KEY-----".');
        setValidatedPayload(null);
        return;
      }

      // Success for self-managed
      setValidatedPayload({
        issuer: 'DigiCert TLS RSA SHA256 2026 CA1',
        expirationDate: 'Oct 12, 2027 (Valid for 365 days)',
        validDays: 365,
        subjectMatch: true,
        fingerprintSha256: '3E:F8:71:09:A6:4C:D2:15:BE:90:3A:88:51:7E:24:D7',
      });
      showToast('Certificate chain and private key match verified successfully');
    }, 600);
  };

  const handleDeployCutover = () => {
    if (!validatedPayload) return;
    setIsDeploying(true);

    setTimeout(() => {
      setIsDeploying(false);
      onDeployCertificate(
        stagingMode,
        validatedPayload.issuer,
        validatedPayload.expirationDate,
        validatedPayload.validDays
      );
      showToast(`Certificate rotation deployed successfully for [${domain.domain}]! Seamless cutover complete.`);
      onClose();
    }, 750);
  };

  const handleSimulateLoadPem = () => {
    setStagingPemFile({
      name: `${domain.domain}_renewed_cert.pem`,
      size: '2.1 KB',
      content: `-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAJ8e4/kL7r4DMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV\nBAMMCm${domain.domain}0HhcNMjYwMTAxMDAwMDAwWhcNMjcwMTAxMDAwMDAw\n-----END CERTIFICATE-----`,
    });
    setStagingKeyFile({
      name: `${domain.domain}_renewed_key.key`,
      size: '1.7 KB',
      content: `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDK/hDdaP2dmf8K\n-----END PRIVATE KEY-----`,
    });
    setValidationError(null);
    showToast('Loaded valid renewal certificate and key files');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-2xl my-8 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div>
            <h3 className="text-[18px] font-semibold text-[#111827]">
              Modify Active Domain: {domain.domain}
            </h3>
            <span className="text-[12px] font-medium text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-full inline-block mt-1">
              Active Hostname &bull; Production IdP Traffic
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* CASE 2 REQUIREMENT 1: STATE LOCKING & IMMUTABILITY NOTICE */}
          <div className="p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-[#4B5563] uppercase tracking-wider">
                Active Hostname (Permanent)
              </label>
              <span className="inline-flex items-center text-[11px] font-medium text-[#4B5563] bg-[#E5E7EB] px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3 mr-1 text-[#4B5563]" />
                Immutable
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                disabled
                value={domain.domain}
                className="w-full bg-[#F3F4F6] border border-[#D1D5DB] rounded-[6px] px-3 py-2 text-[14px] font-mono font-medium text-[#374151] cursor-not-allowed select-all"
              />
            </div>

            {/* Simple inline message indicating hostname cannot be changed */}
            <div className="flex items-start space-x-2 text-[12px] text-[#4B5563] pt-1">
              <Info className="w-4 h-4 text-[#0F62FE] shrink-0 mt-0.5" />
              <p>
                The hostname cannot be changed once activated to protect SAML/OIDC SSO bindings and passkey RP-IDs. Modifications are strictly restricted to certificate rotation.
              </p>
            </div>
          </div>

          {/* CASE 2 REQUIREMENT 2 & 3: CONTINUOUS ZERO-DOWNTIME SERVING & MODE SWITCHING */}
          {/* Section: Currently Serving Live Certificate */}
          <div className="border border-[#BBF7D0] bg-[#F0FDF4] rounded-[8px] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#15803D] flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                <span>Currently Serving Certificate (Zero-Downtime Guard)</span>
              </span>
              <span className="text-[11px] font-medium text-[#15803D] bg-white border border-[#86EFAC] px-2 py-0.5 rounded-full">
                Active in Production
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px] pt-1">
              <div>
                <span className="text-[#4B5563] block">Mode / Issuer:</span>
                <span className="font-medium text-[#111827]">
                  {isCurrentlyManaged ? 'Managed by Hexnode' : 'Self-managed'} ({currentServingIssuer})
                </span>
              </div>
              <div>
                <span className="text-[#4B5563] block">Current Expiration:</span>
                <span className="font-medium text-[#111827]">{currentServingExpiry}</span>
              </div>
            </div>

            <p className="text-[11px] text-[#15803D] italic pt-1 border-t border-[#DCFCE7]">
              Notice: Switching modes or configuring replacements will not clear or disconnect this live certificate. It will continue serving traffic until your new certificate validates and cuts over.
            </p>
          </div>

          {/* Section: Staging Replacement Configuration */}
          <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
              <h4 className="text-[14px] font-semibold text-[#111827]">
                Stage New Replacement Certificate
              </h4>
              <span className="text-[11px] text-[#6B7280]">
                Rotate or switch certificate provider
              </span>
            </div>

            {/* Mode Switching Selector: Managed vs Self-managed */}
            <div className="space-y-2">
              <label className="block text-[12px] font-medium text-[#374151]">
                Target Certificate Management Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStagingMode('managed');
                    setValidatedPayload(null);
                    setValidationError(null);
                  }}
                  className={`p-3 rounded-[6px] border text-left transition-colors cursor-pointer ${
                    stagingMode === 'managed'
                      ? 'border-[#0F62FE] bg-[#EFF6FF]'
                      : 'border-[#E5E7EB] bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[#111827]">Managed by Hexnode</span>
                    {stagingMode === 'managed' && <CheckCircle2 className="w-4 h-4 text-[#0F62FE]" />}
                  </div>
                  <span className="text-[11px] text-[#6B7280] block mt-1">
                    Automated ACME Let&apos;s Encrypt issuance with automatic renewals.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStagingMode('upload');
                    setValidatedPayload(null);
                    setValidationError(null);
                  }}
                  className={`p-3 rounded-[6px] border text-left transition-colors cursor-pointer ${
                    stagingMode === 'upload'
                      ? 'border-[#0F62FE] bg-[#EFF6FF]'
                      : 'border-[#E5E7EB] bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[#111827]">Self-managed</span>
                    {stagingMode === 'upload' && <CheckCircle2 className="w-4 h-4 text-[#0F62FE]" />}
                  </div>
                  <span className="text-[11px] text-[#6B7280] block mt-1">
                    Upload or paste your custom CA certificate chain and private key.
                  </span>
                </button>
              </div>
            </div>

            {/* Mode Specific Inputs */}
            {stagingMode === 'managed' ? (
              <div className="p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[6px] space-y-2">
                <div className="flex items-center space-x-2 text-[13px] font-medium text-[#111827]">
                  <ShieldCheck className="w-4 h-4 text-[#0F62FE]" />
                  <span>Automated ACME Certificate Issuance</span>
                </div>
                <p className="text-[12px] text-[#6B7280]">
                  Hexnode will automatically generate and request a new TLS certificate for <span className="font-mono text-[#111827]">{domain.domain}</span> using DNS routing challenges.
                </p>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {/* Method selector for self-managed */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 text-[13px]">
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={certInputMethod === 'upload'}
                        onChange={() => setCertInputMethod('upload')}
                        className="text-[#0F62FE]"
                      />
                      <span>Upload files</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={certInputMethod === 'text'}
                        onChange={() => setCertInputMethod('text')}
                        className="text-[#0F62FE]"
                      />
                      <span>Paste PEM text</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateLoadPem}
                    className="text-[12px] text-[#0F62FE] hover:underline font-medium cursor-pointer"
                  >
                    Load sample renewal cert
                  </button>
                </div>

                {certInputMethod === 'upload' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Certificate Dropzone */}
                    <div className="border-2 border-dashed border-[#D1D5DB] rounded-[8px] p-4 text-center bg-[#FAFAFA]">
                      <span className="block text-[12px] font-medium text-[#111827] mb-1">
                        Certificate (.pem / .crt)
                      </span>
                      {stagingPemFile ? (
                        <div className="text-[12px] font-mono text-[#15803D] bg-[#DCFCE7] p-2 rounded truncate">
                          {stagingPemFile.name} ({stagingPemFile.size})
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#6B7280] py-2">
                          Drop certificate file here or click sample above
                        </div>
                      )}
                    </div>

                    {/* Private Key Dropzone */}
                    <div className="border-2 border-dashed border-[#D1D5DB] rounded-[8px] p-4 text-center bg-[#FAFAFA]">
                      <span className="block text-[12px] font-medium text-[#111827] mb-1">
                        Private Key (.key)
                      </span>
                      {stagingKeyFile ? (
                        <div className="text-[12px] font-mono text-[#15803D] bg-[#DCFCE7] p-2 rounded truncate">
                          {stagingKeyFile.name} ({stagingKeyFile.size})
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#6B7280] py-2">
                          Drop private key file here or click sample above
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[12px] font-medium text-[#111827] mb-1">
                        Certificate Chain (.pem)
                      </label>
                      <textarea
                        rows={3}
                        value={stagingPemText}
                        onChange={(e) => setStagingPemText(e.target.value)}
                        placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                        className="w-full p-2 text-[12px] font-mono border border-[#D1D5DB] rounded-[6px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#111827] mb-1">
                        Private Key (.key)
                      </label>
                      <textarea
                        rows={3}
                        value={stagingKeyText}
                        onChange={(e) => setStagingKeyText(e.target.value)}
                        placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                        className="w-full p-2 text-[12px] font-mono border border-[#D1D5DB] rounded-[6px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Validation Error Banner */}
            {validationError && (
              <div className="p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-[6px] flex items-center space-x-2 text-[12px] text-[#B91C1C]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Validate Button */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleValidateStagingPayload}
                disabled={isValidating}
                className="h-[36px] px-4 bg-white border border-[#D1D5DB] hover:bg-gray-50 text-[#111827] rounded-[6px] text-[13px] font-medium flex items-center space-x-2 cursor-pointer disabled:opacity-75"
              >
                {isValidating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#0F62FE]" />
                ) : (
                  <KeyRound className="w-4 h-4 text-[#0F62FE]" />
                )}
                <span>Validate Replacement Payload</span>
              </button>

              {validatedPayload && (
                <span className="text-[12px] font-medium text-[#15803D] flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                  <span>Validation passed. Ready to cutover.</span>
                </span>
              )}
            </div>

            {/* Validated Preview Details Box */}
            {validatedPayload && (
              <div className="p-3.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[6px] text-[12px] space-y-1.5 animate-in fade-in duration-100">
                <div className="font-semibold text-[#1D4ED8]">
                  Replacement Certificate Verified &amp; Staged:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#1E3A8A]">
                  <div>Issuer: {validatedPayload.issuer}</div>
                  <div>Validity: {validatedPayload.expirationDate}</div>
                  <div className="col-span-2 font-mono text-[11px] truncate">
                    SHA-256 Fingerprint: {validatedPayload.fingerprintSha256}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#E5E7EB] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDeployCutover}
            disabled={!validatedPayload || isDeploying}
            className="px-5 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isDeploying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Deploying &amp; Cutting Over...</span>
              </>
            ) : (
              <span>Deploy Replacement &amp; Cutover</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

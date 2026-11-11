/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Case 1: Default Domain Details Architecture
 * Mirrors the card-based grid and tab structure of custom domains.
 * Overview: Strictly read-only hostname, suppresses all destructive actions (Disable, Remove).
 * Certificate: Locked to "Managed by Hexnode", suppresses manual PEM upload.
 * Passkeys: Interactive "Inherit passkeys from" selector, read-only relying domains list, live copyable .well-known/webauthn preview.
 */

import React, { useState } from 'react';
import {
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  KeyRound,
  Download,
  Plus,
  Trash2,
  Info,
  Server,
  Lock,
  Globe,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react';

export interface DefaultDomainInheritedOrigin {
  id: string;
  domain: string;
  enforcePasskeyMigration: boolean;
  addedDate: string;
  sourceType: 'legacy-custom' | 'migrated-sso';
}

export interface RelyingDomainItem {
  id: string;
  domain: string;
  rpId: string;
  bindingStatus: 'Active & Linked' | 'Inherited';
  linkedDate: string;
}

interface DefaultDomainDetailsViewProps {
  defaultHostname: string;
  isPrimary: boolean;
  onBack: () => void;
  onSetAsPrimary?: () => void;
  availableCustomDomains: { id: string; domain: string }[];
  showToast: (message: string) => void;
}

export function DefaultDomainDetailsView({
  defaultHostname,
  isPrimary,
  onBack,
  onSetAsPrimary,
  availableCustomDomains,
  showToast,
}: DefaultDomainDetailsViewProps) {
  const [activeTab, setActiveTab] = useState<'Details' | 'Passkeys'>('Details');
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Passkeys Tab State: Inherited Origins
  const [inheritedOrigins, setInheritedOrigins] = useState<DefaultDomainInheritedOrigin[]>([
    {
      id: 'origin-legacy-1',
      domain: 'login.acme.com',
      enforcePasskeyMigration: true,
      addedDate: 'Sep 14, 2026',
      sourceType: 'legacy-custom',
    },
    {
      id: 'origin-legacy-2',
      domain: 'idp.acmecorp.com',
      enforcePasskeyMigration: false,
      addedDate: 'Oct 02, 2026',
      sourceType: 'legacy-custom',
    },
  ]);

  // Read-only list of domains relying on this default origin
  const [relyingDomains] = useState<RelyingDomainItem[]>([
    {
      id: 'relying-1',
      domain: 'login.acme.com',
      rpId: defaultHostname,
      bindingStatus: 'Active & Linked',
      linkedDate: 'Sep 14, 2026',
    },
    {
      id: 'relying-2',
      domain: 'idp.acmecorp.com',
      rpId: defaultHostname,
      bindingStatus: 'Active & Linked',
      linkedDate: 'Oct 02, 2026',
    },
    {
      id: 'relying-3',
      domain: 'sso.staging-corp.com',
      rpId: defaultHostname,
      bindingStatus: 'Inherited',
      linkedDate: 'Oct 08, 2026',
    },
  ]);

  // Inherit Passkey Interactive Selector Modal / Form State
  const [selectedCustomDomainToInherit, setSelectedCustomDomainToInherit] = useState(
    availableCustomDomains[0]?.domain || 'login.corporation.com'
  );
  const [isInheritModalOpen, setIsInheritModalOpen] = useState(false);
  const [newEnforceMigration, setNewEnforceMigration] = useState(true);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showToast(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Generate live .well-known/webauthn JSON payload based on active origins
  const webauthnPayload = JSON.stringify(
    {
      origins: [
        `https://${defaultHostname}`,
        ...inheritedOrigins.map((o) => `https://${o.domain}`),
      ],
    },
    null,
    2
  );

  const handleDownloadWebauthnJson = () => {
    const blob = new Blob([webauthnPayload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'webauthn.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded .well-known/webauthn JSON file');
  };

  const handleAddInheritedOrigin = () => {
    const domainToAdd = selectedCustomDomainToInherit.trim().toLowerCase();
    if (!domainToAdd) return;

    if (inheritedOrigins.some((o) => o.domain.toLowerCase() === domainToAdd)) {
      showToast(`Domain [${domainToAdd}] is already in the inherited origins list`);
      return;
    }

    const newOrigin: DefaultDomainInheritedOrigin = {
      id: `origin-${Date.now()}`,
      domain: domainToAdd,
      enforcePasskeyMigration: newEnforceMigration,
      addedDate: 'Oct 13, 2026',
      sourceType: 'legacy-custom',
    };

    setInheritedOrigins((prev) => [newOrigin, ...prev]);
    setIsInheritModalOpen(false);
    showToast(`Added [${domainToAdd}] to passkey inheritance list`);
  };

  const handleRemoveInheritedOrigin = (id: string, domainName: string) => {
    setInheritedOrigins((prev) => prev.filter((o) => o.id !== id));
    showToast(`Removed [${domainName}] from passkey inheritance`);
  };

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-150">
      {/* Breadcrumb Navigation & Back Link */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-[13px] text-[#6B7280]">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center space-x-1 text-[#0F62FE] hover:underline font-medium cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Domains</span>
          </button>
          <span>/</span>
          <span className="font-mono text-[#111827]">{defaultHostname}</span>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="text-[13px] text-[#4B5563] hover:text-[#111827] px-2.5 py-1 rounded-[6px] hover:bg-gray-100 transition-colors cursor-pointer"
        >
          Back to all domains
        </button>
      </div>

      {/* Top Header Summary */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB] flex-wrap gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <h2 className="text-[22px] font-semibold text-[#111827] font-mono tracking-tight">
              {defaultHostname}
            </h2>

            {/* Status Badges */}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#DCFCE7] text-[#15803D]">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Active
            </span>

            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#EFF6FF] text-[#1D4ED8]">
              Default Tenant Domain
            </span>

            {isPrimary && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#0F62FE] text-white">
                Primary
              </span>
            )}
          </div>

          <p className="text-[13px] text-[#6B7280]">
            Permanent Hexnode IdP domain. Managed automatically with zero configuration required.
          </p>
        </div>

        {/* Actions Dropdown: Strictly SUPPRESS destructive actions (Disable, Remove) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
            className="h-[36px] px-3.5 bg-white border border-[#D1D5DB] hover:bg-gray-50 text-[#374151] rounded-[6px] text-[13px] font-medium flex items-center space-x-2 transition-colors cursor-pointer shadow-xs"
          >
            <span>Actions</span>
            <ChevronDown className="w-4 h-4 text-[#6B7280]" />
          </button>

          {isActionsMenuOpen && (
            <div
              onClick={() => setIsActionsMenuOpen(false)}
              className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-[#E5E7EB] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                onClick={() => copyToClipboard(`https://${defaultHostname}`, 'Domain URL')}
                className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4 text-[#0F62FE]" />
                <span>Copy URL</span>
              </button>

              <a
                href={`https://${defaultHostname}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-[#0F62FE]" />
                <span>Test sign-in</span>
              </a>

              {!isPrimary && onSetAsPrimary && (
                <button
                  type="button"
                  onClick={onSetAsPrimary}
                  className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-[#0F62FE]" />
                  <span>Set as primary</span>
                </button>
              )}

              {/* Note: Destructive Actions (Disable, Remove) are intentionally suppressed */}
              <div className="px-3.5 py-2 mt-1 border-t border-[#F3F4F6] text-[11px] text-[#9CA3AF] italic">
                Default domain cannot be disabled or removed
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation: Details & Passkeys */}
      <div className="flex items-center space-x-8 border-b border-[#E5E7EB] mt-3">
        {(['Details', 'Passkeys'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative pb-3 text-[14px] cursor-pointer transition-colors ${
                isActive
                  ? 'text-[#0F62FE] font-medium'
                  : 'text-[#4B5563] hover:text-[#111827] font-normal'
              }`}
            >
              <span>{tab}</span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0F62FE]" />
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DETAILS (Unified Card-based Grid Layout mirroring Custom Domains) */}
      {activeTab === 'Details' && (
        <div className="space-y-5">
          {/* Top Row: Overview / Hostname Card & Certificate Mode Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. Overview Card: Strictly Read-only Hostname, Destructive Actions Suppressed */}
            <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-[#6B7280]">Hostname</span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(defaultHostname, 'Hostname')}
                      className="text-[#0F62FE] hover:text-[#0050E6] text-[12px] font-medium flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      {copiedKey === 'Hostname' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy</span>
                    </button>
                    <a
                      href={`https://${defaultHostname}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#6B7280] hover:text-[#0F62FE] text-[12px] flex items-center"
                      title="Open in new window"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="text-[16px] font-semibold font-mono text-[#111827] mt-2 select-all">
                  {defaultHostname}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#F3F4F6] flex items-center space-x-2 text-[12px] text-[#6B7280]">
                <Lock className="w-3.5 h-3.5 text-[#15803D]" />
                <span>Strictly immutable origin. Permanent root fallback for all IdP endpoints.</span>
              </div>
            </div>

            {/* 2. Certificate Card: Locked to "Managed by Hexnode", Suppresses Manual PEM Upload */}
            <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[12px] font-medium text-[#6B7280]">Certificate Management</span>
                <div className="text-[16px] font-semibold text-[#111827] mt-2 flex items-center space-x-2">
                  <span>Managed by Hexnode</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D]">
                    Automated TLS
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#F3F4F6] text-[12px] text-[#6B7280]">
                Hexnode provisions and automatically renews TLS certificates for this default origin. Manual PEM upload is restricted.
              </div>
            </div>
          </div>

          {/* Middle Row: Ingress Routing Details Card */}
          <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
              <h3 className="text-[14px] font-semibold text-[#111827]">
                Ingress Routing &amp; Edge Network Details
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EFF6FF] text-[#1D4ED8]">
                Native Edge Anycast
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Edge Ingress Target
                </label>
                <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#E5E7EB] rounded-[6px] px-3 py-2 text-[13px] font-mono text-[#111827]">
                  <span>ingress.hexnode.com</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('ingress.hexnode.com', 'Edge Ingress Target')}
                    className="ml-2 text-[#6B7280] hover:text-[#0F62FE] p-1 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  Supported Protocols
                </label>
                <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[6px] px-3 py-2 text-[13px] font-mono text-[#111827]">
                  TLS 1.3 / TLS 1.2 &bull; HTTP/2 &bull; HTTP/3 (QUIC)
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Grid: Certificate Metadata Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Certificate Status Card */}
            <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs flex flex-col justify-between">
              <span className="text-[12px] font-medium text-[#6B7280]">Certificate Status</span>
              <div className="mt-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Valid (Active)
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280] mt-3">Continuously probed by global health checkers</p>
            </div>

            {/* Certificate Validity Period Card */}
            <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs flex flex-col justify-between">
              <span className="text-[12px] font-medium text-[#6B7280]">Active Validity Period</span>
              <div className="text-[14px] font-semibold text-[#111827] mt-2">
                Valid through Oct 14, 2027
              </div>
              <p className="text-[11px] text-[#6B7280] mt-3">Auto-renews 30 days prior to expiration</p>
            </div>

            {/* Certificate Issuer Card */}
            <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs flex flex-col justify-between">
              <span className="text-[12px] font-medium text-[#6B7280]">Certificate Authority / Issuer</span>
              <div className="text-[14px] font-semibold text-[#111827] mt-2">
                Hexnode Cloud CA / Let&apos;s Encrypt
              </div>
              <p className="text-[11px] text-[#6B7280] mt-3">2048-bit RSA with SHA-256 Signature</p>
            </div>

            {/* Last Successful Check Timestamp Card (Full Width) */}
            <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs md:col-span-3">
              <span className="text-[12px] font-medium text-[#6B7280]">Last Successful Edge Check</span>
              <div className="text-[14px] font-mono text-[#111827] mt-1.5 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
                <span>Oct 13, 2026, 06:40 AM UTC (HTTP 200 OK &bull; TLS Handshake Verified)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PASSKEYS TAB (FIDO Passkey Inheritance & .well-known/webauthn Preview) */}
      {activeTab === 'Passkeys' && (
        <div className="space-y-6">
          {/* Section 1: Interactive "Inherit passkeys from" selector */}
          <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between pb-4 border-b border-[#E5E7EB] flex-wrap gap-4">
              <div>
                <h3 className="text-[16px] font-medium text-[#111827]">
                  Inherit passkeys from legacy domains
                </h3>
                <p className="text-[13px] text-[#6B7280] mt-1">
                  Authorize {defaultHostname} to accept FIDO2 / WebAuthn credentials that were originally registered on legacy custom domains.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsInheritModalOpen(true)}
                className="h-[36px] px-3.5 bg-[#0F62FE] hover:bg-[#0050E6] text-white text-[13px] font-medium rounded-[6px] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Inherit passkeys from domain</span>
              </button>
            </div>

            {/* Inherited Domains Table */}
            <div className="overflow-x-auto">
              {inheritedOrigins.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAFAFA] border-b border-[#E5E7EB]">
                      <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                        Inherited Origin Domain
                      </th>
                      <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                        Origin Source
                      </th>
                      <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                        Enforce Passkey Migration
                      </th>
                      <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                        Date Added
                      </th>
                      <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563] text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {inheritedOrigins.map((origin) => (
                      <tr key={origin.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-4 py-3 text-[14px] font-mono text-[#111827]">
                          https://{origin.domain}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#4B5563]">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EFF6FF] text-[#1D4ED8]">
                            Legacy Custom Domain
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[14px]">
                          {origin.enforcePasskeyMigration ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">
                              Enforced
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] text-[#4B5563]">
                              Optional
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#6B7280]">
                          {origin.addedDate}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveInheritedOrigin(origin.id, origin.domain)}
                            className="p-1 text-[#6B7280] hover:text-[#DC2626] rounded transition-colors cursor-pointer"
                            title="Remove origin mapping"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-8 text-center text-[#6B7280]">
                  <p className="text-[14px] font-medium text-[#111827]">No inherited passkey origins</p>
                  <p className="text-[13px] text-[#6B7280] mt-1">
                    Click &quot;Inherit passkeys from domain&quot; to allow passkey credentials from your previous custom domains to authenticate on {defaultHostname}.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Read-only list of domains relying on this default origin */}
          <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-[#E5E7EB]">
              <div>
                <h3 className="text-[16px] font-medium text-[#111827]">
                  Domains using this domain’s passkeys
                </h3>
                <p className="text-[13px] text-[#6B7280] mt-1">
                  Domains configured to trust {defaultHostname} as their primary FIDO2 Relying Party Identifier (RP-ID).
                </p>
              </div>
              <span className="text-[12px] font-medium text-[#15803D] bg-[#DCFCE7] px-2.5 py-1 rounded-full">
                {relyingDomains.length} Relying Parties Active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#E5E7EB]">
                    <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">Relying Domain</th>
                    <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">FIDO RP-ID</th>
                    <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">Binding Status</th>
                    <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">Linked Since</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {relyingDomains.map((r) => (
                    <tr key={r.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-4 py-3 text-[14px] font-mono text-[#111827]">
                        {r.domain}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-mono text-[#4B5563]">
                        {r.rpId}
                      </td>
                      <td className="px-4 py-3 text-[13px]">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {r.bindingStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#6B7280]">
                        {r.linkedDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Live, Copyable Preview of the .well-known/webauthn JSON Payload */}
          <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-4 pb-3 border-b border-[#E5E7EB]">
              <div>
                <h3 className="text-[16px] font-medium text-[#111827]">
                  Passkey configuration file
                </h3>
                <p className="text-[13px] text-[#6B7280] mt-1">
                  .well-known/webauthn preview
                </p>
              </div>

              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  onClick={() => copyToClipboard(webauthnPayload, '.well-known/webauthn JSON')}
                  className="h-[32px] px-3 bg-white border border-[#D1D5DB] hover:bg-gray-50 rounded-[6px] text-[12px] font-medium text-[#374151] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  {copiedKey === '.well-known/webauthn JSON' ? (
                    <Check className="w-3.5 h-3.5 text-[#15803D]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#0F62FE]" />
                  )}
                  <span>Copy JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadWebauthnJson}
                  className="h-[32px] px-3 bg-white border border-[#D1D5DB] hover:bg-gray-50 rounded-[6px] text-[12px] font-medium text-[#374151] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-[#0F62FE]" />
                  <span>Download file</span>
                </button>
              </div>
            </div>

            {/* Live Monospaced JSON Preview Area */}
            <div className="relative">
              <pre className="bg-[#1E293B] text-[#F8FAFC] p-4 rounded-[6px] font-mono text-[13px] leading-relaxed overflow-x-auto select-all shadow-inner">
                {webauthnPayload}
              </pre>
            </div>

            <div className="flex items-center space-x-2 text-[12px] text-[#6B7280] pt-1">
              <Info className="w-4 h-4 text-[#0F62FE] shrink-0" />
              <span>
                Browsers query this file dynamically when authenticating via passkeys across origins. As you modify inherited origins above, this payload updates in real time.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Interactive "Inherit Passkeys from Domain" */}
      {isInheritModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-[17px] font-semibold text-[#111827]">
                Inherit Passkeys from Legacy Domain
              </h3>
              <button
                type="button"
                onClick={() => setIsInheritModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[13px] text-[#374151] leading-relaxed">
              Select or specify a verified custom domain whose passkey credentials should be trusted by <span className="font-semibold text-[#111827] font-mono">{defaultHostname}</span>.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#111827] mb-1.5">
                  Custom Domain Source <span className="text-[#DC2626]">*</span>
                </label>
                <div className="space-y-2">
                  <select
                    value={selectedCustomDomainToInherit}
                    onChange={(e) => setSelectedCustomDomainToInherit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[13px] text-[#111827] focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE]"
                  >
                    {availableCustomDomains.map((d) => (
                      <option key={d.id} value={d.domain}>
                        {d.domain}
                      </option>
                    ))}
                    <option value="auth.legacy-portal.io">auth.legacy-portal.io (Legacy SSO)</option>
                    <option value="login.globalcorp.com">login.globalcorp.com (Previous IdP)</option>
                  </select>
                </div>
              </div>

              {/* Enforce passkey migration toggle */}
              <div className="p-3.5 bg-gray-50 border border-[#E5E7EB] rounded-[8px] flex items-center justify-between cursor-pointer">
                <div>
                  <span className="block text-[13px] font-medium text-[#111827]">
                    Enforce Passkey Migration
                  </span>
                  <span className="block text-[12px] text-[#6B7280]">
                    Automatically prompt users to register updated credentials bound to {defaultHostname} upon next sign-in.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={newEnforceMigration}
                  onChange={(e) => setNewEnforceMigration(e.target.checked)}
                  className="w-4 h-4 rounded border-[#D1D5DB] text-[#0F62FE] focus:ring-[#0F62FE] cursor-pointer ml-3 shrink-0"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end space-x-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setIsInheritModalOpen(false)}
                className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddInheritedOrigin}
                className="px-4 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer shadow-xs"
              >
                Save &amp; Update Manifest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

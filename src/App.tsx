/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Search,
  Bell,
  HelpCircle,
  Copy,
  Check,
  Settings as SettingsIcon,
  Globe,
  Mail,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Info,
  Phone,
  X,
  Upload,
  CheckCircle2,
  Loader2,
  FileText,
  MoreVertical,
  Trash2,
  Pencil,
  ArrowRightCircle,
  Archive,
  ShieldCheck,
  AlertTriangle,
  Play,
  Star,
  Download,
  RefreshCw,
  AlertCircle,
  KeyRound,
  ShieldAlert,
  FileDown,
  Server,
  Lock,
  ExternalLink,
  RotateCcw,
  AlertOctagon,
  ArrowLeft,
  ArrowRight,
  Plus,
  Eye,
  Fingerprint,
  Ban,
} from 'lucide-react';
import {
  validateHostnameWithPsl,
  getDnsZoneInfoWithPsl,
  pslSyncWorker,
  parseDomainWithPsl,
} from './utils/pslEngine';
import { DefaultDomainDetailsView } from './components/DefaultDomainDetailsView';
import { ActiveDomainCertificateRotationModal } from './components/ActiveDomainCertificateRotationModal';
import { PslStatusBanner } from './components/PslStatusBanner';

// Custom SVG icons to match exact screenshot glyphs
function LicenseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3.5" width="16" height="13" rx="2" />
      <rect x="4.5" y="6" width="3.5" height="3.5" rx="0.5" />
      <line x1="10.5" y1="6.5" x2="15.5" y2="6.5" />
      <line x1="10.5" y1="9.5" x2="14" y2="9.5" />
      <line x1="4.5" y1="13" x2="15.5" y2="13" />
    </svg>
  );
}

function IntegrationsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 6.5C4.5 6.5 3 8 3 10s1.5 3.5 4 3.5c1.8 0 3-1 3.5-2" />
      <path d="M13 13.5c2.5 0 4-1.5 4-3.5s-1.5-3.5-4-3.5c-1.8 0-3 1-3.5 2" />
    </svg>
  );
}

function TechniciansIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 16a3.5 3.5 0 0 0-7 0" />
      <circle cx="9.5" cy="8.5" r="2.5" />
      <path d="M16 14.5a3 3 0 0 0-2.5-2.2" />
      <path d="M13 6.5a2 2 0 0 1 0 3.5" />
    </svg>
  );
}

// Updated Domain State Vocabulary
export type CustomDomainStatus =
  | 'Active'
  | 'Pending setup'
  | 'Provisioning'
  | 'Disabled'
  | 'Action required';

export interface PasskeyAllowedOrigin {
  id: string;
  domain: string;
  enforcePasskeyMigration: boolean;
  addedDate: string;
}

export interface InheritPasskeyRow {
  id: string;
  domain: string;
}

// Table Data Interfaces & States with precise Certificate Expiration & Last Successful Check
export interface CustomDomainItem {
  id: string;
  domain: string;
  isPrimary?: boolean;
  status: CustomDomainStatus;
  certificate: string;
  certManagementType?: 'managed' | 'upload';
  certExpirationDays?: number;
  certExpirationDate: string;
  lastSuccessfulCheck: string;
  issuer?: string;
  passkeyUsersCount?: number;
  passkeyNoFallbackCount?: number;
  allowedOrigins?: PasskeyAllowedOrigin[];
}

export type GlobalActionType =
  | 'Remove'
  | 'Edit'
  | 'Continue setup'
  | 'Disable'
  | 'Complete setup'
  | 'Verify'
  | 'Activate'
  | 'Reactivate'
  | 'Set as primary';

export interface ConfirmationModalState {
  isOpen: boolean;
  type: 'custom';
  action: GlobalActionType;
  domainName: string;
  itemId: string;
}

// Helper to sanitize hostname input
function sanitizeHostname(raw: string): string {
  let cleaned = raw.trim().toLowerCase();
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  cleaned = cleaned.replace(/[\/?:#].*$/, '');
  cleaned = cleaned.replace(/:\d+$/, '');
  return cleaned;
}

// Known cross-tenant reserved / existing hostnames for cross-tenant conflict simulation
const CROSS_TENANT_CONFLICT_DOMAINS = [
  'login.partner.com',
  'auth.external.com',
  'idp.partner.com',
  'sso.globalcorp.com',
  'auth.acmecorp.com',
  'identity.company.com',
  'login.shared-cloud.net',
  'login.hexnode.com',
];

// Case 3: Helper to validate single hostname input with synchronized Public Suffix List (PSL) parsing
function validateHostnameInput(
  rawHostname: string,
  existingDomains: CustomDomainItem[],
  editingId: string | null,
  isEditingActive: boolean = false
): { isValid: boolean; error: string | null; sanitized: string } {
  const result = validateHostnameWithPsl(rawHostname, existingDomains, editingId, isEditingActive);
  return {
    isValid: result.isValid,
    error: result.error,
    sanitized: result.parsed.sanitized,
  };
}

// Case 3: Helper to calculate exact DNS zone info with synchronized PSL zone vs host splitting
function getDnsZoneInfo(hostname: string): {
  hostname: string;
  rootZone: string;
  hostValue: string;
  fullRecordName: string;
  dnsZoneLocation: string;
} {
  const pslInfo = getDnsZoneInfoWithPsl(hostname);
  return {
    hostname: pslInfo.hostname,
    rootZone: pslInfo.rootZone,
    hostValue: pslInfo.hostValue,
    fullRecordName: pslInfo.fullRecordName,
    dnsZoneLocation: pslInfo.dnsZoneLocation,
  };
}

// Helper to validate PEM boundary markers strictly
const SAMPLE_PEM_CERT = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAJ8e4/kL7r4DMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAlVTMQswCQYDVQQIDAJDQTEUMBIGA1UECgwLSGV4bm9kZSBJZFAxEzARBgNV
BAMMCmxvZ2luLnNkYy5jb20wHhcNMjYwMTAxMDAwMDAwWhcNMjcwMTAxMDAwMDAw
WjBFMQswCQYDVQQGEwJVUzELMAkGA1UECAwCQ0ExFDASBgNVBAoMC0hleG5vZGUg
SWRQMRMwEQYDVQQDDApsb2dpbi5zZGMuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOC
AQ8AMIIBCgKCAQEAyv4Q3Wj9nZv8K3u
-----END CERTIFICATE-----`;

const SAMPLE_PEM_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDK/hDdaP2dmf8K
3u1lU4p5gY8QyX9wP6Z3k8v9Y8wX7Z6P5T4wV3u8x7Y6v5W4q3u8z7X6v5W4q3u8
z7X6v5W4q3u8z7X6v5W4q3u8z7X6v5W4q3u8z7X6v5W4q3u8z7X6v5W4q3u8z7X6
v5W4q3u8z7X6v5W4q3u8z7X6v5W4q3u8
-----END PRIVATE KEY-----`;

function validatePemCertBoundary(certText: string): { isValid: boolean; error: string | null } {
  const trimmed = certText.trim();
  if (!trimmed.includes('-----BEGIN CERTIFICATE-----')) {
    return { isValid: false, error: 'Certificate missing exact marker "-----BEGIN CERTIFICATE-----"' };
  }
  if (!trimmed.includes('-----END CERTIFICATE-----')) {
    return { isValid: false, error: 'Certificate missing exact marker "-----END CERTIFICATE-----"' };
  }
  return { isValid: true, error: null };
}

function validatePemKeyBoundary(keyText: string): { isValid: boolean; error: string | null } {
  const trimmed = keyText.trim();
  const hasValidHeader =
    trimmed.includes('-----BEGIN PRIVATE KEY-----') ||
    trimmed.includes('-----BEGIN RSA PRIVATE KEY-----') ||
    trimmed.includes('-----BEGIN EC PRIVATE KEY-----');

  const hasValidFooter =
    trimmed.includes('-----END PRIVATE KEY-----') ||
    trimmed.includes('-----END RSA PRIVATE KEY-----') ||
    trimmed.includes('-----END EC PRIVATE KEY-----');

  if (!hasValidHeader) {
    return { isValid: false, error: 'Private key missing exact marker "-----BEGIN PRIVATE KEY-----"' };
  }
  if (!hasValidFooter) {
    return { isValid: false, error: 'Private key missing exact marker "-----END PRIVATE KEY-----"' };
  }
  return { isValid: true, error: null };
}

export function App() {
  const [activeNav, setActiveNav] = useState('Settings');
  const [activeSidebar, setActiveSidebar] = useState('Domains');
  const [activeDomainTab, setActiveDomainTab] = useState<'Custom domains' | 'Allowed domains'>('Custom domains');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Standalone Default Hexnode Domain Card state & modal
  const defaultHexnodeUrl = 'tenant.hexnode.com';
  const [isDefaultCardMenuOpen, setIsDefaultCardMenuOpen] = useState(false);
  const [isRestoreDefaultModalOpen, setIsRestoreDefaultModalOpen] = useState(false);

  // Allowed Domains Two-Step Verification Wizard State
  const [isAllowedModalOpen, setIsAllowedModalOpen] = useState(false);
  const [newAllowedDomainInput, setNewAllowedDomainInput] = useState('');
  const [allowedWizardStep, setAllowedWizardStep] = useState<1 | 2>(1);
  const [allowedGeneratedToken, setAllowedGeneratedToken] = useState('');
  const [allowedVerifyMethod, setAllowedVerifyMethod] = useState<'dns' | 'http'>('dns');
  const [allowedVerifyStatus, setAllowedVerifyStatus] = useState<'idle' | 'checking' | 'verified' | 'failed'>('idle');
  const [allowedVerifyError, setAllowedVerifyError] = useState<string | null>(null);
  const [allowedVerifyAttemptCount, setAllowedVerifyAttemptCount] = useState<number>(0);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [allowedStep1Error, setAllowedStep1Error] = useState<string | null>(null);
  const newAllowedDomainInputRef = useRef<HTMLInputElement>(null);

  // Provisioning Status Modal state
  const [isProvisioningModalOpen, setIsProvisioningModalOpen] = useState(false);
  const [provisioningModalDomain, setProvisioningModalDomain] = useState<CustomDomainItem | null>(null);

  // Restructured Full-Width 5-Step Wizard State for Custom Domains
  const [isCustomDomainWizardOpen, setIsCustomDomainWizardOpen] = useState(false);
  const [editingCustomDomainId, setEditingCustomDomainId] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1 State: Single Login Hostname Input & Certificate Management
  const [loginHostnameInput, setLoginHostnameInput] = useState('login.sdc.com');
  const [hostnameValidationError, setHostnameValidationError] = useState<string | null>(null);
  const [certManagement, setCertManagement] = useState<'managed' | 'upload'>('managed');
  const [verifiedHostname, setVerifiedHostname] = useState<string | null>(null);
  const [lastVerifiedHostname, setLastVerifiedHostname] = useState<string | null>(null);
  const [isHostnameInvalidated, setIsHostnameInvalidated] = useState<boolean>(false);
  const [isManagedCertApproved, setIsManagedCertApproved] = useState<boolean>(true);

  // Step 2 State: Ownership Verification
  const [verifyMethod, setVerifyMethod] = useState<'dns' | 'http'>('dns');
  const [selectedVerifyMethod, setSelectedVerifyMethod] = useState<'dns' | 'http' | null>(null);
  const [verifyAttemptCount, setVerifyAttemptCount] = useState<number>(0);
  const [ownershipVerificationError, setOwnershipVerificationError] = useState<string | null>(null);
  const [dnsCheckStatus, setDnsCheckStatus] = useState<'idle' | 'checking' | 'verified' | 'failed'>('idle');
  const [httpCheckStatus, setHttpCheckStatus] = useState<'idle' | 'checking' | 'verified' | 'failed'>('idle');

  // Granular Verification Error Simulation State
  type FailureType = 'none' | 'propagation-pending' | 'missing/incorrect-record' | 'unreachable-file' | 'timeout' | 'certificate-error';
  const [selectedFailureSim, setSelectedFailureSim] = useState<FailureType>('none');
  const [activeErrorState, setActiveErrorState] = useState<{ title: string; message: string; failureType: FailureType } | null>(null);

  // Step 3 State: Configure DNS routing
  const [cnameCheckStatus, setCnameCheckStatus] = useState<'idle' | 'checking' | 'verified' | 'failed'>('idle');
  const [cnameAttemptCount, setCnameAttemptCount] = useState<number>(0);
  const [cnameRoutingError, setCnameRoutingError] = useState<string | null>(null);

  // Step 4 State: Certificate (Managed vs Self-managed)
  const [certInputMethod, setCertInputMethod] = useState<'upload' | 'text'>('upload');
  const [pemCertFileName, setPemCertFileName] = useState<string | null>(null);
  const [pemKeyFileName, setPemKeyFileName] = useState<string | null>(null);
  const [pemCertFileText, setPemCertFileText] = useState<string>('');
  const [pemKeyFileText, setPemKeyFileText] = useState<string>('');
  const [pemCertFileSize, setPemCertFileSize] = useState<string | null>(null);
  const [pemKeyFileSize, setPemKeyFileSize] = useState<string | null>(null);
  const [isDraggingCert, setIsDraggingCert] = useState<boolean>(false);
  const [isDraggingKey, setIsDraggingKey] = useState<boolean>(false);
  const [pemCertText, setPemCertText] = useState('');
  const [pemKeyText, setPemKeyText] = useState('');
  const [certValidateStatus, setCertValidateStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [pemValidationError, setPemValidationError] = useState<string | null>(null);

  // Primary Domain Action Modals State
  const [isPrimaryRemovalModalOpen, setIsPrimaryRemovalModalOpen] = useState(false);
  const [primaryRemovalDomain, setPrimaryRemovalDomain] = useState<CustomDomainItem | null>(null);

  const [isPrimaryDisableModalOpen, setIsPrimaryDisableModalOpen] = useState(false);
  const [primaryDisableDomain, setPrimaryDisableDomain] = useState<CustomDomainItem | null>(null);
  const [revertToDefaultChecked, setRevertToDefaultChecked] = useState(false);

  // Modify Domain Confirmation Modal State
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [modifyModalDomain, setModifyModalDomain] = useState<CustomDomainItem | null>(null);
  const [activeDomainForRotation, setActiveDomainForRotation] = useState<CustomDomainItem | null>(null);

  // Post-Activation Success Modal State
  const [isPostActivationSuccessModalOpen, setIsPostActivationSuccessModalOpen] = useState(false);
  const [postActivationDomain, setPostActivationDomain] = useState<string>('');
  const [postActivationDomainId, setPostActivationDomainId] = useState<string | null>(null);
  const [isTestConfirmed, setIsTestConfirmed] = useState(false);
  const [isSetPrimaryChecked, setIsSetPrimaryChecked] = useState(false);
  const [isSetPrimaryAttestationChecked, setIsSetPrimaryAttestationChecked] = useState(false);

  // Destructive Actions Safety Guard Checkboxes (Condition A & Condition B)
  const [confirmPasskeyMigrationChecked, setConfirmPasskeyMigrationChecked] = useState(false);
  const [confirmAdminRecoveryChecked, setConfirmAdminRecoveryChecked] = useState(false);
  const [removeConfirmInput, setRemoveConfirmInput] = useState('');
  const [isMigrationStatusModalOpen, setIsMigrationStatusModalOpen] = useState(false);

  // Reactivation Recheck Modal State
  const [isReactivationModalOpen, setIsReactivationModalOpen] = useState(false);
  const [reactivationDomain, setReactivationDomain] = useState<CustomDomainItem | null>(null);

  // Dynamic Pre-Validated Certificate Replacement Flow State
  const [replacingCertDomainId, setReplacingCertDomainId] = useState<string | null>(null);
  const [isVerificationRequiredModalOpen, setIsVerificationRequiredModalOpen] = useState(false);
  const [verificationRequiredDomain, setVerificationRequiredDomain] = useState<CustomDomainItem | null>(null);
  const [isRetryingVerification, setIsRetryingVerification] = useState(false);

  // Phase 2: Single-Step Certificate Update Modal State
  const [isReplaceCertModalOpen, setIsReplaceCertModalOpen] = useState(false);
  const [replaceCertDomain, setReplaceCertDomain] = useState<CustomDomainItem | null>(null);
  const [replaceCertMethod, setReplaceCertMethod] = useState<'upload' | 'text'>('upload');
  const [replaceCertPemFile, setReplaceCertPemFile] = useState<{ name: string; size: string; content?: string } | null>(null);
  const [replaceCertKeyFile, setReplaceCertKeyFile] = useState<{ name: string; size: string; content?: string } | null>(null);
  const [replaceCertPemText, setReplaceCertPemText] = useState('');
  const [replaceCertKeyText, setReplaceCertKeyText] = useState('');
  const [replaceCertValidationError, setReplaceCertValidationError] = useState<string | null>(null);
  const [replaceCertPreview, setReplaceCertPreview] = useState<{
    issuer: string;
    subjectDomain: string;
    isDomainMatch: boolean;
    expirationDate: string;
  } | null>(null);
  const [isReplacingValidating, setIsReplacingValidating] = useState(false);

  // Navigation Guard Prompt State
  const [isNavGuardPromptOpen, setIsNavGuardPromptOpen] = useState(false);

  // Dedicated Domain Details View State
  const [selectedDomainIdForDetails, setSelectedDomainIdForDetails] = useState<string | null>(null);
  const [activeDetailsTab, setActiveDetailsTab] = useState<'Details' | 'Passkeys'>('Details');
  const [isDetailsManageMenuOpen, setIsDetailsManageMenuOpen] = useState(false);

  // Inherit Passkeys Modal Dynamic Rows State (for Passkeys tab)
  const [isAddOriginModalOpen, setIsAddOriginModalOpen] = useState(false);
  const [inheritDomainRows, setInheritDomainRows] = useState<InheritPasskeyRow[]>([
    { id: 'row-1', domain: '' },
  ]);
  const [enforcePasskeyMigrationToggle, setEnforcePasskeyMigrationToggle] = useState(true);

  // Custom Domains state with precise Certificate expiration date & Last successful check timestamp
  const [customDomains, setCustomDomains] = useState<CustomDomainItem[]>([
    {
      id: 'custom-1',
      domain: 'idp.acmecorp.com',
      isPrimary: true,
      status: 'Active',
      certificate: 'Managed by Hexnode',
      certManagementType: 'managed',
      certExpirationDays: 88,
      certExpirationDate: 'Jan 03, 2027',
      lastSuccessfulCheck: 'Oct 08, 2026, 02:15 AM',
      issuer: "Let's Encrypt Authority X3",
      allowedOrigins: [
        {
          id: 'origin-1',
          domain: 'login.acme.com',
          enforcePasskeyMigration: true,
          addedDate: 'Sep 14, 2026',
        },
        {
          id: 'origin-2',
          domain: 'sso.staging-corp.com',
          enforcePasskeyMigration: false,
          addedDate: 'Oct 02, 2026',
        },
      ],
    },
    {
      id: 'custom-prov',
      domain: 'sso.staging-corp.com',
      isPrimary: false,
      status: 'Provisioning',
      certificate: 'Managed by Hexnode (Issuing)',
      certManagementType: 'managed',
      certExpirationDays: 90,
      certExpirationDate: 'Pending issuance',
      lastSuccessfulCheck: 'Oct 08, 2026, 02:22 AM',
      issuer: "Let's Encrypt Authority X3",
      allowedOrigins: [],
    },
    {
      id: 'custom-active-nonprimary',
      domain: 'login.acme.com',
      isPrimary: false,
      status: 'Active',
      certificate: 'Managed by Hexnode',
      certManagementType: 'managed',
      certExpirationDays: 74,
      certExpirationDate: 'Dec 18, 2026',
      lastSuccessfulCheck: 'Oct 08, 2026, 01:50 AM',
      issuer: "Let's Encrypt Authority X3",
      passkeyUsersCount: 142,
      passkeyNoFallbackCount: 18,
      allowedOrigins: [
        {
          id: 'origin-3',
          domain: 'idp.acmecorp.com',
          enforcePasskeyMigration: false,
          addedDate: 'Aug 29, 2026',
        },
      ],
    },
    {
      id: 'custom-2',
      domain: 'login.corporation.com',
      isPrimary: false,
      status: 'Pending setup',
      certificate: 'Self-managed',
      certManagementType: 'upload',
      certExpirationDays: 18,
      certExpirationDate: 'Oct 26, 2026',
      lastSuccessfulCheck: 'Sep 28, 2026, 04:12 PM',
      issuer: 'DigiCert Global Root CA',
      allowedOrigins: [],
    },
    {
      id: 'custom-3',
      domain: 'auth.legacy-portal.io',
      isPrimary: false,
      status: 'Disabled',
      certificate: 'Self-managed',
      certManagementType: 'upload',
      certExpirationDays: 0,
      certExpirationDate: 'Aug 14, 2026 (Expired)',
      lastSuccessfulCheck: 'Aug 14, 2026, 11:30 AM',
      issuer: 'Sectigo RSA Domain Validation CA',
      allowedOrigins: [],
    },
    {
      id: 'custom-4',
      domain: 'sso.partner-portal.com',
      isPrimary: false,
      status: 'Action required',
      certificate: 'Self-managed',
      certManagementType: 'upload',
      certExpirationDays: 0,
      certExpirationDate: 'Jul 02, 2026 (Expired)',
      lastSuccessfulCheck: 'Oct 08, 2026, 02:10 AM',
      issuer: 'DigiCert Global Root CA',
      allowedOrigins: [],
    },
  ]);

  interface AllowedDomainItem {
    id: string;
    domain: string;
    status: 'Verified' | 'Pending Verification' | 'Disabled';
    source: 'Manual' | 'Entra ID' | 'Google Workspace' | string;
    signInVia: 'Entra' | 'Google' | 'Hexnode';
    users: number | string;
    isManual: boolean;
  }

  const [allowedDomains, setAllowedDomains] = useState<AllowedDomainItem[]>([
    {
      id: 'allowed-1',
      domain: 'corporation.com',
      status: 'Verified',
      source: 'Manual',
      signInVia: 'Hexnode',
      users: '1,420',
      isManual: true,
    },
    {
      id: 'allowed-2',
      domain: 'hexnode.com',
      status: 'Verified',
      source: 'Entra ID',
      signInVia: 'Entra',
      users: '850',
      isManual: false,
    },
    {
      id: 'allowed-3',
      domain: 'partner-portal.io',
      status: 'Pending Verification',
      source: 'Manual',
      signInVia: 'Hexnode',
      users: '340',
      isManual: true,
    },
    {
      id: 'allowed-4',
      domain: 'contractor-network.org',
      status: 'Disabled',
      source: 'Manual',
      signInVia: 'Hexnode',
      users: '28',
      isManual: true,
    },
    {
      id: 'allowed-5',
      domain: 'global-workspace.com',
      status: 'Verified',
      source: 'Google Workspace',
      signInVia: 'Google',
      users: '120',
      isManual: false,
    },
  ]);

  const [newAllowedSignInVia, setNewAllowedSignInVia] = useState<'Entra' | 'Google' | 'Hexnode'>('Hexnode');
  const [isEditAllowedModalOpen, setIsEditAllowedModalOpen] = useState(false);
  const [editingAllowedDomain, setEditingAllowedDomain] = useState<AllowedDomainItem | null>(null);
  const [editAllowedDomainInput, setEditAllowedDomainInput] = useState('');

  // Modals for Allowed Domains Actions
  const [isRemoveAllowedModalOpen, setIsRemoveAllowedModalOpen] = useState(false);
  const [removingAllowedDomain, setRemovingAllowedDomain] = useState<AllowedDomainItem | null>(null);
  const [removeAllowedConfirmInput, setRemoveAllowedConfirmInput] = useState('');

  const [isDisableAllowedModalOpen, setIsDisableAllowedModalOpen] = useState(false);
  const [disablingAllowedDomain, setDisablingAllowedDomain] = useState<AllowedDomainItem | null>(null);

  const [isReactivateAllowedModalOpen, setIsReactivateAllowedModalOpen] = useState(false);
  const [reactivatingAllowedDomain, setReactivatingAllowedDomain] = useState<AllowedDomainItem | null>(null);

  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState>({
    isOpen: false,
    type: 'custom',
    action: 'Remove',
    domainName: '',
    itemId: '',
  });

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const copyToClipboard = (text: string, label = 'Copied') => {
    navigator.clipboard?.writeText(text);
    showToast(`${label} copied to clipboard`);
  };

  const handleDownloadPem = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/x-pem-file' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`);
  };

  // Hostname Modification & Strict Invalidation Handler (Global Reset)
  const handleSingleHostnameInputChange = (val: string) => {
    setLoginHostnameInput(val);

    const valResult = validateHostnameInput(val, customDomains, editingCustomDomainId);
    if (!valResult.isValid && val.trim() !== '') {
      setHostnameValidationError(valResult.error);
    } else {
      setHostnameValidationError(null);
    }

    const trimmed = val.trim();

    // Hostname Invalidation (Step 1 -> Step 2, 3, 4 Global Reset):
    // If the user navigates back to Step 1 and modifies a previously verified hostname string,
    // immediately invalidate the completion status of all subsequent steps.
    const activeReferenceHostname = lastVerifiedHostname || verifiedHostname;

    if (activeReferenceHostname !== null) {
      if (trimmed !== activeReferenceHostname) {
        // Step 2 Ownership Reset (unverified / incomplete state from scratch)
        setDnsCheckStatus('idle');
        setHttpCheckStatus('idle');
        setSelectedVerifyMethod(null);
        setVerifyAttemptCount(0);
        setOwnershipVerificationError(null);
        setActiveErrorState(null);

        // Step 3 Routing Reset (unverified / incomplete state)
        setCnameCheckStatus('idle');
        setCnameAttemptCount(0);
        setCnameRoutingError(null);

        // Step 4 Certificate Reset (unverified / incomplete state)
        setCertValidateStatus('idle');
        setIsManagedCertApproved(false);
        setPemValidationError(null);
        setPemCertFileName(null);
        setPemKeyFileName(null);
        setPemCertFileText('');
        setPemKeyFileText('');
        setPemCertFileSize(null);
        setPemKeyFileSize(null);
        setPemCertText('');
        setPemKeyText('');
        setIsDraggingCert(false);
        setIsDraggingKey(false);

        // Nullify verified reference & mark invalidation active
        setVerifiedHostname(null);
        setIsHostnameInvalidated(true);
      } else {
        // Restored back to the exact verified hostname
        setVerifiedHostname(activeReferenceHostname);
        setIsHostnameInvalidated(false);
      }
    } else if (isHostnameInvalidated) {
      // Keep subsequent steps reset if already invalidated
      setDnsCheckStatus('idle');
      setHttpCheckStatus('idle');
      setCnameCheckStatus('idle');
      setCertValidateStatus('idle');
      setIsManagedCertApproved(false);
    }
  };

  // Certificate Preference Invalidation (Step 4 & Step 1):
  // When the user toggles the Certificate Management radio button between Managed by Hexnode and Self-managed,
  // instantly clear any previously uploaded files, pasted PEM text, or stored certificate payloads in local component state.
  // Reset the step's readiness status to incomplete until the user satisfies the requirements of the newly selected path.
  const handleToggleCertManagement = (newMode: 'managed' | 'upload') => {
    if (newMode === certManagement) return;

    setCertManagement(newMode);

    // Clear previously uploaded files, pasted PEM text, or stored certificate payloads
    setPemCertFileName(null);
    setPemKeyFileName(null);
    setPemCertFileText('');
    setPemKeyFileText('');
    setPemCertFileSize(null);
    setPemKeyFileSize(null);
    setPemCertText('');
    setPemKeyText('');
    setPemValidationError(null);
    setIsDraggingCert(false);
    setIsDraggingKey(false);

    // Reset step readiness status according to chosen mode
    if (newMode === 'managed') {
      setIsManagedCertApproved(true);
      setCertValidateStatus('idle');
    } else {
      setIsManagedCertApproved(false);
      setCertValidateStatus('idle');
    }

    showToast(`Switched to ${newMode === 'managed' ? 'Managed by Hexnode' : 'Self-managed'}. Certificate data cleared.`);
  };

  // Custom Domain Wizard Handlers
  const handleStartCustomDomainWizard = () => {
    setEditingCustomDomainId(null);
    setLoginHostnameInput('login.sdc.com');
    setHostnameValidationError(null);
    setCertManagement('managed');
    setVerifiedHostname(null);
    setLastVerifiedHostname(null);
    setIsHostnameInvalidated(false);
    setIsManagedCertApproved(true);
    setWizardStep(1);
    setSelectedVerifyMethod(null);
    setVerifyAttemptCount(0);
    setOwnershipVerificationError(null);
    setDnsCheckStatus('idle');
    setHttpCheckStatus('idle');
    setCnameCheckStatus('idle');
    setCnameAttemptCount(0);
    setCnameRoutingError(null);
    setCertInputMethod('upload');
    setPemCertFileName(null);
    setPemKeyFileName(null);
    setPemCertFileText('');
    setPemKeyFileText('');
    setPemCertFileSize(null);
    setPemKeyFileSize(null);
    setIsDraggingCert(false);
    setIsDraggingKey(false);
    setPemCertText('');
    setPemKeyText('');
    setCertValidateStatus('idle');
    setPemValidationError(null);
    setSelectedFailureSim('none');
    setActiveErrorState(null);
    setIsCustomDomainWizardOpen(true);
  };

  const handleAttemptCloseCustomWizard = () => {
    if (wizardStep > 1 || loginHostnameInput !== 'login.sdc.com' || certManagement === 'upload') {
      setIsNavGuardPromptOpen(true);
    } else {
      handleCloseCustomDomainWizard();
    }
  };

  const handleCloseCustomDomainWizard = () => {
    setIsCustomDomainWizardOpen(false);
    setIsNavGuardPromptOpen(false);
    setEditingCustomDomainId(null);
    setWizardStep(1);
    setSelectedVerifyMethod(null);
    setVerifyAttemptCount(0);
    setOwnershipVerificationError(null);
    setCnameAttemptCount(0);
    setCnameRoutingError(null);
    setActiveErrorState(null);
    setHostnameValidationError(null);
    setCertInputMethod('upload');
    setPemCertFileName(null);
    setPemKeyFileName(null);
    setPemCertFileText('');
    setPemKeyFileText('');
    setPemCertFileSize(null);
    setPemKeyFileSize(null);
    setIsDraggingCert(false);
    setIsDraggingKey(false);
    setPemCertText('');
    setPemKeyText('');
    setCertValidateStatus('idle');
    setPemValidationError(null);
  };

  // Save and Exit Handler
  const handleSaveAndExitWizard = () => {
    const sanitized = sanitizeHostname(loginHostnameInput) || 'login.sdc.com';
    const certType = certManagement === 'managed'
      ? 'Managed by Hexnode'
      : 'Self-managed';

    setCustomDomains((prev) => {
      if (editingCustomDomainId) {
        return prev.map((d) =>
          d.id === editingCustomDomainId
            ? {
                ...d,
                domain: sanitized,
                status: 'Pending setup',
                certificate: certType,
                certManagementType: certManagement,
                certExpirationDate: 'Oct 26, 2026',
                lastSuccessfulCheck: 'Just now',
              }
            : d
        );
      }
      return [
        ...prev,
        {
          id: `custom-${Date.now()}`,
          domain: sanitized,
          isPrimary: false,
          status: 'Pending setup',
          certificate: certType,
          certManagementType: certManagement,
          certExpirationDays: certManagement === 'managed' ? 90 : 30,
          certExpirationDate: 'Oct 26, 2026',
          lastSuccessfulCheck: 'Just now',
        },
      ];
    });

    setIsCustomDomainWizardOpen(false);
    setIsNavGuardPromptOpen(false);
    showToast(`Draft saved for [${sanitized}]`);
  };

  // Diagnostic Simulation Handler for Step 2 Granular Error Testing
  const triggerVerificationCheckWithSimulation = (
    type: 'dns' | 'http' | 'cname',
    setStatus: React.Dispatch<React.SetStateAction<'idle' | 'checking' | 'verified' | 'failed'>>
  ) => {
    setStatus('checking');
    setActiveErrorState(null);

    setTimeout(() => {
      if (selectedFailureSim === 'none') {
        setStatus('verified');
        const sanitized = sanitizeHostname(loginHostnameInput) || loginHostnameInput.trim();
        setVerifiedHostname(sanitized);
        setLastVerifiedHostname(sanitized);
        setIsHostnameInvalidated(false);
      } else {
        setStatus('failed');
        switch (selectedFailureSim) {
          case 'propagation-pending':
            setActiveErrorState({
              title: 'DNS Propagation Pending',
              message: 'DNS changes are still propagating across global edge resolvers (TTL delay). Please allow up to 15-30 minutes for DNS records to synchronize.',
              failureType: 'propagation-pending',
            });
            break;
          case 'missing/incorrect-record':
            setActiveErrorState({
              title: 'Missing or Incorrect DNS Record',
              message: 'The required TXT/CNAME record value was not found at your DNS provider zone location.',
              failureType: 'missing/incorrect-record',
            });
            break;
          case 'unreachable-file':
            setActiveErrorState({
              title: 'Unreachable HTTPS Verification File',
              message: 'The verification file at /.well-known/hexnode-challenge.txt returned HTTP 404 or connection refused.',
              failureType: 'unreachable-file',
            });
            break;
          case 'timeout':
            setActiveErrorState({
              title: 'Verification Request Timeout',
              message: 'Connection timed out while probing domain endpoint. Check firewall rules.',
              failureType: 'timeout',
            });
            break;
          case 'certificate-error':
            setActiveErrorState({
              title: 'SSL/TLS Handshake Certificate Error',
              message: 'The certificate provided by your server is expired, self-signed, or untrusted.',
              failureType: 'certificate-error',
            });
            break;
        }
      }
    }, 1200);
  };

  const handleVerifyOwnershipStep2 = (method: 'dns' | 'http') => {
    if (!selectedVerifyMethod) return;

    const setStatus = method === 'dns' ? setDnsCheckStatus : setHttpCheckStatus;
    setStatus('checking');
    setOwnershipVerificationError(null);
    setActiveErrorState(null);

    setTimeout(() => {
      if (verifyAttemptCount === 0) {
        // First Click: persistent inline red error
        setStatus('failed');
        setOwnershipVerificationError('Verification failed. Record not found.');
        setVerifyAttemptCount(1);
      } else {
        // Second Click: verification succeeds
        setStatus('verified');
        setOwnershipVerificationError(null);
        setVerifyAttemptCount(2);
        const sanitized = sanitizeHostname(loginHostnameInput) || loginHostnameInput.trim();
        setVerifiedHostname(sanitized);
        setLastVerifiedHostname(sanitized);
        setIsHostnameInvalidated(false);
        showToast('Ownership verified successfully');
      }
    }, 850);
  };

  const handleCheckDnsRecord = () => {
    handleVerifyOwnershipStep2('dns');
  };

  const handleCheckHttpFile = () => {
    handleVerifyOwnershipStep2('http');
  };

  const handleCheckCname = () => {
    setCnameCheckStatus('checking');
    setCnameRoutingError(null);

    setTimeout(() => {
      if (cnameAttemptCount === 0) {
        setCnameCheckStatus('failed');
        setCnameRoutingError('Routing check failed. CNAME mismatch.');
        setCnameAttemptCount(1);
      } else {
        setCnameCheckStatus('verified');
        setCnameRoutingError(null);
        setCnameAttemptCount(2);
        showToast('DNS routing verified successfully');
      }
    }, 850);
  };

  const handleOpenModifyModal = (row: CustomDomainItem) => {
    setOpenActionMenuId(null);
    setIsDetailsManageMenuOpen(false);
    setModifyModalDomain(row);
    setIsModifyModalOpen(true);
  };

  const handleDeployCertificateRotation = (
    updatedCertType: 'managed' | 'upload',
    newIssuer: string,
    newExpirationDate: string,
    newDays: number
  ) => {
    if (!activeDomainForRotation) return;
    setCustomDomains((prev) =>
      prev.map((d) =>
        d.id === activeDomainForRotation.id
          ? {
              ...d,
              certificate: updatedCertType === 'managed' ? 'Managed by Hexnode' : 'Self-managed',
              certManagementType: updatedCertType,
              issuer: newIssuer,
              certExpirationDate: newExpirationDate,
              certExpirationDays: newDays,
              lastSuccessfulCheck: 'Just now (Rotated & Verified)',
            }
          : d
      )
    );
    setActiveDomainForRotation(null);
  };

  // Step 4 File Processing Handlers for Dropzones
  const handleProcessCertFile = (file: File) => {
    if (!file.name.match(/\.(pem|crt|cer)$/i)) {
      setPemValidationError('Invalid format. Please select a .pem, .crt, or .cer certificate file.');
      setPemCertFileName(null);
      setPemCertFileText('');
      setPemCertFileSize(null);
      setCertValidateStatus('invalid');
      return;
    }

    setPemCertFileName(file.name);
    setPemCertFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      setPemCertFileText(text);
      const val = validatePemCertBoundary(text);
      if (!val.isValid) {
        setPemValidationError(val.error);
        setCertValidateStatus('invalid');
      } else {
        setPemValidationError(null);
        if (pemKeyFileText) {
          const keyVal = validatePemKeyBoundary(pemKeyFileText);
          if (keyVal.isValid) {
            setCertValidateStatus('valid');
          }
        }
      }
    };
    reader.onerror = () => {
      setPemValidationError('Could not read the uploaded certificate file.');
      setCertValidateStatus('invalid');
    };
    reader.readAsText(file);
  };

  const handleProcessKeyFile = (file: File) => {
    if (!file.name.match(/\.(key|pem)$/i)) {
      setPemValidationError('Invalid format. Please select a .key or .pem private key file.');
      setPemKeyFileName(null);
      setPemKeyFileText('');
      setPemKeyFileSize(null);
      setCertValidateStatus('invalid');
      return;
    }

    setPemKeyFileName(file.name);
    setPemKeyFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      setPemKeyFileText(text);
      const val = validatePemKeyBoundary(text);
      if (!val.isValid) {
        setPemValidationError(val.error);
        setCertValidateStatus('invalid');
      } else {
        setPemValidationError(null);
        if (pemCertFileText) {
          const certVal = validatePemCertBoundary(pemCertFileText);
          if (certVal.isValid) {
            setCertValidateStatus('valid');
          }
        }
      }
    };
    reader.onerror = () => {
      setPemValidationError('Could not read the uploaded private key file.');
      setCertValidateStatus('invalid');
    };
    reader.readAsText(file);
  };

  const handleLoadSampleFiles = () => {
    setPemCertFileName('wildcard_domain_cert.pem');
    setPemCertFileText(SAMPLE_PEM_CERT);
    setPemCertFileSize('1.8 KB');
    setPemKeyFileName('private_domain_key.pem');
    setPemKeyFileText(SAMPLE_PEM_KEY);
    setPemKeyFileSize('1.7 KB');
    setCertValidateStatus('valid');
    setPemValidationError(null);
    showToast('Sample PEM certificate and private key loaded');
  };

  // Step 4 Self-Managed PEM Validation with persistent inline errors
  const handleValidateCertificateStep4 = () => {
    setPemValidationError(null);

    if (certInputMethod === 'upload') {
      if (!pemCertFileName || !pemKeyFileName) {
        setPemValidationError('Both Certificate file and Private Key file are required.');
        setCertValidateStatus('invalid');
        return;
      }

      if (!pemCertFileText.trim()) {
        setPemValidationError('Certificate file content is empty or could not be read.');
        setCertValidateStatus('invalid');
        return;
      }

      const certVal = validatePemCertBoundary(pemCertFileText);
      if (!certVal.isValid) {
        setPemValidationError(certVal.error);
        setCertValidateStatus('invalid');
        return;
      }

      if (!pemKeyFileText.trim()) {
        setPemValidationError('Private key file content is empty or could not be read.');
        setCertValidateStatus('invalid');
        return;
      }

      const keyVal = validatePemKeyBoundary(pemKeyFileText);
      if (!keyVal.isValid) {
        setPemValidationError(keyVal.error);
        setCertValidateStatus('invalid');
        return;
      }
    } else {
      if (!pemCertText.trim() || !pemKeyText.trim()) {
        setPemValidationError('Both Certificate and Private Key text are required.');
        setCertValidateStatus('invalid');
        return;
      }

      const certVal = validatePemCertBoundary(pemCertText);
      if (!certVal.isValid) {
        setPemValidationError(certVal.error);
        setCertValidateStatus('invalid');
        return;
      }

      const keyVal = validatePemKeyBoundary(pemKeyText);
      if (!keyVal.isValid) {
        setPemValidationError(keyVal.error);
        setCertValidateStatus('invalid');
        return;
      }
    }

    setCertValidateStatus('validating');
    setTimeout(() => {
      setCertValidateStatus('valid');
      setPemValidationError(null);
    }, 750);
  };

  // Step 5 Gatekeeper Activation & Post-Activation Routing
  const handleActivateCustomDomainStep5 = () => {
    const fullDomain = sanitizeHostname(loginHostnameInput) || 'login.sdc.com';
    const certType = certManagement === 'managed'
      ? 'Managed by Hexnode'
      : 'Self-managed';
    const targetDomainId = editingCustomDomainId || `custom-${Date.now()}`;

    setCustomDomains((prev) => {
      if (editingCustomDomainId) {
        return prev.map((d) =>
          d.id === editingCustomDomainId
            ? {
                ...d,
                domain: fullDomain,
                status: 'Active',
                certificate: certType,
                certManagementType: certManagement,
                certExpirationDays: certManagement === 'managed' ? 90 : 365,
                certExpirationDate: 'Jan 05, 2027',
                lastSuccessfulCheck: 'Just now',
              }
            : d
        );
      }
      return [
        ...prev,
        {
          id: targetDomainId,
          domain: fullDomain,
          isPrimary: false,
          status: 'Active',
          certificate: certType,
          certManagementType: certManagement,
          certExpirationDays: certManagement === 'managed' ? 90 : 365,
          certExpirationDate: 'Jan 05, 2027',
          lastSuccessfulCheck: 'Just now',
        },
      ];
    });

    setIsCustomDomainWizardOpen(false);
    setEditingCustomDomainId(null);
    setWizardStep(1);
    showToast(`Custom domain [${fullDomain}] activated successfully!`);

    // Trigger Post-Activation Success Modal
    setPostActivationDomain(fullDomain);
    setPostActivationDomainId(targetDomainId);
    setIsTestConfirmed(false);
    setIsSetPrimaryChecked(false);
    setIsPostActivationSuccessModalOpen(true);
  };

  const handleModifyCustomDomain = (row: CustomDomainItem, startStep: 1 | 2 = 1) => {
    setOpenActionMenuId(null);
    setEditingCustomDomainId(row.id);
    setLoginHostnameInput(row.domain);
    setHostnameValidationError(null);
    const isManaged = row.certificate.includes('Managed by Hexnode');
    setCertManagement(isManaged ? 'managed' : 'upload');
    const isAct = row.status === 'Active';
    setVerifiedHostname(isAct ? row.domain : null);
    setLastVerifiedHostname(isAct ? row.domain : null);
    setIsHostnameInvalidated(false);
    setIsManagedCertApproved(isManaged);
    setDnsCheckStatus(isAct ? 'verified' : 'idle');
    setHttpCheckStatus('idle');
    setSelectedVerifyMethod(isAct ? 'dns' : null);
    setVerifyAttemptCount(isAct ? 2 : 0);
    setOwnershipVerificationError(null);
    setCnameCheckStatus(isAct ? 'verified' : 'idle');
    setCertValidateStatus(isAct ? 'valid' : 'idle');
    setPemValidationError(null);
    setSelectedFailureSim('none');
    setActiveErrorState(null);
    setWizardStep(startStep);
    setIsCustomDomainWizardOpen(true);
  };

  // "Fix issue" action handler for Action required state
  const handleFixIssue = (row: CustomDomainItem) => {
    setOpenActionMenuId(null);
    setEditingCustomDomainId(row.id);
    setLoginHostnameInput(row.domain);
    setHostnameValidationError(null);
    const isManaged = row.certificate.includes('Managed by Hexnode');
    setCertManagement(isManaged ? 'managed' : 'upload');

    // Route directly to the failed step with persistent red banner & retry
    if (row.certExpirationDays === 0 || row.certificate.includes('Expired')) {
      // Step 4 Certificate failure
      setWizardStep(4);
      setDnsCheckStatus('verified');
      setCnameCheckStatus('verified');
      setCertValidateStatus('invalid');
      setPemValidationError('SSL certificate expired. Upload or paste a renewed certificate chain.');
    } else {
      // Step 2 Ownership / DNS failure
      setWizardStep(2);
      setDnsCheckStatus('failed');
      setCnameCheckStatus('failed');
      setActiveErrorState({
        title: 'DNS Ownership / Routing Verification Failed',
        message: 'The DNS records for this domain could not be resolved by Hexnode edge probes.',
        failureType: 'missing/incorrect-record',
      });
    }

    setIsCustomDomainWizardOpen(true);
  };

  // Dynamic Pre-Validated Certificate Replacement Flow Handlers
  const handleStartReplaceCertificateFlow = (domain: CustomDomainItem, forceFailure = false) => {
    setOpenActionMenuId(null);
    setIsDetailsManageMenuOpen(false);
    setReplacingCertDomainId(domain.id);
    showToast(`Verifying DNS ownership and CNAME routing records for [${domain.domain}]...`);

    setTimeout(() => {
      setReplacingCertDomainId(null);
      // Backend DNS check: fails if domain is 'Action required', or if explicitly forced for testing
      const hasDnsFailure = forceFailure || domain.status === 'Action required';
      if (hasDnsFailure) {
        setVerificationRequiredDomain(domain);
        setIsVerificationRequiredModalOpen(true);
      } else {
        openReplaceCertModal(domain);
      }
    }, 850);
  };

  const openReplaceCertModal = (domain: CustomDomainItem) => {
    setReplaceCertDomain(domain);
    setReplaceCertMethod('upload');
    setReplaceCertPemFile(null);
    setReplaceCertKeyFile(null);
    setReplaceCertPemText('');
    setReplaceCertKeyText('');
    setReplaceCertValidationError(null);
    setReplaceCertPreview(null);
    setIsReplaceCertModalOpen(true);
  };

  const handleRetryVerification = () => {
    if (!verificationRequiredDomain) return;
    setIsRetryingVerification(true);

    setTimeout(() => {
      setIsRetryingVerification(false);
      setIsVerificationRequiredModalOpen(false);
      showToast(`DNS ownership and routing records verified successfully for [${verificationRequiredDomain.domain}]`);

      // Update domain status if it was Action required
      setCustomDomains((prev) =>
        prev.map((d) => (d.id === verificationRequiredDomain.id ? { ...d, status: 'Active' } : d))
      );

      const targetDomain = { ...verificationRequiredDomain, status: 'Active' as CustomDomainStatus };
      openReplaceCertModal(targetDomain);
    }, 1100);
  };

  const handleValidateReplaceCertPayload = () => {
    if (!replaceCertDomain) return;
    setIsReplacingValidating(true);
    setReplaceCertValidationError(null);

    setTimeout(() => {
      setIsReplacingValidating(false);

      const targetDomain = replaceCertDomain.domain.toLowerCase().trim();
      let certContent = replaceCertMethod === 'upload' ? (replaceCertPemFile?.content || '') : replaceCertPemText;
      let keyContent = replaceCertMethod === 'upload' ? (replaceCertKeyFile?.content || '') : replaceCertKeyText;

      // In upload mode with file selected but no text read (e.g. mock/browse), generate synthetic valid payload for that domain
      if (replaceCertMethod === 'upload') {
        if (!replaceCertPemFile || !replaceCertKeyFile) {
          setReplaceCertValidationError('Please upload both Certificate (.pem/.crt) and Private Key (.key) files before validating.');
          setReplaceCertPreview(null);
          return;
        }
        if (!certContent) {
          certContent = `-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAJ8e4/kL7r4DMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV\nBAYTAlVTMQswCQYDVQQIDAJDQTEUMBIGA1UECgwLSGV4bm9kZSBJZFAxEzARBgNV\nBAMMCm${targetDomain}0HhcNMjYwMTAxMDAwMDAwWhcNMjcwMTAxMDAwMDAw\nWjBFMQswCQYDVQQGEwJVUzELMAkGA1UECAwCQ0ExFDASBgNVBAoMC0hleG5vZGUg\nSWRQMRMwEQYDVQQDDAp${targetDomain}MIIBIjANBgkqhkiG9w0BAQEFAAOC\nAQ8AMIIBCgKCAQEAyv4Q3Wj9nZv8K3u\n-----END CERTIFICATE-----`;
        }
        if (!keyContent) {
          keyContent = SAMPLE_PEM_KEY;
        }
      }

      // Check text presence
      if (!certContent.trim() || !keyContent.trim()) {
        setReplaceCertValidationError('Both Certificate (PEM) and Private Key must be provided.');
        setReplaceCertPreview(null);
        return;
      }

      // 1. Validate exact PEM boundaries
      const certBoundary = validatePemCertBoundary(certContent);
      if (!certBoundary.isValid) {
        setReplaceCertValidationError(certBoundary.error || 'Invalid Certificate PEM boundary markers.');
        setReplaceCertPreview(null);
        return;
      }

      const keyBoundary = validatePemKeyBoundary(keyContent);
      if (!keyBoundary.isValid) {
        setReplaceCertValidationError(keyBoundary.error || 'Invalid Private Key PEM boundary markers.');
        setReplaceCertPreview(null);
        return;
      }

      // 2. Validate key-pair compatibility and Subject (Domains) match
      const lowerCert = certContent.toLowerCase();
      if (lowerCert.includes('mismatch') || lowerCert.includes('wrong-domain.com') || lowerCert.includes('example.org')) {
        setReplaceCertValidationError(`Subject Domain Mismatch: The certificate Subject does not match active custom hostname [${replaceCertDomain.domain}].`);
        setReplaceCertPreview(null);
        return;
      }

      if (lowerCert.includes('expired') || lowerCert.includes('expired-cert')) {
        setReplaceCertValidationError('Certificate Expired: The provided certificate payload has expired and cannot be deployed.');
        setReplaceCertPreview(null);
        return;
      }

      // 3. Success: expand preview card
      setReplaceCertPreview({
        issuer: replaceCertDomain.issuer || "DigiCert TLS RSA SHA256 2020 CA1",
        subjectDomain: replaceCertDomain.domain,
        isDomainMatch: true,
        expirationDate: "Oct 11, 2027 (Valid for 365 days)",
      });
      setReplaceCertValidationError(null);
    }, 400);
  };

  const handleConfirmReplaceCertificate = () => {
    if (!replaceCertDomain || !replaceCertPreview) return;

    setCustomDomains((prev) =>
      prev.map((d) =>
        d.id === replaceCertDomain.id
          ? {
              ...d,
              status: 'Active',
              certificate: 'Self-managed',
              certExpirationDays: 365,
              certExpirationDate: 'Oct 11, 2027',
              lastSuccessfulCheck: 'Just now',
              issuer: replaceCertPreview.issuer,
            }
          : d
      )
    );

    showToast(`SSL Certificate replaced and validated successfully for [${replaceCertDomain.domain}]`);
    setIsReplaceCertModalOpen(false);
    setReplaceCertDomain(null);
    setReplaceCertPreview(null);
  };

  // Primary Removal Handler (Hard Block)
  const handleConfirmPrimaryRemoval = () => {
    setIsPrimaryRemovalModalOpen(false);
    setPrimaryRemovalDomain(null);
  };

  // Primary Disable Handler (Revert to default Hexnode IdP domain)
  const handleConfirmPrimaryDisable = () => {
    if (!primaryDisableDomain) return;

    setCustomDomains((prev) =>
      prev.map((d) =>
        d.id === primaryDisableDomain.id
          ? { ...d, isPrimary: false, status: 'Disabled' }
          : d
      )
    );
    showToast(`Primary custom domain [${primaryDisableDomain.domain}] disabled. Reverted primary domain to default Hexnode IdP domain.`);
    setIsPrimaryDisableModalOpen(false);
    setPrimaryDisableDomain(null);
    setRevertToDefaultChecked(false);
  };

  // Reactivation Verify Click Handler
  const handleConfirmReactivationVerify = () => {
    if (!reactivationDomain) return;

    const targetDomain = reactivationDomain;
    setIsReactivationModalOpen(false);
    setReactivationDomain(null);

    handleModifyCustomDomain(targetDomain, 2);
    // Ensure domain verification recheck begins unverified at Step 2
    setDnsCheckStatus('idle');
    setHttpCheckStatus('idle');
    setSelectedVerifyMethod(null);
    setVerifyAttemptCount(0);
    setOwnershipVerificationError(null);
  };

  // Simulate Primary Domain Outage
  const handleSimulateOutage = (domainId: string) => {
    setOpenActionMenuId(null);
    setCustomDomains((prev) =>
      prev.map((d) =>
        d.id === domainId
          ? {
              ...d,
              status: 'Action required',
              lastSuccessfulCheck: 'Just now (Check failed)',
            }
          : d
      )
    );
    showToast('Domain outage simulated. Domain status moved to "Action required".');
  };

  const handleOpenActionModal = (
    type: 'custom',
    action: GlobalActionType,
    domainName: string,
    itemId: string
  ) => {
    setOpenActionMenuId(null);
    setConfirmPasskeyMigrationChecked(false);
    setConfirmAdminRecoveryChecked(false);
    setRevertToDefaultChecked(false);
    setRemoveConfirmInput('');
    setIsSetPrimaryAttestationChecked(false);

    if (type === 'custom' && action === 'Remove') {
      const targetDomain = customDomains.find((d) => d.id === itemId);
      if (targetDomain && targetDomain.isPrimary) {
        setPrimaryRemovalDomain(targetDomain);
        setIsPrimaryRemovalModalOpen(true);
        return;
      }
    }

    if (type === 'custom' && action === 'Disable') {
      const targetDomain = customDomains.find((d) => d.id === itemId);
      if (targetDomain && targetDomain.isPrimary) {
        setPrimaryDisableDomain(targetDomain);
        setRevertToDefaultChecked(false);
        setIsPrimaryDisableModalOpen(true);
        return;
      }
    }

    if (type === 'custom' && (action === 'Activate' || action === 'Reactivate')) {
      const targetDomain = customDomains.find((d) => d.id === itemId);
      if (targetDomain) {
        setReactivationDomain(targetDomain);
        setIsReactivationModalOpen(true);
        return;
      }
    }

    setConfirmationModal({
      isOpen: true,
      type,
      action,
      domainName,
      itemId,
    });
  };

  const handleConfirmAction = () => {
    const { type, action, domainName, itemId } = confirmationModal;

    if (type === 'custom') {
      if (action === 'Set as primary') {
        setCustomDomains((prev) =>
          prev.map((d) => ({
            ...d,
            isPrimary: d.id === itemId,
          }))
        );
        showToast(`Domain [${domainName}] set as primary domain`);
      } else if (action === 'Remove') {
        setCustomDomains((prev) => prev.filter((d) => d.id !== itemId));
        if (selectedDomainIdForDetails === itemId) {
          setSelectedDomainIdForDetails(null);
        }
        showToast(`Custom domain [${domainName}] removed successfully`);
        setRemoveConfirmInput('');
      } else if (action === 'Disable') {
        setCustomDomains((prev) =>
          prev.map((d) => (d.id === itemId ? { ...d, status: 'Disabled' } : d))
        );
        showToast(`Custom domain [${domainName}] disabled`);
      } else if (action === 'Complete setup' || action === 'Continue setup') {
        const targetDomain = customDomains.find((d) => d.id === itemId);
        if (targetDomain) {
          handleModifyCustomDomain(targetDomain, 2);
        }
      } else if (action === 'Verify') {
        const targetDomain = customDomains.find((d) => d.id === itemId);
        if (targetDomain) {
          handleModifyCustomDomain(targetDomain, 2);
        }
      } else if (action === 'Activate' || action === 'Reactivate') {
        setCustomDomains((prev) =>
          prev.map((d) => (d.id === itemId ? { ...d, status: 'Active' } : d))
        );
        showToast(`Custom domain [${domainName}] reactivated successfully`);
      }
    }
    setIsSetPrimaryAttestationChecked(false);
    setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
  };

  // Export Entire App and Product Flows as Standalone HTML file
  const handleExportAppHtml = async () => {
    try {
      showToast('Preparing standalone HTML file for export...');
      const response = await fetch('/download-offline.html');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hexnode-idp-domain-offline.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('Export successful! Downloaded hexnode-idp-domain-offline.html');
        return;
      }
    } catch {
      // Fallback: serialize current document
    }

    try {
      const htmlContent = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hexnode-idp-domain-app.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('Export successful! Downloaded hexnode-idp-domain-app.html');
    } catch (err) {
      console.error('Export HTML failed:', err);
      showToast('Export failed. Please check browser permissions.');
    }
  };

  // Status Badge Renderer for Updated Vocabulary
  const renderCustomStatusBadge = (status: CustomDomainStatus) => {
    switch (status) {
      case 'Active':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#DCFCE7] text-[#15803D]">
            Active
          </span>
        );
      case 'Pending setup':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#FEF3C7] text-[#B45309]">
            Pending setup
          </span>
        );
      case 'Provisioning':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#EFF6FF] text-[#1D4ED8]">
            Provisioning
          </span>
        );
      case 'Disabled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#F3F4F6] text-[#4B5563]">
            Disabled
          </span>
        );
      case 'Action required':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#FEE2E2] text-[#B91C1C]">
            Action required
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#F3F4F6] text-[#4B5563]">
            {status}
          </span>
        );
    }
  };

  // Exact Certificate Expiration Date Cell
  const renderCertExpirationCell = (dateString: string, expDays?: number) => {
    if (dateString.includes('Expired') || (expDays !== undefined && expDays <= 0)) {
      return (
        <span className="text-[#DC2626] font-medium">
          {dateString}
        </span>
      );
    }
    if (expDays !== undefined && expDays <= 30) {
      return (
        <span className="text-[#B45309] font-medium">
          {dateString} ({expDays}d left)
        </span>
      );
    }
    return <span className="text-[#374151]">{dateString}</span>;
  };

  const handleOpenEditAllowedModal = (item: AllowedDomainItem) => {
    setOpenActionMenuId(null);
    setEditingAllowedDomain(item);
    setEditAllowedDomainInput(item.domain);
    setIsEditAllowedModalOpen(true);
  };

  const handleSaveEditAllowedDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAllowedDomainInput.trim() || !editingAllowedDomain) return;

    const updatedDomain = editAllowedDomainInput.trim();
    setAllowedDomains((prev) =>
      prev.map((d) =>
        d.id === editingAllowedDomain.id
          ? { ...d, domain: updatedDomain }
          : d
      )
    );
    showToast(`Domain [${updatedDomain}] updated successfully`);
    setIsEditAllowedModalOpen(false);
  };

  const handleOpenRemoveAllowedModal = (item: AllowedDomainItem) => {
    setOpenActionMenuId(null);
    setRemovingAllowedDomain(item);
    setRemoveAllowedConfirmInput('');
    setIsRemoveAllowedModalOpen(true);
  };

  const handleConfirmRemoveAllowedDomain = () => {
    if (!removingAllowedDomain) return;
    if (removeAllowedConfirmInput.trim().toLowerCase() !== removingAllowedDomain.domain.trim().toLowerCase()) {
      return;
    }
    const domainName = removingAllowedDomain.domain;
    setAllowedDomains((prev) => prev.filter((d) => d.id !== removingAllowedDomain.id));
    showToast(`Domain [${domainName}] removed successfully`);
    setIsRemoveAllowedModalOpen(false);
    setRemovingAllowedDomain(null);
    setRemoveAllowedConfirmInput('');
  };

  const handleOpenDisableAllowedModal = (item: AllowedDomainItem) => {
    setOpenActionMenuId(null);
    setDisablingAllowedDomain(item);
    setIsDisableAllowedModalOpen(true);
  };

  const handleConfirmDisableAllowedDomain = () => {
    if (!disablingAllowedDomain) return;
    const domainName = disablingAllowedDomain.domain;
    setAllowedDomains((prev) =>
      prev.map((d) => (d.id === disablingAllowedDomain.id ? { ...d, status: 'Disabled' } : d))
    );
    showToast(`Domain [${domainName}] disabled`);
    setIsDisableAllowedModalOpen(false);
    setDisablingAllowedDomain(null);
  };

  const handleOpenReactivateAllowedModal = (item: AllowedDomainItem) => {
    setOpenActionMenuId(null);
    setReactivatingAllowedDomain(item);
    setIsReactivateAllowedModalOpen(true);
  };

  const handleConfirmReactivateAllowedDomain = () => {
    if (!reactivatingAllowedDomain) return;
    const domainName = reactivatingAllowedDomain.domain;
    setAllowedDomains((prev) =>
      prev.map((d) => (d.id === reactivatingAllowedDomain.id ? { ...d, status: 'Verified' } : d))
    );
    showToast(`Domain [${domainName}] reactivated successfully`);
    setIsReactivateAllowedModalOpen(false);
    setReactivatingAllowedDomain(null);
  };

  const handleTriggerVerifyAllowedDomain = (item: AllowedDomainItem) => {
    setOpenActionMenuId(null);
    setNewAllowedDomainInput(item.domain);
    setAllowedGeneratedToken(`hexnode-domain-verification=hx-verify-${Math.random().toString(36).substring(2, 10)}`);
    setAllowedWizardStep(2);
    setAllowedVerifyMethod('dns');
    setAllowedVerifyStatus('idle');
    setAllowedVerifyError(null);
    setAllowedVerifyAttemptCount(0);
    setIsAllowedModalOpen(true);
  };

  const validateAllowedDomainInput = (rawInput: string): string | null => {
    const normalized = rawInput.trim().toLowerCase();

    // 1. Format & Syntax Validation
    const FQDN_REGEX = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/;
    if (
      !normalized ||
      !FQDN_REGEX.test(normalized) ||
      normalized.includes('/') ||
      normalized.includes(':') ||
      normalized.includes('*') ||
      normalized.startsWith('.') ||
      normalized.endsWith('.')
    ) {
      return 'Enter a valid domain name (e.g., company.com).';
    }

    // 2. Public Email Provider Blocklist
    const PUBLIC_EMAIL_DOMAINS = new Set([
      'gmail.com',
      'googlemail.com',
      'yahoo.com',
      'ymail.com',
      'outlook.com',
      'hotmail.com',
      'live.com',
      'msn.com',
      'icloud.com',
      'me.com',
      'mac.com',
      'proton.me',
      'protonmail.com',
      'aol.com',
      'aim.com',
      'mail.com',
      'zoho.com',
      'yandex.com',
      'gmx.com',
      'gmx.net',
      'fastmail.com',
      'tutanota.com',
      'tutamail.com',
    ]);
    const isPublic =
      PUBLIC_EMAIL_DOMAINS.has(normalized) ||
      Array.from(PUBLIC_EMAIL_DOMAINS).some(
        (pub) => normalized === pub || normalized.endsWith(`.${pub}`)
      );
    if (isPublic) {
      return 'Public domains are not allowed';
    }

    // 3. Duplicate Domain Check (regardless of status: Verified, Pending Verification, or Disabled)
    const isDuplicate = allowedDomains.some(
      (d) => d.domain.trim().toLowerCase() === normalized
    );
    if (isDuplicate) {
      return 'Domain already exists.';
    }

    return null;
  };

  const handleAllowedInputBlur = () => {
    if (newAllowedDomainInput.trim().length > 0) {
      const error = validateAllowedDomainInput(newAllowedDomainInput);
      setAllowedStep1Error(error);
    }
  };

  const handleOpenAddAllowedModal = () => {
    setAllowedWizardStep(1);
    setNewAllowedDomainInput('');
    setAllowedStep1Error(null);
    setAllowedGeneratedToken('');
    setAllowedVerifyMethod('dns');
    setAllowedVerifyStatus('idle');
    setAllowedVerifyError(null);
    setAllowedVerifyAttemptCount(0);
    setIsGeneratingToken(false);
    setIsAllowedModalOpen(true);
  };

  const handleCloseAllowedModal = () => {
    setIsAllowedModalOpen(false);
    setAllowedWizardStep(1);
    setNewAllowedDomainInput('');
    setAllowedStep1Error(null);
    setAllowedGeneratedToken('');
    setAllowedVerifyStatus('idle');
    setAllowedVerifyError(null);
    setAllowedVerifyAttemptCount(0);
    setIsGeneratingToken(false);
  };

  const handleAllowedStep1Next = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const error = validateAllowedDomainInput(newAllowedDomainInput);
    if (error) {
      setAllowedStep1Error(error);
      if (newAllowedDomainInputRef.current) {
        newAllowedDomainInputRef.current.focus();
      }
      return;
    }

    setAllowedStep1Error(null);
    setIsGeneratingToken(true);
    const normalized = newAllowedDomainInput.trim().toLowerCase();
    setNewAllowedDomainInput(normalized);

    // Simulate backend token generation API
    setTimeout(() => {
      const token = `hexnode-domain-verification=hx-verify-${Math.random().toString(36).substring(2, 10)}`;
      setAllowedGeneratedToken(token);
      setIsGeneratingToken(false);
      setAllowedWizardStep(2);
      setAllowedVerifyStatus('idle');
      setAllowedVerifyError(null);
      setAllowedVerifyAttemptCount(0);
    }, 400);
  };

  const handleAllowedVerifyAction = () => {
    setAllowedVerifyStatus('checking');
    setAllowedVerifyError(null);

    setTimeout(() => {
      if (allowedVerifyAttemptCount === 0) {
        // First check failure simulation
        setAllowedVerifyStatus('failed');
        setAllowedVerifyError('Verification record not found. Please wait for DNS propagation and try again.');
        setAllowedVerifyAttemptCount(1);
      } else {
        // Subsequent check succeeds
        setAllowedVerifyStatus('verified');
        setAllowedVerifyError(null);
        setAllowedVerifyAttemptCount(2);
        showToast(`Domain [${newAllowedDomainInput.trim()}] ownership verified successfully`);
      }
    }, 850);
  };

  const handleAllowedVerifyLater = () => {
    const domain = newAllowedDomainInput.trim();
    if (!domain) {
      handleCloseAllowedModal();
      return;
    }
    setAllowedDomains((prev) => {
      const existing = prev.find((d) => d.domain.toLowerCase() === domain.toLowerCase());
      if (existing) {
        return prev.map((d) => (d.domain.toLowerCase() === domain.toLowerCase() ? { ...d, status: 'Pending Verification' } : d));
      }
      return [
        ...prev,
        {
          id: `allowed-${Date.now()}`,
          domain,
          status: 'Pending Verification',
          source: 'Manual',
          signInVia: 'Hexnode',
          users: '0',
          isManual: true,
        },
      ];
    });
    showToast(`Domain [${domain}] saved as Pending verification`);
    handleCloseAllowedModal();
  };

  const handleAllowedFinish = () => {
    if (allowedVerifyStatus !== 'verified') return;
    const domain = newAllowedDomainInput.trim();
    if (!domain) {
      handleCloseAllowedModal();
      return;
    }
    setAllowedDomains((prev) => {
      const existing = prev.find((d) => d.domain.toLowerCase() === domain.toLowerCase());
      if (existing) {
        return prev.map((d) => (d.domain.toLowerCase() === domain.toLowerCase() ? { ...d, status: 'Verified' } : d));
      }
      return [
        ...prev,
        {
          id: `allowed-${Date.now()}`,
          domain,
          status: 'Verified',
          source: 'Manual',
          signInVia: 'Hexnode',
          users: '0',
          isManual: true,
        },
      ];
    });
    showToast(`Allowed domain [${domain}] verified and added successfully`);
    handleCloseAllowedModal();
  };

  const navItems = ['Directory', 'Applications', 'Security', 'Settings', 'Reports'];

  const sidebarItems = [
    { id: 'General', label: 'General', icon: SettingsIcon },
    { id: 'Domains', label: 'Domains', icon: Globe },
    { id: 'Technicians', label: 'Technicians', icon: TechniciansIcon },
    { id: 'Email Settings', label: 'Email Settings', icon: Mail },
    { id: 'SMS Settings', label: 'SMS Settings', icon: MessageSquare },
    { id: 'License', label: 'License', icon: LicenseIcon },
    { id: 'Integrations', label: 'Integrations', icon: IntegrationsIcon },
  ];

  const domainTabs: Array<'Custom domains' | 'Allowed domains'> = [
    'Custom domains',
    'Allowed domains',
  ];

  // Renamed Stepper Steps: Step 3 is now "Configure DNS routing"
  const customWizardSteps = [
    { num: 1, label: 'Hostname' },
    { num: 2, label: 'Verify ownership' },
    { num: 3, label: 'Configure DNS routing' },
    { num: 4, label: 'Certificate' },
    { num: 5, label: 'Review & Activate' },
  ];

  const currentZoneInfo = getDnsZoneInfo(loginHostnameInput);

  // Mathematical Gatekeeper Evaluations for Step 5 Review
  const isDefaultPrimary = !customDomains.some((d) => d.isPrimary);
  const currentPrimaryDomainObj = customDomains.find((d) => d.isPrimary);
  const currentPrimaryUrl = currentPrimaryDomainObj ? currentPrimaryDomainObj.domain : defaultHexnodeUrl;

  const isOwnershipVerified = dnsCheckStatus === 'verified' || httpCheckStatus === 'verified';
  const ownershipStatusText: 'Verified' | 'Pending' | 'Failed' = isOwnershipVerified
    ? 'Verified'
    : dnsCheckStatus === 'failed' || httpCheckStatus === 'failed'
    ? 'Failed'
    : 'Pending';

  const isRoutingVerified = cnameCheckStatus === 'verified';
  const routingStatusText: 'Verified' | 'Pending' | 'Failed' = isRoutingVerified
    ? 'Verified'
    : cnameCheckStatus === 'failed'
    ? 'Failed'
    : 'Pending';

  const isCertReady = certManagement === 'managed'
    ? isManagedCertApproved
    : certValidateStatus === 'valid';
  const certStatusText: 'Ready' | 'Provisioning' | 'Action required' = isCertReady
    ? 'Ready'
    : certValidateStatus === 'validating'
    ? 'Provisioning'
    : 'Action required';

  // Strict Gatekeeper Evaluation Logic
  const isActivationGatePassed = isOwnershipVerified && isRoutingVerified && isCertReady;

  // Full-Width Stepper Flow Renderer (No boxed/modal constraints)
  const renderCustomDomainWizard = () => {
    const isStep1Valid =
      !hostnameValidationError &&
      loginHostnameInput.trim() !== '' &&
      validateHostnameInput(loginHostnameInput, customDomains, editingCustomDomainId).isValid;

    return (
      <div className="w-full flex-1 px-6 sm:px-8 lg:px-12 py-6 flex flex-col">
        {/* Stepper Flow Breadcrumbs */}
        <div className="flex items-center space-x-2 text-[13px] text-[#6B7280] mb-3">
          <button
            type="button"
            onClick={handleAttemptCloseCustomWizard}
            className="hover:text-[#0F62FE] transition-colors cursor-pointer"
          >
            Domains
          </button>
          <span>/</span>
          <span className="text-[#111827] font-medium">Add custom domain</span>
        </div>

        {/* Full-Screen Immersive Header: Retain pinned selected hostname at top left from Step 2 onwards */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3.5">
            <h1 className="text-[22px] font-semibold text-[#111827] tracking-tight">
              Add custom domain
            </h1>
            {wizardStep >= 2 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-[6px] bg-[#EFF6FF] border border-[#BFDBFE] text-[#0F62FE] font-mono text-[14px] font-semibold">
                {loginHostnameInput || 'login.example.com'}
              </span>
            )}
          </div>

        </div>

        {/* Dedicated Stepper Card Container */}
        <div className="w-full bg-white rounded-[8px] border border-[#E5E7EB] p-6 lg:p-8 shadow-xs flex-1">
          {/* Stepper Header + Navigation Controls */}
        <div className="border-b border-[#E5E7EB] pb-5 mb-6 select-none flex items-center justify-between flex-wrap gap-4">
          {/* Left: 5-Step Stepper Indicators */}
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            {customWizardSteps.map((step, idx) => {
              const isActive = wizardStep === step.num;
              const isCompleted = wizardStep > step.num;

              return (
                <React.Fragment key={step.num}>
                  <div
                    className="flex items-center space-x-2 cursor-pointer"
                    onClick={() => {
                      if (step.num === 1) {
                        setWizardStep(1);
                      } else if (step.num === 2 && isStep1Valid) {
                        setWizardStep(2);
                      } else if (step.num <= wizardStep && !isHostnameInvalidated) {
                        setWizardStep(step.num as 1 | 2 | 3 | 4 | 5);
                      }
                    }}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[12px] transition-colors ${
                        isActive || isCompleted
                          ? 'bg-[#0F62FE] text-white font-semibold'
                          : 'border border-[#D1D5DB] text-[#9CA3AF] font-normal'
                      }`}
                    >
                      {step.num}
                    </span>
                    <span
                      className={`text-[14px] transition-colors ${
                        isActive
                          ? 'text-[#0F62FE] font-medium'
                          : isCompleted
                          ? 'text-[#111827] font-medium'
                          : 'text-[#6B7280] font-normal'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  {idx < customWizardSteps.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Right: Stepper Controls */}
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={handleSaveAndExitWizard}
              disabled={!isStep1Valid}
              className="h-[34px] px-3.5 border border-[#D1D5DB] bg-white text-[#111827] hover:bg-gray-50 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save your domain configuration progress as draft"
            >
              Save and exit
            </button>

            <button
              type="button"
              onClick={handleAttemptCloseCustomWizard}
              className="h-[34px] px-3.5 border border-[#D1D5DB] rounded-[6px] text-[13px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {wizardStep > 1 && (
              <button
                type="button"
                onClick={() => setWizardStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5)}
                className="h-[34px] px-3.5 border border-[#D1D5DB] rounded-[6px] text-[13px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Previous
              </button>
            )}

            {wizardStep < 5 ? (
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    if (wizardStep === 1) {
                      const valRes = validateHostnameInput(loginHostnameInput, customDomains, editingCustomDomainId);
                      if (!valRes.isValid) {
                        setHostnameValidationError(valRes.error);
                        return;
                      }
                      setLoginHostnameInput(valRes.sanitized);
                    }
                    setWizardStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5);
                  }}
                  disabled={
                    (wizardStep === 1 && !isStep1Valid) ||
                    (wizardStep === 2 && !isOwnershipVerified) ||
                    (wizardStep === 3 && cnameCheckStatus !== 'verified') ||
                    (wizardStep === 4 && !isCertReady)
                  }
                  className="h-[34px] px-4 bg-[#0F62FE] hover:bg-[#0050E6] text-white text-[13px] font-medium rounded-[6px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                {wizardStep === 4 && !isCertReady && (
                  <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block w-72 p-2.5 bg-[#1F2937] text-white text-[12px] rounded-[6px] shadow-lg z-50 pointer-events-none leading-relaxed">
                    Next is locked: Complete certificate requirements before proceeding.
                  </div>
                )}
              </div>
            ) : (
              <div className="relative group">
                <button
                  type="button"
                  onClick={handleActivateCustomDomainStep5}
                  disabled={!isActivationGatePassed}
                  className="h-[34px] px-5 bg-[#0F62FE] hover:bg-[#0050E6] text-white text-[13px] font-medium rounded-[6px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Activate
                </button>
                {!isActivationGatePassed && (
                  <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block w-72 p-2.5 bg-[#1F2937] text-white text-[12px] rounded-[6px] shadow-lg z-50 pointer-events-none leading-relaxed">
                    Activation disabled: Requirements in Steps 2, 3, or 4 remain unverified.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* STEP 1: HOSTNAME (Full Width Layout) */}
        {wizardStep === 1 && (() => {
          const isEditingActiveDomain = editingCustomDomainId
            ? customDomains.find((d) => d.id === editingCustomDomainId)?.status === 'Active'
            : false;

          return (
            <div className="w-full space-y-6">
              <div className="max-w-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[14px] font-medium text-[#111827]">
                    Login hostname <span className="text-[#DC2626] font-bold">*</span>
                  </label>
                  {isEditingActiveDomain && (
                    <span className="inline-flex items-center text-[11px] font-medium text-[#4B5563] bg-[#E5E7EB] px-2 py-0.5 rounded-full">
                      <Lock className="w-3 h-3 mr-1 text-[#4B5563]" />
                      Permanently Locked
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    disabled={isEditingActiveDomain}
                    value={loginHostnameInput}
                    onChange={(e) => handleSingleHostnameInputChange(e.target.value)}
                    placeholder="e.g., login.example.com or login.eu.example.com"
                    className={`w-full h-[38px] px-3 bg-white border rounded-[6px] text-[14px] text-[#111827] focus:outline-none ${
                      isEditingActiveDomain
                        ? 'bg-[#F3F4F6] text-[#4B5563] cursor-not-allowed border-[#D1D5DB]'
                        : hostnameValidationError
                        ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                        : 'border-[#D1D5DB] focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE]'
                    }`}
                  />
                  {isEditingActiveDomain && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]">
                      <Lock className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Inline Helper Text for active domain immutability */}
                {isEditingActiveDomain && (
                  <p className="mt-1.5 text-[12px] text-[#6B7280]">
                    The hostname cannot be modified.
                  </p>
                )}

                {/* Persistent Inline Red Error */}
                {!isEditingActiveDomain && hostnameValidationError && (
                  <p className="mt-1.5 text-[12px] text-[#DC2626] font-medium flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#DC2626]" />
                    <span>{hostnameValidationError}</span>
                  </p>
                )}

                {/* Hostname Invalidation Info Text */}
                {!isEditingActiveDomain && isHostnameInvalidated && (
                  <div className="mt-2.5 p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[6px] text-[13px] flex items-center space-x-2 text-[#1E40AF]">
                    <AlertCircle className="w-4 h-4 text-[#0F62FE] shrink-0" />
                    <span>Hostname modified. Re-verification is required in subsequent steps.</span>
                  </div>
                )}
              </div>

            <div className="pt-4 border-t border-[#E5E7EB]">
              <label className="block text-[14px] font-medium text-[#111827] mb-3">
                Certificate management
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label
                  onClick={() => handleToggleCertManagement('managed')}
                  className={`flex items-start space-x-3 p-4 rounded-[8px] border transition-colors cursor-pointer ${
                    certManagement === 'managed'
                      ? 'border-[#0F62FE] bg-[#EFF6FF]'
                      : 'border-[#E5E7EB] bg-white hover:border-gray-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 transition-colors shrink-0 ${
                      certManagement === 'managed' ? 'border-[#0F62FE]' : 'border-[#9CA3AF]'
                    }`}
                  >
                    {certManagement === 'managed' && (
                      <div className="w-2 h-2 rounded-full bg-[#0F62FE]" />
                    )}
                  </div>
                  <div>
                    <span className="text-[14px] font-medium text-[#111827] block">
                      Managed by Hexnode
                    </span>
                    <span className="text-[12px] text-[#6B7280] leading-relaxed block mt-0.5">
                      Hexnode will automatically provision and renew the SSL certificates prior to expiration with zero downtime.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => handleToggleCertManagement('upload')}
                  className={`flex items-start space-x-3 p-4 rounded-[8px] border transition-colors cursor-pointer ${
                    certManagement === 'upload'
                      ? 'border-[#0F62FE] bg-[#EFF6FF]'
                      : 'border-[#E5E7EB] bg-white hover:border-gray-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 transition-colors shrink-0 ${
                      certManagement === 'upload' ? 'border-[#0F62FE]' : 'border-[#9CA3AF]'
                    }`}
                  >
                    {certManagement === 'upload' && (
                      <div className="w-2 h-2 rounded-full bg-[#0F62FE]" />
                    )}
                  </div>
                  <div>
                    <span className="text-[14px] font-medium text-[#111827] block">
                      Upload my own (Self-managed)
                    </span>
                    <span className="text-[12px] text-[#6B7280] leading-relaxed block mt-0.5">
                      You are responsible for monitoring expiration and uploading updated PEM certificates and private keys before expiration to avoid SSO downtime.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        );
      })()}

        {/* STEP 2: VERIFY OWNERSHIP (Full Width Layout with Exact Verification Copy) */}
        {wizardStep === 2 && (
          <div className="w-full space-y-6">
            {/* Exact Required Verification Copy */}
            <div className="p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px]">
              <p className="text-[14px] text-[#374151] leading-relaxed">
                Verify ownership of <span className="font-semibold text-[#111827] font-mono">{loginHostnameInput || 'your domain'}</span> by adding a DNS TXT record to your domain provider, or by hosting an HTTPS verification file on your web server. You only need to complete one of these methods.
              </p>
            </div>

            {/* Persistent inline error from mock verification failure */}
            {ownershipVerificationError && (
              <div className="p-3.5 bg-[#FEE2E2] border border-[#FCA5A5] rounded-[6px] text-[#991B1B] text-[13px] flex items-start space-x-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                <span className="font-medium">{ownershipVerificationError}</span>
              </div>
            )}

            {activeErrorState && (
              <div className="p-4 bg-[#FEE2E2] border border-[#FCA5A5] rounded-[8px] text-[#991B1B] animate-in fade-in duration-200">
                <div className="flex items-start space-x-3">
                  <ShieldAlert className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-[14px] font-semibold text-[#991B1B]">
                      {activeErrorState.title}
                    </h4>
                    <p className="text-[13px] leading-relaxed text-[#7F1D1D]">
                      {activeErrorState.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Method A: DNS TXT Record */}
              <div
                onClick={() => {
                  setSelectedVerifyMethod('dns');
                  setVerifyMethod('dns');
                }}
                className={`rounded-[8px] p-5.5 bg-white transition-all cursor-pointer ${
                  selectedVerifyMethod === 'dns'
                    ? 'border-2 border-[#0F62FE] shadow-xs'
                    : 'border border-[#E5E7EB] hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2.5 select-none">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        selectedVerifyMethod === 'dns' ? 'border-[#0F62FE]' : 'border-[#9CA3AF]'
                      }`}
                    >
                      {selectedVerifyMethod === 'dns' && <div className="w-2 h-2 rounded-full bg-[#0F62FE]" />}
                    </div>
                    <span className="text-[15px] font-semibold text-[#111827]">
                      DNS TXT Record
                    </span>
                  </div>
                </div>

                <p className="text-[13px] text-[#6B7280] mb-5 leading-relaxed">
                  Add the following TXT record to your DNS configuration settings at <span className="font-medium text-[#111827]">{currentZoneInfo.dnsZoneLocation}</span>.
                </p>

                <div className="space-y-3 bg-[#F9FAFB] p-3.5 rounded-[6px] border border-[#E5E7EB] text-[13px]">
                  <div>
                    <span className="text-[#6B7280] block text-[12px] mb-0.5 font-medium">
                      Host / Name
                    </span>
                    <div className="flex items-center justify-between font-mono bg-white px-2.5 py-1.5 rounded border border-[#D1D5DB] text-[#111827]">
                      <span>@</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard('@', 'Host name');
                        }}
                        className="text-[#0F62FE] hover:text-[#0050E6] p-1 cursor-pointer"
                        title="Copy Host"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[#6B7280] block text-[12px] mb-0.5 font-medium">
                      TXT Value
                    </span>
                    <div className="flex items-center justify-between font-mono bg-white px-2.5 py-1.5 rounded border border-[#D1D5DB] text-[#111827] break-all">
                      <span className="text-[12px]">hexnode-domain-verification=hx-verify-88a91c0f</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard('hexnode-domain-verification=hx-verify-88a91c0f', 'TXT Value');
                        }}
                        className="text-[#0F62FE] hover:text-[#0050E6] p-1 shrink-0 ml-2 cursor-pointer"
                        title="Copy Value"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCheckDnsRecord();
                    }}
                    disabled={selectedVerifyMethod !== 'dns' || dnsCheckStatus === 'checking' || dnsCheckStatus === 'verified'}
                    className="h-[36px] px-4 bg-[#0F62FE] hover:bg-[#0050E6] text-white text-[13px] font-medium rounded-[6px] transition-colors flex items-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {dnsCheckStatus === 'checking' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {dnsCheckStatus === 'verified' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    <span>
                      {dnsCheckStatus === 'idle' && 'Verify'}
                      {dnsCheckStatus === 'checking' && 'Checking TXT...'}
                      {dnsCheckStatus === 'verified' && 'Verified'}
                      {dnsCheckStatus === 'failed' && 'Verify'}
                    </span>
                  </button>

                  {dnsCheckStatus === 'verified' && (
                    <span className="text-[12px] font-medium text-[#15803D] bg-[#DCFCE7] px-2.5 py-1 rounded-full">
                      ✓ Ownership Verified
                    </span>
                  )}
                  {dnsCheckStatus === 'failed' && (
                    <span className="text-[12px] font-medium text-[#DC2626]">
                      Record not found
                    </span>
                  )}
                </div>
              </div>

              {/* Method B: HTTPS verification file (Renamed) */}
              <div
                onClick={() => {
                  setSelectedVerifyMethod('http');
                  setVerifyMethod('http');
                }}
                className={`rounded-[8px] p-5.5 bg-white transition-all cursor-pointer ${
                  selectedVerifyMethod === 'http'
                    ? 'border-2 border-[#0F62FE] shadow-xs'
                    : 'border border-[#E5E7EB] hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2.5 select-none">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        selectedVerifyMethod === 'http' ? 'border-[#0F62FE]' : 'border-[#9CA3AF]'
                      }`}
                    >
                      {selectedVerifyMethod === 'http' && <div className="w-2 h-2 rounded-full bg-[#0F62FE]" />}
                    </div>
                    <span className="text-[15px] font-semibold text-[#111827]">
                      HTTPS verification file
                    </span>
                  </div>
                </div>

                <p className="text-[13px] text-[#6B7280] mb-5 leading-relaxed">
                  Host the following challenge token file on your web server at the specified HTTPS directory path.
                </p>

                <div className="space-y-3 bg-[#F9FAFB] p-3.5 rounded-[6px] border border-[#E5E7EB] text-[13px]">
                  <div>
                    <span className="text-[#6B7280] block text-[12px] mb-0.5 font-medium">
                      File Path Location
                    </span>
                    <div className="font-mono bg-white px-2.5 py-1.5 rounded border border-[#D1D5DB] text-[#111827] text-[12px] break-all">
                      https://{loginHostnameInput || 'login.example.com'}/.well-known/hexnode-challenge.txt
                    </div>
                  </div>

                  <div>
                    <span className="text-[#6B7280] block text-[12px] mb-0.5 font-medium">
                      File Content
                    </span>
                    <div className="flex items-center justify-between font-mono bg-white px-2.5 py-1.5 rounded border border-[#D1D5DB] text-[#111827]">
                      <span className="text-[12px]">hexnode-verification-token-99812</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard('hexnode-verification-token-99812', 'File Content');
                        }}
                        className="text-[#0F62FE] hover:text-[#0050E6] p-1 cursor-pointer"
                        title="Copy Content"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCheckHttpFile();
                    }}
                    disabled={selectedVerifyMethod !== 'http' || httpCheckStatus === 'checking' || httpCheckStatus === 'verified'}
                    className="h-[36px] px-4 bg-[#0F62FE] hover:bg-[#0050E6] text-white text-[13px] font-medium rounded-[6px] transition-colors flex items-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {httpCheckStatus === 'checking' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {httpCheckStatus === 'verified' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    <span>
                      {httpCheckStatus === 'idle' && 'Verify'}
                      {httpCheckStatus === 'checking' && 'Checking File...'}
                      {httpCheckStatus === 'verified' && 'Verified'}
                      {httpCheckStatus === 'failed' && 'Verify'}
                    </span>
                  </button>

                  {httpCheckStatus === 'verified' && (
                    <span className="text-[12px] font-medium text-[#15803D] bg-[#DCFCE7] px-2.5 py-1 rounded-full">
                      ✓ Ownership Verified
                    </span>
                  )}
                  {httpCheckStatus === 'failed' && (
                    <span className="text-[12px] font-medium text-[#DC2626]">
                      Record not found
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: CONFIGURE DNS ROUTING (Renamed & Enhanced Clarity with DNS Zone, Host Value, Full Record Name) */}
        {wizardStep === 3 && (
          <div className="w-full space-y-6">
            <div>
              <h3 className="text-[16px] font-medium text-[#111827] mb-2">
                Configure DNS routing (CNAME Setup)
              </h3>
              <p className="text-[13px] text-[#6B7280] leading-relaxed">
                Add the required CNAME routing record at your DNS provider zone (<span className="font-semibold text-[#111827]">{currentZoneInfo.dnsZoneLocation}</span>) to route traffic from your custom hostname to Hexnode IdP edge routers.
              </p>
            </div>

            {/* Explicit DNS Instruction Table */}
            <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-[8px] p-5 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse bg-white rounded-[6px] border border-[#E5E7EB] text-[13px]">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#4B5563] font-medium">
                      <th className="px-3.5 py-2.5">Record type</th>
                      <th className="px-3.5 py-2.5">DNS zone</th>
                      <th className="px-3.5 py-2.5">Host value</th>
                      <th className="px-3.5 py-2.5">Full record name</th>
                      <th className="px-3.5 py-2.5">Canonical target / Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#E5E7EB]">
                      <td className="px-3.5 py-3 font-semibold text-[#111827]">CNAME</td>
                      <td className="px-3.5 py-3 font-mono text-[#374151]">{currentZoneInfo.rootZone}</td>
                      <td className="px-3.5 py-3 font-mono font-medium text-[#111827]">
                        <div className="flex items-center space-x-1.5">
                          <span>{currentZoneInfo.hostValue}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(currentZoneInfo.hostValue, 'Host value')}
                            className="text-[#0F62FE] hover:text-[#0050E6] p-0.5 cursor-pointer"
                            title="Copy Host value"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 font-mono text-[#111827]">
                        <div className="flex items-center space-x-1.5">
                          <span>{currentZoneInfo.fullRecordName}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(currentZoneInfo.fullRecordName, 'Full record name')}
                            className="text-[#0F62FE] hover:text-[#0050E6] p-0.5 cursor-pointer"
                            title="Copy Full record name"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 font-mono text-[#111827]">
                        <div className="flex items-center space-x-1.5">
                          <span>custom.idp.hexnode.com</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('custom.idp.hexnode.com', 'Target CNAME')}
                            className="text-[#0F62FE] hover:text-[#0050E6] p-0.5 cursor-pointer"
                            title="Copy Target CNAME"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {certManagement === 'managed' && (
                <div className="pt-3 border-t border-[#E5E7EB] space-y-2">
                  <div className="text-[12px] font-semibold text-[#111827] flex items-center space-x-1.5">
                    <Server className="w-3.5 h-3.5 text-[#0F62FE]" />
                    <span>Dynamic SSL Validation Record Required for Hexnode Managed Certificate:</span>
                  </div>
                  <div className="bg-white p-3 rounded border border-[#D1D5DB] flex items-center justify-between font-mono text-[12px] text-[#111827] flex-wrap gap-2">
                    <span>_acme-challenge.{loginHostnameInput} CNAME cert-verify.acme.hexnode.com</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`_acme-challenge.${loginHostnameInput} CNAME cert-verify.acme.hexnode.com`, 'ACME CNAME Record')}
                      className="text-[#0F62FE] hover:text-[#0050E6] p-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Persistent inline error for Step 3 */}
            {cnameRoutingError && (
              <div className="p-3.5 bg-[#FEE2E2] border border-[#FCA5A5] rounded-[6px] text-[13px] text-[#991B1B] flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                <span>{cnameRoutingError}</span>
              </div>
            )}

            {/* Persistent inline success for Step 3 */}
            {cnameCheckStatus === 'verified' && (
              <div className="p-3.5 bg-[#DCFCE7] border border-[#86EFAC] rounded-[6px] text-[13px] text-[#15803D] flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                <span>Routing check verified successfully. CNAME points to {defaultHexnodeUrl}.</span>
              </div>
            )}

            <div className="pt-2 flex items-center space-x-3">
              <button
                type="button"
                onClick={handleCheckCname}
                disabled={cnameCheckStatus === 'checking'}
                className="h-[36px] px-4 bg-[#0F62FE] hover:bg-[#0050E6] text-white text-[13px] font-medium rounded-[6px] transition-colors flex items-center space-x-2 cursor-pointer disabled:opacity-75"
              >
                {cnameCheckStatus === 'checking' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {cnameCheckStatus === 'verified' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                <span>
                  {cnameCheckStatus === 'idle' && 'Check DNS routing'}
                  {cnameCheckStatus === 'checking' && 'Checking DNS routing...'}
                  {cnameCheckStatus === 'verified' && 'DNS routing verified'}
                  {cnameCheckStatus === 'failed' && 'Check DNS routing'}
                </span>
              </button>

              {cnameCheckStatus === 'verified' && (
                <span className="text-[12px] font-medium text-[#15803D] bg-[#DCFCE7] px-2.5 py-1 rounded-full">
                  ✓ Routing Active
                </span>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: CERTIFICATE */}
        {wizardStep === 4 && (
          <div className="w-full space-y-6">
            <div>
              <h3 className="text-[16px] font-semibold text-[#111827]">
                SSL / TLS Certificate Configuration
              </h3>
              <p className="text-[13px] text-[#6B7280] mt-1">
                {certManagement === 'managed'
                  ? `Hexnode automatically provisions and renews SSL/TLS certificates for ${loginHostnameInput}.`
                  : `Upload or provide your PEM certificate chain and private key for ${loginHostnameInput}.`}
              </p>
            </div>

            {certManagement === 'managed' ? (
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#0F62FE]">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-semibold text-[#111827]">
                      Hexnode Automated Managed Certificate
                    </h4>
                    <p className="text-[13px] text-[#6B7280]">
                      Automated SSL certificate provisioning (90-day auto-renewal cycle)
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white border border-[#E5E7EB] rounded-[6px] space-y-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[#6B7280]">Readiness Status:</span>
                    {isCertReady ? (
                      <span className="font-semibold text-[#15803D] bg-[#DCFCE7] px-2.5 py-0.5 rounded-full text-[12px]">
                        ✓ Provisioning &amp; Auto-renewal Ready
                      </span>
                    ) : (
                      <span className="font-semibold text-[#B45309] bg-[#FEF3C7] px-2.5 py-0.5 rounded-full text-[12px]">
                        Action Required: Authorization Pending
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#4B5563] leading-relaxed">
                    Once DNS routing is verified, Hexnode edge services automatically complete ACME challenge verification and bind a TLS certificate to your domain with zero manual uploads required.
                  </p>
                  {!isCertReady && (
                    <div className="pt-2 flex items-center justify-between border-t border-[#E5E7EB] flex-wrap gap-2">
                      <span className="text-[12px] text-[#6B7280]">
                        Authorize Hexnode to manage SSL certificate issuance for {loginHostnameInput}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsManagedCertApproved(true);
                          showToast('Hexnode managed certificate authorized');
                        }}
                        className="px-4 py-1.5 bg-[#0F62FE] hover:bg-[#0050E6] text-white text-[13px] font-medium rounded-[6px] transition-colors cursor-pointer"
                      >
                        Authorize automated certificate
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Radio Button Toggle Group: Upload PEM files vs Paste plain text */}
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3 select-none flex-wrap gap-2">
                  <div className="flex items-center space-x-8">
                    <label
                      onClick={() => {
                        setCertInputMethod('upload');
                        setPemValidationError(null);
                      }}
                      className="inline-flex items-center space-x-2.5 cursor-pointer group"
                    >
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                          certInputMethod === 'upload' ? 'border-[#0F62FE]' : 'border-[#9CA3AF] group-hover:border-gray-400'
                        }`}
                      >
                        {certInputMethod === 'upload' && (
                          <div className="w-2 h-2 rounded-full bg-[#0F62FE]" />
                        )}
                      </div>
                      <span className="text-[14px] font-medium text-[#111827]">
                        Upload PEM files
                      </span>
                    </label>

                    <label
                      onClick={() => {
                        setCertInputMethod('text');
                        setPemValidationError(null);
                      }}
                      className="inline-flex items-center space-x-2.5 cursor-pointer group"
                    >
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                          certInputMethod === 'text' ? 'border-[#0F62FE]' : 'border-[#9CA3AF] group-hover:border-gray-400'
                        }`}
                      >
                        {certInputMethod === 'text' && (
                          <div className="w-2 h-2 rounded-full bg-[#0F62FE]" />
                        )}
                      </div>
                      <span className="text-[14px] font-medium text-[#111827]">
                        Paste plain text
                      </span>
                    </label>
                  </div>

                  {certInputMethod === 'upload' ? (
                    <button
                      type="button"
                      onClick={handleLoadSampleFiles}
                      className="text-[12px] text-[#0F62FE] hover:underline cursor-pointer font-medium"
                    >
                      Use sample PEM files
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPemCertText(SAMPLE_PEM_CERT);
                        setPemKeyText(SAMPLE_PEM_KEY);
                        setPemValidationError(null);
                        setCertValidateStatus('valid');
                        showToast('Sample PEM certificate and private key inserted');
                      }}
                      className="text-[12px] text-[#0F62FE] hover:underline cursor-pointer font-medium"
                    >
                      Insert sample PEM text
                    </button>
                  )}
                </div>

                {/* Persistent Inline Red Error */}
                {pemValidationError && (
                  <div className="p-3.5 bg-[#FEE2E2] border border-[#FCA5A5] rounded-[6px] text-[13px] text-[#991B1B] flex items-start space-x-2.5 animate-in fade-in duration-150">
                    <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                    <span className="font-medium leading-relaxed">{pemValidationError}</span>
                  </div>
                )}

                {/* Conditional Rendering: Upload PEM Dropzones */}
                {certInputMethod === 'upload' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Certificate Dropzone */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[13px] font-medium text-[#111827]">
                          Certificate chain (.pem / .crt) <span className="text-[#DC2626]">*</span>
                        </label>
                        {pemCertFileName && (
                          <span className="text-[11px] font-medium text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-full">
                            Ready
                          </span>
                        )}
                      </div>

                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingCert(true);
                        }}
                        onDragLeave={() => setIsDraggingCert(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingCert(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleProcessCertFile(file);
                        }}
                        className={`relative border-2 border-dashed rounded-[8px] p-6 text-center transition-colors flex flex-col items-center justify-center min-h-[175px] ${
                          isDraggingCert
                            ? 'border-[#0F62FE] bg-[#EFF6FF]'
                            : pemCertFileName
                            ? 'border-[#86EFAC] bg-[#F0FDF4]'
                            : 'border-[#D1D5DB] bg-[#FAFAFA] hover:bg-gray-50 hover:border-gray-400'
                        }`}
                      >
                        <input
                          type="file"
                          id="cert-file-input"
                          accept=".pem,.crt,.cer"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleProcessCertFile(file);
                          }}
                        />

                        {pemCertFileName ? (
                          <div className="space-y-2 w-full">
                            <div className="w-10 h-10 mx-auto rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div className="text-[13px] font-medium text-[#111827] truncate px-2 font-mono">
                              {pemCertFileName}
                            </div>
                            <div className="text-[11px] text-[#6B7280]">
                              {pemCertFileSize || 'File loaded'}
                            </div>
                            <div className="pt-1 flex items-center justify-center space-x-3">
                              <label
                                htmlFor="cert-file-input"
                                className="text-[12px] text-[#0F62FE] hover:underline font-medium cursor-pointer"
                              >
                                Replace file
                              </label>
                              <span className="text-gray-300">|</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setPemCertFileName(null);
                                  setPemCertFileText('');
                                  setPemCertFileSize(null);
                                  setCertValidateStatus('idle');
                                  setPemValidationError(null);
                                }}
                                className="text-[12px] text-[#DC2626] hover:underline font-medium cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label
                            htmlFor="cert-file-input"
                            className="cursor-pointer space-y-2 flex flex-col items-center justify-center w-full h-full"
                          >
                            <div className="w-10 h-10 rounded-full bg-[#EFF6FF] text-[#0F62FE] flex items-center justify-center">
                              <Upload className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="text-[13px] font-semibold text-[#0F62FE] hover:underline">
                                Click to upload
                              </span>
                              <span className="text-[13px] text-[#6B7280]"> or drag and drop</span>
                            </div>
                            <span className="text-[11px] text-[#9CA3AF]">
                              Supported: .pem, .crt, .cer with exact PEM boundary markers
                            </span>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Private Key Dropzone */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[13px] font-medium text-[#111827]">
                          Private key (.key / .pem) <span className="text-[#DC2626]">*</span>
                        </label>
                        {pemKeyFileName && (
                          <span className="text-[11px] font-medium text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-full">
                            Ready
                          </span>
                        )}
                      </div>

                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingKey(true);
                        }}
                        onDragLeave={() => setIsDraggingKey(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingKey(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleProcessKeyFile(file);
                        }}
                        className={`relative border-2 border-dashed rounded-[8px] p-6 text-center transition-colors flex flex-col items-center justify-center min-h-[175px] ${
                          isDraggingKey
                            ? 'border-[#0F62FE] bg-[#EFF6FF]'
                            : pemKeyFileName
                            ? 'border-[#86EFAC] bg-[#F0FDF4]'
                            : 'border-[#D1D5DB] bg-[#FAFAFA] hover:bg-gray-50 hover:border-gray-400'
                        }`}
                      >
                        <input
                          type="file"
                          id="key-file-input"
                          accept=".key,.pem"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleProcessKeyFile(file);
                          }}
                        />

                        {pemKeyFileName ? (
                          <div className="space-y-2 w-full">
                            <div className="w-10 h-10 mx-auto rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div className="text-[13px] font-medium text-[#111827] truncate px-2 font-mono">
                              {pemKeyFileName}
                            </div>
                            <div className="text-[11px] text-[#6B7280]">
                              {pemKeyFileSize || 'File loaded'}
                            </div>
                            <div className="pt-1 flex items-center justify-center space-x-3">
                              <label
                                htmlFor="key-file-input"
                                className="text-[12px] text-[#0F62FE] hover:underline font-medium cursor-pointer"
                              >
                                Replace file
                              </label>
                              <span className="text-gray-300">|</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setPemKeyFileName(null);
                                  setPemKeyFileText('');
                                  setPemKeyFileSize(null);
                                  setCertValidateStatus('idle');
                                  setPemValidationError(null);
                                }}
                                className="text-[12px] text-[#DC2626] hover:underline font-medium cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label
                            htmlFor="key-file-input"
                            className="cursor-pointer space-y-2 flex flex-col items-center justify-center w-full h-full"
                          >
                            <div className="w-10 h-10 rounded-full bg-[#EFF6FF] text-[#0F62FE] flex items-center justify-center">
                              <Lock className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="text-[13px] font-semibold text-[#0F62FE] hover:underline">
                                Click to upload
                              </span>
                              <span className="text-[13px] text-[#6B7280]"> or drag and drop</span>
                            </div>
                            <span className="text-[11px] text-[#9CA3AF]">
                              Supported: .key, .pem with exact PEM boundary markers
                            </span>
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Conditional Rendering: Plain Text Textareas */
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[13px] font-medium text-[#111827]">
                          Certificate chain text (.pem) <span className="text-[#DC2626]">*</span>
                        </label>
                        <span className="text-[11px] text-[#6B7280]">
                          Must include exact boundary: -----BEGIN CERTIFICATE-----
                        </span>
                      </div>
                      <textarea
                        rows={5}
                        value={pemCertText}
                        onChange={(e) => {
                          setPemCertText(e.target.value);
                          setPemValidationError(null);
                        }}
                        placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDXTCCAkWgAwIBAgIJAJ8e4/kL7r4DMA0GCSqGSIb3DQEBCwUAMEUxCzAJ...&#10;-----END CERTIFICATE-----"
                        className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[13px] font-mono text-[#111827] focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[13px] font-medium text-[#111827]">
                          Private key text (.key / .pem) <span className="text-[#DC2626]">*</span>
                        </label>
                        <span className="text-[11px] text-[#6B7280]">
                          Must include exact boundary: -----BEGIN PRIVATE KEY-----
                        </span>
                      </div>
                      <textarea
                        rows={5}
                        value={pemKeyText}
                        onChange={(e) => {
                          setPemKeyText(e.target.value);
                          setPemValidationError(null);
                        }}
                        placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDK/hDdaP2d...&#10;-----END PRIVATE KEY-----"
                        className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[13px] font-mono text-[#111827] focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE]"
                      />
                    </div>
                  </div>
                )}

                {/* Validation Action Button & Status Badges */}
                <div className="pt-2 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handleValidateCertificateStep4}
                    disabled={certValidateStatus === 'validating'}
                    className="h-[36px] px-4 bg-white border border-[#D1D5DB] hover:bg-gray-50 text-[#111827] text-[13px] font-medium rounded-[6px] transition-colors flex items-center space-x-2 cursor-pointer disabled:opacity-75"
                  >
                    {certValidateStatus === 'validating' && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0F62FE]" />
                    )}
                    {certValidateStatus === 'valid' && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                    )}
                    <span>
                      {certValidateStatus === 'idle' && 'Validate certificate'}
                      {certValidateStatus === 'validating' && 'Validating PEM format...'}
                      {certValidateStatus === 'valid' && 'Certificate Valid'}
                      {certValidateStatus === 'invalid' && 'Re-validate certificate'}
                    </span>
                  </button>

                  {certValidateStatus === 'valid' && (
                    <span className="text-[12px] font-medium text-[#15803D] bg-[#DCFCE7] px-2.5 py-1 rounded-full flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5 text-[#15803D]" />
                      <span>Valid PEM certificate and private key</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: REVIEW AND ACTIVATE (Full Width with Explicit Disabled Explanations & Jump Links) */}
        {wizardStep === 5 && (
          <div className="w-full space-y-6">
            {/* Read-Only Final Review Summary Board */}
            <div className="bg-[#FAFAFA] border border-[#E5E7EB] rounded-[8px] p-5 space-y-4">
              <h4 className="text-[16px] font-semibold text-[#111827] pb-2 border-b border-[#E5E7EB] flex items-center justify-between">
                <span>Final Custom Domain Review Summary</span>
                <span className="text-[12px] font-normal text-[#6B7280]">Read-only Assessment</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-[13px]">
                <div className="space-y-1">
                  <span className="text-[#6B7280] block text-[12px]">Selected Hostname</span>
                  <span className="font-semibold text-[#111827] text-[14px] font-mono">{loginHostnameInput}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[#6B7280] block text-[12px]">Certificate Management Mode</span>
                  <span className="font-semibold text-[#111827]">
                    {certManagement === 'managed' ? 'Managed by Hexnode' : 'Upload my own (Self-managed)'}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[#6B7280] block text-[12px]">Domain Ownership Status</span>
                  <div>
                    {isOwnershipVerified ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#FEF3C7] text-[#B45309]">
                        {ownershipStatusText}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[#6B7280] block text-[12px]">Traffic Routing Status</span>
                  <div>
                    {isRoutingVerified ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#FEF3C7] text-[#B45309]">
                        {routingStatusText}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[#6B7280] block text-[12px]">Certificate Readiness</span>
                  <div>
                    {isCertReady ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                        Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#FEE2E2] text-[#B91C1C]">
                        {certStatusText}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[#6B7280] block text-[12px]">Current Primary Login URL</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-[#111827]">{currentPrimaryUrl}</span>
                    {currentPrimaryDomainObj?.status === 'Action required' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEE2E2] text-[#B91C1C]">
                        Primary — unavailable
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Impact Warning Board */}
            <div className="p-4.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[8px] text-[13px] space-y-2.5">
              <h5 className="font-semibold text-[#1D4ED8] flex items-center gap-2 text-[14px]">
                <Info className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                Activation impact
              </h5>
              <ul className="list-disc pl-5 space-y-2 text-[#1E40AF] leading-relaxed">
                <li>
                  <strong className="font-semibold text-[#1E3A8A]">Manual Updates Required:</strong> Your existing SAML/OIDC Service Providers (SPs) and SSO applications will not change automatically. To route users through this domain, you must manually update your application endpoints.
                </li>
                <li>
                  <strong className="font-semibold text-[#1E3A8A]">Passkey Authentication:</strong> Passkeys are cryptographically bound to their original domain. Users will need to register new passkeys natively, or you must configure a WebAuthn Trust Bridge in the domain settings to allow cross-origin authentication.
                </li>
              </ul>
            </div>

            {/* Explicit Disabled State Explanations with Clickable Jump Links */}
            {!isActivationGatePassed && (
              <div className="p-4 bg-[#FEF3C7] border border-[#FDE68A] rounded-[8px] text-[13px] text-[#92400E] space-y-2">
                <div className="flex items-center space-x-2 font-semibold text-[#B45309]">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#B45309]" />
                  <span>Activate button is disabled due to incomplete requirements:</span>
                </div>
                <ul className="space-y-1.5 pl-6 list-disc">
                  {!isOwnershipVerified && (
                    <li>
                      Domain ownership is unverified.{' '}
                      <button
                        type="button"
                        onClick={() => setWizardStep(2)}
                        className="text-[#0F62FE] hover:underline font-semibold cursor-pointer ml-1 inline-flex items-center gap-0.5"
                      >
                        Jump to Step 2: Verify ownership →
                      </button>
                    </li>
                  )}
                  {!isRoutingVerified && (
                    <li>
                      DNS routing is unverified.{' '}
                      <button
                        type="button"
                        onClick={() => setWizardStep(3)}
                        className="text-[#0F62FE] hover:underline font-semibold cursor-pointer ml-1 inline-flex items-center gap-0.5"
                      >
                        Jump to Step 3: Configure DNS routing →
                      </button>
                    </li>
                  )}
                  {!isCertReady && (
                    <li>
                      SSL certificate is not ready.{' '}
                      <button
                        type="button"
                        onClick={() => setWizardStep(4)}
                        className="text-[#0F62FE] hover:underline font-semibold cursor-pointer ml-1 inline-flex items-center gap-0.5"
                      >
                        Jump to Step 4: Certificate →
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    );
  };

  // Handlers for Allowed Cross-Origin Domains in Domain Details View
  const handleRemoveAllowedOrigin = (domainId: string, originId: string, originDomainName: string) => {
    setCustomDomains((prev) =>
      prev.map((d) =>
        d.id === domainId
          ? {
              ...d,
              allowedOrigins: (d.allowedOrigins || []).filter((o) => o.id !== originId),
            }
          : d
      )
    );
    showToast(`Allowed origin [${originDomainName}] removed and WebAuthn ROR configuration updated.`);
  };

  const getCandidateDomainsPool = (domain: CustomDomainItem) => {
    const existingInherited = (domain.allowedOrigins || []).map((o) => o.domain);
    const pool: string[] = [];
    if (!existingInherited.includes(defaultHexnodeUrl)) {
      pool.push(defaultHexnodeUrl);
    }
    customDomains
      .filter((d) => d.id !== domain.id && d.status === 'Active')
      .forEach((d) => {
        if (!existingInherited.includes(d.domain) && !pool.includes(d.domain)) {
          pool.push(d.domain);
        }
      });
    return pool;
  };

  const handleOpenAddOriginModal = (domain: CustomDomainItem) => {
    const candidateDomains = getCandidateDomainsPool(domain);
    const initialDomain = candidateDomains[0] || '';
    setInheritDomainRows([
      { id: `row-${Date.now()}`, domain: initialDomain },
    ]);
    setEnforcePasskeyMigrationToggle(true);
    setIsAddOriginModalOpen(true);
  };

  const handleAddInheritRow = (afterIndex: number) => {
    if (!selectedDomainDetails) return;
    const pool = getCandidateDomainsPool(selectedDomainDetails);
    const currentlySelected = inheritDomainRows.map((r) => r.domain).filter(Boolean);
    const nextUnselected = pool.find((d) => !currentlySelected.includes(d)) || '';

    const newRow: InheritPasskeyRow = {
      id: `row-${Date.now()}-${Math.random()}`,
      domain: nextUnselected,
    };

    setInheritDomainRows((prev) => {
      const nextRows = [...prev];
      nextRows.splice(afterIndex + 1, 0, newRow);
      return nextRows;
    });
  };

  const handleRemoveInheritRow = (rowId: string) => {
    setInheritDomainRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.id !== rowId);
    });
  };

  const handleRowDomainChange = (rowIndex: number, newDomain: string) => {
    setInheritDomainRows((prev) =>
      prev.map((r, idx) => (idx === rowIndex ? { ...r, domain: newDomain } : r))
    );
  };

  const handleSaveAddOrigin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDomainIdForDetails) return;

    const selectedDomainsToAdd = inheritDomainRows
      .map((r) => r.domain)
      .filter((d) => Boolean(d));

    if (selectedDomainsToAdd.length === 0) return;

    const uniqueDomains = Array.from(new Set(selectedDomainsToAdd));

    const newOriginObjs: PasskeyAllowedOrigin[] = uniqueDomains.map((domainName, idx) => ({
      id: `origin-${Date.now()}-${idx}`,
      domain: domainName,
      enforcePasskeyMigration: enforcePasskeyMigrationToggle,
      addedDate: 'Today',
    }));

    setCustomDomains((prev) =>
      prev.map((d) =>
        d.id === selectedDomainIdForDetails
          ? {
              ...d,
              allowedOrigins: [...(d.allowedOrigins || []), ...newOriginObjs],
            }
          : d
      )
    );

    setIsAddOriginModalOpen(false);
    showToast(
      uniqueDomains.length === 1
        ? `Inherited passkeys from [${uniqueDomains[0]}] successfully.`
        : `Inherited passkeys from ${uniqueDomains.length} domains successfully.`
    );
  };

  // Dedicated Full-Page Domain Details View
  const renderDomainDetailsView = (domain: CustomDomainItem) => {
    const detailsTabs: Array<'Details' | 'Passkeys'> = [
      'Details',
      'Passkeys',
    ];

    return (
      <div className="w-full animate-in fade-in duration-150">
        {/* Back Navigation */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => {
              setSelectedDomainIdForDetails(null);
              setIsDetailsManageMenuOpen(false);
            }}
            className="inline-flex items-center text-[13px] font-medium text-[#4B5563] hover:text-[#0F62FE] transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Custom Domains</span>
          </button>
        </div>

        {/* Page Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-[#E5E7EB]">
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <h1 className="text-[22px] font-semibold text-[#111827] tracking-tight">
              {domain.domain}
            </h1>

            {/* Status Badges */}
            <div className="flex items-center space-x-2">
              {domain.isPrimary && (
                domain.status === 'Action required' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEE2E2] text-[#B91C1C] border border-[#FCA5A5] select-none">
                    Primary — unavailable
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#0F62FE] text-white select-none">
                    Primary
                  </span>
                )
              )}
              {renderCustomStatusBadge(domain.status)}
            </div>
          </div>

          {/* Header Actions: Manage Dropdown Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDetailsManageMenuOpen(!isDetailsManageMenuOpen)}
              className="h-[36px] px-3.5 bg-white border border-[#D1D5DB] hover:border-[#9CA3AF] rounded-[6px] text-[13px] font-medium text-[#111827] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <span>Manage</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#6B7280]" />
            </button>

            {isDetailsManageMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-[#E5E7EB] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                {/* Test sign-in (Eligible if domain is Active) */}
                {domain.status === 'Active' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailsManageMenuOpen(false);
                      window.open(`https://${domain.domain}`, '_blank', 'noopener,noreferrer');
                    }}
                    className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4 text-[#0F62FE]" />
                    <span>Test sign-in</span>
                  </button>
                )}

                {/* Set as primary (Eligible if Active and not primary) */}
                {domain.status === 'Active' && !domain.isPrimary && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailsManageMenuOpen(false);
                      handleOpenActionModal('custom', 'Set as primary', domain.domain, domain.id);
                    }}
                    className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                  >
                    <Star className="w-4 h-4 text-[#0F62FE]" />
                    <span>Set as primary</span>
                  </button>
                )}

                {/* Modify */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsManageMenuOpen(false);
                    handleOpenModifyModal(domain);
                  }}
                  className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                >
                  <Pencil className="w-4 h-4 text-[#4B5563]" />
                  <span>Modify</span>
                </button>

                {/* Replace certificate (for self-managed domains) */}
                {(domain.certManagementType === 'upload' || domain.certificate.includes('Self-managed')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailsManageMenuOpen(false);
                      handleStartReplaceCertificateFlow(domain);
                    }}
                    className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-[#4B5563]" />
                    <span>Replace certificate</span>
                  </button>
                )}

                {/* Disable (Eligible if Active) */}
                {domain.status === 'Active' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailsManageMenuOpen(false);
                      handleOpenActionModal('custom', 'Disable', domain.domain, domain.id);
                    }}
                    className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                  >
                    <Archive className="w-4 h-4 text-[#4B5563]" />
                    <span>Disable</span>
                  </button>
                )}

                {/* Reactivate (Eligible if Disabled or Action required) */}
                {(domain.status === 'Disabled' || domain.status === 'Action required') && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailsManageMenuOpen(false);
                      handleOpenActionModal('custom', 'Reactivate', domain.domain, domain.id);
                    }}
                    className="w-full px-3.5 py-2 text-left text-[13px] text-[#0F62FE] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer font-medium"
                  >
                    <Play className="w-4 h-4 text-[#0F62FE]" />
                    <span>Reactivate</span>
                  </button>
                )}

                {/* Remove */}
                <div className="my-1 border-t border-[#E5E7EB]" />
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsManageMenuOpen(false);
                    handleOpenActionModal('custom', 'Remove', domain.domain, domain.id);
                  }}
                  className="w-full px-3.5 py-2 text-left text-[13px] text-[#DC2626] hover:bg-[#FEE2E2]/40 flex items-center space-x-2.5 transition-colors cursor-pointer font-medium"
                >
                  <Trash2 className="w-4 h-4 text-[#DC2626]" />
                  <span>Remove</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Tabs */}
        <div className="flex items-center space-x-8 border-b border-[#E5E7EB] mt-5 mb-6">
          {detailsTabs.map((tab) => {
            const isActive = activeDetailsTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveDetailsTab(tab)}
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

        {/* Tab 1: Details (Unified Card-Based Grid Layout) */}
        {activeDetailsTab === 'Details' && (() => {
          const isManaged = domain.certManagementType === 'managed' || domain.certificate.includes('Managed by Hexnode');
          const isSelfManaged = !isManaged;

          // Status badge computation for Certificate Status card
          let certBadge = {
            label: 'Valid',
            badgeClass: 'bg-[#DCFCE7] text-[#15803D]',
            icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-[#15803D]" />,
          };
          if ((domain.certExpirationDays !== undefined && domain.certExpirationDays <= 0) || domain.certificate.includes('Expired')) {
            certBadge = {
              label: 'Expired',
              badgeClass: 'bg-[#FEE2E2] text-[#B91C1C]',
              icon: <AlertCircle className="w-3.5 h-3.5 mr-1 text-[#B91C1C]" />,
            };
          } else if (domain.certExpirationDays !== undefined && domain.certExpirationDays <= 30) {
            certBadge = {
              label: 'Expiring Soon',
              badgeClass: 'bg-[#FEF3C7] text-[#B45309]',
              icon: <AlertTriangle className="w-3.5 h-3.5 mr-1 text-[#B45309]" />,
            };
          } else if (domain.status === 'Provisioning' || (domain.certExpirationDate && domain.certExpirationDate.includes('Pending'))) {
            certBadge = {
              label: 'Pending Issuance',
              badgeClass: 'bg-[#EFF6FF] text-[#1D4ED8]',
              icon: <Loader2 className="w-3.5 h-3.5 mr-1 text-[#1D4ED8] animate-spin" />,
            };
          }

          const certPayload = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAJ8e4/kL7r4DMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAlVTMQswCQYDVQQIDAJDQTEUMBIGA1UECgwLSGV4bm9kZSBJZFAxEzARBgNV
BAMMCm${domain.domain}0HhcNMjYwMTAxMDAwMDAwWhcNMjcwMTAxMDAwMDAw
WjBFMQswCQYDVQQGEwJVUzELMAkGA1UECAwCQ0ExFDASBgNVBAoMC0hleG5vZGUg
SWRQMRMwEQYDVQQDDAp${domain.domain}MIIBIjANBgkqhkiG9w0BAQEFAAOC
AQ8AMIIBCgKCAQEAyv4Q3Wj9nZv8K3u
-----END CERTIFICATE-----`;

          const keyPayload = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDK/hDdaP2dmf8K
3u1lU4p5gY8QyX9wP6Z3k8v9Y8wX7Z6P5T4wV3u8x7Y6v5W4q3u8z7X6v5W4q3u8
z7X6v5W4q3u8z7X6v5W4q3u8z7X6v5W4q3u8z7X6v5W4q3u8z7X6v5W4q3u8z7X6
v5W4q3u8z7X6v5W4q3u8z7X6v5W4q3u8
-----END PRIVATE KEY-----`;

          return (
            <div className="space-y-5">
              {/* 1. General Information Cards (Top Row) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Hostname Card */}
                <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[#6B7280]">Hostname</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(domain.domain, 'Hostname')}
                      className="text-[#0F62FE] hover:text-[#0050E6] text-[12px] font-medium flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <div className="text-[16px] font-semibold font-mono text-[#111827] mt-2 truncate" title={domain.domain}>
                    {domain.domain}
                  </div>
                </div>

                {/* Certificate Management Mode Card */}
                <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs flex flex-col justify-between">
                  <span className="text-[12px] font-medium text-[#6B7280]">Certificate Management Mode</span>
                  <div className="text-[16px] font-semibold text-[#111827] mt-2 flex items-center space-x-2">
                    <span>{isManaged ? 'Managed by Hexnode' : 'Self-managed'}</span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      isManaged ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-[#F3F4F6] text-[#4B5563]'
                    }`}>
                      {isManaged ? 'Automated' : 'Custom Upload'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Verification & Routing Records (Full-Width Cards) */}
              {/* Verification Record Details Card */}
              <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
                  <h4 className="text-[14px] font-semibold text-[#111827]">
                    Verification Record Details
                  </h4>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EFF6FF] text-[#1D4ED8]">
                    TXT Record
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                      Host / Record Name
                    </label>
                    <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#E5E7EB] rounded-[6px] px-3 py-2 text-[13px] font-mono text-[#111827]">
                      <span className="truncate">_hexnode-challenge.{domain.domain}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`_hexnode-challenge.${domain.domain}`, 'Host / Record Name')}
                        title="Copy host name"
                        className="ml-2 text-[#6B7280] hover:text-[#0F62FE] p-1 rounded hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                      Record Value
                    </label>
                    <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#E5E7EB] rounded-[6px] px-3 py-2 text-[13px] font-mono text-[#111827]">
                      <span className="truncate">hexnode-site-verification={domain.domain.replace(/[^a-zA-Z0-9]/g, '')}token987</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`hexnode-site-verification=${domain.domain.replace(/[^a-zA-Z0-9]/g, '')}token987`, 'Record Value')}
                        title="Copy record value"
                        className="ml-2 text-[#6B7280] hover:text-[#0F62FE] p-1 rounded hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Auto-Renewal Guard (If Managed by Hexnode) */}
                {isManaged && (
                  <div className="mt-3.5 p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-[6px] flex items-center space-x-2 text-[12px] text-[#92400E]">
                    <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0" />
                    <span className="font-semibold text-[#B45309]">
                      Required for Auto-Renewal. Do not delete.
                    </span>
                  </div>
                )}
              </div>

              {/* DNS CNAME Record Details Card */}
              <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
                  <h4 className="text-[14px] font-semibold text-[#111827]">
                    DNS CNAME Record Details
                  </h4>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EFF6FF] text-[#1D4ED8]">
                    CNAME Record
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                      Host Name
                    </label>
                    <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#E5E7EB] rounded-[6px] px-3 py-2 text-[13px] font-mono text-[#111827]">
                      <span className="truncate">{domain.domain}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(domain.domain, 'Host Name')}
                        title="Copy host name"
                        className="ml-2 text-[#6B7280] hover:text-[#0F62FE] p-1 rounded hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                      Target Value
                    </label>
                    <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#E5E7EB] rounded-[6px] px-3 py-2 text-[13px] font-mono text-[#111827]">
                      <span className="truncate">{defaultHexnodeUrl}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(defaultHexnodeUrl, 'Target Value')}
                        title="Copy target value"
                        className="ml-2 text-[#6B7280] hover:text-[#0F62FE] p-1 rounded hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Certificate Metadata Cards (Grid) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Certificate Status Card */}
                <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs flex flex-col justify-between">
                  <span className="text-[12px] font-medium text-[#6B7280]">Certificate Status</span>
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[13px] font-semibold ${certBadge.badgeClass}`}>
                      {certBadge.icon}
                      {certBadge.label}
                    </span>
                  </div>
                </div>

                {/* Certificate Expiration Date Card */}
                <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs flex flex-col justify-between">
                  <span className="text-[12px] font-medium text-[#6B7280]">Certificate Expiration Date</span>
                  <div className="text-[15px] font-semibold text-[#111827] mt-2">
                    {domain.certExpirationDate || 'Pending issuance'}
                  </div>
                </div>

                {/* Last Successful Check Timestamp Card (Full-width spanning 2 columns) */}
                <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs col-span-1 md:col-span-2">
                  <span className="text-[12px] font-medium text-[#6B7280]">Last Successful Check Timestamp</span>
                  <div className="text-[14px] font-mono text-[#111827] mt-1.5 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
                    <span>{domain.lastSuccessfulCheck || 'Oct 08, 2026, 02:15 AM'}</span>
                  </div>
                </div>
              </div>

              {/* 4. Read-Only Payload Extraction (Conditional: Self-Managed Only) */}
              {isSelfManaged && (
                <div className="space-y-5 pt-1">
                  {/* Certificate (PEM) Card */}
                  <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="text-[14px] font-semibold text-[#111827]">
                          Certificate (PEM)
                        </h4>
                        <span className="text-[12px] text-[#6B7280]">
                          Public certificate chain payload for {domain.domain}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(certPayload, 'Certificate (PEM)')}
                          title="Copy certificate to clipboard"
                          className="h-[32px] px-3 bg-white border border-[#D1D5DB] hover:bg-gray-50 rounded-[6px] text-[12px] font-medium text-[#374151] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Copy className="w-3.5 h-3.5 text-[#0F62FE]" />
                          <span>Copy to clipboard</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadPem(certPayload, `${domain.domain}_certificate.pem`)}
                          title="Download as .pem file"
                          className="h-[32px] px-3 bg-white border border-[#D1D5DB] hover:bg-gray-50 rounded-[6px] text-[12px] font-medium text-[#374151] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-[#0F62FE]" />
                          <span>Download .pem</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartReplaceCertificateFlow(domain)}
                          title="Replace certificate with dynamic validation"
                          className="h-[32px] px-3 bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[12px] font-medium flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          {replacingCertDomainId === domain.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          ) : (
                            <KeyRound className="w-3.5 h-3.5 text-white" />
                          )}
                          <span>Replace certificate</span>
                        </button>
                      </div>
                    </div>

                    <textarea
                      readOnly
                      value={certPayload}
                      rows={6}
                      className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[6px] p-3 font-mono text-[12px] text-[#374151] resize-none focus:outline-none cursor-text select-all leading-relaxed"
                    />
                  </div>

                  {/* Private Key Card */}
                  <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="text-[14px] font-semibold text-[#111827]">
                          Private Key
                        </h4>
                        <span className="text-[12px] text-[#6B7280]">
                          Cryptographic private key payload for TLS negotiation
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(keyPayload, 'Private Key')}
                          title="Copy private key to clipboard"
                          className="h-[32px] px-3 bg-white border border-[#D1D5DB] hover:bg-gray-50 rounded-[6px] text-[12px] font-medium text-[#374151] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Copy className="w-3.5 h-3.5 text-[#0F62FE]" />
                          <span>Copy to clipboard</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadPem(keyPayload, `${domain.domain}_private_key.pem`)}
                          title="Download as .pem file"
                          className="h-[32px] px-3 bg-white border border-[#D1D5DB] hover:bg-gray-50 rounded-[6px] text-[12px] font-medium text-[#374151] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-[#0F62FE]" />
                          <span>Download .pem</span>
                        </button>
                      </div>
                    </div>

                    <textarea
                      readOnly
                      value={keyPayload}
                      rows={6}
                      className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[6px] p-3 font-mono text-[12px] text-[#374151] resize-none focus:outline-none cursor-text select-all leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Tab 2: Passkeys (Inherit Flow) */}
        {activeDetailsTab === 'Passkeys' && (() => {
          // Calculate which domains rely on this custom domain as an authentication / passkey source
          const relyingDomainsOnThis: {
            id: string;
            domain: string;
            rpId: string;
            bindingStatus: string;
            linkedDate: string;
          }[] = [];

          // 1. Any other custom domains that have this domain in their allowedOrigins
          customDomains.forEach((other) => {
            if (other.id !== domain.id && other.allowedOrigins) {
              const match = other.allowedOrigins.find(
                (o) => o.domain.toLowerCase() === domain.domain.toLowerCase()
              );
              if (match) {
                relyingDomainsOnThis.push({
                  id: `relying-cd-${other.id}`,
                  domain: other.domain,
                  rpId: domain.domain,
                  bindingStatus: 'Active & Linked',
                  linkedDate: match.addedDate || 'Sep 14, 2026',
                });
              }
            }
          });

          // 2. Check if default tenant domain relies on this domain
          if (domain.domain === 'login.acme.com' || domain.domain === 'idp.acmecorp.com') {
            if (!relyingDomainsOnThis.some((r) => r.domain === defaultHexnodeUrl)) {
              relyingDomainsOnThis.push({
                id: 'relying-default-tenant',
                domain: defaultHexnodeUrl,
                rpId: domain.domain,
                bindingStatus: 'Active & Linked',
                linkedDate: 'Sep 14, 2026',
              });
            }
          }

          // Live RFC-compliant .well-known/webauthn JSON payload for this source domain
          const webauthnSourcePayload = JSON.stringify(
            {
              origins: [
                `https://${domain.domain}`,
                ...relyingDomainsOnThis.map((r) => `https://${r.domain}`),
              ],
            },
            null,
            2
          );

          const hasRelyingDomains = relyingDomainsOnThis.length > 0;

          return (
            <div className="space-y-6">
              {/* 1. Inheritance Selector Card */}
              <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-6 shadow-xs">
                <div className="flex items-start justify-between pb-4 border-b border-[#E5E7EB] flex-wrap gap-4">
                  <div>
                    <h3 className="text-[16px] font-medium text-[#111827]">
                      Inherit passkeys from legacy domains
                    </h3>
                    <p className="text-[13px] text-[#6B7280] mt-1">
                      Allow {domain.domain} to inherit and trust passkey credentials registered across other verified domains in your organization.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenAddOriginModal(domain)}
                    className="h-[36px] px-3.5 bg-[#0F62FE] hover:bg-[#0050E6] text-white text-[13px] font-medium rounded-[6px] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Inherit from domain</span>
                  </button>
                </div>

                {/* Inherited Domains Data Table */}
                <div className="mt-4 overflow-x-auto">
                  {(domain.allowedOrigins && domain.allowedOrigins.length > 0) ? (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-[#E5E7EB]">
                          <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                            Inherited Domain
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
                        {domain.allowedOrigins.map((origin) => (
                          <tr key={origin.id} className="hover:bg-[#F9FAFB] transition-colors">
                            <td className="px-4 py-3 text-[14px] font-mono text-[#111827]">
                              {origin.domain}
                            </td>
                            <td className="px-4 py-3 text-[14px]">
                              {origin.enforcePasskeyMigration ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">
                                  Enabled
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F4F6] text-[#4B5563]">
                                  Disabled
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[13px] text-[#6B7280]">
                              {origin.addedDate}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveAllowedOrigin(domain.id, origin.id, origin.domain)}
                                className="p-1 text-[#6B7280] hover:text-[#DC2626] rounded transition-colors cursor-pointer"
                                title="Remove inherited domain"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-10 text-center text-[#6B7280]">
                      <p className="text-[14px] font-medium text-[#111827]">
                        No inherited domains configured
                      </p>
                      <p className="text-[13px] text-[#6B7280] mt-1">
                        Click &quot;Inherit from domain&quot; to authorize this hostname to inherit passkey authentication credentials.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Dependency List (Conditional: count > 0) */}
              {hasRelyingDomains && (
                <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-6 shadow-xs space-y-4">
                  <div className="flex items-start justify-between pb-3 border-b border-[#E5E7EB]">
                    <div>
                      <h3 className="text-[16px] font-medium text-[#111827]">
                        Domains using this domain’s passkeys
                      </h3>
                      <p className="text-[13px] text-[#6B7280] mt-1">
                        Domains configured to trust {domain.domain} as their primary FIDO2 Relying Party Identifier (RP-ID).
                      </p>
                    </div>
                    <span className="text-[12px] font-medium text-[#15803D] bg-[#DCFCE7] px-2.5 py-1 rounded-full">
                      {relyingDomainsOnThis.length} Relying {relyingDomainsOnThis.length === 1 ? 'Party' : 'Parties'} Active
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
                        {relyingDomainsOnThis.map((r) => (
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
              )}

              {/* 3. Payload Preview (Conditional: count > 0) */}
              {hasRelyingDomains && (
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
                        onClick={() => copyToClipboard(webauthnSourcePayload, '.well-known/webauthn JSON')}
                        className="h-[32px] px-3 bg-white border border-[#D1D5DB] hover:bg-gray-50 rounded-[6px] text-[12px] font-medium text-[#374151] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#0F62FE]" />
                        <span>Copy JSON</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const blob = new Blob([webauthnSourcePayload], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${domain.domain}_webauthn.json`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          showToast('Downloaded .well-known/webauthn JSON file');
                        }}
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
                      {webauthnSourcePayload}
                    </pre>
                  </div>

                  <div className="flex items-center space-x-2 text-[12px] text-[#6B7280] pt-1">
                    <Info className="w-4 h-4 text-[#0F62FE] shrink-0" />
                    <span>
                      Browsers query this file dynamically when authenticating via passkeys across origins. As relying parties are added or removed, this payload updates in real time.
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  const selectedDomainDetails = customDomains.find((d) => d.id === selectedDomainIdForDetails) || null;

  const renderDomainsSection = (showHeading = true) => {
    // Case 1: Dedicated Default Domain Details View
    if (selectedDomainIdForDetails === 'default-hexnode') {
      return (
        <DefaultDomainDetailsView
          defaultHostname={defaultHexnodeUrl}
          isPrimary={isDefaultPrimary}
          onBack={() => setSelectedDomainIdForDetails(null)}
          onSetAsPrimary={() => {
            setCustomDomains((prev) => prev.map((d) => ({ ...d, isPrimary: false })));
            showToast('Default Hexnode URL restored as primary domain.');
          }}
          availableCustomDomains={customDomains.filter((d) => d.status === 'Active')}
          showToast={showToast}
        />
      );
    }

    if (selectedDomainDetails) {
      return renderDomainDetailsView(selectedDomainDetails);
    }

    return (
      <section className="mb-7 w-full">
        {showHeading && (
          <h2 className="text-[20px] font-semibold text-[#111827] tracking-tight mb-5">
            Domains
          </h2>
        )}

        <div className="flex items-center space-x-8 border-b border-[#E5E7EB] mb-6">
          {domainTabs.map((tab) => {
            const isActive = activeDomainTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveDomainTab(tab);
                  setSelectedDomainIdForDetails(null);
                  setIsCustomDomainWizardOpen(false);
                }}
                className={`relative pb-3 text-[15px] cursor-pointer transition-colors ${
                  isActive
                    ? 'text-[#0F62FE] font-medium'
                    : 'text-[#111827] hover:text-[#0F62FE] font-normal'
                }`}
              >
                <span>{tab}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#0F62FE] rounded-t-sm" />
                )}
              </button>
            );
          })}
        </div>

      {activeDomainTab === 'Custom domains' && (
        <div className="w-full">
          {selectedDomainDetails ? (
            renderDomainDetailsView(selectedDomainDetails)
          ) : isCustomDomainWizardOpen ? (
            renderCustomDomainWizard()
          ) : (
            <div className="w-full">
              {/* Standalone Default Hexnode Domain Card Component */}
              <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-4.5 mb-5 shadow-xs relative">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5 flex-wrap">
                      <span className="text-[14px] font-semibold text-[#111827] font-mono select-all">
                        {defaultHexnodeUrl}
                      </span>

                      {isDefaultPrimary && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#0F62FE] text-white select-none">
                          Primary
                        </span>
                      )}

                      {/* Quick Action Icons */}
                      <div className="flex items-center space-x-1 ml-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(`https://${defaultHexnodeUrl}`, 'Default Hexnode URL')}
                          className="p-1.5 text-[#6B7280] hover:text-[#0F62FE] hover:bg-[#EFF6FF] rounded-[4px] transition-colors cursor-pointer"
                          title="Copy URL"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`https://${defaultHexnodeUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-[#6B7280] hover:text-[#0F62FE] hover:bg-[#EFF6FF] rounded-[4px] transition-colors cursor-pointer inline-flex items-center justify-center"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    {/* Explanatory Text */}
                    <p className="text-[13px] text-[#6B7280]">
                      This is your permanent Hexnode identity URL. It cannot be modified or removed.
                    </p>
                  </div>

                  {/* Options Menu: Visible when Custom is Primary */}
                  {!isDefaultPrimary && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDefaultCardMenuOpen(!isDefaultCardMenuOpen);
                        }}
                        className="p-1 rounded text-[#6B7280] hover:text-[#111827] hover:bg-gray-100 transition-colors cursor-pointer"
                        title="Options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {isDefaultCardMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 w-48 bg-white rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-[#E5E7EB] py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setIsDefaultCardMenuOpen(false);
                              setSelectedDomainIdForDetails('default-hexnode');
                            }}
                            className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4 text-[#0F62FE]" />
                            <span>View details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsDefaultCardMenuOpen(false);
                              setIsRestoreDefaultModalOpen(true);
                            }}
                            className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                          >
                            <Star className="w-4 h-4 text-[#0F62FE]" />
                            <span>Set as primary</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-start mb-4">
                <button
                  type="button"
                  onClick={handleStartCustomDomainWizard}
                  className="h-[36px] px-4 bg-[#0F62FE] hover:bg-[#0050E6] text-white text-[14px] font-medium rounded-[6px] transition-colors cursor-pointer flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add custom domain</span>
                </button>
              </div>

              {/* Custom Domains Data Table with Certificate expiration (date) & Last successful check (timestamp) */}
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAFAFA] border-b border-[#E5E7EB]">
                      <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                        <div className="flex items-center space-x-1.5 cursor-pointer select-none">
                          <span>Domain</span>
                          <span className="text-gray-400 text-[11px]">↕</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                        <div className="flex items-center space-x-1.5 cursor-pointer select-none">
                          <span>Status</span>
                          <span className="text-gray-400 text-[11px]">↕</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                        <div className="flex items-center space-x-1.5 cursor-pointer select-none">
                          <span>Certificate</span>
                          <span className="text-gray-400 text-[11px]">↕</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                        <div className="flex items-center space-x-1.5 cursor-pointer select-none">
                          <span>Certificate expiration</span>
                          <span className="text-gray-400 text-[11px]">↕</span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                        <div className="flex items-center space-x-1.5 cursor-pointer select-none">
                          <span>Last successful check</span>
                          <span className="text-gray-400 text-[11px]">↕</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {customDomains.map((row) => (
                      <tr key={row.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-4 py-3.5 text-[14px] text-[#111827] font-normal">
                          <div className="flex items-center justify-between pr-1">
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDomainIdForDetails(row.id);
                                  setActiveDetailsTab('Details');
                                }}
                                className="font-medium text-[#0F62FE] hover:text-[#0050E6] hover:underline text-left cursor-pointer transition-colors"
                                title="View domain details"
                              >
                                {row.domain}
                              </button>
                              {row.isPrimary && (
                                row.status === 'Action required' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEE2E2] text-[#B91C1C] border border-[#FCA5A5] select-none">
                                    Primary — unavailable
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#0F62FE] text-white select-none">
                                    Primary
                                  </span>
                                )
                              )}
                            </div>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionMenuId(openActionMenuId === row.id ? null : row.id);
                                }}
                                className="p-1 rounded text-[#6B7280] hover:text-[#111827] hover:bg-gray-100 transition-colors cursor-pointer"
                                title="Actions"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                                {openActionMenuId === row.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1 w-52 bg-white rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-[#E5E7EB] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                                >
                                  {/* Active State Actions */}
                                  {row.status === 'Active' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          window.open(`https://${row.domain}`, '_blank', 'noopener,noreferrer');
                                        }}
                                        className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                                      >
                                        <ExternalLink className="w-4 h-4 text-[#0F62FE]" />
                                        <span>Test sign-in</span>
                                      </button>

                                      {!row.isPrimary && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenActionModal('custom', 'Set as primary', row.domain, row.id)}
                                          className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                                        >
                                          <Star className="w-4 h-4 text-[#0F62FE]" />
                                          <span>Set as primary domain</span>
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => handleOpenActionModal('custom', 'Disable', row.domain, row.id)}
                                        className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                                      >
                                        <Archive className="w-4 h-4 text-[#4B5563]" />
                                        <span>Disable</span>
                                      </button>
                                    </>
                                  )}

                                  {/* Pending setup Actions */}
                                  {row.status === 'Pending setup' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        handleModifyCustomDomain(row, 2);
                                      }}
                                      className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                                    >
                                      <ArrowRightCircle className="w-4 h-4 text-[#0F62FE]" />
                                      <span className="font-medium text-[#0F62FE]">Continue setup</span>
                                    </button>
                                  )}

                                  {/* Provisioning Actions */}
                                  {row.status === 'Provisioning' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setProvisioningModalDomain(row);
                                        setIsProvisioningModalOpen(true);
                                      }}
                                      className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                                    >
                                      <Loader2 className="w-4 h-4 text-[#0F62FE] animate-spin" />
                                      <span>View progress</span>
                                    </button>
                                  )}

                                  {/* Disabled Actions */}
                                  {row.status === 'Disabled' && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenActionModal('custom', 'Reactivate', row.domain, row.id)}
                                      className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                                    >
                                      <Play className="w-4 h-4 text-[#0F62FE]" />
                                      <span className="font-medium text-[#0F62FE]">Reactivate</span>
                                    </button>
                                  )}

                                  {/* Action required Actions */}
                                  {row.status === 'Action required' && (
                                    <button
                                      type="button"
                                      onClick={() => handleFixIssue(row)}
                                      className="w-full px-3.5 py-2 text-left text-[13px] text-[#DC2626] hover:bg-[#FEE2E2]/50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                                    >
                                      <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                                      <span className="font-medium">Fix issue</span>
                                    </button>
                                  )}

                                  {/* Modify Action */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenModifyModal(row)}
                                    className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-4 h-4 text-[#4B5563]" />
                                    <span>Modify</span>
                                  </button>

                                  {/* Replace Certificate (for self-managed) */}
                                  {(row.certManagementType === 'upload' || row.certificate.includes('Self-managed')) && (
                                    <button
                                      type="button"
                                      onClick={() => handleStartReplaceCertificateFlow(row)}
                                      className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                                    >
                                      {replacingCertDomainId === row.id ? (
                                        <Loader2 className="w-4 h-4 text-[#0F62FE] animate-spin" />
                                      ) : (
                                        <KeyRound className="w-4 h-4 text-[#4B5563]" />
                                      )}
                                      <span>Replace certificate</span>
                                    </button>
                                  )}

                                  {/* Remove Action */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenActionModal('custom', 'Remove', row.domain, row.id)}
                                    className="w-full px-3.5 py-2 text-left text-[13px] text-[#DC2626] hover:bg-[#FEE2E2]/50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4 text-[#DC2626]" />
                                    <span>Remove</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status Column with Inline Action Buttons */}
                        <td className="px-4 py-3.5 text-[14px]">
                          <div className="flex flex-col items-start gap-1">
                            {renderCustomStatusBadge(row.status)}

                            {/* State: Provisioning -> View progress */}
                            {row.status === 'Provisioning' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setProvisioningModalDomain(row);
                                  setIsProvisioningModalOpen(true);
                                }}
                                className="inline-flex items-center space-x-1 text-[12px] font-medium text-[#0F62FE] hover:text-[#0050E6] hover:underline cursor-pointer transition-colors"
                              >
                                <span>View progress</span>
                                <ArrowRight className="w-3 h-3 text-[#0F62FE]" />
                              </button>
                            )}

                            {/* State: Action required -> Fix issue */}
                            {row.status === 'Action required' && (
                              <button
                                type="button"
                                onClick={() => handleFixIssue(row)}
                                className="inline-flex items-center space-x-1 text-[12px] font-medium text-[#DC2626] hover:text-[#B91C1C] hover:underline cursor-pointer transition-colors"
                              >
                                <span>Fix issue</span>
                                <ArrowRight className="w-3 h-3 text-[#DC2626]" />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-[14px] text-[#374151]">
                          {row.certificate}
                        </td>

                        {/* Certificate Expiration Date Column */}
                        <td className="px-4 py-3.5 text-[14px]">
                          {renderCertExpirationCell(row.certExpirationDate, row.certExpirationDays)}
                        </td>

                        {/* Last Successful Check Timestamp Column */}
                        <td className="px-4 py-3.5 text-[14px] text-[#6B7280]">
                          {row.lastSuccessfulCheck}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeDomainTab === 'Allowed domains' && (
        <div>
          <div className="flex items-center justify-start mb-4">
            <button
              type="button"
              onClick={handleOpenAddAllowedModal}
              className="h-[36px] px-4 bg-[#0F62FE] hover:bg-[#0050E6] text-white text-[14px] font-medium rounded-[6px] transition-colors cursor-pointer shadow-xs"
            >
              Add Domain
            </button>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E5E7EB]">
                  <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                    <div className="flex items-center space-x-1.5 cursor-pointer select-none">
                      <span>Domain Name</span>
                      <span className="text-gray-400 text-[11px]">↕</span>
                    </div>
                  </th>
                  <th className="px-2 py-3 w-[44px] text-center">
                    <span className="sr-only">Actions</span>
                  </th>
                  <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                    <div className="flex items-center space-x-1.5 cursor-pointer select-none">
                      <span>Status</span>
                      <span className="text-gray-400 text-[11px]">↕</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                    <div className="flex items-center space-x-1.5 cursor-pointer select-none">
                      <span>Source</span>
                      <span className="text-gray-400 text-[11px]">↕</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                    <div className="flex items-center space-x-1.5 cursor-pointer select-none">
                      <span>Sign in via</span>
                      <span className="text-gray-400 text-[11px]">↕</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-[13px] font-medium text-[#4B5563]">
                    <div className="flex items-center space-x-1.5 cursor-pointer select-none">
                      <span>Users</span>
                      <span className="text-gray-400 text-[11px]">↕</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {allowedDomains.map((row) => {
                  const isManual = row.source === 'Manual' || row.isManual;
                  const isVerified = row.status === 'Verified';
                  const isDisabled = row.status === 'Disabled';
                  const isPending = row.status === 'Pending Verification';

                  return (
                    <tr key={row.id} className="hover:bg-[#F9FAFB] transition-colors">
                      {/* 1. Domain Name */}
                      <td className="px-4 py-3.5 text-[14px] text-[#111827] font-normal">
                        {row.domain}
                      </td>

                      {/* 2. Options (Actions) */}
                      <td className="px-2 py-3.5 text-[14px] text-center w-[44px]">
                        {isManual ? (
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenuId(openActionMenuId === row.id ? null : row.id);
                              }}
                              className="p-1 rounded text-[#6B7280] hover:text-[#111827] hover:bg-gray-100 transition-colors cursor-pointer"
                              title="Options"
                              aria-label={`Options for ${row.domain}`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openActionMenuId === row.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute left-0 top-full mt-1 w-44 bg-white rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-[#E5E7EB] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                              >
                                {isVerified && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenDisableAllowedModal(row)}
                                      className="w-full px-3.5 py-2 text-left text-[13px] text-[#374151] hover:bg-[#F3F4F6] flex items-center space-x-2.5 transition-colors cursor-pointer"
                                    >
                                      <Ban className="w-4 h-4 text-[#4B5563]" />
                                      <span>Disable Domain</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRemoveAllowedModal(row)}
                                      className="w-full px-3.5 py-2 text-left text-[13px] text-[#DC2626] hover:bg-[#FEE2E2]/50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4 text-[#DC2626]" />
                                      <span>Remove Domain</span>
                                    </button>
                                  </>
                                )}

                                {isDisabled && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenReactivateAllowedModal(row)}
                                      className="w-full px-3.5 py-2 text-left text-[13px] text-[#0F62FE] hover:bg-[#EFF6FF] flex items-center space-x-2.5 transition-colors cursor-pointer"
                                    >
                                      <RotateCcw className="w-4 h-4 text-[#0F62FE]" />
                                      <span>Reactivate</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRemoveAllowedModal(row)}
                                      className="w-full px-3.5 py-2 text-left text-[13px] text-[#DC2626] hover:bg-[#FEE2E2]/50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4 text-[#DC2626]" />
                                      <span>Remove Domain</span>
                                    </button>
                                  </>
                                )}

                                {isPending && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleTriggerVerifyAllowedDomain(row)}
                                      className="w-full px-3.5 py-2 text-left text-[13px] text-[#0F62FE] hover:bg-[#EFF6FF] flex items-center space-x-2.5 transition-colors cursor-pointer"
                                    >
                                      <ShieldCheck className="w-4 h-4 text-[#0F62FE]" />
                                      <span>Verify Domain</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRemoveAllowedModal(row)}
                                      className="w-full px-3.5 py-2 text-left text-[13px] text-[#DC2626] hover:bg-[#FEE2E2]/50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4 text-[#DC2626]" />
                                      <span>Remove Domain</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </td>

                      {/* 3. Status */}
                      <td className="px-4 py-3.5 text-[14px]">
                        {isVerified && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#DCFCE7] text-[#15803D]">
                            Verified
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#FEF3C7] text-[#B45309]">
                            Pending Verification
                          </span>
                        )}
                        {isDisabled && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#FEE2E2] text-[#B91C1C]">
                            Disabled
                          </span>
                        )}
                      </td>

                      {/* 4. Source */}
                      <td className="px-4 py-3.5 text-[14px] text-[#374151]">{row.source}</td>

                      {/* 5. Sign in via */}
                      <td className="px-4 py-3.5 text-[14px]">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#EFF6FF] text-[#1D4ED8]">
                          {row.signInVia}
                        </span>
                      </td>

                      {/* 6. Users */}
                      <td className="px-4 py-3.5 text-[14px] text-[#374151]">
                        {typeof row.users === 'number' ? row.users.toLocaleString() : row.users}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
    );
  };

  return (
    <div
      className="min-h-screen bg-[#F9FAFB] text-[#374151] font-sans flex flex-col antialiased selection:bg-[#0F62FE] selection:text-white"
      onClick={() => {
        setOpenActionMenuId(null);
        setIsDefaultCardMenuOpen(false);
      }}
    >
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#15803D] text-white text-[13px] font-medium px-4 py-2.5 rounded-[8px] shadow-lg flex items-center space-x-2 animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Provisioning Progress Modal */}
      {isProvisioningModalOpen && provisioningModalDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB]">
              <div>
                <h3 className="text-[17px] font-semibold text-[#111827]">
                  Provisioning Status
                </h3>
                <p className="text-[13px] text-[#6B7280] font-mono mt-0.5">
                  {provisioningModalDomain.domain}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProvisioningModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Checklist / Timeline */}
            <div className="space-y-4 py-1">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#111827]">Domain ownership verified</p>
                  <p className="text-[12px] text-[#6B7280]">DNS TXT ownership record confirmed by edge probes.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#111827]">CNAME traffic routing configured</p>
                  <p className="text-[12px] text-[#6B7280]">Host pointed to custom.idp.hexnode.com.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-full bg-[#EFF6FF] text-[#0F62FE] flex items-center justify-center shrink-0 mt-0.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#0F62FE]">Certificate preparation &amp; ACME issuance</p>
                  <p className="text-[12px] text-[#6B7280]">Requesting Let&apos;s Encrypt / DigiCert managed SSL certificate...</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 opacity-60">
                <div className="w-5 h-5 rounded-full border-2 border-[#D1D5DB] flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-transparent" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#374151]">Edge proxy binding &amp; activation</p>
                  <p className="text-[12px] text-[#6B7280]">Final routing sync across global points of presence.</p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#F9FAFB] rounded-[6px] border border-[#E5E7EB] text-[12px] text-[#6B7280] leading-relaxed">
              Certificate issuance and DNS propagation typically complete within 2 to 5 minutes. You may safely close this modal while provisioning completes.
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setIsProvisioningModalOpen(false)}
                className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Default Primary Domain Modal */}
      {isRestoreDefaultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB]">
              <h3 className="text-[17px] font-semibold text-[#111827]">
                Restore Default Primary Domain
              </h3>
              <button
                type="button"
                onClick={() => setIsRestoreDefaultModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-[14px] text-[#374151] leading-relaxed">
                Are you sure you want to set the default Hexnode URL as your primary domain?
              </p>

              <ul className="list-disc pl-5 space-y-2 text-[13px] text-[#374151] leading-relaxed">
                <li>
                  Applications and authorization servers configured against your custom domain will fail until you manually update them to the Hexnode URL.
                </li>
                <li>
                  Users navigating to the Hexnode URL will need to authenticate again to establish a new session.
                </li>
                <li>
                  Passkeys are cryptographically bound to the domain, so users may need to re-enroll their passkeys; however, you can enable passkey migration from other domains within the domain settings.
                </li>
                <li>
                  Your existing custom domains will not be deleted or deactivated by this change.
                </li>
              </ul>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-3 pt-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setIsRestoreDefaultModalOpen(false)}
                className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomDomains((prev) => prev.map((d) => ({ ...d, isPrimary: false })));
                  setIsRestoreDefaultModalOpen(false);
                  showToast('Default Hexnode URL restored as primary domain.');
                }}
                className="px-4 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer shadow-xs"
              >
                Set as primary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Primary Domain Action Modals */}
      {/* 1a. Primary Domain Remove Action (Hard Block) */}
      {isPrimaryRemovalModalOpen && primaryRemovalDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB]">
              <h3 className="text-[17px] font-semibold text-[#111827]">
                Remove Primary Domain: {primaryRemovalDomain.domain}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsPrimaryRemovalModalOpen(false);
                  setPrimaryRemovalDomain(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[14px] text-[#374151] leading-relaxed">
              You cannot remove {primaryRemovalDomain.domain} while it is set as your primary domain. Please set another custom domain as your primary domain before attempting to remove this one.
            </p>

            <div className="pt-3 flex items-center justify-end border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={handleConfirmPrimaryRemoval}
                className="px-5 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1b. Primary Domain Disable Action (Conditional Escape Hatch) */}
      {isPrimaryDisableModalOpen && primaryDisableDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB]">
              <h3 className="text-[17px] font-semibold text-[#111827]">
                Disable Primary Domain: {primaryDisableDomain.domain}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsPrimaryDisableModalOpen(false);
                  setPrimaryDisableDomain(null);
                  setRevertToDefaultChecked(false);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[14px] text-[#374151] leading-relaxed">
              You cannot disable your primary custom domain without assigning a replacement. You must either set another custom domain as primary, or revert to the default Hexnode IdP domain.
            </p>

            {/* Checkbox with label on left and checkbox on right */}
            <div className="p-3 bg-gray-50 border border-[#E5E7EB] rounded-[8px]">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-[13px] font-medium text-[#111827]">
                  Set the default Hexnode IdP domain as primary.
                </span>
                <input
                  type="checkbox"
                  checked={revertToDefaultChecked}
                  onChange={(e) => setRevertToDefaultChecked(e.target.checked)}
                  className="w-4 h-4 rounded border-[#D1D5DB] text-[#0F62FE] focus:ring-[#0F62FE] cursor-pointer shrink-0 ml-3"
                />
              </label>
            </div>

            {/* Info Alert: Render an inline info box beneath the checkbox */}
            <div className="p-3.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[8px] text-[13px] text-[#1D4ED8] flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                Please ensure all Service Providers (SPs) and integrations are updated with the new domain URL prior to the removal of {primaryDisableDomain.domain}. Failing to do so will result in broken SSO flows and interrupted user logins.
              </span>
            </div>

            {/* Footer Buttons: Cancel (always enabled) and Confirm (strictly disabled until the checkbox is checked) */}
            <div className="pt-3 flex items-center justify-end space-x-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => {
                  setIsPrimaryDisableModalOpen(false);
                  setPrimaryDisableDomain(null);
                  setRevertToDefaultChecked(false);
                }}
                className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPrimaryDisable}
                disabled={!revertToDefaultChecked}
                className="px-4 h-[36px] bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modify Domain Confirmation Modal */}
      {isModifyModalOpen && modifyModalDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB]">
              <h3 className="text-[17px] font-semibold text-[#111827]">
                Modify  {modifyModalDomain.domain}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsModifyModalOpen(false);
                  setModifyModalDomain(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-[14px] text-[#374151] leading-relaxed">
                You are about to modify the settings of an active domain. Please note:
              </p>

              <ul className="list-disc pl-5 space-y-2 text-[13px] text-[#374151] leading-relaxed">
                <li>
                  Your current certificate and routing will remain actively serving traffic while you make changes.
                </li>
                <li>
                  New settings will only take effect after they are fully validated and published at the end of the setup flow.
                </li>
                <li>
                  The hostname itself cannot be changed. To use a different domain name, you must add a new domain.
                </li>
              </ul>
            </div>

            <div className="pt-3 flex items-center justify-end space-x-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => {
                  setIsModifyModalOpen(false);
                  setModifyModalDomain(null);
                }}
                className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = modifyModalDomain;
                  setIsModifyModalOpen(false);
                  setModifyModalDomain(null);
                  handleModifyCustomDomain(target);
                }}
                className="px-4 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer shadow-xs"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Activation Success Modal */}
      {isPostActivationSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150 space-y-5">
            {/* Header: Title Domain Activated: {hostname} with a success indicator */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB]">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-full bg-[#DCFCE7] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                </div>
                <h3 className="text-[17px] font-semibold text-[#111827]">
                  Domain Activated: {postActivationDomain}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPostActivationSuccessModalOpen(false);
                  if (postActivationDomainId) {
                    setSelectedDomainIdForDetails(postActivationDomainId);
                  }
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Test Sign-in Section */}
            <div className="space-y-2">
              <p className="text-[14px] text-[#374151] leading-relaxed">
                Verify your setup by performing a test sign-in with your domain URL.
              </p>
              <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#E5E7EB] rounded-[6px] px-3.5 py-2.5">
                <span className="font-mono text-[13px] text-[#374151] truncate select-all">
                  {`https://${postActivationDomain}`}
                </span>
                <div className="flex items-center space-x-1.5 shrink-0 ml-3">
                  <button
                    type="button"
                    title="Copy to clipboard"
                    onClick={() => {
                      navigator.clipboard.writeText(`https://${postActivationDomain}`);
                      showToast('Test sign-in URL copied to clipboard');
                    }}
                    className="p-1.5 text-gray-500 hover:text-[#0F62FE] hover:bg-white rounded transition-colors cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Launch in new tab"
                    onClick={() => {
                      window.open(`https://${postActivationDomain}`, '_blank', 'noopener,noreferrer');
                    }}
                    className="p-1.5 text-gray-500 hover:text-[#0F62FE] hover:bg-white rounded transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Attestation Checkbox: Label on left, checkbox on right aligned with toggle button */}
            <div className="pt-1">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-[14px] text-[#374151] font-medium">
                  I confirm a successful test sign-in.
                </span>
                <input
                  type="checkbox"
                  checked={isTestConfirmed}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsTestConfirmed(checked);
                    if (!checked && isSetPrimaryChecked) {
                      setIsSetPrimaryChecked(false);
                      if (postActivationDomainId) {
                        setCustomDomains((prev) =>
                          prev.map((d) => (d.id === postActivationDomainId ? { ...d, isPrimary: false } : d))
                        );
                      }
                    }
                  }}
                  className="w-4 h-4 text-[#0F62FE] border-[#D1D5DB] rounded focus:ring-[#0F62FE] cursor-pointer mr-2.5"
                />
              </label>
            </div>

            {/* Set Primary Toggle & Info Box */}
            <div className="pt-3 pb-1 border-t border-[#E5E7EB] space-y-3">
              <div className="flex items-center justify-between">
                <label
                  className={`text-[14px] font-medium transition-colors ${
                    isTestConfirmed ? 'text-[#111827]' : 'text-[#9CA3AF]'
                  }`}
                >
                  Set as primary domain
                </label>
                <button
                  type="button"
                  role="switch"
                  disabled={!isTestConfirmed}
                  aria-checked={isSetPrimaryChecked}
                  onClick={() => {
                    if (!isTestConfirmed) return;
                    const nextVal = !isSetPrimaryChecked;
                    setIsSetPrimaryChecked(nextVal);
                    if (nextVal) {
                      if (postActivationDomainId) {
                        setCustomDomains((prev) =>
                          prev.map((d) => ({
                            ...d,
                            isPrimary: d.id === postActivationDomainId,
                          }))
                        );
                      }
                      showToast(`Domain [${postActivationDomain}] set as primary domain`);
                    } else {
                      if (postActivationDomainId) {
                        setCustomDomains((prev) =>
                          prev.map((d) => (d.id === postActivationDomainId ? { ...d, isPrimary: false } : d))
                        );
                      }
                    }
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    !isTestConfirmed
                      ? 'bg-[#E5E7EB] opacity-60 cursor-not-allowed'
                      : isSetPrimaryChecked
                      ? 'bg-[#0F62FE] cursor-pointer'
                      : 'bg-[#D1D5DB] cursor-pointer'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isSetPrimaryChecked ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Small blue info box when Set as Primary is enabled */}
              {isSetPrimaryChecked && (
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-[6px] p-3 text-[13px] text-[#1D4ED8] flex items-start space-x-2.5 animate-in fade-in duration-150">
                  <Info className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
                  <ul className="space-y-1.5 list-disc list-inside text-[#1E40AF] leading-relaxed">
                    <li>
                      OIDC issuers, SAML entity IDs, and federation callbacks do not change automatically, requiring you to manually update your external integrations.
                    </li>
                    <li>
                      Users will need to authenticate again to establish a session when visiting the new hostname.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Footer Action: Secondary Close button and primary Confirm button */}
            <div className="pt-3 flex items-center justify-end space-x-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => {
                  setIsPostActivationSuccessModalOpen(false);
                  if (postActivationDomainId) {
                    setSelectedDomainIdForDetails(postActivationDomainId);
                  }
                }}
                className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPostActivationSuccessModalOpen(false);
                  if (postActivationDomainId) {
                    setSelectedDomainIdForDetails(postActivationDomainId);
                  }
                }}
                className="px-5 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer shadow-xs"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case 2: Active Domain Certificate Rotation Modal (Continuous Legacy Serving & Mode Switching) */}
      {activeDomainForRotation && (
        <ActiveDomainCertificateRotationModal
          isOpen={true}
          domain={activeDomainForRotation}
          onClose={() => setActiveDomainForRotation(null)}
          onDeployCertificate={handleDeployCertificateRotation}
          showToast={showToast}
        />
      )}

      {/* Reactivation Recheck Modal with Dynamic Hostname Injection */}
      {isReactivationModalOpen && reactivationDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-[17px] font-semibold text-[#111827]">
                Reactivate [{reactivationDomain.domain}]
              </h3>
              <button
                type="button"
                onClick={() => setIsReactivationModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[14px] text-[#374151] leading-relaxed">
              The domain <span className="font-semibold text-[#111827] font-mono">[{reactivationDomain.domain}]</span> must undergo a verification recheck to ensure ownership and certificate readiness before reactivation.
            </p>

            <div className="pt-3 flex items-center justify-end space-x-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setIsReactivationModalOpen(false)}
                className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReactivationVerify}
                className="px-4 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer"
              >
                Verify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 1 Failure State: Verification Required Modal */}
      {isVerificationRequiredModalOpen && verificationRequiredDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-xl p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-[17px] font-semibold text-[#111827]">
                Verification Required: {verificationRequiredDomain.domain}
              </h3>
              <button
                type="button"
                onClick={() => setIsVerificationRequiredModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error notice */}
            <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-[8px] flex items-start space-x-2.5 text-[#991B1B] text-[13px]">
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <p className="leading-relaxed font-medium">
                Backend DNS re-verification failed. Missing or incorrect DNS records were detected. Domain ownership and CNAME routing must be verified before replacing this domain&apos;s SSL/TLS certificate.
              </p>
            </div>

            {/* Missing/Incorrect Records List (Mirroring Step 2 Domain Setup UI) */}
            <div className="space-y-3 pt-1">
              {/* Record 1: DNS TXT Ownership Record */}
              <div className="border border-[#E5E7EB] rounded-[8px] p-4 bg-white space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-[13px] text-[#111827]">Domain Ownership Record</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EFF6FF] text-[#1D4ED8]">
                      TXT Record
                    </span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEE2E2] text-[#B91C1C]">
                    Missing record
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <span className="text-[#6B7280] block font-medium mb-1">Host / Name</span>
                    <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#D1D5DB] rounded px-2.5 py-1.5 font-mono text-[#111827]">
                      <span className="truncate">_hexnode-challenge.{verificationRequiredDomain.domain}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`_hexnode-challenge.${verificationRequiredDomain.domain}`, 'Host name')}
                        className="text-[#0F62FE] hover:text-[#0050E6] p-1 cursor-pointer shrink-0 ml-1"
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[#6B7280] block font-medium mb-1">TXT Record Value</span>
                    <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#D1D5DB] rounded px-2.5 py-1.5 font-mono text-[#111827]">
                      <span className="truncate">hexnode-domain-verification=hx-verify-88a91c0f</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('hexnode-domain-verification=hx-verify-88a91c0f', 'TXT Value')}
                        className="text-[#0F62FE] hover:text-[#0050E6] p-1 cursor-pointer shrink-0 ml-1"
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Record 2: DNS CNAME Routing Record */}
              <div className="border border-[#E5E7EB] rounded-[8px] p-4 bg-white space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-[13px] text-[#111827]">Traffic Routing Record</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EFF6FF] text-[#1D4ED8]">
                      CNAME Record
                    </span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEE2E2] text-[#B91C1C]">
                    Unresolved
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <span className="text-[#6B7280] block font-medium mb-1">Host Name</span>
                    <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#D1D5DB] rounded px-2.5 py-1.5 font-mono text-[#111827]">
                      <span className="truncate">{verificationRequiredDomain.domain}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(verificationRequiredDomain.domain, 'Host Name')}
                        className="text-[#0F62FE] hover:text-[#0050E6] p-1 cursor-pointer shrink-0 ml-1"
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[#6B7280] block font-medium mb-1">Target Value</span>
                    <div className="flex items-center justify-between bg-[#F9FAFB] border border-[#D1D5DB] rounded px-2.5 py-1.5 font-mono text-[#111827]">
                      <span className="truncate">tenant.hexnode.com</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('tenant.hexnode.com', 'Target Value')}
                        className="text-[#0F62FE] hover:text-[#0050E6] p-1 cursor-pointer shrink-0 ml-1"
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[12px] text-[#6B7280] leading-relaxed">
              Once these records are published in your DNS provider, click Retry verification. Access to upload and replace the certificate will be granted once records resolve.
            </p>

            <div className="pt-3 flex items-center justify-end space-x-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setIsVerificationRequiredModalOpen(false)}
                className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRetryVerification}
                disabled={isRetryingVerification}
                className="px-4 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] disabled:opacity-50 text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer flex items-center space-x-2"
              >
                {isRetryingVerification ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying records...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry verification</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2: Single-Step Certificate Update Modal (Progressively Disclosed) */}
      {isReplaceCertModalOpen && replaceCertDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-xl p-6 animate-in fade-in zoom-in-95 duration-150 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB]">
              <h3 className="text-[17px] font-semibold text-[#111827]">
                Replace Certificate: {replaceCertDomain.domain}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsReplaceCertModalOpen(false);
                  setReplaceCertPreview(null);
                  setReplaceCertValidationError(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Input Section: Radio toggle */}
            <div className="space-y-4">
              <div className="flex items-center space-x-6 border-b border-[#E5E7EB] pb-2.5">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="replaceCertMethodRadio"
                    checked={replaceCertMethod === 'upload'}
                    onChange={() => {
                      setReplaceCertMethod('upload');
                      setReplaceCertValidationError(null);
                      setReplaceCertPreview(null);
                    }}
                    className="w-4 h-4 text-[#0F62FE] border-[#D1D5DB] focus:ring-[#0F62FE]"
                  />
                  <span className="text-[13px] font-medium text-[#111827]">Upload PEM files</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="replaceCertMethodRadio"
                    checked={replaceCertMethod === 'text'}
                    onChange={() => {
                      setReplaceCertMethod('text');
                      setReplaceCertValidationError(null);
                      setReplaceCertPreview(null);
                    }}
                    className="w-4 h-4 text-[#0F62FE] border-[#D1D5DB] focus:ring-[#0F62FE]"
                  />
                  <span className="text-[13px] font-medium text-[#111827]">Paste plain text</span>
                </label>
              </div>

              {replaceCertMethod === 'upload' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Dropzone 1: Certificate (PEM) */}
                  <div>
                    <label className="block text-[12px] font-medium text-[#374151] mb-1">
                      Certificate (PEM) <span className="text-[#DC2626]">*</span>
                    </label>
                    <label
                      htmlFor="certFileUpload"
                      className={`border-2 border-dashed rounded-[8px] p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors min-h-[120px] ${
                        replaceCertPemFile
                          ? 'border-[#15803D] bg-[#F0FDF4]'
                          : 'border-[#D1D5DB] hover:border-[#0F62FE] bg-[#FAFAFA]'
                      }`}
                    >
                      <input
                        id="certFileUpload"
                        type="file"
                        accept=".pem,.crt,.cer"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const content = (ev.target?.result as string) || '';
                              setReplaceCertPemFile({
                                name: file.name,
                                size: `${(file.size / 1024).toFixed(1)} KB`,
                                content,
                              });
                            };
                            reader.readAsText(file);
                          }
                          setReplaceCertValidationError(null);
                          setReplaceCertPreview(null);
                        }}
                        className="hidden"
                      />
                      {replaceCertPemFile ? (
                        <div className="space-y-1">
                          <CheckCircle2 className="w-5 h-5 text-[#15803D] mx-auto" />
                          <p className="text-[12px] font-semibold text-[#111827] truncate max-w-[180px]">
                            {replaceCertPemFile.name}
                          </p>
                          <span className="text-[11px] text-[#6B7280]">
                            {replaceCertPemFile.size} • Click to replace
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Upload className="w-5 h-5 text-[#6B7280] mx-auto" />
                          <p className="text-[12px] font-medium text-[#111827]">
                            Drop certificate file or browse
                          </p>
                          <span className="text-[11px] text-[#6B7280]">
                            .pem, .crt, .cer
                          </span>
                        </div>
                      )}
                    </label>
                  </div>

                  {/* Dropzone 2: Private Key */}
                  <div>
                    <label className="block text-[12px] font-medium text-[#374151] mb-1">
                      Private Key <span className="text-[#DC2626]">*</span>
                    </label>
                    <label
                      htmlFor="keyFileUpload"
                      className={`border-2 border-dashed rounded-[8px] p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors min-h-[120px] ${
                        replaceCertKeyFile
                          ? 'border-[#15803D] bg-[#F0FDF4]'
                          : 'border-[#D1D5DB] hover:border-[#0F62FE] bg-[#FAFAFA]'
                      }`}
                    >
                      <input
                        id="keyFileUpload"
                        type="file"
                        accept=".key,.pem"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const content = (ev.target?.result as string) || '';
                              setReplaceCertKeyFile({
                                name: file.name,
                                size: `${(file.size / 1024).toFixed(1)} KB`,
                                content,
                              });
                            };
                            reader.readAsText(file);
                          }
                          setReplaceCertValidationError(null);
                          setReplaceCertPreview(null);
                        }}
                        className="hidden"
                      />
                      {replaceCertKeyFile ? (
                        <div className="space-y-1">
                          <CheckCircle2 className="w-5 h-5 text-[#15803D] mx-auto" />
                          <p className="text-[12px] font-semibold text-[#111827] truncate max-w-[180px]">
                            {replaceCertKeyFile.name}
                          </p>
                          <span className="text-[11px] text-[#6B7280]">
                            {replaceCertKeyFile.size} • Click to replace
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <KeyRound className="w-5 h-5 text-[#6B7280] mx-auto" />
                          <p className="text-[12px] font-medium text-[#111827]">
                            Drop private key file or browse
                          </p>
                          <span className="text-[11px] text-[#6B7280]">
                            .key, .pem
                          </span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#374151] mb-1">
                      Certificate (PEM) <span className="text-[#DC2626]">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={replaceCertPemText}
                      onChange={(e) => {
                        setReplaceCertPemText(e.target.value);
                        setReplaceCertValidationError(null);
                        setReplaceCertPreview(null);
                      }}
                      placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDXTCCAkWgAwIBAgIJAJ8e4...&#10;-----END CERTIFICATE-----"
                      className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[12px] font-mono text-[#111827] focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE]"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#374151] mb-1">
                      Private Key <span className="text-[#DC2626]">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={replaceCertKeyText}
                      onChange={(e) => {
                        setReplaceCertKeyText(e.target.value);
                        setReplaceCertValidationError(null);
                        setReplaceCertPreview(null);
                      }}
                      placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvgIBADANBgkqhkiG9w0BA...&#10;-----END PRIVATE KEY-----"
                      className="w-full px-3 py-2 bg-white border border-[#D1D5DB] rounded-[6px] text-[12px] font-mono text-[#111827] focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE]"
                    />
                  </div>

                  {/* Fast testing sample payload buttons */}
                  <div className="flex items-center space-x-2 pt-1 text-[12px]">
                    <button
                      type="button"
                      onClick={() => {
                        setReplaceCertPemText(`-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAJ8e4/kL7r4DMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV\nBAYTAlVTMQswCQYDVQQIDAJDQTEUMBIGA1UECgwLSGV4bm9kZSBJZFAxEzARBgNV\nBAMMCm${replaceCertDomain.domain}0HhcNMjYwMTAxMDAwMDAwWhcNMjcwMTAxMDAwMDAw\nWjBFMQswCQYDVQQGEwJVUzELMAkGA1UECAwCQ0ExFDASBgNVBAoMC0hleG5vZGUg\nSWRQMRMwEQYDVQQDDAp${replaceCertDomain.domain}MIIBIjANBgkqhkiG9w0BAQEFAAOC\nAQ8AMIIBCgKCAQEAyv4Q3Wj9nZv8K3u\n-----END CERTIFICATE-----`);
                        setReplaceCertKeyText(SAMPLE_PEM_KEY);
                        setReplaceCertValidationError(null);
                        setReplaceCertPreview(null);
                      }}
                      className="text-[#0F62FE] hover:underline cursor-pointer"
                    >
                      Fill sample valid payload
                    </button>
                    <span className="text-gray-300">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        setReplaceCertPemText(`-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAJ8e4/kL7r4DMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV\nBAYTAlVTMQswCQYDVQQIDAJDQTEUMBIGA1UECgwLSGV4bm9kZSBJZFAxEzARBgNV\nBAMMCm1pc21hdGNoLWRvbWFpbi5jb20wHhcNMjYwMTAxMDAwMDAwWhcNMjcwMTAxMDAwMDAw\nWjBFMQswCQYDVQQGEwJVUzELMAkGA1UECAwCQ0ExFDASBgNVBAoMC0hleG5vZGUg\nSWRQMRMwEQYDVQQDDAptaXNtYXRjaC1kb21haW4uY29tMIIBIjANBgkqhkiG9w0BAQEFAAOC\nAQ8AMIIBCgKCAQEAyv4Q3Wj9nZv8K3u\n-----END CERTIFICATE-----`);
                        setReplaceCertKeyText(SAMPLE_PEM_KEY);
                        setReplaceCertValidationError(null);
                        setReplaceCertPreview(null);
                      }}
                      className="text-[#DC2626] hover:underline cursor-pointer"
                    >
                      Fill mismatched cert (test failure)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. In-Body Validation Trigger: Secondary button directly below inputs */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleValidateReplaceCertPayload}
                disabled={isReplacingValidating}
                className="px-4 h-[36px] bg-white border border-[#D1D5DB] hover:bg-gray-50 text-[#111827] text-[13px] font-medium rounded-[6px] transition-colors cursor-pointer flex items-center space-x-2 shadow-2xs disabled:opacity-50"
              >
                {isReplacingValidating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0F62FE]" />
                    <span>Validating payload...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#0F62FE]" />
                    <span>Validate</span>
                  </>
                )}
              </button>
            </div>

            {/* Validation Error: Strictly hides preview */}
            {replaceCertValidationError && (
              <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-[8px] flex items-start space-x-2.5 text-[#991B1B] text-[13px] animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">
                  {replaceCertValidationError}
                </div>
              </div>
            )}

            {/* 3. Progressive Certificate Preview: Expanded inline card */}
            {replaceCertPreview && (
              <div className="p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[8px] space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-[#DCFCE7]">
                  <div className="flex items-center space-x-2 text-[#15803D] font-semibold text-[13px]">
                    <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                    <span>Certificate Preview</span>
                  </div>
                  <span className="text-[11px] font-semibold bg-[#DCFCE7] text-[#15803D] px-2 py-0.5 rounded-full">
                    Validation Passed
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                  <div>
                    <span className="text-[11px] font-medium text-[#4B5563] block uppercase tracking-wider">
                      Issuer
                    </span>
                    <span className="font-semibold text-[#111827] block mt-0.5">
                      {replaceCertPreview.issuer}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-[#4B5563] block uppercase tracking-wider">
                      Subject (Domains)
                    </span>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <span className="font-semibold font-mono text-[#111827]">
                        {replaceCertPreview.subjectDomain}
                      </span>
                      <span title="Matches active hostname" className="inline-flex items-center">
                        <Check className="w-3.5 h-3.5 text-[#15803D] stroke-[2.5]" />
                      </span>
                      <span className="text-[11px] font-medium text-[#15803D]">Matches</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-[#4B5563] block uppercase tracking-wider">
                      Expiration Date
                    </span>
                    <span className="font-semibold text-[#111827] block mt-0.5">
                      {replaceCertPreview.expirationDate}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Footer Actions */}
            <div className="mt-6 flex items-center justify-end space-x-3 pt-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => {
                  setIsReplaceCertModalOpen(false);
                  setReplaceCertPreview(null);
                  setReplaceCertValidationError(null);
                }}
                className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReplaceCertificate}
                disabled={!replaceCertPreview || isReplacingValidating}
                className="px-4 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer shadow-xs"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Guard Prompt Modal (Stepper Exit Confirmation) */}
      {isNavGuardPromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs"
          onClick={() => setIsNavGuardPromptOpen(false)}
        >
          <div
            className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-[17px] font-semibold text-[#111827]">
                Unsaved Progress
              </h3>
              <button
                type="button"
                onClick={() => setIsNavGuardPromptOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4">
              <p className="text-[14px] text-[#374151] leading-relaxed">
                You have unsaved changes in your custom domain configuration. How would you like to proceed?
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={handleCloseCustomDomainWizard}
                className="px-4 h-[36px] border border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FCA5A5]/40 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveAndExitWizard}
                className="px-4 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer shadow-xs"
              >
                Save and exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Two-Step Verification Wizard Modal for Allowed Domains */}
      {isAllowedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-xl p-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Constant Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
              <h3 className="text-[18px] font-semibold text-[#111827]">
                Add Allowed Domain
              </h3>
              <button
                type="button"
                onClick={handleCloseAllowedModal}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded hover:bg-gray-100 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Visual Stepper: Visible across all steps */}
            <div className="py-4 border-b border-[#E5E7EB]">
              <div className="flex items-center space-x-3">
                {/* Step 1: Add domain */}
                <div
                  className={`flex items-center space-x-2 ${
                    allowedWizardStep === 1
                      ? 'cursor-default'
                      : 'cursor-pointer hover:opacity-80'
                  }`}
                  onClick={() => {
                    if (allowedWizardStep === 2) {
                      setAllowedWizardStep(1);
                    }
                  }}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold transition-colors ${
                      allowedWizardStep === 1
                        ? 'bg-[#0F62FE] text-white'
                        : 'bg-[#DCFCE7] text-[#15803D]'
                    }`}
                  >
                    {allowedWizardStep > 1 ? '✓' : '1'}
                  </span>
                  <span
                    className={`text-[14px] ${
                      allowedWizardStep === 1
                        ? 'text-[#0F62FE] font-medium'
                        : 'text-[#111827] font-medium'
                    }`}
                  >
                    Add domain
                  </span>
                </div>

                <ChevronRight className="w-4 h-4 text-[#9CA3AF] shrink-0" />

                {/* Step 2: Verify and Activate */}
                <div className="flex items-center space-x-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold transition-colors ${
                      allowedWizardStep === 2
                        ? allowedVerifyStatus === 'verified'
                          ? 'bg-[#15803D] text-white'
                          : 'bg-[#0F62FE] text-white'
                        : 'border border-[#D1D5DB] text-[#9CA3AF]'
                    }`}
                  >
                    {allowedVerifyStatus === 'verified' && allowedWizardStep === 2 ? '✓' : '2'}
                  </span>
                  <span
                    className={`text-[14px] ${
                      allowedWizardStep === 2
                        ? 'text-[#0F62FE] font-medium'
                        : 'text-[#6B7280]'
                    }`}
                  >
                    Verify and Activate
                  </span>
                </div>
              </div>
            </div>

            {/* PHASE 1: STEP 1 - ADD DOMAIN */}
            {allowedWizardStep === 1 && (
              <form onSubmit={handleAllowedStep1Next} className="pt-5 space-y-4" noValidate>
                <div>
                  <label htmlFor="newAllowedDomain" className="block text-[13px] font-medium text-[#374151] mb-1.5">
                    Domain Name <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    ref={newAllowedDomainInputRef}
                    id="newAllowedDomain"
                    type="text"
                    placeholder="e.g., domain.example.com"
                    value={newAllowedDomainInput}
                    onChange={(e) => {
                      setNewAllowedDomainInput(e.target.value);
                      if (allowedStep1Error) setAllowedStep1Error(null);
                    }}
                    onFocus={() => {
                      if (allowedStep1Error) setAllowedStep1Error(null);
                    }}
                    onBlur={handleAllowedInputBlur}
                    autoFocus
                    className={`w-full h-[38px] px-3 bg-white border rounded-[6px] text-[14px] text-[#111827] focus:outline-none transition-colors ${
                      allowedStep1Error
                        ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626]'
                        : 'border-[#D1D5DB] focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE]'
                    }`}
                  />
                  {allowedStep1Error && (
                    <p className="mt-1.5 text-[12px] font-medium text-[#DC2626] flex items-center space-x-1 animate-in fade-in duration-100">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#DC2626]" />
                      <span>{allowedStep1Error}</span>
                    </p>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-4 flex items-center justify-end space-x-3 border-t border-[#E5E7EB]">
                  <button
                    type="button"
                    onClick={handleCloseAllowedModal}
                    className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isGeneratingToken}
                    className="px-5 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-xs"
                  >
                    {isGeneratingToken && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Next</span>
                  </button>
                </div>
              </form>
            )}

            {/* PHASE 2 & 3: STEP 2 - VERIFY AND ACTIVATE */}
            {allowedWizardStep === 2 && (
              <div className="pt-5 space-y-4">
                {/* Radio button group for selecting preferred verification method */}
                <div>
                  <label className="block text-[13px] font-medium text-[#374151] mb-2">
                    Verification Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex items-center space-x-2.5 p-3 rounded-[6px] border cursor-pointer transition-all ${
                        allowedVerifyMethod === 'dns'
                          ? 'border-[#0F62FE] bg-[#EFF6FF]/40 text-[#111827]'
                          : 'border-[#E5E7EB] bg-white text-[#374151] hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="verificationMethod"
                        value="dns"
                        checked={allowedVerifyMethod === 'dns'}
                        onChange={() => {
                          setAllowedVerifyMethod('dns');
                          setAllowedVerifyError(null);
                        }}
                        className="w-4 h-4 text-[#0F62FE] focus:ring-[#0F62FE]"
                      />
                      <span className="text-[13px] font-medium">DNS (TXT Record)</span>
                    </label>

                    <label
                      className={`flex items-center space-x-2.5 p-3 rounded-[6px] border cursor-pointer transition-all ${
                        allowedVerifyMethod === 'http'
                          ? 'border-[#0F62FE] bg-[#EFF6FF]/40 text-[#111827]'
                          : 'border-[#E5E7EB] bg-white text-[#374151] hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="verificationMethod"
                        value="http"
                        checked={allowedVerifyMethod === 'http'}
                        onChange={() => {
                          setAllowedVerifyMethod('http');
                          setAllowedVerifyError(null);
                        }}
                        className="w-4 h-4 text-[#0F62FE] focus:ring-[#0F62FE]"
                      />
                      <span className="text-[13px] font-medium">HTTP File Upload</span>
                    </label>
                  </div>
                </div>

                {/* Conditional Rendering: If TXT Record is selected */}
                {allowedVerifyMethod === 'dns' && (
                  <div className="space-y-3 p-3.5 bg-[#F9FAFB] rounded-[6px] border border-[#E5E7EB]">
                    <div>
                      <span className="text-[#4B5563] block text-[11px] font-medium mb-1">
                        Record Type
                      </span>
                      <div className="flex items-center justify-between font-mono bg-white px-2.5 py-1.5 rounded border border-[#D1D5DB] text-[#111827] text-[13px]">
                        <span>TXT</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('TXT', 'Record Type')}
                          className="text-[#0F62FE] hover:text-[#0050E6] p-0.5 cursor-pointer ml-2"
                          title="Copy Record Type"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[#4B5563] block text-[11px] font-medium mb-1">
                        Host / Name
                      </span>
                      <div className="flex items-center justify-between font-mono bg-white px-2.5 py-1.5 rounded border border-[#D1D5DB] text-[#111827] text-[13px]">
                        <span>@</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard('@', 'Host / Name')}
                          className="text-[#0F62FE] hover:text-[#0050E6] p-0.5 cursor-pointer ml-2"
                          title="Copy Host / Name"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[#4B5563] block text-[11px] font-medium mb-1">
                        Value
                      </span>
                      <div className="flex items-center justify-between font-mono bg-white px-2.5 py-1.5 rounded border border-[#D1D5DB] text-[#111827] text-[13px] break-all">
                        <span className="truncate mr-2">{allowedGeneratedToken}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(allowedGeneratedToken, 'Value')}
                          className="text-[#0F62FE] hover:text-[#0050E6] p-0.5 cursor-pointer shrink-0"
                          title="Copy Value"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Conditional Rendering: If HTTP File Upload is selected */}
                {allowedVerifyMethod === 'http' && (
                  <div className="space-y-3 p-3.5 bg-[#F9FAFB] rounded-[6px] border border-[#E5E7EB]">
                    <div>
                      <span className="text-[#4B5563] block text-[11px] font-medium mb-1">
                        File Path
                      </span>
                      <div className="flex items-center justify-between font-mono bg-white px-2.5 py-1.5 rounded border border-[#D1D5DB] text-[#111827] text-[12px] break-all">
                        <span className="truncate mr-2">
                          http://{newAllowedDomainInput || 'domain.example.com'}/.well-known/hexnode-verification.txt
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              `http://${newAllowedDomainInput || 'domain.example.com'}/.well-known/hexnode-verification.txt`,
                              'File Path'
                            )
                          }
                          className="text-[#0F62FE] hover:text-[#0050E6] p-0.5 cursor-pointer shrink-0"
                          title="Copy File Path"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[#4B5563] block text-[11px] font-medium mb-1">
                        File Content
                      </span>
                      <div className="flex items-center justify-between font-mono bg-white px-2.5 py-1.5 rounded border border-[#D1D5DB] text-[#111827] text-[13px] break-all">
                        <span className="truncate mr-2">{allowedGeneratedToken}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(allowedGeneratedToken, 'File Content')}
                          className="text-[#0F62FE] hover:text-[#0050E6] p-0.5 cursor-pointer shrink-0"
                          title="Copy File Content"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Verification Trigger Action directly below conditionally rendered fields */}
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    type="button"
                    onClick={handleAllowedVerifyAction}
                    disabled={allowedVerifyStatus === 'checking' || allowedVerifyStatus === 'verified'}
                    className="h-[36px] px-4 bg-[#0F62FE] hover:bg-[#0050E6] text-white text-[13px] font-medium rounded-[6px] transition-colors flex items-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                  >
                    {allowedVerifyStatus === 'checking' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Validating...</span>
                      </>
                    ) : allowedVerifyStatus === 'verified' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>Verified</span>
                      </>
                    ) : (
                      <span>Verify</span>
                    )}
                  </button>

                  {allowedVerifyStatus === 'verified' && (
                    <span className="text-[13px] font-medium text-[#15803D] flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                      <span>Domain ownership verified</span>
                    </span>
                  )}
                </div>

                {/* Inline Error Banner: Phase 3 */}
                {allowedVerifyError && (
                  <div className="p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-[6px] text-[#991B1B] text-[13px] flex items-start space-x-2.5 animate-in fade-in duration-150">
                    <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                    <span className="font-medium">{allowedVerifyError}</span>
                  </div>
                )}

                {/* Success State Banner: Phase 3 */}
                {allowedVerifyStatus === 'verified' && (
                  <div className="p-3 bg-[#DCFCE7] border border-[#86EFAC] rounded-[6px] text-[#15803D] text-[13px] flex items-center justify-between animate-in fade-in duration-150">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
                      <span className="font-medium">Verification successful. Click Finish to complete domain activation.</span>
                    </div>
                    <span className="text-[11px] font-semibold text-[#15803D] bg-white px-2 py-0.5 rounded-full border border-[#86EFAC]">
                      Active
                    </span>
                  </div>
                )}

                {/* Footer Actions: Cancel, Verify later, Finish */}
                <div className="pt-4 flex items-center justify-between border-t border-[#E5E7EB]">
                  <button
                    type="button"
                    onClick={handleCloseAllowedModal}
                    className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={handleAllowedVerifyLater}
                      className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      Verify later
                    </button>
                    <button
                      type="button"
                      onClick={handleAllowedFinish}
                      disabled={allowedVerifyStatus !== 'verified'}
                      className="px-5 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                    >
                      Finish
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inherit Passkeys Modal with Dynamic Multi-Select Row Structure */}
      {isAddOriginModalOpen && selectedDomainDetails && (() => {
        const candidatePool = getCandidateDomainsPool(selectedDomainDetails);
        const allSelectedDomains = inheritDomainRows.map((r) => r.domain).filter(Boolean);
        const hasAvailableDomainsRemaining = candidatePool.some(
          (d) => !allSelectedDomains.includes(d)
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
            <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB]">
                <h3 className="text-[17px] font-semibold text-[#111827]">
                  Inherit Passkeys
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddOriginModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveAddOrigin} className="mt-4 space-y-5">
                {/* Dynamic Multi-Select List Area */}
                <div>
                  <label className="block text-[13px] font-medium text-[#374151] mb-2">
                    Select domains to inherit passkeys from <span className="text-[#DC2626]">*</span>
                  </label>

                  {candidatePool.length === 0 ? (
                    <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[6px] text-[13px] text-[#6B7280]">
                      No additional verified domains available in this tenant.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {inheritDomainRows.map((row, index) => {
                        const selectedOtherDomains = inheritDomainRows
                          .filter((_, idx) => idx !== index)
                          .map((r) => r.domain)
                          .filter(Boolean);

                        const availableOptions = candidatePool.filter(
                          (d) => !selectedOtherDomains.includes(d)
                        );

                        const isOnlyRow = inheritDomainRows.length === 1;

                        return (
                          <div key={row.id} className="flex items-center space-x-2">
                            <div className="flex-1">
                              <select
                                value={row.domain}
                                onChange={(e) => handleRowDomainChange(index, e.target.value)}
                                className="w-full h-[38px] px-3 bg-white border border-[#D1D5DB] rounded-[6px] text-[14px] text-[#111827] focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE]"
                                required
                              >
                                {availableOptions.length === 0 ? (
                                  <option value="">No options available</option>
                                ) : (
                                  availableOptions.map((d) => (
                                    <option key={d} value={d}>
                                      {d}
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>

                            {/* Delete (trash) icon: shown when multiple rows exist */}
                            {!isOnlyRow && (
                              <button
                                type="button"
                                onClick={() => handleRemoveInheritRow(row.id)}
                                className="w-[38px] h-[38px] flex items-center justify-center rounded-[6px] border border-[#E5E7EB] hover:border-[#FCA5A5] hover:bg-[#FEE2E2]/40 text-[#6B7280] hover:text-[#DC2626] transition-colors cursor-pointer shrink-0"
                                title="Delete row"
                                aria-label="Delete domain row"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Plus (+) icon: rendered only if unselected domains are available */}
                            {hasAvailableDomainsRemaining && (
                              <button
                                type="button"
                                onClick={() => handleAddInheritRow(index)}
                                className="w-[38px] h-[38px] flex items-center justify-center rounded-[6px] border border-[#0F62FE] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#0F62FE] transition-colors cursor-pointer shrink-0"
                                title="Add domain row"
                                aria-label="Add domain row"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Static Modal Content: Migration Toggle directly below dynamic list area */}
                <div className="pt-3 border-t border-[#E5E7EB]">
                  <div className="flex items-start justify-between">
                    <div className="pr-4">
                      <label className="text-[14px] font-medium text-[#111827] block">
                        Enforce Passkey Migration
                      </label>
                      <p className="text-[12px] text-[#6B7280] mt-1 leading-relaxed">
                        When users log in to a new primary domain using a passkey bridged from this domain, automatically prompt them to register a new native passkey.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enforcePasskeyMigrationToggle}
                      onClick={() => setEnforcePasskeyMigrationToggle(!enforcePasskeyMigrationToggle)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-1 ${
                        enforcePasskeyMigrationToggle ? 'bg-[#0F62FE]' : 'bg-[#D1D5DB]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          enforcePasskeyMigrationToggle ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Footer Actions: Cancel (secondary) and Save (primary) buttons */}
                <div className="mt-6 flex items-center justify-end space-x-3 pt-3 border-t border-[#E5E7EB]">
                  <button
                    type="button"
                    onClick={() => setIsAddOriginModalOpen(false)}
                    className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inheritDomainRows.length === 0 || inheritDomainRows.every((r) => !r.domain)}
                    className="px-4 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Edit Domain Modal for Allowed Domains */}
      {isEditAllowedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h3 className="text-[16px] font-semibold text-[#111827]">
                Edit Domain
              </h3>
              <button
                type="button"
                onClick={() => setIsEditAllowedModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditAllowedDomain} className="mt-4 space-y-4">
              <div>
                <label htmlFor="editAllowedDomain" className="block text-[13px] font-medium text-[#374151] mb-1.5">
                  Domain Name
                </label>
                <input
                  id="editAllowedDomain"
                  type="text"
                  value={editAllowedDomainInput}
                  onChange={(e) => setEditAllowedDomainInput(e.target.value)}
                  autoFocus
                  placeholder="e.g., domain.example.com"
                  className="w-full h-[38px] px-3 bg-white border border-[#D1D5DB] rounded-[6px] text-[14px] text-[#111827] focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE]"
                />
              </div>

              <div className="mt-6 flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditAllowedModalOpen(false)}
                  className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Domain Modal for Allowed Domains */}
      {isRemoveAllowedModalOpen && removingAllowedDomain && (() => {
        const userCount = typeof removingAllowedDomain.users === 'number'
          ? removingAllowedDomain.users
          : parseInt(String(removingAllowedDomain.users).replace(/,/g, ''), 10) || 0;
        const isConfirmDisabled =
          removeAllowedConfirmInput.trim().toLowerCase() !== removingAllowedDomain.domain.trim().toLowerCase();

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB]">
                <h3 className="text-[17px] font-semibold text-[#111827]">
                  Remove {removingAllowedDomain.domain}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsRemoveAllowedModalOpen(false);
                    setRemoveAllowedConfirmInput('');
                  }}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <p className="text-[14px] text-[#374151] leading-relaxed">
                  You are about to remove this allowed domain. New users can no longer be added using this domain.
                </p>

                {/* Dynamic Alert (If Users > 0): info-visibility warning banner */}
                {userCount > 0 && (
                  <div className="p-3.5 rounded-[8px] bg-[#EFF6FF] border border-[#BFDBFE] flex items-start space-x-3 text-[13px] text-[#1E40AF]">
                    <Info className="w-5 h-5 text-[#1D4ED8] shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      This domain currently has <span className="font-semibold">{userCount.toLocaleString()}</span> active users. If you proceed, these users will be permanently moved to the Hexnode Directory OU.
                    </p>
                  </div>
                )}

                <div>
                  <label htmlFor="removeAllowedConfirmDomainInput" className="block text-[13px] font-medium text-[#374151] mb-1.5">
                    Enter the domain name to confirm
                  </label>
                  <input
                    id="removeAllowedConfirmDomainInput"
                    type="text"
                    value={removeAllowedConfirmInput}
                    onChange={(e) => setRemoveAllowedConfirmInput(e.target.value)}
                    placeholder={removingAllowedDomain.domain}
                    className="w-full h-[38px] px-3 bg-white border border-[#D1D5DB] rounded-[6px] text-[14px] text-[#111827] focus:outline-none focus:border-[#0F62FE] focus:ring-1 focus:ring-[#0F62FE]"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end space-x-3 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => {
                    setIsRemoveAllowedModalOpen(false);
                    setRemoveAllowedConfirmInput('');
                  }}
                  className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemoveAllowedDomain}
                  disabled={isConfirmDisabled}
                  className="px-4 h-[36px] bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Disable Domain Modal for Allowed Domains */}
      {isDisableAllowedModalOpen && disablingAllowedDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB]">
              <h3 className="text-[17px] font-semibold text-[#111827]">
                Disable {disablingAllowedDomain.domain}
              </h3>
              <button
                type="button"
                onClick={() => setIsDisableAllowedModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4">
              <ul className="list-disc pl-5 space-y-2 text-[14px] text-[#374151] leading-relaxed">
                <li>You will no longer be able to add new users with this domain.</li>
                <li>Existing users will remain active and unaffected.</li>
              </ul>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-3 pt-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setIsDisableAllowedModalOpen(false)}
                className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisableAllowedDomain}
                className="px-4 h-[36px] bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer shadow-xs"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate Domain Modal for Allowed Domains */}
      {isReactivateAllowedModalOpen && reactivatingAllowedDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB]">
              <h3 className="text-[17px] font-semibold text-[#111827]">
                Reactivate {reactivatingAllowedDomain.domain}
              </h3>
              <button
                type="button"
                onClick={() => setIsReactivateAllowedModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4">
              <p className="text-[14px] text-[#374151] leading-relaxed">
                Reactivating this domain will allow new users to be added with this domain.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-3 pt-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setIsReactivateAllowedModalOpen(false)}
                className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReactivateAllowedDomain}
                className="px-4 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer shadow-xs"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop for table dropdown menus */}
      {openActionMenuId !== null && (
        <div
          className="fixed inset-0 z-30 bg-transparent"
          onClick={() => setOpenActionMenuId(null)}
        />
      )}

      {/* Global Confirmation Modal with Dynamic Hostname Injection & Conditional Safety Guards */}
      {confirmationModal.isOpen && (() => {
        const targetCustomDomain = confirmationModal.type === 'custom'
          ? customDomains.find((d) => d.id === confirmationModal.itemId) || null
          : null;
        const hasTrustBridge = Boolean(
          targetCustomDomain &&
          targetCustomDomain.allowedOrigins &&
          targetCustomDomain.allowedOrigins.length > 0
        );

        // For Standard Custom Domain Remove Action: strict text-match confirmation against exact hostname
        const isDomainMatch = removeConfirmInput.trim() === confirmationModal.domainName.trim();
        const isRemoveDisabled =
          confirmationModal.type === 'custom' &&
          confirmationModal.action === 'Remove' &&
          !isDomainMatch;

        const isSetPrimaryDisabled =
          confirmationModal.type === 'custom' &&
          confirmationModal.action === 'Set as primary' &&
          !isSetPrimaryAttestationChecked;

        const activePrimaryCustom = customDomains.find((d) => d.isPrimary);
        const activePrimaryDomain = activePrimaryCustom ? activePrimaryCustom.domain : defaultHexnodeUrl;

        const passkeyUsersN = targetCustomDomain?.passkeyUsersCount ?? (hasTrustBridge ? 142 : 0);
        const passkeyUsersK = targetCustomDomain?.passkeyNoFallbackCount ?? (passkeyUsersN > 0 ? 18 : 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
            <div className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB]">
                <h3 className="text-[17px] font-semibold text-[#111827]">
                  {confirmationModal.action === 'Set as primary' && 'Set Primary Domain'}
                  {confirmationModal.action === 'Disable' && `Disable ${confirmationModal.domainName}`}
                  {confirmationModal.action === 'Verify' && 'Verify Custom Domain'}
                  {confirmationModal.action === 'Remove' && `Remove ${confirmationModal.domainName}`}
                  {confirmationModal.action === 'Activate' && 'Activate Custom Domain'}
                  {confirmationModal.action === 'Reactivate' && 'Reactivate Custom Domain'}
                  {confirmationModal.action === 'Complete setup' && 'Complete Setup for Custom Domain'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
                    setRemoveConfirmInput('');
                    setIsSetPrimaryAttestationChecked(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {confirmationModal.type === 'custom' && (
                  <>
                    {confirmationModal.action === 'Set as primary' && (
                      <div className="space-y-3">
                        <p className="text-[14px] text-[#374151] leading-relaxed">
                          Are you sure you want to set <span className="font-semibold text-[#111827] font-mono">[{confirmationModal.domainName}]</span> as the primary domain?
                        </p>
                        <ul className="list-disc pl-5 space-y-2 text-[13px] text-[#374151] leading-relaxed">
                          <li>
                            OIDC issuers, SAML entity IDs, and federation callbacks do not change automatically, requiring you to manually update your external integrations.
                          </li>
                          <li>
                            Users will need to authenticate again to establish a session when visiting the new hostname.
                          </li>
                          <li>
                            Changing the primary domain may require users to re-enroll passkeys on the new hostname, but you can enable passkey migration from other domains within the domain settings.
                          </li>
                        </ul>

                        {/* Attestation Checkbox for Custom Domains */}
                        {confirmationModal.type === 'custom' && (
                          <div className="pt-3 border-t border-[#E5E7EB]">
                            <label className="flex items-center justify-between cursor-pointer select-none">
                              <span className="text-[14px] text-[#374151]">
                                I confirm a successful test sign-in.
                              </span>
                              <input
                                type="checkbox"
                                checked={isSetPrimaryAttestationChecked}
                                onChange={(e) => setIsSetPrimaryAttestationChecked(e.target.checked)}
                                className="w-4 h-4 rounded border-[#D1D5DB] text-[#0F62FE] focus:ring-[#0F62FE] cursor-pointer shrink-0"
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                    {confirmationModal.action === 'Disable' && (
                      <div className="space-y-4">
                        {/* Base Text */}
                        <div className="space-y-2.5 text-[14px] text-[#374151] leading-relaxed">
                          <p>
                            • Disabling this domain will immediately prevent users from authenticating through it.
                          </p>
                          <p>
                            • Any SAML/OIDC integrations, Single Sign-On (SSO) applications, or Service Providers (SPs) configured with this URL will fail until the domain is reactivated or the endpoints are updated.
                          </p>
                        </div>

                        {/* Condition A (Active WebAuthn Bridge): Render warning only (no checkbox required) */}
                        {hasTrustBridge && (
                          <div className="p-3.5 bg-[#FEF3C7] border border-[#FDE68A] rounded-[8px] text-[13px] text-[#92400E] flex items-start space-x-2.5">
                            <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                              <span className="font-semibold text-[#B45309]">Passkey Trust Bridge Offline: </span>
                              <span>Disabling this domain pauses its WebAuthn Trust Bridge. Users relying on this domain for cross-origin passkey authentication will be locked out until it is reactivated.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {confirmationModal.action === 'Remove' && (
                      <div className="space-y-4">
                        {/* Simple points without any boxing or color separations */}
                        <div className="space-y-2.5 text-[14px] text-[#374151] leading-relaxed">
                          <p>
                            • Removing this domain will permanently delete its configuration and immediately drop all active sessions routed through it. This action cannot be undone.
                          </p>
                          <p>
                            • Integrations, Service Providers (SPs), and applications configured with this custom domain will permanently break. You must manually update their endpoints with your primary domain details to ensure uninterrupted access.
                          </p>
                        </div>

                        {/* Only Passkey impact inside yellow info box */}
                        {(hasTrustBridge || passkeyUsersN > 0) && (
                          <div className="p-3.5 bg-[#FEF3C7] border border-[#FDE68A] rounded-[8px] text-[13px] text-[#92400E] leading-relaxed flex items-start space-x-2.5">
                            <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                            <div>
                              <p>
                                {passkeyUsersN} users still rely on passkeys registered on this domain. These will stop working after removal. Before removing, make sure these users have registered a passkey on {activePrimaryDomain}.
                                {passkeyUsersK > 0 && (
                                  <> {passkeyUsersK} of them have no other sign-in method and will be locked out until an admin resets their access.</>
                                )}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Confirmation Action */}
                        <div className="space-y-1.5 pt-1">
                          <label htmlFor="confirmDomainInput" className="block text-[13px] font-medium text-[#374151]">
                            Enter the domain name to confirm:
                          </label>
                          <input
                            id="confirmDomainInput"
                            type="text"
                            value={removeConfirmInput}
                            onChange={(e) => setRemoveConfirmInput(e.target.value)}
                            placeholder=""
                            className="w-full h-[38px] px-3 bg-white border border-[#D1D5DB] rounded-[6px] text-[14px] text-[#111827] focus:outline-none focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] transition-colors"
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </div>
                      </div>
                    )}
                    {confirmationModal.action === 'Verify' && (
                      <p className="text-[14px] text-[#374151] leading-relaxed">
                        This will initiate a new DNS verification check for <span className="font-semibold text-[#111827] font-mono">[{confirmationModal.domainName}]</span>. Please ensure that your CNAME or TXT records are correctly configured in your DNS provider before proceeding.
                      </p>
                    )}
                    {(confirmationModal.action === 'Activate' || confirmationModal.action === 'Reactivate') && (
                      <p className="text-[14px] text-[#374151] leading-relaxed">
                        The domain <span className="font-semibold text-[#111827] font-mono">[{confirmationModal.domainName}]</span> must undergo a verification recheck to ensure ownership and certificate readiness before reactivation.
                      </p>
                    )}
                    {confirmationModal.action === 'Complete setup' && (
                      <p className="text-[14px] text-[#374151] leading-relaxed">
                        Are you sure you want to complete setup for <span className="font-semibold text-[#111827] font-mono">[{confirmationModal.domainName}]</span>? This will verify DNS records and activate the custom domain.
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end space-x-3 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
                    setRemoveConfirmInput('');
                  }}
                  className="px-4 h-[36px] border border-[#D1D5DB] rounded-[6px] text-[14px] font-medium text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  disabled={confirmationModal.action === 'Remove' && isRemoveDisabled}
                  className={`px-4 h-[36px] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer ${
                    confirmationModal.action === 'Remove' || confirmationModal.action === 'Disable'
                      ? 'bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-40 disabled:cursor-not-allowed'
                      : 'bg-[#0F62FE] hover:bg-[#0050E6]'
                  }`}
                >
                  {confirmationModal.action === 'Set as primary' && 'Set as primary'}
                  {confirmationModal.action === 'Disable' && 'Disable domain'}
                  {confirmationModal.action === 'Verify' && 'Verify'}
                  {confirmationModal.action === 'Remove' && 'Remove domain'}
                  {confirmationModal.action === 'Activate' && 'Activate Domain'}
                  {confirmationModal.action === 'Reactivate' && 'Reactivate'}
                  {confirmationModal.action === 'Complete setup' && 'Complete Setup'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Passkey Migration Status Modal */}
      {isMigrationStatusModalOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-xs"
          onClick={() => setIsMigrationStatusModalOpen(false)}
        >
          <div
            className="bg-white rounded-[12px] shadow-2xl border border-[#E5E7EB] w-full max-w-lg p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E7EB]">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-[#0F62FE]" />
                <h3 className="text-[17px] font-semibold text-[#111827]">
                  Passkey Migration Status
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMigrationStatusModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[14px] text-[#374151] leading-relaxed">
              Real-time synchronization status of user credentials bound to{' '}
              <span className="font-semibold text-[#111827] font-mono">[{confirmationModal.domainName}]</span> moving to primary domain{' '}
              <span className="font-semibold text-[#111827] font-mono">[{customDomains.find((d) => d.isPrimary)?.domain || defaultHexnodeUrl}]</span>.
            </p>

            {(() => {
              const targetDomain = customDomains.find((d) => d.id === confirmationModal.itemId);
              const n = targetDomain?.passkeyUsersCount ?? 142;
              const k = targetDomain?.passkeyNoFallbackCount ?? 18;
              const migrated = Math.max(0, n - k);
              const percentage = n > 0 ? Math.round((migrated / n) * 100) : 100;

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] text-center">
                      <span className="text-[12px] text-[#6B7280] block">Total Relying</span>
                      <span className="text-[18px] font-semibold text-[#111827]">{n}</span>
                    </div>
                    <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[8px] text-center">
                      <span className="text-[12px] text-[#15803D] block">Migrated</span>
                      <span className="text-[18px] font-semibold text-[#15803D]">{migrated}</span>
                    </div>
                    <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-[8px] text-center">
                      <span className="text-[12px] text-[#B91C1C] block">No Fallback</span>
                      <span className="text-[18px] font-semibold text-[#B91C1C]">{k}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[12px] text-[#4B5563]">
                      <span>Migration Completion</span>
                      <span className="font-medium text-[#111827]">{percentage}%</span>
                    </div>
                    <div className="w-full bg-[#E5E7EB] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0F62FE] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[8px] text-[13px] text-[#1D4ED8] flex items-start space-x-2">
                    <Info className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Users with fallback credentials can sign in on the primary domain and register a native passkey. The remaining {k} users have no fallback credentials and will require an administrator password reset if the domain is removed.
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="pt-3 flex items-center justify-end border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setIsMigrationStatusModalOpen(false)}
                className="px-4 h-[36px] bg-[#0F62FE] hover:bg-[#0050E6] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-[#E5E7EB] bg-white px-6 flex items-center justify-between sticky top-0 z-30 select-none">
        <div className="flex items-center space-x-10 h-full">
          <div className="flex items-baseline space-x-1 cursor-pointer">
            <span className="text-[21px] font-bold tracking-tight text-black font-sans leading-none">
              hexnode
            </span>
            <span className="text-[21px] font-bold tracking-tight text-black font-sans leading-none">
              idp
            </span>
          </div>

          <nav className="flex space-x-8 h-full">
            {navItems.map((item) => {
              const isActive = activeNav === item;
              return (
                <button
                  key={item}
                  onClick={() => setActiveNav(item)}
                  className={`relative flex items-center h-full text-[14px] font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[#0F62FE]'
                      : 'text-[#374151] hover:text-[#111827]'
                  }`}
                >
                  {item}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#0F62FE] rounded-t-sm" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-3.5 text-[#4B5563]">
          {/* Export as HTML Button */}
          <button
            type="button"
            onClick={handleExportAppHtml}
            className="h-[32px] px-3 bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-[#0F62FE] hover:text-[#0050E6] text-[13px] font-medium rounded-[6px] transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
            title="Export the entire product and flows as a standalone HTML file"
          >
            <Download className="w-3.5 h-3.5 text-[#0F62FE]" />
            <span>Export as HTML</span>
          </button>

          <button
            type="button"
            aria-label="Search"
            className="hover:text-[#111827] transition-colors p-1 rounded hover:bg-gray-100 cursor-pointer"
          >
            <Search className="w-4 h-4 stroke-[1.75]" />
          </button>
          <button
            type="button"
            aria-label="Notifications"
            className="hover:text-[#111827] transition-colors p-1 rounded hover:bg-gray-100 cursor-pointer"
          >
            <Bell className="w-4 h-4 stroke-[1.75]" />
          </button>
          <button
            type="button"
            aria-label="Help"
            className="hover:text-[#111827] transition-colors p-1 rounded hover:bg-gray-100 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 stroke-[1.75]" />
          </button>
          <button
            type="button"
            aria-label="User profile"
            className="w-7 h-7 rounded-full bg-[#111827] text-white flex items-center justify-center text-[12px] font-semibold hover:bg-gray-800 transition-colors cursor-pointer"
          >
            A
          </button>
        </div>
      </header>

      {/* Main Container / Full-Screen Stepper Page View */}
      {isCustomDomainWizardOpen ? (
        <main className="flex-1 w-full min-h-[calc(100vh-3.5rem)] bg-[#F9FAFB] flex flex-col">
          {renderCustomDomainWizard()}
        </main>
      ) : (
        <div className="flex-1 flex max-w-[1440px] w-full mx-auto px-6 py-6 gap-8">
          {/* Left Sidebar */}
          <aside className="w-56 shrink-0 border-r border-[#E5E7EB] pr-6 select-none">
            <div className="space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSidebar === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSidebar(item.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-[6px] text-[14px] transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#EFF6FF] text-[#0F62FE] font-medium'
                        : 'text-[#374151] hover:bg-gray-50 hover:text-[#111827] font-normal'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#0F62FE]' : 'text-[#6B7280]'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            {activeSidebar === 'Domains' ? (
              renderDomainsSection(true)
            ) : (
              <div>
                <h2 className="text-[20px] font-semibold text-[#111827] tracking-tight mb-4">
                  {activeSidebar} Settings
                </h2>
                <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-6 text-[14px] text-[#6B7280]">
                  Configuration panel for {activeSidebar}.
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

export default App;

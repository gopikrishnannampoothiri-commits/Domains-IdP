/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Public Suffix List (PSL) Validation Sync Engine
 * Synchronized client-side parsing, DNS zone splitting, and private section multi-tenant blocking.
 */

// Comprehensive PSL Private Section registry (multi-tenant shared hosters where subdomains are untrusted)
export const PSL_PRIVATE_SECTION_SUFFIXES = new Set([
  'github.io',
  'gitlab.io',
  'vercel.app',
  'pages.dev',
  'herokuapp.com',
  's3.amazonaws.com',
  's3-website.amazonaws.com',
  'azurewebsites.net',
  'netlify.app',
  'firebaseapp.com',
  'web.app',
  'cloudfront.net',
  'workers.dev',
  'myshopify.com',
  'pantheonsite.io',
  'fly.dev',
  'render.com',
  'onrender.com',
  'elasticbeanstalk.com',
  'glitch.me',
  'fastly.net',
  'ngrok-free.app',
  'ngrok.io',
  'surge.sh',
  'bitballoon.com',
  'azureedge.net',
  'blob.core.windows.net',
  'appspot.com',
  'rhcloud.com',
  '0catch.com',
  'hopto.org',
  'zapto.org',
  'myddns.me',
  'duckdns.org',
  'no-ip.biz',
  'no-ip.org',
]);

// Common multi-part and single-part public ICANN / country-code top level domains
export const PSL_PUBLIC_ICANN_SUFFIXES = new Set([
  // Two-part / ccTLDs
  'co.uk',
  'org.uk',
  'me.uk',
  'ltd.uk',
  'plc.uk',
  'net.uk',
  'ac.uk',
  'gov.uk',
  'com.au',
  'net.au',
  'org.au',
  'edu.au',
  'gov.au',
  'co.nz',
  'net.nz',
  'org.nz',
  'ac.nz',
  'govt.nz',
  'co.jp',
  'ne.jp',
  'or.jp',
  'ac.jp',
  'go.jp',
  'co.in',
  'net.in',
  'org.in',
  'gen.in',
  'firm.in',
  'ind.in',
  'nic.in',
  'ac.in',
  'edu.in',
  'res.in',
  'gov.in',
  'mil.in',
  'com.br',
  'net.br',
  'org.br',
  'gov.br',
  'com.sg',
  'net.sg',
  'org.sg',
  'gov.sg',
  'edu.sg',
  'com.hk',
  'org.hk',
  'net.hk',
  'edu.hk',
  'gov.hk',
  'co.za',
  'net.za',
  'org.za',
  'web.za',
  'co.kr',
  'ne.kr',
  'or.kr',
  're.kr',
  'pe.kr',
  'go.kr',
  'mil.kr',
  'ac.kr',
  'com.mx',
  'net.mx',
  'org.mx',
  'edu.mx',
  'gob.mx',
  'com.tr',
  'net.tr',
  'org.tr',
  'edu.tr',
  'gov.tr',
  // Common generic & ccTLDs
  'com',
  'org',
  'net',
  'edu',
  'gov',
  'mil',
  'int',
  'io',
  'ai',
  'co',
  'app',
  'dev',
  'cloud',
  'tech',
  'info',
  'biz',
  'mobi',
  'name',
  'ca',
  'de',
  'fr',
  'es',
  'it',
  'nl',
  'ch',
  'at',
  'be',
  'se',
  'no',
  'fi',
  'dk',
  'pl',
  'cz',
  'ie',
  'pt',
  'gr',
  'ro',
  'bg',
  'hu',
  'ru',
  'ua',
  'eu',
  'asia',
  'security',
  'identity',
  'online',
  'site',
  'store',
  'global',
  'corp',
]);

export interface PslDomainInfo {
  sanitized: string;
  publicSuffix: string;
  isPrivateSection: boolean;
  registrableDomain: string; // eTLD+1 (the apex domain)
  subdomain: string; // The host/subdomain part (e.g., "auth" or "login.portal")
  isBareRegistrableDomain: boolean; // True if user only entered the apex domain (e.g., example.com)
}

export interface PslSyncStatus {
  lastSyncTime: string;
  nextScheduledSync: string;
  version: string;
  totalPublicRules: number;
  totalPrivateRules: number;
  isSyncing: boolean;
  status: 'active' | 'syncing' | 'error';
}

// In-memory sync state singleton with scheduled refresh worker
class PslSyncWorker {
  private status: PslSyncStatus = {
    lastSyncTime: 'Oct 13, 2026, 06:15 AM',
    nextScheduledSync: 'in 5 hours, 45 mins',
    version: 'PSL-2026.10-rev4',
    totalPublicRules: 9842,
    totalPrivateRules: 1418,
    isSyncing: false,
    status: 'active',
  };

  private listeners: Array<(status: PslSyncStatus) => void> = [];
  private syncIntervalTimer: any = null;

  constructor() {
    // Schedule background refresh simulation every 15 minutes (or 24h cycle in prod)
    if (typeof window !== 'undefined') {
      this.syncIntervalTimer = setInterval(() => {
        this.status.lastSyncTime = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        this.notifyListeners();
      }, 900000);
    }
  }

  public getStatus(): PslSyncStatus {
    return { ...this.status };
  }

  public subscribe(listener: (status: PslSyncStatus) => void): () => void {
    this.listeners.push(listener);
    listener(this.getStatus());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    const s = this.getStatus();
    this.listeners.forEach((fn) => fn(s));
  }

  public async refreshNow(): Promise<PslSyncStatus> {
    this.status.isSyncing = true;
    this.status.status = 'syncing';
    this.notifyListeners();

    await new Promise((resolve) => setTimeout(resolve, 850));

    const now = new Date();
    this.status.lastSyncTime = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ', ' + now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    this.status.nextScheduledSync = 'in 23 hours, 59 mins';
    this.status.version = `PSL-${now.getFullYear()}.${now.getMonth() + 1}-rev${Math.floor(Math.random() * 5) + 5}`;
    this.status.isSyncing = false;
    this.status.status = 'active';
    this.notifyListeners();
    return this.getStatus();
  }
}

export const pslSyncWorker = new PslSyncWorker();

/**
 * Sanitize and clean raw hostname
 */
export function sanitizeRawHostname(raw: string): string {
  let cleaned = raw.trim().toLowerCase();
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  cleaned = cleaned.replace(/[\/?:#].*$/, '');
  cleaned = cleaned.replace(/:\d+$/, '');
  return cleaned;
}

/**
 * Synchronized PSL Parser
 * Finds the effective Public Suffix (checking Private Section first, then ICANN public suffixes)
 */
export function parseDomainWithPsl(rawHostname: string): PslDomainInfo {
  const sanitized = sanitizeRawHostname(rawHostname);
  const labels = sanitized.split('.').filter(Boolean);

  if (labels.length === 0) {
    return {
      sanitized: '',
      publicSuffix: '',
      isPrivateSection: false,
      registrableDomain: '',
      subdomain: '',
      isBareRegistrableDomain: false,
    };
  }

  // 1. Check for PSL Private Section matches (e.g., "mytenant.github.io", "auth.vercel.app")
  // Check from 3 labels down to 2 labels
  let matchedPrivateSuffix: string | null = null;
  for (let i = 0; i < labels.length - 1; i++) {
    const candidateSuffix = labels.slice(i).join('.');
    if (PSL_PRIVATE_SECTION_SUFFIXES.has(candidateSuffix)) {
      matchedPrivateSuffix = candidateSuffix;
      break;
    }
  }

  if (matchedPrivateSuffix) {
    const suffixLabels = matchedPrivateSuffix.split('.').length;
    const apexIndex = labels.length - suffixLabels - 1;
    const registrableDomain = apexIndex >= 0 ? labels.slice(apexIndex).join('.') : matchedPrivateSuffix;
    const subdomain = apexIndex > 0 ? labels.slice(0, apexIndex).join('.') : '';

    return {
      sanitized,
      publicSuffix: matchedPrivateSuffix,
      isPrivateSection: true,
      registrableDomain,
      subdomain,
      isBareRegistrableDomain: subdomain === '',
    };
  }

  // 2. Check for Multi-part or Single-part Public ICANN suffixes
  let matchedPublicSuffix: string = labels[labels.length - 1] || '';
  if (labels.length >= 3) {
    const candidateTwoPart = labels.slice(-2).join('.');
    if (PSL_PUBLIC_ICANN_SUFFIXES.has(candidateTwoPart)) {
      matchedPublicSuffix = candidateTwoPart;
    }
  }
  if (!matchedPublicSuffix && PSL_PUBLIC_ICANN_SUFFIXES.has(labels[labels.length - 1])) {
    matchedPublicSuffix = labels[labels.length - 1];
  }

  const suffixLabelCount = matchedPublicSuffix.split('.').length;
  const apexLabelIndex = labels.length - suffixLabelCount - 1;

  if (apexLabelIndex >= 0) {
    const registrableDomain = labels.slice(apexLabelIndex).join('.');
    const subdomain = labels.slice(0, apexLabelIndex).join('.');
    return {
      sanitized,
      publicSuffix: matchedPublicSuffix,
      isPrivateSection: false,
      registrableDomain,
      subdomain,
      isBareRegistrableDomain: subdomain === '',
    };
  }

  // If fewer labels than suffix + apex (e.g., bare "com" or "co.uk")
  return {
    sanitized,
    publicSuffix: matchedPublicSuffix,
    isPrivateSection: false,
    registrableDomain: sanitized,
    subdomain: '',
    isBareRegistrableDomain: true,
  };
}

/**
 * Unified Hostname Validator using synchronized PSL logic
 */
export function validateHostnameWithPsl(
  rawHostname: string,
  existingDomains: { id: string; domain: string; status?: string }[],
  editingId: string | null,
  isEditingActive: boolean = false
): {
  isValid: boolean;
  error: string | null;
  parsed: PslDomainInfo;
} {
  const trimmed = rawHostname.trim();
  const parsed = parseDomainWithPsl(trimmed);

  if (!trimmed) {
    return {
      isValid: false,
      error: 'Enter hostname only (e.g., login.example.com).',
      parsed,
    };
  }

  // 1. Schemes, Paths, Ports
  if (
    /https?:\/\//i.test(trimmed) ||
    trimmed.includes('/') ||
    trimmed.includes(':') ||
    trimmed.includes('?')
  ) {
    return {
      isValid: false,
      error: 'Enter hostname only (e.g., login.example.com).',
      parsed,
    };
  }

  // 2. Wildcards
  if (trimmed.includes('*')) {
    return {
      isValid: false,
      error: 'Wildcard domains are not supported.',
      parsed,
    };
  }

  // 3. Internationalized Domains (IDN)
  if (/[^\x00-\x7F]/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Internationalized domain names are not supported.',
      parsed,
    };
  }

  // 4. IP Addresses & Local Hostnames
  const lower = parsed.sanitized;
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(lower);
  const isIpv6 = lower.includes('::') || /^[0-9a-f:]{3,}$/i.test(lower);
  const isLocalOrInternal =
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.lan') ||
    lower.endsWith('.corp') ||
    lower.endsWith('.home');
  const hasMissingTld = !lower.includes('.') || lower.endsWith('.') || lower.startsWith('.');

  if (isIpv4 || isIpv6 || isLocalOrInternal || hasMissingTld) {
    return {
      isValid: false,
      error: 'IP addresses and internal hostnames are not supported.',
      parsed,
    };
  }

  // Valid hostname characters
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(lower)) {
    return {
      isValid: false,
      error: 'Enter hostname only (e.g., login.example.com).',
      parsed,
    };
  }

  // 5. CASE 3 REQUIREMENT: Strictly block PSL Private Section domains
  // Prevents cross-tenant origin spoofing on shared hosting (e.g. github.io, vercel.app)
  if (parsed.isPrivateSection) {
    return {
      isValid: false,
      error: `Domains listed in the Public Suffix List Private Section (e.g., ${parsed.publicSuffix}) are blocked to prevent cross-tenant origin spoofing.`,
      parsed,
    };
  }

  // 6. CASE 3 REQUIREMENT: Reject bare registrable domains (eTLD+1) using synchronized PSL parsing
  if (parsed.isBareRegistrableDomain) {
    return {
      isValid: false,
      error: `Root domains not supported. Use a subdomain (e.g., login.${parsed.registrableDomain || 'example.com'}).`,
      parsed,
    };
  }

  // 7. Duplicate Checks (Same Tenant)
  const isSameTenantDuplicate = existingDomains.some(
    (d) => d.id !== editingId && d.domain.toLowerCase() === lower
  );
  if (isSameTenantDuplicate) {
    return {
      isValid: false,
      error: 'Hostname already exists in your account.',
      parsed,
    };
  }

  // 8. Cross-Tenant conflict domains
  const CROSS_TENANT_CONFLICTS = [
    'login.partner.com',
    'auth.external.com',
    'idp.partner.com',
    'sso.globalcorp.com',
    'auth.acmecorp.com',
    'identity.company.com',
    'login.shared-cloud.net',
    'login.hexnode.com',
  ];
  if (CROSS_TENANT_CONFLICTS.includes(lower)) {
    return {
      isValid: false,
      error: 'Hostname in use. Contact support to claim ownership.',
      parsed,
    };
  }

  return { isValid: true, error: null, parsed };
}

/**
 * Synchronized DNS Record Helper using the exact same PSL parsing logic
 * Splits zone vs. host accurately across multi-part and ccTLDs
 */
export function getDnsZoneInfoWithPsl(hostname: string): {
  hostname: string;
  rootZone: string; // The apex registrable domain where DNS zone is hosted
  hostValue: string; // The subdomain/host label to configure in the zone
  fullRecordName: string;
  txtRecordHost: string;
  cnameRecordHost: string;
  publicSuffix: string;
  dnsZoneLocation: string;
} {
  const parsed = parseDomainWithPsl(hostname);
  const fullHostname = parsed.sanitized || 'login.example.com';
  const rootZone = parsed.registrableDomain || 'example.com';
  const hostValue = parsed.subdomain || 'login';

  return {
    hostname: fullHostname,
    rootZone,
    hostValue,
    fullRecordName: fullHostname,
    txtRecordHost: `_hexnode-challenge.${hostValue}`,
    cnameRecordHost: hostValue,
    publicSuffix: parsed.publicSuffix,
    dnsZoneLocation: `DNS provider for zone: ${rootZone}`,
  };
}

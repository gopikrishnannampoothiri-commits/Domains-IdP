/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Case 3: Public Suffix List (PSL) Status & Validation Sync Control
 * Displays scheduled worker status, dynamic refresh controls, and explains synchronized validation rules.
 */

import React, { useState, useEffect } from 'react';
import {
  Globe,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { pslSyncWorker, PslSyncStatus } from '../utils/pslEngine';

interface PslStatusBannerProps {
  showToast: (msg: string) => void;
}

export function PslStatusBanner({ showToast }: PslStatusBannerProps) {
  const [syncStatus, setSyncStatus] = useState<PslSyncStatus>(pslSyncWorker.getStatus());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = pslSyncWorker.subscribe((newStatus) => {
      setSyncStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const updated = await pslSyncWorker.refreshNow();
      showToast(`PSL rules refreshed: ${updated.version} (${updated.totalPublicRules.toLocaleString()} public + ${updated.totalPrivateRules.toLocaleString()} private suffixes active)`);
    } catch {
      showToast('Error syncing Public Suffix List');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-[8px] p-3.5 mb-5 shadow-xs transition-all">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Left: Engine Status Indicator */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-[#EFF6FF] text-[#0F62FE] flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[13px] font-semibold text-[#111827]">
                Public Suffix List (PSL) Validation Sync
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Live Sync Engine Active
              </span>
              <span className="text-[11px] font-mono text-[#6B7280] hidden sm:inline">
                {syncStatus.version}
              </span>
            </div>

            <p className="text-[12px] text-[#6B7280] mt-0.5">
              Last synced: <span className="font-medium text-[#374151]">{syncStatus.lastSyncTime}</span> &bull; Next scheduled refresh: <span className="text-[#374151]">{syncStatus.nextScheduledSync}</span>
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-[32px] px-3 bg-white border border-[#D1D5DB] hover:bg-gray-50 text-[#374151] rounded-[6px] text-[12px] font-medium flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Trigger scheduled worker sync immediately"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#0F62FE] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync PSL Rules'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-[#6B7280] hover:text-[#111827] rounded hover:bg-gray-100 transition-colors cursor-pointer"
            title={isExpanded ? 'Hide policy details' : 'View policy details'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Details Drawer */}
      {isExpanded && (
        <div className="mt-3.5 pt-3 border-t border-[#F3F4F6] grid grid-cols-1 md:grid-cols-3 gap-4 text-[12px] animate-in fade-in duration-100">
          <div className="p-3 bg-[#F9FAFB] rounded-[6px] border border-[#E5E7EB] space-y-1">
            <span className="font-semibold text-[#111827] block">Bare Registrable Domain Guard</span>
            <p className="text-[#4B5563] leading-relaxed">
              Synchronized PSL parsing detects apex domains across all ccTLDs (e.g. .co.uk, .com.au) and requires custom subdomains (e.g. login.example.com) to prevent wildcard cookie leaks.
            </p>
          </div>

          <div className="p-3 bg-[#F9FAFB] rounded-[6px] border border-[#E5E7EB] space-y-1">
            <span className="font-semibold text-[#111827] block">Private Section Multi-Tenant Blocking</span>
            <p className="text-[#4B5563] leading-relaxed">
              Strictly blocks public suffix private sections (e.g. vercel.app, github.io, pages.dev, herokuapp.com) to prevent cross-tenant origin spoofing and credential interception.
            </p>
          </div>

          <div className="p-3 bg-[#F9FAFB] rounded-[6px] border border-[#E5E7EB] space-y-1">
            <span className="font-semibold text-[#111827] block">Unified DNS Zone vs. Host Splitting</span>
            <p className="text-[#4B5563] leading-relaxed">
              Identical PSL grammar powers DNS record configuration helpers, calculating the exact registrar apex zone (e.g. corp.ac.uk) and subdomain host record (e.g. auth).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

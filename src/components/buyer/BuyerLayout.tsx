import React, { useState } from 'react';
import { useApp, BuyerSubRole } from '../../context/AppContext';
import { Logo } from '../common/Logo';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  ClipboardList,
  Users,
  Lock,
  Award,
  BarChart3,
  UserCheck,
  FormInput,
  Layers,
  Palette,
  Key,
  CreditCard,
  ScrollText,
  Settings,
  Search,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Bell,
  Sparkles,
} from 'lucide-react';

import { BuyerDashboard } from './BuyerDashboard';
import { BuyerCreateCallWizard } from './BuyerCreateCallWizard';
import { BuyerReviewQueue } from './BuyerReviewQueue';
import { BuyerSupplierDatabase } from './BuyerSupplierDatabase';
import { BuyerRFPManagement } from './BuyerRFPManagement';
import { BuyerBidsOpening } from './BuyerBidsOpening';
import { BuyerEvaluation } from './BuyerEvaluation';
import { BuyerAwards } from './BuyerAwards';
import { BuyerClarifications } from './BuyerClarifications';
import { BuyerReports } from './BuyerReports';
import { BuyerTeamRoles } from './BuyerTeamRoles';
import { BuyerFormBuilder } from './BuyerFormBuilder';
import { BuyerWorkflowsScoring } from './BuyerWorkflowsScoring';
import { BuyerBranding } from './BuyerBranding';
import { BuyerIntegrations } from './BuyerIntegrations';
import { BuyerBilling } from './BuyerBilling';
import { BuyerAuditLog } from './BuyerAuditLog';
import { BuyerSettings } from './BuyerSettings';
import { NotificationDrawer } from '../common/NotificationDrawer';

export const BuyerLayout: React.FC = () => {
  const { setRole, setActiveNav, buyerSubRole, setBuyerSubRole, setSelectedCallId } = useApp();
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const navGroups = [
    {
      groupTitle: 'Overview',
      items: [{ id: 'overview', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      groupTitle: 'Calls',
      items: [
        { id: 'calls', label: 'Calls', icon: FileText },
        { id: 'clarifications', label: 'Clarifications', icon: MessageSquare },
      ],
    },
    {
      groupTitle: 'Review',
      items: [
        { id: 'applications', label: 'Applications', icon: ClipboardList },
        { id: 'roster', label: 'Supplier roster', icon: Users },
      ],
    },
    {
      groupTitle: 'Bids',
      items: [
        { id: 'bids-opening', label: 'Bids and opening', icon: Lock },
        { id: 'evaluation', label: 'Evaluation', icon: BarChart3 },
        { id: 'awards', label: 'Awards and contracts', icon: Award },
      ],
    },
    {
      groupTitle: 'Reports',
      items: [{ id: 'reports', label: 'Reports', icon: BarChart3 }],
    },
    {
      groupTitle: 'Admin',
      items: [
        { id: 'team', label: 'Team and roles', icon: UserCheck },
        { id: 'form-builder', label: 'Form builder', icon: FormInput },
        { id: 'scoring-workflows', label: 'Workflows and scoring', icon: Layers },
        { id: 'branding', label: 'Branding', icon: Palette },
        { id: 'integrations', label: 'Integrations', icon: Key },
        { id: 'billing', label: 'Billing', icon: CreditCard },
        { id: 'audit-log', label: 'Audit log', icon: ScrollText },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  const handleSignOut = () => {
    setRole('public');
    setActiveNav('about');
  };

  const renderActiveContent = () => {
    switch (currentTab) {
      case 'overview':
        return (
          <BuyerDashboard
            onNavigate={(tabId) => setCurrentTab(tabId)}
            onSelectCall={(cId) => setSelectedCallId(cId)}
          />
        );
      case 'calls':
        return <BuyerRFPManagement />;
      case 'create-call':
        return (
          <BuyerCreateCallWizard
            onFinished={() => setCurrentTab('calls')}
            onCancel={() => setCurrentTab('overview')}
          />
        );
      case 'clarifications':
        return <BuyerClarifications />;
      case 'applications':
        return <BuyerReviewQueue />;
      case 'roster':
        return <BuyerSupplierDatabase />;
      case 'bids-opening':
        return <BuyerBidsOpening />;
      case 'evaluation':
        return <BuyerEvaluation />;
      case 'awards':
        return <BuyerAwards />;
      case 'reports':
        return <BuyerReports />;
      case 'team':
        return <BuyerTeamRoles />;
      case 'form-builder':
        return <BuyerFormBuilder />;
      case 'scoring-workflows':
        return <BuyerWorkflowsScoring />;
      case 'branding':
        return <BuyerBranding />;
      case 'integrations':
        return <BuyerIntegrations />;
      case 'billing':
        return <BuyerBilling />;
      case 'audit-log':
        return <BuyerAuditLog />;
      case 'settings':
        return <BuyerSettings />;
      default:
        return (
          <BuyerDashboard
            onNavigate={(tabId) => setCurrentTab(tabId)}
            onSelectCall={(cId) => setSelectedCallId(cId)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-white flex flex-col">
      {/* 1. Dedicated Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-[#10212E] border-b border-[#D5E0EA] dark:border-[#1E364A] h-16 flex items-center px-4 sm:px-6 justify-between gap-4">
        {/* Left: Organization Branding */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="md:hidden p-1.5 text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] hover:bg-[#F7FAFD]"
          >
            {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[8px] bg-[#1F5F99] text-white flex items-center justify-center font-heading font-bold text-[14px]">
              GR
            </div>
            <div className="leading-tight">
              <span className="font-heading font-semibold text-[15px] text-[#10212E] dark:text-white block">
                Gaborone Regional Council
              </span>
              <span className="text-[12px] text-[#6B7A87] block">
                Procuring entity console
              </span>
            </div>
          </div>
        </div>

        {/* Center: Global Search */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-[#6B7A87] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tenders, bids, supplier dossiers, evaluation matrices..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-[#F7FAFD] dark:bg-[#132635] text-[13px] text-[#10212E] dark:text-white focus:bg-white"
            />
          </div>
        </div>

        {/* Right: Notifications & Buyer User Menu */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsNotifOpen(true)}
            className="p-2 text-[#43525F] dark:text-[#B2C3D2] hover:text-[#1F5F99] rounded-[6px] hover:bg-[#F7FAFD] transition-colors cursor-pointer"
            aria-label="Open notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-[6px] bg-[#EAF2FA] text-[#1F5F99] flex items-center justify-center font-semibold text-[13px]">
                KT
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <span className="font-semibold text-[14px] text-[#10212E] dark:text-white block">
                  Kgosi Tau
                </span>
                <span className="text-[12px] text-[#6B7A87] block">
                  {buyerSubRole}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#6B7A87]" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] p-2 z-50 text-[13px] space-y-1 shadow-sm">
                <div className="px-3 py-2 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                  <div className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                    Kgosi Tau
                  </div>
                  <div className="text-[12px] text-[#6B7A87]">
                    k.tau@grc.gov.bw · {buyerSubRole}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTab('team');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-[#F7FAFD] text-[#10212E] dark:text-white transition-colors"
                >
                  Team profile & roles
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTab('settings');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-[#F7FAFD] text-[#10212E] dark:text-white transition-colors"
                >
                  Procurement settings
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 rounded-[6px] hover:bg-rose-50 text-[#C2412D] transition-colors font-medium flex items-center justify-between"
                >
                  <span>Sign out</span>
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main Body with Grouped Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside
          className={`w-64 bg-white dark:bg-[#10212E] border-r border-[#D5E0EA] dark:border-[#1E364A] p-4 flex flex-col justify-between shrink-0 overflow-y-auto ${
            isMobileNavOpen ? 'block fixed inset-y-0 left-0 z-50 pt-20' : 'hidden md:flex'
          }`}
        >
          <div className="space-y-4">
            {navGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-1">
                <span className="text-[11px] font-semibold text-[#6B7A87] uppercase tracking-wider px-3 block">
                  {group.groupTitle}
                </span>
                {group.items.map((item) => {
                  const isActive = currentTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCurrentTab(item.id);
                        setIsMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#EAF2FA] text-[#1F5F99] font-semibold'
                          : 'text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#132635] hover:text-[#10212E]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#1F5F99]' : 'text-[#6B7A87]'}`} strokeWidth={1.5} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="pt-4 mt-6 border-t border-[#D5E0EA] dark:border-[#1E364A] text-[12px] text-[#6B7A87] space-y-1">
            <div>Gaborone Regional Council</div>
            <div className="text-[11px]">Audit Ledger Sync · Active</div>
          </div>
        </aside>

        {/* Main Content View */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-10">
          <div className="max-w-6xl mx-auto space-y-4">
            {buyerSubRole === 'Auditor' && (
              <div className="p-3.5 rounded-[8px] bg-[#EAF2FA] dark:bg-[#162C3E] border border-[#C9D9E8] dark:border-[#1E364A] text-[13px] text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ScrollText className="w-4 h-4 shrink-0" />
                  <span><strong>Auditor mode (Read-only):</strong> You have inspection access across tender calls, scorecards, submissions, and cryptographic receipts. Mutating actions and publishing are restricted.</span>
                </div>
                <span className="text-[11px] font-semibold bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded border border-[#C9D9E8] shrink-0">Read-Only</span>
              </div>
            )}
            {renderActiveContent()}
          </div>
        </main>
      </div>

      <NotificationDrawer isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </div>
  );
};

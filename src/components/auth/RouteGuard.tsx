import React from 'react';
import { useApp, UserRole } from '../../context/AppContext';
import { Lock, ShieldAlert, ArrowRight, ArrowLeft, LogIn, UserPlus } from 'lucide-react';
import { Button } from '../ui/Button';

interface RouteGuardProps {
  requiredRole?: UserRole;
  targetRoute: string;
  isRoleMismatch?: boolean;
}

interface RouteInfo {
  title: string;
  purpose: string;
}

const ROUTE_LABELS: Record<string, RouteInfo> = {
  dashboard: {
    title: 'Supplier Command Dashboard',
    purpose: 'View live compliance metrics, active tenders, and track statutory status.',
  },
  'supplier-dashboard': {
    title: 'Supplier Command Dashboard',
    purpose: 'View live compliance metrics, active tenders, and track statutory status.',
  },
  profile: {
    title: 'Company Passport & Statutory Profile',
    purpose: 'Maintain CIPA registration, PPRA codes, tax clearance, and shareholding details.',
  },
  vault: {
    title: 'Confidential Document Vault',
    purpose: 'Store encrypted tax clearances, trading licenses, audited financials, and compliance certs.',
  },
  sharing: {
    title: 'Consent & Data Sharing Access Roster',
    purpose: 'Audit and control procuring entities that have permission to view your verified statutory vault.',
  },
  consent: {
    title: 'Consent & Data Sharing Access Roster',
    purpose: 'Audit and control procuring entities that have permission to view your verified statutory vault.',
  },
  'my-applications': {
    title: 'Tender Applications & Submissions',
    purpose: 'Monitor submitted bids, evaluation stages, clarification requests, and award notices.',
  },
  apply: {
    title: 'Tender Application Stepper',
    purpose: 'Complete official tender documentation and statutory declarations for submission.',
  },
  bids: {
    title: 'Cryptographic Sealed Bid Submission',
    purpose: 'Encrypt and deposit tamper-proof bid envelopes prior to the public opening deadline.',
  },
  'buyer-dashboard': {
    title: 'Procuring Entity Operations Portal',
    purpose: 'Access procurement planning, requisition controls, and published tender dashboards.',
  },
  'review-queue': {
    title: 'Procurement Review Queue',
    purpose: 'Screen submitted applications against mandatory statutory compliance gates.',
  },
  'rfp-management': {
    title: 'Tender Management Portal',
    purpose: 'Draft, publish, and administer Requests for Proposals and expressions of interest.',
  },
  'bids-opening': {
    title: 'Sealed Envelope Opening Session',
    purpose: 'Participate in cryptographic envelope key reveals and generate statutory opening minutes.',
  },
  evaluation: {
    title: 'Tender Evaluation Matrix',
    purpose: 'Score technical bids, run conflict of interest checks, and enter committee remarks.',
  },
  awards: {
    title: 'Contract Award Recommendations',
    purpose: 'Prepare statutory award justifications and generate public intention-to-award notices.',
  },
  'supplier-database': {
    title: 'Approved Supplier Roster',
    purpose: 'Search verified suppliers across PPRA categories and citizen-owned economic categories.',
  },
  'buyer-settings': {
    title: 'Procuring Entity Configuration',
    purpose: 'Manage institutional approval thresholds, evaluator seats, and team access.',
  },
  'audit-log': {
    title: 'Statutory Audit Trail & Compliance Log',
    purpose: 'Inspect immutable, timestamped logs of every action, access grant, and score.',
  },
  'admin-dashboard': {
    title: 'National Platform Administration Desk',
    purpose: 'Supervise cross-institutional procurement compliance and system integrity.',
  },
  'admin-overview': {
    title: 'National Oversight & System Metrics',
    purpose: 'Monitor live platform analytics, transaction volumes, and system health.',
  },
  'admin-orgs': {
    title: 'Procuring Entity Approvals Desk',
    purpose: 'Review and certify public sector procuring entities requesting platform workspaces.',
  },
  'admin-verification': {
    title: 'Statutory Document Verification Queue',
    purpose: 'Audit CIPA, BURS, and PPRA documents submitted by prospective suppliers.',
  },
  'admin-users': {
    title: 'Platform Security & User Credentials',
    purpose: 'Administer enterprise user directories, role permissions, and access credentials.',
  },
  'admin-billing': {
    title: 'Institutional Billing & Subscription Management',
    purpose: 'Manage government subscription tiers, license allocations, and payment receipts.',
  },
  'admin-risk': {
    title: 'Debarment & Risk Intelligence Desk',
    purpose: 'Track blacklisted contractors, integrity alerts, and debarment enforcement.',
  },
  'admin-notifications': {
    title: 'Platform Notification Delivery Logs',
    purpose: 'Inspect SMS, email, and audit notification deliveries.',
  },
  'admin-system': {
    title: 'System Settings & Audit Log',
    purpose: 'Review national audit records and system-wide configuration controls.',
  },
};

export const RouteGuard: React.FC<RouteGuardProps> = ({
  requiredRole = 'supplier',
  targetRoute,
  isRoleMismatch = false,
}) => {
  const { setActiveNav, setIntendedRoute, role, logout } = useApp();

  const routeInfo = ROUTE_LABELS[targetRoute] || {
    title: targetRoute.charAt(0).toUpperCase() + targetRoute.slice(1).replace(/-/g, ' '),
    purpose: 'Access this restricted procurement workflow.',
  };

  const handleSignIn = () => {
    setIntendedRoute(targetRoute);
    if (requiredRole === 'admin') {
      setActiveNav('admin-login');
    } else if (requiredRole === 'buyer') {
      setActiveNav('buyer-login');
    } else {
      setActiveNav('supplier-login');
    }
  };

  const handleSignUp = () => {
    setIntendedRoute(targetRoute);
    if (requiredRole === 'buyer') {
      setActiveNav('buyer-signup');
    } else {
      setActiveNav('supplier-signup');
    }
  };

  const handleBackHome = () => {
    setActiveNav('about');
  };

  const handleReturnToDashboard = () => {
    if (role === 'admin') {
      setActiveNav('admin-dashboard');
    } else {
      setActiveNav('dashboard');
    }
  };

  if (isRoleMismatch) {
    return (
      <div className="py-12 sm:py-16 flex items-center justify-center">
        <div className="w-full max-w-lg bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] p-8 shadow-elevated text-center space-y-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 dark:bg-amber-950/40 text-[#E8A33D] flex items-center justify-center border border-amber-200 dark:border-amber-900/50">
            <ShieldAlert className="w-7 h-7" strokeWidth={1.5} />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-2.5 py-0.5 rounded-[4px] bg-[#FFFBEB] dark:bg-[#92400E]/20 text-[#92400E] dark:text-[#FCD34D] text-[12px] font-semibold tracking-wide uppercase">
              Role Access Restricted
            </span>
            <h2 className="font-heading font-semibold text-[24px] text-[#10212E] dark:text-white">
              Authorized role required
            </h2>
            <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
              The page <strong>"{routeInfo.title}"</strong> requires an active <strong>{requiredRole}</strong> account. You are currently logged in as a <strong>{role}</strong>.
            </p>
            <p className="text-[13px] text-[#6B7A87] italic">
              {routeInfo.purpose}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="secondary"
              onClick={async () => {
                await logout();
                handleSignIn();
              }}
              leftIcon={<LogIn className="w-4 h-4" />}
            >
              Sign in with {requiredRole} account
            </Button>
            <Button
              variant="ghost"
              onClick={handleReturnToDashboard}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Return to my dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-16 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] p-8 shadow-elevated text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-center border border-[#C9D9E8] dark:border-[#1F5F99]/40">
          <Lock className="w-7 h-7" strokeWidth={1.5} />
        </div>

        <div className="space-y-2">
          <span className="inline-block px-2.5 py-0.5 rounded-[4px] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0] text-[12px] font-semibold tracking-wide uppercase">
            Security & Access Guard
          </span>
          <h2 className="font-heading font-semibold text-[24px] text-[#10212E] dark:text-white">
            Sign in required
          </h2>
          <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
            Access to <strong>"{routeInfo.title}"</strong> is protected. In compliance with the Public Procurement Act, confidential documents, sealed tenders, and operational records require an authenticated session.
          </p>
          <p className="text-[13px] text-[#6B7A87] italic">
            {routeInfo.purpose}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            onClick={handleSignIn}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Sign in to continue
          </Button>
          <Button
            variant="secondary"
            onClick={handleSignUp}
            leftIcon={<UserPlus className="w-4 h-4" />}
          >
            {requiredRole === 'buyer' ? 'Register organization' : 'Register company'}
          </Button>
        </div>

        <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A]">
          <button
            type="button"
            onClick={() => setActiveNav('opportunities')}
            className="text-[13px] text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Browse public opportunities without signing in</span>
          </button>
        </div>
      </div>
    </div>
  );
};

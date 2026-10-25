import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { Logo } from './components/common/Logo';
import { RouteGuard } from './components/auth/RouteGuard';
import { PWAInstallPrompt } from './components/common/PWAInstallPrompt';
import AppGate, { GateSkeleton } from './components/AppGate';

// Public Views
import { PublicAbout } from './components/public/PublicAbout';
import { PublicOpportunities } from './components/public/PublicOpportunities';
import { PublicCallDetail } from './components/public/PublicCallDetail';
import { PublicForSuppliers } from './components/public/PublicForSuppliers';
import { PublicForBuyers } from './components/public/PublicForBuyers';
import { PublicHelp } from './components/public/PublicHelp';
import { AuthScreen } from './components/auth/AuthScreen';

// Lazy-loaded Authenticated Views (Keeps initial login bundle small)
const AdminDashboard = React.lazy(() =>
  import('./components/auth/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const BuyerLayout = React.lazy(() =>
  import('./components/buyer/BuyerLayout').then((m) => ({ default: m.BuyerLayout }))
);
const SupplierDashboard = React.lazy(() =>
  import('./components/supplier/SupplierDashboard').then((m) => ({ default: m.SupplierDashboard }))
);
const SupplierProfile = React.lazy(() =>
  import('./components/supplier/SupplierProfile').then((m) => ({ default: m.SupplierProfile }))
);
const SupplierVault = React.lazy(() =>
  import('./components/supplier/SupplierVault').then((m) => ({ default: m.SupplierVault }))
);
const SupplierConsent = React.lazy(() =>
  import('./components/supplier/SupplierConsent').then((m) => ({ default: m.SupplierConsent }))
);
const SupplierApplicationStepper = React.lazy(() =>
  import('./components/supplier/SupplierApplicationStepper').then((m) => ({ default: m.SupplierApplicationStepper }))
);
const SupplierApplicationsList = React.lazy(() =>
  import('./components/supplier/SupplierApplicationsList').then((m) => ({ default: m.SupplierApplicationsList }))
);
const SupplierBidSubmission = React.lazy(() =>
  import('./components/supplier/SupplierBidSubmission').then((m) => ({ default: m.SupplierBidSubmission }))
);

import { ApplicationsLockedPrompt } from './components/supplier/ApplicationsLockedPrompt';
import { calculateSupplierCompleteness } from './utils/supplierOnboarding';

const DashboardFallback = () => (
  <div className="flex items-center justify-center py-20 text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
    <div className="w-5 h-5 border-2 border-[#1F5F99] border-t-transparent rounded-full animate-spin mr-3" />
    <span>Loading workspace...</span>
  </div>
);

// Recognized route categories
const AUTH_ROUTES = [
  'auth',
  'signin',
  'signup',
  'register',
  'supplier-login',
  'supplier-signup',
  'supplier-verify-email',
  'supplier-welcome',
  'buyer-login',
  'buyer-signup',
  'buyer-pending',
  'org-login',
  'admin-login',
  'forgot-password',
  'reset-password',
  'accept-invite',
  'choose-workspace',
  'session-expired',
  'account-locked',
];

const SUPPLIER_PROTECTED_ROUTES = [
  'dashboard',
  'supplier-dashboard',
  'profile',
  'vault',
  'sharing',
  'consent',
  'my-applications',
  'apply',
  'bids',
];

const BUYER_PROTECTED_ROUTES = [
  'buyer-dashboard',
  'review-queue',
  'rfp-management',
  'bids-opening',
  'evaluation',
  'awards',
  'supplier-database',
  'buyer-settings',
  'audit-log',
];

const ADMIN_PROTECTED_ROUTES = [
  'admin-dashboard',
  'admin-overview',
  'admin-orgs',
  'admin-verification',
  'admin-users',
  'admin-billing',
  'admin-risk',
  'admin-notifications',
  'admin-system',
];

const MainContent: React.FC = () => {
  const {
    role,
    activeNav,
    setActiveNav,
    selectedCallId,
    setSelectedCallId,
    calls,
    buyerOrgStatus,
    isAuthenticated,
    authLoading,
    supplier,
    documents,
  } = useApp();
  const [viewingCallId, setViewingCallId] = useState<string | null>(null);
  const [profileInitialSection, setProfileInitialSection] = useState<
    'details' | 'directors' | 'categories' | 'projects' | 'preferences' | 'team'
  >('details');

  // Automatically dismiss call detail view when navigating to other sections
  useEffect(() => {
    if (activeNav !== 'opportunities' && viewingCallId) {
      setViewingCallId(null);
    }
  }, [activeNav, viewingCallId]);

  const supplierCompleteness = calculateSupplierCompleteness(supplier, documents);
  const isProfileComplete = supplierCompleteness.score >= 100;

  // ----------------------------------------------------
  // SESSION RESTORATION LOADING INDICATOR (handled by AppGate)
  // ----------------------------------------------------

  // ----------------------------------------------------
  // PLATFORM ADMIN FULL EXPERIENCE (when authenticated)
  // ----------------------------------------------------
  if (isAuthenticated && role === 'admin') {
    const isPublicNav = [
      'opportunities',
      'help',
      'guidelines',
      'about',
      'suppliers',
      'buyers',
    ].includes(activeNav) || viewingCallId !== null;

    if (!isPublicNav) {
      return (
        <div className="min-h-screen flex flex-col bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-[#EAF2FA]">
          <React.Suspense fallback={<DashboardFallback />}>
            <AdminDashboard />
          </React.Suspense>
        </div>
      );
    }
  }

  // ----------------------------------------------------
  // BUYER FULL EXPERIENCE (when authenticated)
  // ----------------------------------------------------
  if (isAuthenticated && role === 'buyer') {
    const isPublicNav = [
      'opportunities',
      'help',
      'guidelines',
      'about',
      'suppliers',
      'buyers',
    ].includes(activeNav) || viewingCallId !== null;

    if (!isPublicNav) {
      if (buyerOrgStatus !== 'Approved') {
        return (
          <div className="min-h-screen flex flex-col bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-[#EAF2FA]">
            <AuthScreen initialRoute="buyer-pending" />
          </div>
        );
      }
      return (
        <div className="min-h-screen flex flex-col bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-[#EAF2FA]">
          <React.Suspense fallback={<DashboardFallback />}>
            <BuyerLayout />
          </React.Suspense>
        </div>
      );
    }
  }

  // Render based on current role, route guards, and active navigation
  const renderContent = () => {
    // 1. Viewing a specific public call detail
    if (viewingCallId && activeNav === 'opportunities') {
      return (
        <PublicCallDetail
          callId={viewingCallId}
          onBack={() => setViewingCallId(null)}
          onApply={() => {
            const targetCall = viewingCallId;
            setViewingCallId(null);
            setSelectedCallId(targetCall);
            setActiveNav('apply');
          }}
        />
      );
    }

    // 2. Authentication sub-routes
    if (AUTH_ROUTES.includes(activeNav)) {
      return <AuthScreen initialRoute={activeNav as any} />;
    }

    // 3. ADMIN PROTECTED ROUTES
    if (ADMIN_PROTECTED_ROUTES.includes(activeNav)) {
      if (!isAuthenticated) {
        return <RouteGuard targetRoute={activeNav} requiredRole="admin" />;
      }
      if (role !== 'admin') {
        return <RouteGuard targetRoute={activeNav} requiredRole="admin" isRoleMismatch={true} />;
      }
      return <AdminDashboard />;
    }

    // 4. BUYER PROTECTED ROUTES
    if (BUYER_PROTECTED_ROUTES.includes(activeNav)) {
      if (!isAuthenticated) {
        return <RouteGuard targetRoute={activeNav} requiredRole="buyer" />;
      }
      if (role !== 'buyer') {
        return <RouteGuard targetRoute={activeNav} requiredRole="buyer" isRoleMismatch={true} />;
      }
      if (buyerOrgStatus !== 'Approved') {
        return <AuthScreen initialRoute="buyer-pending" />;
      }
      return <BuyerLayout />;
    }

    // 5. SUPPLIER PROTECTED ROUTES
    if (SUPPLIER_PROTECTED_ROUTES.includes(activeNav)) {
      if (!isAuthenticated) {
        return <RouteGuard targetRoute={activeNav} requiredRole="supplier" />;
      }
      if (role !== 'supplier') {
        return <RouteGuard targetRoute={activeNav} requiredRole="supplier" isRoleMismatch={true} />;
      }

      switch (activeNav) {
        case 'dashboard':
        case 'supplier-dashboard':
          return (
            <SupplierDashboard
              onNavigateToVault={() => setActiveNav('vault')}
              onNavigateToApplications={() => setActiveNav('my-applications')}
              onNavigateToApply={(callId) => {
                if (callId) setSelectedCallId(callId);
                setActiveNav('apply');
              }}
              onNavigateToProfile={() => setActiveNav('profile')}
              onNavigateToConsent={() => setActiveNav('consent')}
            />
          );
        case 'profile':
          return <SupplierProfile initialSection={profileInitialSection} />;
        case 'vault':
          return <SupplierVault />;
        case 'sharing':
        case 'consent': {
          if (!isProfileComplete) {
            return (
              <ApplicationsLockedPrompt
                completeness={supplierCompleteness}
                onNavigateToProfile={(sec) => {
                  setProfileInitialSection(sec || 'details');
                  setActiveNav('profile');
                }}
                onNavigateToVault={() => setActiveNav('vault')}
                onNavigateToDashboard={() => setActiveNav('dashboard')}
                intendedAction="sharing"
              />
            );
          }
          return <SupplierConsent />;
        }
        case 'bids': {
          if (!isProfileComplete) {
            const selectedCall = calls.find((c) => c.id === selectedCallId);
            return (
              <ApplicationsLockedPrompt
                completeness={supplierCompleteness}
                onNavigateToProfile={(sec) => {
                  setProfileInitialSection(sec || 'details');
                  setActiveNav('profile');
                }}
                onNavigateToVault={() => setActiveNav('vault')}
                onNavigateToDashboard={() => setActiveNav('dashboard')}
                intendedAction="bids"
                callTitle={selectedCall?.title}
              />
            );
          }
          return (
            <SupplierBidSubmission
              initialCallId={selectedCallId}
              onFinished={(newAppId) => {
                setSelectedCallId(null);
                setActiveNav('my-applications');
              }}
              onCancel={() => {
                setSelectedCallId(null);
                setActiveNav('dashboard');
              }}
            />
          );
        }
        case 'apply': {
          const selectedCall = calls.find((c) => c.id === selectedCallId);
          if (!isProfileComplete) {
            return (
              <ApplicationsLockedPrompt
                completeness={supplierCompleteness}
                onNavigateToProfile={(sec) => {
                  setProfileInitialSection(sec || 'details');
                  setActiveNav('profile');
                }}
                onNavigateToVault={() => setActiveNav('vault')}
                onNavigateToDashboard={() => setActiveNav('dashboard')}
                intendedAction="apply"
                callTitle={selectedCall?.title}
              />
            );
          }
          if (selectedCall?.type === 'RFP') {
            return (
              <SupplierBidSubmission
                initialCallId={selectedCallId}
                onFinished={(newAppId) => {
                  setSelectedCallId(null);
                  setActiveNav('my-applications');
                }}
                onCancel={() => {
                  setSelectedCallId(null);
                  setActiveNav('dashboard');
                }}
              />
            );
          }
          return (
            <SupplierApplicationStepper
              initialCallId={selectedCallId}
              onFinished={(newAppId) => {
                setSelectedCallId(null);
                setActiveNav('my-applications');
              }}
              onCancel={() => {
                setSelectedCallId(null);
                setActiveNav('dashboard');
              }}
            />
          );
        }
        case 'my-applications':
          if (!isProfileComplete) {
            return (
              <ApplicationsLockedPrompt
                completeness={supplierCompleteness}
                onNavigateToProfile={(sec) => {
                  setProfileInitialSection(sec || 'details');
                  setActiveNav('profile');
                }}
                onNavigateToVault={() => setActiveNav('vault')}
                onNavigateToDashboard={() => setActiveNav('dashboard')}
                intendedAction="applications"
              />
            );
          }
          return (
            <SupplierApplicationsList
              onNewApplication={() => setActiveNav('opportunities')}
            />
          );
        default:
          return (
            <SupplierDashboard
              onNavigateToVault={() => setActiveNav('vault')}
              onNavigateToApplications={() => setActiveNav('my-applications')}
              onNavigateToApply={(callId) => {
                if (callId) setSelectedCallId(callId);
                setActiveNav('apply');
              }}
              onNavigateToProfile={() => setActiveNav('profile')}
              onNavigateToConsent={() => setActiveNav('consent')}
            />
          );
      }
    }

    // 6. PUBLIC ROUTES
    if (activeNav === 'opportunities') {
      return (
        <PublicOpportunities
          onSelectCall={(callId) => setViewingCallId(callId)}
        />
      );
    }
    if (activeNav === 'suppliers') {
      return <PublicForSuppliers />;
    }
    if (activeNav === 'buyers') {
      return <PublicForBuyers />;
    }
    if (activeNav === 'help' || activeNav === 'guidelines') {
      return <PublicHelp />;
    }

    // 7. DEFAULT LANDING
    if (isAuthenticated) {
      if (role === 'supplier') {
        return (
          <SupplierDashboard
            onNavigateToVault={() => setActiveNav('vault')}
            onNavigateToApplications={() => setActiveNav('my-applications')}
            onNavigateToApply={(callId) => {
              if (callId) setSelectedCallId(callId);
              setActiveNav('apply');
            }}
            onNavigateToProfile={() => setActiveNav('profile')}
            onNavigateToConsent={() => setActiveNav('consent')}
          />
        );
      }
    }

    return <PublicAbout />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-[#EAF2FA] transition-colors duration-150">
      <Header />

      <main className="flex-1 container-1160 w-full py-8 sm:py-12">
        <React.Suspense fallback={<DashboardFallback />}>
          {renderContent()}
        </React.Suspense>
      </main>

      <Footer />
      <PWAInstallPrompt />
    </div>
  );
};

function MainAppWrapper() {
  const {
    isAuthenticated,
    currentUser,
    profileSummary,
    authLoading,
    gateError,
    gatePurpose,
    retryProfileLoad,
    logout,
    activeNav,
  } = useApp();

  const isAuthRoute = AUTH_ROUTES.includes(activeNav);
  const isPublicRoute = ['opportunities', 'help', 'guidelines', 'about', 'suppliers', 'buyers'].includes(activeNav);
  const isPublicOrAuth = isAuthRoute || (isPublicRoute && !isAuthenticated);

  const ready = Boolean(
    isAuthenticated &&
    profileSummary !== null &&
    currentUser !== null &&
    profileSummary.userId === currentUser.id &&
    !authLoading
  );
  const failed = Boolean(gateError);
  const title = gatePurpose === 'setting_up' ? 'Setting up your profile' : 'Loading your profile';

  if (isPublicOrAuth) {
    return <MainContent />;
  }

  return (
    <AppGate
      ready={ready}
      failed={failed}
      title={title}
      skeleton={<GateSkeleton />}
      onRetry={retryProfileLoad}
      onSignOut={() => logout('user_initiated')}
    >
      <MainContent />
    </AppGate>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainAppWrapper />
    </AppProvider>
  );
}

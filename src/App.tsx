import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { Logo } from './components/common/Logo';
import { RouteGuard } from './components/auth/RouteGuard';

// Public Views
import { PublicAbout } from './components/public/PublicAbout';
import { PublicOpportunities } from './components/public/PublicOpportunities';
import { PublicCallDetail } from './components/public/PublicCallDetail';
import { PublicForSuppliers } from './components/public/PublicForSuppliers';
import { PublicForBuyers } from './components/public/PublicForBuyers';
import { PublicHelp } from './components/public/PublicHelp';
import { AuthScreen } from './components/auth/AuthScreen';
import { AdminDashboard } from './components/auth/AdminDashboard';

// Supplier Views
import { SupplierDashboard } from './components/supplier/SupplierDashboard';
import { SupplierProfile } from './components/supplier/SupplierProfile';
import { SupplierVault } from './components/supplier/SupplierVault';
import { SupplierConsent } from './components/supplier/SupplierConsent';
import { SupplierApplicationStepper } from './components/supplier/SupplierApplicationStepper';
import { SupplierApplicationsList } from './components/supplier/SupplierApplicationsList';
import { SupplierBidSubmission } from './components/supplier/SupplierBidSubmission';

// Buyer Views
import { BuyerLayout } from './components/buyer/BuyerLayout';

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
  } = useApp();
  const [viewingCallId, setViewingCallId] = useState<string | null>(null);

  // ----------------------------------------------------
  // SESSION RESTORATION LOADING INDICATOR
  // ----------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-[#EAF2FA]">
        <div className="flex flex-col items-center gap-4">
          <Logo theme="light" size="lg" />
          <div className="flex items-center gap-2.5 text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
            <div className="w-4 h-4 border-2 border-[#1F5F99] border-t-transparent rounded-full animate-spin" />
            <span>Verifying security session...</span>
          </div>
        </div>
      </div>
    );
  }

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
          <AdminDashboard />
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
          <BuyerLayout />
        </div>
      );
    }
  }

  // Render based on current role, route guards, and active navigation
  const renderContent = () => {
    // 1. Viewing a specific public call detail
    if (viewingCallId) {
      return (
        <PublicCallDetail
          callId={viewingCallId}
          onBack={() => setViewingCallId(null)}
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
          return <SupplierProfile />;
        case 'vault':
          return <SupplierVault />;
        case 'sharing':
        case 'consent':
          return <SupplierConsent />;
        case 'bids':
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
        case 'apply': {
          const selectedCall = calls.find((c) => c.id === selectedCallId);
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
        {renderContent()}
      </main>

      <Footer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { DemoModeWidget } from './components/common/DemoModeWidget';

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

const MainContent: React.FC = () => {
  const { role, activeNav, setActiveNav, selectedCallId, setSelectedCallId, calls, buyerOrgStatus } = useApp();
  const [viewingCallId, setViewingCallId] = useState<string | null>(null);

  // ----------------------------------------------------
  // PLATFORM ADMIN EXPERIENCE (Full-screen sidebar layout)
  // ----------------------------------------------------
  if (role === 'admin') {
    return (
      <div className="min-h-screen flex flex-col bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-[#EAF2FA]">
        <AdminDashboard />
        <DemoModeWidget />
      </div>
    );
  }

  // ----------------------------------------------------
  // BUYER EXPERIENCE (Full-screen grouped sidebar layout)
  // ----------------------------------------------------
  if (role === 'buyer') {
    if (buyerOrgStatus !== 'Approved') {
      return (
        <div className="min-h-screen flex flex-col bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-[#EAF2FA]">
          <AuthScreen initialRoute="buyer-pending" />
          <DemoModeWidget />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-[#EAF2FA]">
        <BuyerLayout />
        <DemoModeWidget />
      </div>
    );
  }

  // Render based on current role and navigation
  const renderContent = () => {
    // ----------------------------------------------------
    // PUBLIC EXPERIENCE (Unauthenticated / Public Browsing)
    // ----------------------------------------------------
    if (role === 'public') {
      if (viewingCallId) {
        return (
          <PublicCallDetail
            callId={viewingCallId}
            onBack={() => setViewingCallId(null)}
          />
        );
      }
      if (activeNav === 'auth' || activeNav === 'signin' || activeNav === 'supplier-login') {
        return <AuthScreen initialRoute="supplier-login" />;
      }
      if (activeNav === 'signup' || activeNav === 'register' || activeNav === 'supplier-signup') {
        return <AuthScreen initialRoute="supplier-signup" />;
      }
      if (activeNav === 'buyer-login') {
        return <AuthScreen initialRoute="buyer-login" />;
      }
      if (activeNav === 'buyer-signup') {
        return <AuthScreen initialRoute="buyer-signup" />;
      }
      if (activeNav === 'buyer-pending') {
        return <AuthScreen initialRoute="buyer-pending" />;
      }
      if (activeNav === 'org-login') {
        return <AuthScreen initialRoute="org-login" />;
      }
      if (activeNav === 'admin-login') {
        return <AuthScreen initialRoute="admin-login" />;
      }
      if (activeNav === 'forgot-password') {
        return <AuthScreen initialRoute="forgot-password" />;
      }
      if (activeNav === 'reset-password') {
        return <AuthScreen initialRoute="reset-password" />;
      }
      if (activeNav === 'accept-invite') {
        return <AuthScreen initialRoute="accept-invite" />;
      }
      if (activeNav === 'choose-workspace') {
        return <AuthScreen initialRoute="choose-workspace" />;
      }
      if (activeNav === 'session-expired') {
        return <AuthScreen initialRoute="session-expired" />;
      }
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
      return <PublicAbout />;
    }

    // ----------------------------------------------------
    // SUPPLIER EXPERIENCE
    // ----------------------------------------------------
    if (role === 'supplier') {
      switch (activeNav) {
        case 'dashboard':
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
        case 'opportunities':
          return (
            <PublicOpportunities
              onSelectCall={(callId) => {
                setSelectedCallId(callId);
                setActiveNav('apply');
              }}
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

    return <PublicAbout />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-[#EAF2FA] transition-colors duration-150">
      <Header />

      <main className="flex-1 container-1160 w-full py-8 sm:py-12">
        {renderContent()}
      </main>

      <Footer />

      {/* Global Collapsible Demo Mode Controller */}
      <DemoModeWidget />
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

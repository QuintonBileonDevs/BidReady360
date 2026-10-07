import React from 'react';
import { Logo } from '../common/Logo';
import { RingMotif } from '../ui/RingMotif';
import { useApp } from '../../context/AppContext';
import {
  ArrowLeft,
  Globe,
  Lock,
  FileCheck2,
  ShieldCheck,
  Building2,
} from 'lucide-react';

export interface TrustPoint {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export interface AuthLayoutProps {
  children: React.ReactNode;
  leftMessage?: string;
  tagline?: string;
  trustPoints?: TrustPoint[];
  backLinkText?: string;
  onBack?: () => void;
  brandAccentColor?: string;
  customLogo?: React.ReactNode;
  organizationName?: string;
  showPoweredBy?: boolean;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  leftMessage = 'Register once. Bid anywhere.',
  trustPoints = [
    {
      icon: <Lock className="w-5 h-5 text-[#6FAEE0]" strokeWidth={1.5} />,
      title: 'Sealed bids',
      description: 'Bids stay sealed until an authorized opening session is held after the closing time.',
    },
    {
      icon: <FileCheck2 className="w-5 h-5 text-[#2F8F5B]" strokeWidth={1.5} />,
      title: 'Verified documents',
      description: 'Documents are checked against registries so you can submit them with confidence.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-[#1F5F99]" strokeWidth={1.5} />,
      title: 'You control what you share',
      description: 'You choose which organizations can view your profile and documents.',
    },
  ],
  backLinkText = 'Back to website',
  onBack,
  brandAccentColor,
  customLogo,
  organizationName,
  showPoweredBy = false,
}) => {
  const { setActiveNav, setRole, language, setLanguage } = useApp();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setRole('public');
      setActiveNav('about');
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-white">
      {/* ======================================================== */}
      {/* DESKTOP LEFT PANEL: INK BACKGROUND WITH RING MOTIF       */}
      {/* ======================================================== */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-[#10212E] text-white p-12 xl:p-16 relative flex-col justify-between overflow-hidden border-r border-[#1E364A]">
        {/* Large thin ring outline cropped at the edge */}
        <RingMotif
          size={560}
          dotAngle={45}
          color="#1E364A"
          opacity={0.5}
          position="bottom-right"
        />

        {/* Top: Logo / Brand */}
        <div className="relative z-10 space-y-4">
          {customLogo || <Logo theme="dark" size="lg" />}
          {organizationName && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[#1E364A] text-[14px] text-[#B2C3D2] border border-white/10 font-medium">
              <Building2 className="w-4 h-4 text-[#6FAEE0]" strokeWidth={1.5} />
              <span>{organizationName}</span>
            </div>
          )}
        </div>

        {/* Middle: One-line Message & Three Trust Points */}
        <div className="relative z-10 space-y-8 my-auto py-8 max-w-md">
          <div className="space-y-3">
            <h1 className="text-[32px] xl:text-[36px] font-heading font-semibold text-white tracking-tight leading-tight">
              {leftMessage}
            </h1>
          </div>

          <div className="space-y-5 pt-4 border-t border-[#1E364A]">
            {trustPoints.map((point, index) => (
              <div key={index} className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-[6px] bg-[#132635] border border-[#1E364A] flex items-center justify-center shrink-0 mt-0.5">
                  {point.icon}
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-[15px] font-heading font-semibold text-white">
                    {point.title}
                  </h3>
                  <p className="text-[14px] text-[#B2C3D2] leading-relaxed">
                    {point.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Civic Reference */}
        <div className="relative z-10 pt-6 border-t border-[#1E364A] flex items-center justify-between text-[14px] text-[#7D92A4]">
          <span>BidReady360 Botswana</span>
          <span>Democracy & Transparency</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT PANEL: SURFACE WITH BORDERED FORM CARD (MAX 440PX) */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col justify-between p-4 sm:p-8 lg:p-12 overflow-y-auto bg-[#F7FAFD] dark:bg-[#0D1A25]">
        {/* Top Header Bar on Form Side */}
        <div className="max-w-[440px] w-full mx-auto flex items-center justify-between gap-4 pb-4 sm:pb-6">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#43525F] dark:text-[#B2C3D2] hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] transition-colors min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            <span>{backLinkText}</span>
          </button>

          {/* Language Toggle */}
          <div className="flex items-center gap-1.5 text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
            <Globe className="w-4 h-4 text-[#1F5F99] dark:text-[#6FAEE0]" strokeWidth={1.5} />
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`font-semibold cursor-pointer min-h-[44px] inline-flex items-center ${
                language === 'en'
                  ? 'text-[#1F5F99] dark:text-[#6FAEE0] underline'
                  : 'text-[#6B7A87] hover:text-[#10212E]'
              }`}
            >
              EN
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={() => setLanguage('tn')}
              className={`font-semibold cursor-pointer min-h-[44px] inline-flex items-center ${
                language === 'tn'
                  ? 'text-[#1F5F99] dark:text-[#6FAEE0] underline'
                  : 'text-[#6B7A87] hover:text-[#10212E]'
              }`}
            >
              TN
            </button>
          </div>
        </div>

        {/* Mobile Header with Logo on top */}
        <div className="lg:hidden max-w-[440px] w-full mx-auto pb-4">
          {customLogo || <Logo theme="light" size="md" />}
        </div>

        {/* Form Card Area: White bordered card, 12px radius, no shadow, max 440px */}
        <div className="my-auto py-2 sm:py-4 max-w-[440px] w-full mx-auto">
          <div className="bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] p-6 sm:p-8 shadow-none space-y-6">
            {children}
          </div>
        </div>

        {/* Bottom Footer: Terms and Privacy notice */}
        <div className="max-w-[440px] w-full mx-auto pt-6 text-center text-[14px] text-[#6B7A87] space-y-2">
          {showPoweredBy && (
            <div className="flex items-center justify-center gap-2 pb-1">
              <span>Powered by</span>
              <Logo size="sm" />
            </div>
          )}
          <div className="flex items-center justify-center gap-4 text-[14px]">
            <button
              type="button"
              onClick={() => {
                setRole('public');
                setActiveNav('help');
              }}
              className="hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] hover:underline"
            >
              Terms
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => {
                setRole('public');
                setActiveNav('help');
              }}
              className="hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] hover:underline"
            >
              Privacy notice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

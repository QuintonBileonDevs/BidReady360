import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Building2,
  Briefcase,
  ShieldCheck,
  X,
  Lock,
  Mail,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  User,
  Phone,
  Check,
  KeyRound,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Logo } from '../common/Logo';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { authApi } from '../../services/api';

export type AuthTenant = 'supplier' | 'buyer' | 'auditor';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTenant?: AuthTenant;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialTenant = 'supplier',
  initialMode = 'signin',
}) => {
  const { setRole, setActiveNav, updateSupplierProfile, registerBuyerOrganization, loginSuccess } = useApp();
  const [tenant, setTenant] = useState<AuthTenant>(initialTenant);
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cipaNumber, setCipaNumber] = useState('');
  const [buyerOrg, setBuyerOrg] = useState('');
  const [staffId, setStaffId] = useState('');

  if (!isOpen) return null;

  const handleOpenFullPage = () => {
    onClose();
    if (tenant === 'buyer') {
      setActiveNav(mode === 'signup' ? 'buyer-signup' : 'buyer-login');
    } else {
      setActiveNav(mode === 'signup' ? 'supplier-signup' : 'supplier-login');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg('Please provide both email and password.');
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg(mode === 'signup' ? 'Setting up verified workspace...' : 'Verifying credentials...');

    try {
      if (mode === 'signup') {
        if (tenant === 'supplier') {
          const res = await authApi.registerSupplier({
            legalName: companyName.trim() || 'My Supplier Entity',
            cipaUin: cipaNumber.trim().toUpperCase() || `BW${Date.now().toString().slice(-8)}`,
            fullName: email.split('@')[0] || 'Supplier Admin',
            email: email.trim().toLowerCase(),
            password,
          });
          updateSupplierProfile({
            id: res.user?.memberships?.[0]?.tenantId || 'sup-new',
            legalName: companyName.trim() || 'My Supplier Entity',
            tradingName: companyName.trim() || 'My Supplier Entity',
            cipaNumber: cipaNumber.trim().toUpperCase() || `BW${Date.now().toString().slice(-8)}`,
            email: email.trim().toLowerCase(),
          });
          loginSuccess(
            {
              user: res.user,
              activeTenant: res.user?.memberships?.[0] || {
                tenantType: 'supplier',
                tenantId: 'sup-registered',
                tenantName: companyName.trim() || 'My Supplier Entity',
              },
              token: res.token,
            },
            'supplier'
          );
        } else {
          await authApi.registerBuyer({
            organizationName: buyerOrg.trim() || 'Procuring Entity',
            fullName: email.split('@')[0] || 'Procurement Lead',
            email: email.trim().toLowerCase(),
            password,
          });
          registerBuyerOrganization({
            orgName: buyerOrg.trim() || 'Procuring Entity',
            email: email.trim(),
          });
          setActiveNav('buyer-pending');
        }
      } else {
        const res = await authApi.login(email.trim().toLowerCase(), password);
        if (res.requiresMfa) {
          onClose();
          setActiveNav(tenant === 'buyer' ? 'buyer-login' : 'supplier-login');
          return;
        }

        const targetResolvedRole = tenant === 'buyer' || tenant === 'auditor' ? 'buyer' : 'supplier';
        loginSuccess(
          {
            user: res.user,
            activeTenant: res.user?.memberships?.find((m: any) =>
              m.tenantType === (targetResolvedRole === 'supplier' ? 'supplier' : 'organization')
            ) || {
              tenantType: targetResolvedRole === 'supplier' ? 'supplier' : 'organization',
              tenantId: targetResolvedRole === 'supplier' ? 'sup-1' : 'org-grc',
              tenantName: targetResolvedRole === 'supplier' ? 'Registered Supplier' : 'Gaborone Regional Council',
            },
            token: res.token,
          },
          targetResolvedRole
        );
      }

      onClose();
    } catch (err: any) {
      console.error('[AUTH MODAL ERROR]', err);
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
      setSuccessMsg(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-xl bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[10px] shadow-elevated overflow-hidden z-10 flex flex-col max-h-[92vh]">
        {/* Top Dark Header */}
        <div className="bg-[#10212E] text-white p-6 relative border-b border-[#1E364A]">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-[6px] bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>

          <div className="space-y-1.5 pr-8">
            <div className="inline-flex items-center gap-1.5 text-xs text-[#6FAEE0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8A33D]" />
              <span>Botswana Unified Procurement Gateway</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-heading font-semibold text-white tracking-tight">
              {mode === 'signin' ? 'Sign In to BidReady360' : 'Register System Account'}
            </h2>
          </div>

          {/* Tenant Selector Tabs */}
          <div className="grid grid-cols-3 gap-1.5 mt-5 p-1 bg-[#132635] rounded-[8px] border border-[#1E364A]">
            <button
              type="button"
              onClick={() => {
                setTenant('supplier');
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-[6px] text-xs font-semibold transition-all ${
                tenant === 'supplier'
                  ? 'bg-[#1F5F99] text-white shadow-subtle'
                  : 'text-[#B2C3D2] hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              <span className="truncate">Supplier</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTenant('buyer');
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-[6px] text-xs font-semibold transition-all ${
                tenant === 'buyer'
                  ? 'bg-[#1F5F99] text-white shadow-subtle'
                  : 'text-[#B2C3D2] hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              <span className="truncate">Buyer Body</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTenant('auditor');
                setErrorMsg(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-[6px] text-xs font-semibold transition-all ${
                tenant === 'auditor'
                  ? 'bg-[#1F5F99] text-white shadow-subtle'
                  : 'text-[#B2C3D2] hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              <span className="truncate">Oversight</span>
            </button>
          </div>
        </div>

        {/* Modal Form Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-[#10212E] dark:text-white">
          {/* Mode Switcher */}
          <div className="flex items-center justify-between pb-3 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                }}
                className={`text-sm font-heading font-semibold pb-1 transition-colors border-b-2 ${
                  mode === 'signin'
                    ? 'text-[#1F5F99] dark:text-[#6FAEE0] border-[#1F5F99] dark:border-[#6FAEE0]'
                    : 'text-[#6B7A87] border-transparent hover:text-[#10212E]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                }}
                className={`text-sm font-heading font-semibold pb-1 transition-colors border-b-2 ${
                  mode === 'signup'
                    ? 'text-[#1F5F99] dark:text-[#6FAEE0] border-[#1F5F99] dark:border-[#6FAEE0]'
                    : 'text-[#6B7A87] border-transparent hover:text-[#10212E]'
                }`}
              >
                Register
              </button>
            </div>

            <button
              type="button"
              onClick={handleOpenFullPage}
              className="text-xs text-[#1F5F99] dark:text-[#6FAEE0] hover:underline font-semibold flex items-center gap-1"
            >
              <span>Full-Page Gateway</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Feedback alerts */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-[#C2412D] border border-rose-200 dark:border-rose-900 rounded-[6px] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-[#ECFDF5] dark:bg-[#065F46]/20 text-[#065F46] dark:text-[#6EE7B7] border border-[#A7F3D0] dark:border-[#065F46]/40 rounded-[6px] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {tenant === 'supplier' && mode === 'signup' && (
              <>
                <Input
                  label="Company Legal Name *"
                  placeholder="e.g. Tsodilo Civil Engineering (Pty) Ltd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
                <Input
                  label="CIPA Unique Identification Number (UIN) *"
                  placeholder="e.g. BW00001234567"
                  value={cipaNumber}
                  onChange={(e) => setCipaNumber(e.target.value)}
                  required
                />
              </>
            )}

            {tenant === 'buyer' && (
              <Input
                label="Procuring Entity / Organization Name *"
                placeholder="e.g. Gaborone Regional Council or Botswana Power Corporation"
                value={buyerOrg}
                onChange={(e) => setBuyerOrg(e.target.value)}
                required
              />
            )}

            <Input
              label="Account / Official Email *"
              type="email"
              placeholder={tenant === 'buyer' ? 'officer@council.gov.bw' : 'director@company.co.bw'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="username"
              required
            />

            <Input
              label="Password *"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="focus:outline-none hover:text-[#10212E] dark:hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              autoComplete="current-password"
              required
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full font-bold shadow-subtle"
                isLoading={isSubmitting}
                rightIcon={<ArrowRight />}
              >
                {mode === 'signin' ? `Sign In as ${tenant === 'supplier' ? 'Supplier' : 'Buyer'}` : 'Complete Registration'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

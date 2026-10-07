import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { PasswordRulesCheck } from './PasswordRulesCheck';
import {
  Building2,
  Lock,
  Mail,
  User,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  Info,
  Briefcase,
} from 'lucide-react';

interface BuyerSignupProps {
  onNavigate: (route: string) => void;
}

export const BuyerSignup: React.FC<BuyerSignupProps> = ({ onNavigate }) => {
  const { registerBuyerOrganization } = useApp();

  // Organization details
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('Local authority / Regional council');
  const [regNumber, setRegNumber] = useState('');
  const [city, setCity] = useState('Gaborone');

  // Your details
  const [userName, setUserName] = useState('');
  const [officialEmail, setOfficialEmail] = useState('');
  const [phone, setPhone] = useState('+267 ');
  const [jobTitle, setJobTitle] = useState('');

  // Credentials & Agreements
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleBlur = (field: string) => {
    const newErrors = { ...errors };
    if (field === 'orgName') {
      if (!orgName.trim()) newErrors.orgName = 'Enter the organization name.';
      else delete newErrors.orgName;
    }
    if (field === 'regNumber') {
      if (!regNumber.trim()) newErrors.regNumber = 'Enter the official registration or gazette reference.';
      else delete newErrors.regNumber;
    }
    if (field === 'userName') {
      if (!userName.trim()) newErrors.userName = 'Enter your full name.';
      else delete newErrors.userName;
    }
    if (field === 'officialEmail') {
      if (!officialEmail.trim() || !/\S+@\S+\.\S+/.test(officialEmail)) {
        newErrors.officialEmail = 'Enter an official work email like name@council.gov.bw';
      } else {
        delete newErrors.officialEmail;
      }
    }
    if (field === 'phone') {
      if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
        newErrors.phone = 'Enter a valid telephone number like +267 3651200';
      } else {
        delete newErrors.phone;
      }
    }
    if (field === 'jobTitle') {
      if (!jobTitle.trim()) newErrors.jobTitle = 'Enter your job title or designation.';
      else delete newErrors.jobTitle;
    }
    if (field === 'password') {
      if (password.length < 10) newErrors.password = 'Enter a password with at least 10 characters.';
      else delete newErrors.password;
    }
    setErrors(newErrors);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!orgName.trim()) newErrors.orgName = 'Enter the organization name.';
    if (!regNumber.trim()) newErrors.regNumber = 'Enter the official registration or gazette reference.';
    if (!userName.trim()) newErrors.userName = 'Enter your full name.';
    if (!officialEmail.trim() || !/\S+@\S+\.\S+/.test(officialEmail)) {
      newErrors.officialEmail = 'Enter an official work email like name@council.gov.bw';
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
      newErrors.phone = 'Enter a valid telephone number.';
    }
    if (!jobTitle.trim()) newErrors.jobTitle = 'Enter your job title.';
    if (password.length < 10) newErrors.password = 'Enter a password with at least 10 characters.';
    if (!agreedToTerms || !agreedToPrivacy) {
      newErrors.terms = 'You must agree to the Terms and Privacy notice.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    registerBuyerOrganization({
      orgName: orgName.trim(),
      email: officialEmail.trim(),
      orgType,
      regNumber: regNumber.trim(),
      jobTitle: jobTitle.trim(),
      phone: phone.trim(),
    });

    setTimeout(() => {
      setIsLoading(false);
      onNavigate('buyer-pending');
    }, 750);
  };

  return (
    <AuthLayout
      leftMessage="Run fair, transparent procurement."
      tagline="Equip your procuring organization with an auditable, sealed tender workspace to evaluate bids with confidence."
    >
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Register procuring organization
          </h2>
          <p className="text-[14px] text-[#6B7A87]">
            Set up an official workspace for your council, parastatal, or entity.
          </p>
        </div>

        {/* Short Note per user requirement */}
        <div className="p-3.5 rounded-[8px] bg-[#EAF2FA] dark:bg-[#162C3E] border border-[#C9D9E8] dark:border-[#1E364A] text-[14px] text-[#1F5F99] dark:text-[#6FAEE0] flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
          <span>New organizations are reviewed before they can publish calls.</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Organization Details Section */}
          <div className="space-y-3 pt-1">
            <span className="text-[13px] font-semibold text-[#10212E] dark:text-white uppercase tracking-wider block border-b border-[#D5E0EA] dark:border-[#1E364A] pb-1">
              Organization details
            </span>

            <Input
              label="Organization name *"
              placeholder="e.g. Gaborone Regional Council"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onBlur={() => handleBlur('orgName')}
              error={errors.orgName}
              leftIcon={<Building2 className="w-4 h-4" />}
            />

            <Select
              label="Organization type *"
              value={orgType}
              onChange={(e) => setOrgType(e.target.value)}
            >
              <option value="Local authority / Regional council">Local authority / Regional council</option>
              <option value="State-owned enterprise / Parastatal">State-owned enterprise / Parastatal</option>
              <option value="Central government ministry">Central government ministry</option>
              <option value="Corporate procuring entity">Corporate procuring entity</option>
            </Select>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Registration or gazette reference *"
                placeholder="e.g. BW-GOV-GRC-01"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                onBlur={() => handleBlur('regNumber')}
                error={errors.regNumber}
              />

              <Select
                label="City *"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="Gaborone">Gaborone</option>
                <option value="Francistown">Francistown</option>
                <option value="Maun">Maun</option>
                <option value="Palapye">Palapye</option>
                <option value="Jwaneng">Jwaneng</option>
                <option value="Selebi-Phikwe">Selebi-Phikwe</option>
                <option value="Kasane">Kasane</option>
              </Select>
            </div>
          </div>

          {/* Your Details Section */}
          <div className="space-y-3 pt-2">
            <span className="text-[13px] font-semibold text-[#10212E] dark:text-white uppercase tracking-wider block border-b border-[#D5E0EA] dark:border-[#1E364A] pb-1">
              Your details
            </span>

            <Input
              label="Full name *"
              placeholder="e.g. Kgosi Tau"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onBlur={() => handleBlur('userName')}
              error={errors.userName}
              leftIcon={<User className="w-4 h-4" />}
              autoComplete="name"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Official work email *"
                type="email"
                placeholder="e.g. k.tau@council.gov.bw"
                value={officialEmail}
                onChange={(e) => setOfficialEmail(e.target.value)}
                onBlur={() => handleBlur('officialEmail')}
                error={errors.officialEmail}
                leftIcon={<Mail className="w-4 h-4" />}
                autoComplete="email"
              />

              <Input
                label="Phone number *"
                type="tel"
                placeholder="+267 3651200"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => handleBlur('phone')}
                error={errors.phone}
                leftIcon={<Phone className="w-4 h-4" />}
                autoComplete="tel"
              />
            </div>

            <Input
              label="Job title *"
              placeholder="e.g. Principal Procurement Officer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              onBlur={() => handleBlur('jobTitle')}
              error={errors.jobTitle}
              leftIcon={<Briefcase className="w-4 h-4" />}
            />

            <div className="space-y-1">
              <Input
                label="Password *"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 10 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => handleBlur('password')}
                error={errors.password}
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="focus:outline-none hover:text-[#10212E] dark:hover:text-white"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                autoComplete="new-password"
              />
              <PasswordRulesCheck password={password} />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Checkbox
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              label="I agree to the Terms of Service"
            />

            <Checkbox
              checked={agreedToPrivacy}
              onChange={(e) => setAgreedToPrivacy(e.target.checked)}
              label="I agree to the Privacy notice"
            />

            {errors.terms && <p className="text-[14px] text-[#C2412D] font-medium">{errors.terms}</p>}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            isLoading={isLoading}
            rightIcon={<ArrowRight />}
          >
            Submit organization for review
          </Button>
        </form>

        {/* Bottom Switcher Link */}
        <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] text-center text-[14px] text-[#6B7A87]">
          Already have an approved account?{' '}
          <button
            type="button"
            onClick={() => onNavigate('buyer-login')}
            className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
          >
            Sign in
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { supplierApi } from '../../services/api';
import { Director } from '../../types';
import {
  calculateSupplierCompleteness,
  OnboardingChecklistItem,
} from '../../utils/supplierOnboarding';
import {
  Building2,
  Users,
  ShieldCheck,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Globe,
  Edit3,
  Plus,
  Trash2,
  CheckCircle2,
  Save,
  X,
  FileCheck,
  FileText,
  Award,
  AlertCircle,
  Briefcase,
  FolderTree,
  Eye,
  EyeOff,
  UserPlus,
  Clock,
  Sparkles,
  ArrowRight,
  Upload,
  Check,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  RotateCw,
} from 'lucide-react';

interface PastProject {
  id: string;
  client: string;
  title: string;
  valueBWP: number;
  startDate: string;
  endDate: string;
  referenceContact: {
    name: string;
    role: string;
    email: string;
    phone: string;
  };
  status: 'Completed' | 'Ongoing';
}

interface PreferenceClaim {
  id: string;
  title: string;
  description: string;
  basis: string;
  evidenceFile?: string;
  status: 'Claimed' | 'Verified' | 'Rejected' | 'Expired';
  verifiedDate?: string;
}

interface SupplierTeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Supplier admin' | 'Supplier staff';
  lastActive: string;
  status: 'Active' | 'Invited';
}

interface CategoryNode {
  code: string;
  name: string;
  children?: { code: string; name: string }[];
}

const CATEGORY_TREE: CategoryNode[] = [
  {
    code: 'Code 01',
    name: 'Building Works & Materials',
    children: [
      { code: 'Subcode 01', name: 'Building Construction' },
      { code: 'Subcode 02', name: 'Structural Timber & Roofing' },
      { code: 'Subcode 03', name: 'General Hardware Supply' },
      { code: 'Subcode 04', name: 'Prefabricated Structures' },
    ],
  },
  {
    code: 'Code 02',
    name: 'Electrical Works',
    children: [
      { code: 'Subcode 01', name: 'Electrical Installations & High Voltage' },
      { code: 'Subcode 02', name: 'Solar PV & Renewable Energy Systems' },
      { code: 'Subcode 03', name: 'Street Lighting & Generators' },
    ],
  },
  {
    code: 'Code 03',
    name: 'Civil Engineering Infrastructure',
    children: [
      { code: 'Subcode 01', name: 'Roads, Bridges & Paving Works' },
      { code: 'Subcode 02', name: 'Water & Sewerage Reticulation' },
      { code: 'Subcode 03', name: 'Earthworks & Plant Hire' },
    ],
  },
  {
    code: 'Code 104',
    name: 'ICT, Systems & Telecommunications',
    children: [
      { code: 'Subcode 01', name: 'ICT Hardware, Servers & Peripherals' },
      { code: 'Subcode 02', name: 'Software Development & ERP' },
    ],
  },
  {
    code: 'Code 318',
    name: 'General Facility Services & Supplies',
    children: [
      { code: 'Subcode 01', name: 'Office Stationery & Consumables' },
      { code: 'Subcode 02', name: 'Industrial Protective Wear & PPE' },
    ],
  },
];

export const SupplierProfile: React.FC = () => {
  const {
    supplier,
    documents,
    updateSupplierProfile,
    addAuditEvent,
    setActiveNav,
    resetDemoData,
  } = useApp();

  // Active section state
  const [activeSection, setActiveSection] = useState<
    'details' | 'directors' | 'categories' | 'projects' | 'preferences' | 'team'
  >('details');

  // Checklist Filter State ('All' | 'Company' | 'People' | 'Documents')
  const [checklistFilter, setChecklistFilter] = useState<'All' | 'Company' | 'People' | 'Documents'>('All');
  const [isChecklistVisible, setIsChecklistVisible] = useState(true);
  const [isHeaderMissingOpen, setIsHeaderMissingOpen] = useState(false);

  // Compute 15-item completeness dynamically from real memory state
  const completeness = calculateSupplierCompleteness(supplier, documents);

  // Company Details Form State
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [detailsLastUpdated, setDetailsLastUpdated] = useState('Today');
  const [detailsForm, setDetailsForm] = useState({
    legalName: supplier.legalName || '',
    tradingName: supplier.tradingName || '',
    cipaNumber: supplier.cipaNumber || '',
    tinNumber: supplier.tinNumber || '',
    companyType: supplier.companyType || 'Private Company (Pty) Ltd',
    yearEstablished: supplier.yearEstablished || new Date().getFullYear(),
    physicalAddress: supplier.physicalAddress || '',
    city: supplier.city || '',
    district: supplier.district || '',
    postalAddress: supplier.postalAddress || '',
    primaryPhone: supplier.primaryPhone || '',
    email: supplier.email || '',
    website: supplier.website || '',
    bankName: supplier.bankName || '',
    bankBranch: supplier.bankBranch || '',
    accountNumberMasked: supplier.accountNumberMasked || '',
    citizenOwnedPercentage: supplier.citizenOwnedPercentage ?? 0,
    description: supplier.description || '',
  });

  // Directors State & ID Masking
  const [directorsList, setDirectorsList] = useState<
    (Director & { idNumber: string; verificationStatus: 'Not started' | 'Pending' | 'Verified' })[]
  >(
    (supplier.directors || []).map((d) => ({
      ...d,
      idNumber: d.nationalIdOrPassport || '',
      verificationStatus: 'Verified',
    }))
  );
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [isDirectorDrawerOpen, setIsDirectorDrawerOpen] = useState(false);
  const [newDirectorForm, setNewDirectorForm] = useState({
    fullName: '',
    idNumber: '',
    nationality: 'Motswana',
    isCitizen: true,
    shareholdingPercentage: 0,
    role: 'Director',
  });

  // Categories State
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    supplier.categories?.length
      ? supplier.categories
      : supplier.category
      ? [supplier.category]
      : []
  );

  // Past Projects State
  const [projectsList, setProjectsList] = useState<PastProject[]>(
    supplier.pastProjects || []
  );
  const [isProjectDrawerOpen, setIsProjectDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<PastProject | null>(null);
  const [projectForm, setProjectForm] = useState<Omit<PastProject, 'id'>>({
    client: '',
    title: '',
    valueBWP: 1000000,
    startDate: 'Jan 2025',
    endDate: 'Completed',
    referenceContact: {
      name: '',
      role: '',
      email: '',
      phone: '',
    },
    status: 'Completed',
  });

  // Team State
  const [teamMembers, setTeamMembers] = useState<SupplierTeamMember[]>(
    supplier.teamMembers?.length
      ? supplier.teamMembers
      : [
          {
            id: 'tm-owner',
            name:
              supplier.directors?.[0]?.fullName ||
              supplier.legalName ||
              'Account Owner',
            email: supplier.email || '',
            role: 'Supplier admin',
            lastActive: 'Active now',
            status: 'Active',
          },
        ]
  );
  const [pendingInvites, setPendingInvites] = useState<
    { id: string; email: string; role: string; sentDate: string }[]
  >([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Supplier admin' | 'Supplier staff'>(
    'Supplier staff'
  );

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Sync state when supplier context updates (e.g. on reset demo or profile reload)
  useEffect(() => {
    if (!isEditingDetails) {
      setDetailsForm({
        legalName: supplier.legalName || '',
        tradingName: supplier.tradingName || '',
        cipaNumber: supplier.cipaNumber || '',
        tinNumber: supplier.tinNumber || '',
        companyType: supplier.companyType || 'Private Company (Pty) Ltd',
        yearEstablished: supplier.yearEstablished || new Date().getFullYear(),
        physicalAddress: supplier.physicalAddress || '',
        city: supplier.city || '',
        district: supplier.district || '',
        postalAddress: supplier.postalAddress || '',
        primaryPhone: supplier.primaryPhone || '',
        email: supplier.email || '',
        website: supplier.website || '',
        bankName: supplier.bankName || '',
        bankBranch: supplier.bankBranch || '',
        accountNumberMasked: supplier.accountNumberMasked || '',
        citizenOwnedPercentage: supplier.citizenOwnedPercentage ?? 0,
        description: supplier.description || '',
      });
    }

    setDirectorsList(
      (supplier.directors || []).map((d) => ({
        ...d,
        idNumber: d.nationalIdOrPassport || '',
        verificationStatus: 'Verified',
      }))
    );

    setSelectedCategories(
      supplier.categories?.length
        ? supplier.categories
        : supplier.category
        ? [supplier.category]
        : []
    );

    setProjectsList(supplier.pastProjects || []);

    if (supplier.teamMembers?.length) {
      setTeamMembers(supplier.teamMembers);
    }
  }, [supplier]);

  // Total shareholding calculation
  const totalOwnership = directorsList.reduce(
    (sum, d) => sum + (Number(d.shareholdingPercentage) || 0),
    0
  );

  // Section status calculation (dynamic based on actual memory values)
  const sectionStatuses: Record<
    string,
    { label: 'Complete' | 'Incomplete' | 'Needs attention'; color: string }
  > = {
    details: {
      label: completeness.items
        .filter((i) => i.category === 'Company')
        .every((i) => i.isComplete)
        ? 'Complete'
        : 'Incomplete',
      color: completeness.items
        .filter((i) => i.category === 'Company')
        .every((i) => i.isComplete)
        ? 'bg-[#ECFDF5] text-[#2F8F5B]'
        : 'bg-[#FFFBEB] text-[#D97706]',
    },
    directors: {
      label: directorsList.length > 0 && Math.round(totalOwnership) === 100
        ? 'Complete'
        : 'Incomplete',
      color: directorsList.length > 0 && Math.round(totalOwnership) === 100
        ? 'bg-[#ECFDF5] text-[#2F8F5B]'
        : 'bg-[#FFFBEB] text-[#D97706]',
    },
    categories: {
      label: selectedCategories.length > 0 ? 'Complete' : 'Incomplete',
      color: selectedCategories.length > 0
        ? 'bg-[#ECFDF5] text-[#2F8F5B]'
        : 'bg-[#FFFBEB] text-[#D97706]',
    },
    projects: {
      label: projectsList.length > 0 ? 'Complete' : 'Incomplete',
      color: projectsList.length > 0
        ? 'bg-[#ECFDF5] text-[#2F8F5B]'
        : 'bg-[#F7FAFD] text-[#6B7A87]',
    },
    preferences: {
      label: supplier.citizenOwnershipSet || supplier.citizenOwnedPercentage > 0
        ? 'Complete'
        : 'Needs attention',
      color: supplier.citizenOwnershipSet || supplier.citizenOwnedPercentage > 0
        ? 'bg-[#ECFDF5] text-[#2F8F5B]'
        : 'bg-[#FFFBEB] text-[#D97706]',
    },
    team: {
      label: teamMembers.length > 0 ? 'Complete' : 'Incomplete',
      color: teamMembers.length > 0
        ? 'bg-[#ECFDF5] text-[#2F8F5B]'
        : 'bg-[#FFFBEB] text-[#D97706]',
    },
  };

  // Preference claims computed dynamically from supplier attributes
  const preferenceClaims: PreferenceClaim[] = [
    {
      id: 'pref-citizen',
      title: `${supplier.citizenOwnedPercentage || 0}% Citizen shareholding`,
      description: `${supplier.citizenOwnedPercentage || 0}% Batswana citizen equity held by registered resident directors.`,
      basis: 'Citizen Economic Empowerment Programme (CEEP)',
      status: supplier.citizenOwnedPercentage > 0 ? 'Verified' : 'Claimed',
    },
    {
      id: 'pref-edd',
      title: 'Economic Diversification Drive (EDD)',
      description: supplier.eddCertified
        ? 'Certified local producer / supplier under Ministry of Trade EDD framework.'
        : 'Local enterprise manufacturing or service provider registration.',
      basis: 'Ministry of Trade & Industry EDD Scheme',
      status: supplier.eddCertified ? 'Verified' : 'Claimed',
    },
    {
      id: 'pref-women',
      title: 'Women-owned business preference margin',
      description: supplier.womenOwned
        ? 'Qualified enterprise with qualifying female citizen ownership.'
        : 'Enterprise with active directorship and ownership held by female citizen partners.',
      basis: 'National Gender Equity Procurement Margin',
      status: supplier.womenOwned ? 'Verified' : 'Claimed',
    },
    {
      id: 'pref-youth',
      title: 'Youth-owned business preference margin',
      description: supplier.youthOwned
        ? 'Qualified enterprise managed by youth entrepreneurs under 35 years.'
        : 'Statutory preference margin for companies with youth management.',
      basis: 'National Youth Procurement Framework',
      status: supplier.youthOwned ? 'Verified' : 'Claimed',
    },
    {
      id: 'pref-local',
      title: 'Local district procurement preference margin',
      description: `Physical operating premises located in ${supplier.district || supplier.city || 'local district'}.`,
      basis: 'Local Authority Procurement Preference Framework',
      status: supplier.district || supplier.city ? 'Verified' : 'Claimed',
    },
  ];

  // Checklist Item Click Handler -> Links directly to the field or section
  const handleChecklistItemClick = (item: OnboardingChecklistItem) => {
    if (item.category === 'Company') {
      setActiveSection('details');
      setIsEditingDetails(true);
      setTimeout(() => {
        const el = document.getElementById(item.fieldId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }, 150);
    } else if (item.category === 'People') {
      setActiveSection('directors');
      setIsDirectorDrawerOpen(true);
    } else if (item.category === 'Documents') {
      setActiveNav('vault');
    }
  };

  // Reveal masked ID handler
  const handleRevealId = (directorId: string, directorName: string) => {
    setRevealedIds((prev) => ({ ...prev, [directorId]: true }));
    addAuditEvent({
      action: 'National Identity Number Unmasked',
      actorName: 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      entityType: 'Supplier',
      entityId: directorId,
      details: `Revealed statutory identification number for director ${directorName}. Action recorded in audit ledger.`,
      ipAddress: '168.167.23.41',
    });
    showToast(`Identity number revealed for ${directorName}. Action logged in audit ledger.`);
  };

  // Save Company Details
  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    updateSupplierProfile({
      legalName: detailsForm.legalName.trim(),
      tradingName: detailsForm.tradingName.trim(),
      cipaNumber: detailsForm.cipaNumber.trim(),
      tinNumber: detailsForm.tinNumber.trim(),
      yearEstablished: Number(detailsForm.yearEstablished),
      physicalAddress: detailsForm.physicalAddress.trim(),
      city: detailsForm.city.trim(),
      district: detailsForm.district.trim(),
      postalAddress: detailsForm.postalAddress.trim(),
      primaryPhone: detailsForm.primaryPhone.trim(),
      email: detailsForm.email.trim(),
      website: detailsForm.website.trim(),
      bankName: detailsForm.bankName.trim(),
      bankBranch: detailsForm.bankBranch.trim(),
      accountNumberMasked: detailsForm.accountNumberMasked.trim(),
      citizenOwnedPercentage: Number(detailsForm.citizenOwnedPercentage),
      citizenOwnershipSet: true,
      description: detailsForm.description.trim(),
      detailsSaved: true,
    });
    setDetailsLastUpdated('Just now');
    setIsEditingDetails(false);
    showToast('Company details saved and profile completeness updated.');
  };

  // Add Director
  const handleAddDirectorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDirectorForm.fullName || !newDirectorForm.idNumber) return;

    const newDir = {
      id: `dir-${Date.now()}`,
      fullName: newDirectorForm.fullName.trim(),
      nationalIdOrPassport: newDirectorForm.idNumber.trim(),
      idNumber: newDirectorForm.idNumber.trim(),
      nationality: newDirectorForm.nationality,
      isCitizen: newDirectorForm.isCitizen,
      shareholdingPercentage: Number(newDirectorForm.shareholdingPercentage),
      role: newDirectorForm.role,
      verificationStatus: 'Verified' as const,
    };

    const updated = [...directorsList, newDir];
    setDirectorsList(updated);
    updateSupplierProfile({
      directors: updated.map((d) => ({
        id: d.id,
        fullName: d.fullName,
        nationalIdOrPassport: d.nationalIdOrPassport,
        nationality: d.nationality,
        isCitizen: d.isCitizen,
        shareholdingPercentage: d.shareholdingPercentage,
        role: d.role,
      })),
    });

    setIsDirectorDrawerOpen(false);
    setNewDirectorForm({
      fullName: '',
      idNumber: '',
      nationality: 'Motswana',
      isCitizen: true,
      shareholdingPercentage: 0,
      role: 'Director',
    });
    showToast(`Added ${newDir.fullName}. Ownership & completeness recalculated.`);
  };

  const handleDeleteDirector = (dirId: string) => {
    const updated = directorsList.filter((d) => d.id !== dirId);
    setDirectorsList(updated);
    updateSupplierProfile({
      directors: updated.map((d) => ({
        id: d.id,
        fullName: d.fullName,
        nationalIdOrPassport: d.nationalIdOrPassport,
        nationality: d.nationality,
        isCitizen: d.isCitizen,
        shareholdingPercentage: d.shareholdingPercentage,
        role: d.role,
      })),
    });
    showToast('Director removed and completeness recalculated.');
  };

  // Save Project
  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.client || !projectForm.title) return;

    let updatedProjects: PastProject[];
    if (editingProject) {
      updatedProjects = projectsList.map((p) =>
        p.id === editingProject.id ? { ...projectForm, id: p.id } : p
      );
      showToast(`Updated project: ${projectForm.title}`);
    } else {
      const newProj: PastProject = {
        ...projectForm,
        id: `proj-${Date.now()}`,
      };
      updatedProjects = [newProj, ...projectsList];
      showToast(`Added past project: ${projectForm.title}`);
    }

    setProjectsList(updatedProjects);
    updateSupplierProfile({ pastProjects: updatedProjects });
    setIsProjectDrawerOpen(false);
    setEditingProject(null);
  };

  // Open Edit Project
  const handleOpenEditProject = (proj: PastProject) => {
    setEditingProject(proj);
    setProjectForm({
      client: proj.client,
      title: proj.title,
      valueBWP: proj.valueBWP,
      startDate: proj.startDate,
      endDate: proj.endDate,
      referenceContact: proj.referenceContact,
      status: proj.status,
    });
    setIsProjectDrawerOpen(true);
  };

  // Toggle Category
  const handleToggleCategory = (catName: string) => {
    let next: string[];
    if (selectedCategories.includes(catName)) {
      next = selectedCategories.filter((c) => c !== catName);
    } else {
      next = [...selectedCategories, catName];
    }
    setSelectedCategories(next);
    updateSupplierProfile({
      categories: next,
      category: next[0] || '',
    });
  };

  // Invite Team Member (Any valid email format allowed, no domain restriction)
  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showToast('Enter a valid email address (e.g. name@example.com).');
      return;
    }

    setPendingInvites([
      ...pendingInvites,
      {
        id: `inv-${Date.now()}`,
        email: cleanEmail,
        role: inviteRole,
        sentDate: 'Just now',
      },
    ]);

    addAuditEvent({
      action: 'Team Member Invited',
      actorName: 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      entityType: 'Supplier',
      entityId: supplier.id,
      details: `Sent invitation to ${inviteEmail} as ${inviteRole}.`,
      ipAddress: '168.167.23.41',
    });

    setIsInviteModalOpen(false);
    setInviteEmail('');
    showToast(`Invitation sent to ${inviteEmail}.`);
  };

  // Filtered Checklist Items
  const displayedChecklistItems = completeness.items.filter((item) => {
    if (checklistFilter === 'All') return true;
    return item.category === checklistFilter;
  });

  return (
    <div className="space-y-8">
      {/* 0. Demo Mode Ribbon (if demo account) */}
      {supplier.isDemoAccount && (
        <div className="bg-[#FFFBEB] dark:bg-[#78350F]/20 border border-[#FDE68A] dark:border-[#78350F]/50 rounded-[10px] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[14px]">
          <div className="flex items-center gap-2.5 text-[#92400E] dark:text-[#FCD34D]">
            <Sparkles className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-semibold">Demo Account Mode:</span>{' '}
              <span>Inspecting sample data for Kopano Building Supplies (Pty) Ltd.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={resetDemoData}
            className="px-3 py-1.5 bg-[#D97706] hover:bg-[#B45309] text-white rounded-[6px] font-medium text-[13px] inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Reset demo data</span>
          </button>
        </div>
      )}

      {/* 1. Onboarding Checklist Banner (Shown until completeness is 100%) */}
      {!completeness.isComplete && (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 rounded-[4px] bg-[#EAF2FA] text-[#1F5F99] dark:bg-[#162C3E] dark:text-[#6FAEE0] text-[12px] font-semibold uppercase tracking-wider">
                  Onboarding Checklist
                </span>
                <span className="text-[14px] text-[#6B7A87]">
                  {completeness.completedCount} of {completeness.totalCount} completed
                </span>
              </div>
              <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
                Complete your profile to start applying
              </h2>
              <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
                15 statutory requirements of equal weight. Each links directly to its field and ticks off automatically.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsChecklistVisible(!isChecklistVisible)}
                className="p-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[#6B7A87] hover:text-[#10212E] transition-colors cursor-pointer"
                aria-label="Toggle checklist"
              >
                {isChecklistVisible ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#6B7A87]">Completeness: {completeness.completedCount}/15 items</span>
              <span className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] tabular-nums">
                {completeness.score}%
              </span>
            </div>
            <div className="h-2 w-full bg-[#EAF2FA] dark:bg-[#162C3E] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1F5F99] transition-all duration-300 rounded-full"
                style={{ width: `${completeness.score}%` }}
              />
            </div>
          </div>

          {/* Category Filter Pills & 15-Item Checklist */}
          {isChecklistVisible && (
            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {(['All', 'Company', 'People', 'Documents'] as const).map((tab) => {
                  const count =
                    tab === 'All'
                      ? completeness.items.length
                      : completeness.items.filter((i) => i.category === tab).length;
                  const completedInTab =
                    tab === 'All'
                      ? completeness.completedCount
                      : completeness.items.filter((i) => i.category === tab && i.isComplete).length;

                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setChecklistFilter(tab)}
                      className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                        checklistFilter === tab
                          ? 'bg-[#1F5F99] text-white'
                          : 'bg-[#F7FAFD] dark:bg-[#10212E] text-[#43525F] dark:text-[#B2C3D2] border border-[#D5E0EA] dark:border-[#1E364A]'
                      }`}
                    >
                      {tab} ({completedInTab}/{count})
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {displayedChecklistItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleChecklistItemClick(item)}
                    className={`p-3 rounded-[8px] border text-left flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                      item.isComplete
                        ? 'bg-[#F0FDF4] dark:bg-[#064E3B]/20 border-[#BBF7D0] dark:border-[#065F46]/50'
                        : 'bg-white dark:bg-[#132635] border-[#D5E0EA] dark:border-[#1E364A] hover:border-[#1F5F99]'
                    }`}
                  >
                    <div className="space-y-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold text-[13px] ${
                            item.isComplete
                              ? 'text-[#166534] dark:text-[#86EFAC] line-through opacity-85'
                              : 'text-[#10212E] dark:text-white'
                          }`}
                        >
                          {item.shortLabel}
                        </span>
                        <span className="text-[11px] px-1.5 py-0.2 rounded bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0]">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#6B7A87] line-clamp-1 leading-snug">
                        {item.description}
                      </p>
                    </div>

                    <div className="shrink-0 mt-0.5">
                      {item.isComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-[#2F8F5B]" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border-2 border-[#D5E0EA] dark:border-[#384C5C] flex items-center justify-center text-[10px] text-[#1F5F99] font-bold">
                          •
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Header with Profile Completeness Meter & What's Missing */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
              {supplier.legalName || 'Company Profile'}
            </h1>
            {completeness.isComplete ? (
              <span className="bg-[#ECFDF5] text-[#2F8F5B] px-2.5 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified supplier</span>
              </span>
            ) : (
              <span className="bg-[#FFFBEB] text-[#D97706] px-2.5 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Incomplete profile ({completeness.score}%)</span>
              </span>
            )}
          </div>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            CIPA UIN: {supplier.cipaNumber || 'Pending'} · Trading as{' '}
            {supplier.tradingName || 'Pending'} · Central supplier database profile
          </p>
        </div>

        {/* Completeness Meter */}
        <div className="bg-white dark:bg-[#132635] p-4 rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] shrink-0 min-w-[280px]">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[14px] font-semibold text-[#10212E] dark:text-white">
                Profile completeness
              </span>
              <span className="font-heading font-semibold text-[15px] text-[#10212E] dark:text-white tabular-nums">
                {completeness.score}% complete
              </span>
            </div>

            <div className="w-full h-2 bg-[#EAF2FA] dark:bg-[#1E364A] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1F5F99] rounded-full transition-all duration-300"
                style={{ width: `${completeness.score}%` }}
              />
            </div>

            <div className="text-[13px] text-[#6B7A87]">
              {completeness.isComplete ? (
                <span className="text-[#2F8F5B] font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ready for tender bidding</span>
                </span>
              ) : (
                <div className="space-y-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsHeaderMissingOpen(!isHeaderMissingOpen)}
                    className="text-[#1F5F99] dark:text-[#6FAEE0] font-medium text-[13px] hover:underline flex items-center justify-between w-full cursor-pointer"
                  >
                    <span>What's missing ({completeness.missingItems.length})</span>
                    {isHeaderMissingOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {isHeaderMissingOpen && (
                    <div className="mt-1.5 p-2 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1 max-h-40 overflow-y-auto">
                      {completeness.missingItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            handleChecklistItemClick(item);
                            setIsHeaderMissingOpen(false);
                          }}
                          className="w-full text-left text-[12px] py-1 px-1.5 rounded hover:bg-white dark:hover:bg-[#132635] text-[#43525F] dark:text-[#B2C3D2] hover:text-[#1F5F99] flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <span className="truncate pr-1">{item.label}</span>
                          <span className="text-[#D97706] text-[10px] font-semibold shrink-0">
                            Required
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-4 rounded-[12px] bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] flex items-center justify-between gap-3 text-[14px] animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[#065F46] hover:opacity-75 text-[14px] cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Main Two-Column Layout (Left Navigation + Right Section Content) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Left Section List */}
        <div className="lg:col-span-1 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-2 space-y-1">
          {[
            { id: 'details', label: 'Company details', icon: Building2 },
            { id: 'directors', label: 'Directors and owners', icon: Users },
            { id: 'categories', label: 'Categories', icon: FolderTree },
            { id: 'projects', label: 'Past projects', icon: Briefcase },
            { id: 'preferences', label: 'Preference status', icon: Award },
            { id: 'team', label: 'Team', icon: UserPlus },
          ].map((item) => {
            const isActive = activeSection === item.id;
            const Icon = item.icon;
            const status = sectionStatuses[item.id];

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id as any)}
                className={`w-full p-3 rounded-[8px] flex items-center justify-between gap-2 text-[14px] transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] font-semibold'
                    : 'text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {status && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-[4px] font-medium shrink-0 ${status.color}`}
                  >
                    {status.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Section Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* ================= SECTION 1: Company Details (10 Items) ================= */}
          {activeSection === 'details' && (
            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                <div>
                  <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                    Company details
                  </h2>
                  <span className="text-[14px] text-[#6B7A87]">
                    Last updated on {detailsLastUpdated}
                  </span>
                </div>

                {!isEditingDetails && (
                  <button
                    type="button"
                    onClick={() => setIsEditingDetails(true)}
                    className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit details</span>
                  </button>
                )}
              </div>

              {isEditingDetails ? (
                /* Inline Edit Form for all 10 Company items */
                <form onSubmit={handleSaveDetails} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Legal company name *
                      </label>
                      <input
                        id="field-legalName"
                        type="text"
                        required
                        value={detailsForm.legalName}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, legalName: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Trading name *
                      </label>
                      <input
                        id="field-tradingName"
                        type="text"
                        required
                        value={detailsForm.tradingName}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, tradingName: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        CIPA registration # *
                      </label>
                      <input
                        id="field-cipaNumber"
                        type="text"
                        required
                        value={detailsForm.cipaNumber}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, cipaNumber: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Tax number (BURS TIN) *
                      </label>
                      <input
                        id="field-tinNumber"
                        type="text"
                        required
                        value={detailsForm.tinNumber}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, tinNumber: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Citizen ownership % *
                      </label>
                      <input
                        id="field-citizenOwnedPercentage"
                        type="number"
                        min="0"
                        max="100"
                        required
                        value={detailsForm.citizenOwnedPercentage}
                        onChange={(e) =>
                          setDetailsForm({
                            ...detailsForm,
                            citizenOwnedPercentage: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                      Physical premises address *
                    </label>
                    <input
                      id="field-physicalAddress"
                      type="text"
                      required
                      placeholder="e.g. Plot 22019, G-West Industrial"
                      value={detailsForm.physicalAddress}
                      onChange={(e) =>
                        setDetailsForm({ ...detailsForm, physicalAddress: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        City / Town *
                      </label>
                      <input
                        id="field-city"
                        type="text"
                        required
                        placeholder="e.g. Gaborone"
                        value={detailsForm.city}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, city: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        District *
                      </label>
                      <input
                        id="field-district"
                        type="text"
                        required
                        placeholder="e.g. South East District"
                        value={detailsForm.district}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, district: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Telephone *
                      </label>
                      <input
                        id="field-primaryPhone"
                        type="tel"
                        required
                        placeholder="e.g. +267 391 4455"
                        value={detailsForm.primaryPhone}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, primaryPhone: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Email address *
                      </label>
                      <input
                        id="field-email"
                        type="email"
                        required
                        placeholder="e.g. name@example.com"
                        value={detailsForm.email}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, email: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      />
                      <p className="text-[12px] text-[#6B7A87] dark:text-[#8FA2B2]">
                        Use an email you check regularly. Company and personal addresses are both fine.
                      </p>
                    </div>
                  </div>

                  {/* Commercial Banking Details */}
                  <div className="p-4 bg-[#F7FAFD] dark:bg-[#0D1A25] rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] space-y-3">
                    <span className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                      Commercial Banking Details *
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[12px] text-[#6B7A87] block">Bank name *</label>
                        <input
                          id="field-bankDetails"
                          type="text"
                          required
                          placeholder="e.g. First National Bank"
                          value={detailsForm.bankName}
                          onChange={(e) =>
                            setDetailsForm({ ...detailsForm, bankName: e.target.value })
                          }
                          className="w-full px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[13px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[12px] text-[#6B7A87] block">Branch name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Mall Branch"
                          value={detailsForm.bankBranch}
                          onChange={(e) =>
                            setDetailsForm({ ...detailsForm, bankBranch: e.target.value })
                          }
                          className="w-full px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[13px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[12px] text-[#6B7A87] block">Account number *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 62890123456"
                          value={detailsForm.accountNumberMasked}
                          onChange={(e) =>
                            setDetailsForm({ ...detailsForm, accountNumberMasked: e.target.value })
                          }
                          className="w-full px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[13px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Postal address
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. P.O. Box 4022, Gaborone"
                        value={detailsForm.postalAddress}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, postalAddress: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Website URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={detailsForm.website}
                        onChange={(e) =>
                          setDetailsForm({ ...detailsForm, website: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                      Company profile summary & scope of business
                    </label>
                    <textarea
                      rows={3}
                      value={detailsForm.description}
                      onChange={(e) =>
                        setDetailsForm({ ...detailsForm, description: e.target.value })
                      }
                      className="w-full p-3 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                    />
                  </div>

                  <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEditingDetails(false)}
                      className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save changes</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Static Read-Only Details */
                <div className="space-y-6 text-[14px]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Legal company name</span>
                      <span className="font-semibold text-[#10212E] dark:text-white block">
                        {detailsForm.legalName || 'Not specified'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Trading name</span>
                      <span className="font-semibold text-[#10212E] dark:text-white block">
                        {detailsForm.tradingName || 'Not specified'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">CIPA registration #</span>
                      <span className="font-semibold text-[#10212E] dark:text-white block tabular-nums">
                        {detailsForm.cipaNumber || 'Not specified'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">BURS tax number (TIN)</span>
                      <span className="font-semibold text-[#10212E] dark:text-white block tabular-nums">
                        {detailsForm.tinNumber || 'Not specified'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Citizen ownership %</span>
                      <span className="font-semibold text-[#10212E] dark:text-white block tabular-nums">
                        {detailsForm.citizenOwnedPercentage}%
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Telephone</span>
                      <span className="font-semibold text-[#10212E] dark:text-white block tabular-nums">
                        {detailsForm.primaryPhone || 'Not specified'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Official email</span>
                      <span className="font-medium text-[#1F5F99] dark:text-[#6FAEE0] block">
                        {detailsForm.email || 'Not specified'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">City / District</span>
                      <span className="font-medium text-[#10212E] dark:text-white block">
                        {detailsForm.city || 'N/A'}{detailsForm.district ? `, ${detailsForm.district}` : ''}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Banking details</span>
                      <span className="font-medium text-[#10212E] dark:text-white block">
                        {detailsForm.bankName
                          ? `${detailsForm.bankName} (${detailsForm.bankBranch || 'Active'})`
                          : 'Not provided'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] space-y-4">
                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Registered physical address</span>
                      <span className="font-semibold text-[#10212E] dark:text-white block">
                        {detailsForm.physicalAddress || 'Not recorded'}
                      </span>
                      {detailsForm.postalAddress && (
                        <span className="text-[#43525F] dark:text-[#B2C3D2] block">
                          Postal: {detailsForm.postalAddress}
                        </span>
                      )}
                    </div>

                    {detailsForm.description && (
                      <div className="space-y-1">
                        <span className="text-[14px] text-[#6B7A87] font-medium block">Company description</span>
                        <p className="text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                          {detailsForm.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= SECTION 2: Directors and Owners (1 Item: 100% Equity) ================= */}
          {activeSection === 'directors' && (
            <div id="field-directors" className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                <div>
                  <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                    Directors and beneficial owners
                  </h2>
                  <p className="text-[14px] text-[#6B7A87] mt-0.5">
                    Statutory requirement: At least one resident director, with total shareholdings tallying exactly 100%.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDirectorDrawerOpen(true)}
                  className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add director</span>
                </button>
              </div>

              {/* Ownership Total & Status */}
              <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[14px]">
                <div className="flex items-center gap-2">
                  <span className="text-[#6B7A87]">Running equity total:</span>
                  <span className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white tabular-nums">
                    {totalOwnership}%
                  </span>
                  {directorsList.length > 0 && Math.round(totalOwnership) === 100 ? (
                    <span className="bg-[#ECFDF5] text-[#2F8F5B] px-2 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Balanced (100% equity allocated)</span>
                    </span>
                  ) : totalOwnership > 100 ? (
                    <span className="bg-[#FEF2F2] text-[#C2412D] px-2 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Exceeds 100% allocation</span>
                    </span>
                  ) : (
                    <span className="bg-[#FFFBEB] text-[#D97706] px-2 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      <span>{100 - totalOwnership}% unallocated</span>
                    </span>
                  )}
                </div>
                <span className="text-[13px] text-[#6B7A87]">
                  {directorsList.length} director{directorsList.length === 1 ? '' : 's'} recorded
                </span>
              </div>

              {/* Directors Table or Empty State */}
              {directorsList.length === 0 ? (
                <div className="p-8 border border-dashed border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] text-center space-y-3">
                  <p className="text-[15px] font-semibold text-[#10212E] dark:text-white">
                    No directors registered yet
                  </p>
                  <p className="text-[13px] text-[#6B7A87] max-w-md mx-auto">
                    To fulfill statutory compliance, add at least one resident director whose shareholdings total exactly 100%.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsDirectorDrawerOpen(true)}
                    className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add first director</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px]">
                  <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
                    <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[14px]">
                      <tr>
                        <th className="p-4">Name</th>
                        <th className="p-4">Role</th>
                        <th className="p-4 text-right">Ownership</th>
                        <th className="p-4">ID number</th>
                        <th className="p-4">Verification</th>
                        <th className="p-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                      {directorsList.map((dir) => {
                        const isRevealed = revealedIds[dir.id];
                        const maskedId = `••••••${(dir.idNumber || '').slice(-4)}`;

                        return (
                          <tr key={dir.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors">
                            <td className="p-4">
                              <div className="space-y-0.5">
                                <span className="font-semibold block">{dir.fullName}</span>
                                <span className="text-[13px] text-[#6B7A87] block">{dir.nationality}</span>
                              </div>
                            </td>

                            <td className="p-4 text-[#43525F] dark:text-[#B2C3D2]">{dir.role}</td>

                            <td className="p-4 font-semibold tabular-nums text-right text-[15px]">
                              {dir.shareholdingPercentage}%
                            </td>

                            <td className="p-4">
                              <div className="flex items-center gap-2 tabular-nums">
                                <span className="font-medium">
                                  {isRevealed ? dir.idNumber : maskedId}
                                </span>
                                {!isRevealed ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRevealId(dir.id, dir.fullName)}
                                    className="text-[13px] text-[#1F5F99] dark:text-[#6FAEE0] hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
                                    title="Unmask identity number (action logged)"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Reveal</span>
                                  </button>
                                ) : (
                                  <span className="text-[12px] text-[#2F8F5B] bg-[#ECFDF5] px-1.5 py-0.5 rounded">
                                    Audit logged
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-4">
                              <span
                                className={`text-[13px] px-2.5 py-0.5 rounded-[4px] font-medium inline-flex items-center gap-1 ${
                                  dir.verificationStatus === 'Verified'
                                    ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                                    : 'bg-[#FFFBEB] text-[#D97706]'
                                }`}
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>{dir.verificationStatus}</span>
                              </span>
                            </td>

                            <td className="p-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteDirector(dir.id)}
                                className="text-[#C2412D] hover:opacity-75 p-1 rounded cursor-pointer"
                                title="Remove director"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================= SECTION 3: Categories ================= */}
          {activeSection === 'categories' && (
            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
              <div className="space-y-1 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                  Supply and service categories
                </h2>
                <p className="text-[14px] text-[#6B7A87]">
                  Select the supply categories, industry disciplines, and commodity sectors registered to your company.
                </p>
              </div>

              {/* Selected Categories Removable Chips */}
              <div className="space-y-2">
                <span className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Active registered categories ({selectedCategories.length})
                </span>
                {selectedCategories.length === 0 ? (
                  <p className="text-[14px] text-[#6B7A87] italic">
                    No categories chosen yet. Select items from the list below to see matching tenders.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedCategories.map((cat) => (
                      <span
                        key={cat}
                        className="bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] px-3 py-1.5 rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2"
                      >
                        <span>{cat}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleCategory(cat)}
                          className="hover:opacity-75 cursor-pointer text-[#1F5F99] dark:text-[#6FAEE0]"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Category Tree */}
              <div className="space-y-3 pt-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#6B7A87] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by code or category name (e.g. Building, Solar, Roads)..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  />
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] p-3">
                  {CATEGORY_TREE.map((node) => {
                    const matchesSearch =
                      !categorySearch ||
                      node.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
                      node.code.toLowerCase().includes(categorySearch.toLowerCase()) ||
                      (node.children || []).some((c) =>
                        c.name.toLowerCase().includes(categorySearch.toLowerCase())
                      );

                    if (!matchesSearch) return null;

                    const isNodeSelected = selectedCategories.includes(
                      `${node.code} — ${node.name}`
                    );

                    return (
                      <div
                        key={node.code}
                        className="p-3 bg-[#F7FAFD]/60 dark:bg-[#10212E]/60 rounded-[6px] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                            {node.code} — {node.name}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleCategory(`${node.code} — ${node.name}`)
                            }
                            className={`px-2.5 py-1 rounded-[4px] text-[12px] font-medium cursor-pointer transition-colors ${
                              isNodeSelected
                                ? 'bg-[#2F8F5B] text-white'
                                : 'bg-[#1F5F99] text-white hover:bg-[#184c7a]'
                            }`}
                          >
                            {isNodeSelected ? 'Selected' : '+ Add Code'}
                          </button>
                        </div>

                        {node.children && (
                          <div className="pl-4 space-y-1 pt-1 border-l-2 border-[#D5E0EA] dark:border-[#1E364A]">
                            {node.children.map((child) => {
                              const childLabel = `${child.code}: ${child.name}`;
                              const isChildSelected = selectedCategories.includes(childLabel);

                              return (
                                <div
                                  key={child.code}
                                  className="flex items-center justify-between text-[13px] py-1"
                                >
                                  <span className="text-[#43525F] dark:text-[#B2C3D2]">
                                    {childLabel}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCategory(childLabel)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                                      isChildSelected
                                        ? 'bg-[#2F8F5B] text-white'
                                        : 'bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] text-[#1F5F99] hover:bg-[#F7FAFD]'
                                    }`}
                                  >
                                    {isChildSelected ? 'Selected' : '+ Select'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION 4: Past Projects ================= */}
          {activeSection === 'projects' && (
            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                <div>
                  <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                    Past projects & track record
                  </h2>
                  <p className="text-[14px] text-[#6B7A87]">
                    Record completed and ongoing contracts to satisfy technical qualification criteria.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingProject(null);
                    setProjectForm({
                      client: '',
                      title: '',
                      valueBWP: 500000,
                      startDate: 'Jan 2025',
                      endDate: 'Dec 2025',
                      referenceContact: { name: '', role: '', email: '', phone: '' },
                      status: 'Completed',
                    });
                    setIsProjectDrawerOpen(true);
                  }}
                  className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add project</span>
                </button>
              </div>

              {/* Projects Card List or Empty State */}
              {projectsList.length === 0 ? (
                <div className="p-8 border border-dashed border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] text-center space-y-3">
                  <p className="text-[15px] font-semibold text-[#10212E] dark:text-white">
                    No past projects recorded yet
                  </p>
                  <p className="text-[13px] text-[#6B7A87] max-w-md mx-auto">
                    Add prior commercial contracts and public sector work to strengthen your technical capability evaluations.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProject(null);
                      setIsProjectDrawerOpen(true);
                    }}
                    className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add first project</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {projectsList.map((proj) => (
                    <div
                      key={proj.id}
                      className="p-5 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/40 dark:bg-[#10212E]/40 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] font-semibold text-[#1F5F99] dark:text-[#6FAEE0]">
                              {proj.client}
                            </span>
                            <span
                              className={`text-[13px] px-2 py-0.5 rounded-[4px] font-medium ${
                                proj.status === 'Completed'
                                  ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                                  : 'bg-[#EAF2FA] text-[#1F5F99]'
                              }`}
                            >
                              {proj.status}
                            </span>
                          </div>
                          <h3 className="font-heading font-semibold text-[17px] text-[#10212E] dark:text-white">
                            {proj.title}
                          </h3>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <span className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white tabular-nums block">
                            BWP {proj.valueBWP.toLocaleString()}
                          </span>
                          <span className="text-[13px] text-[#6B7A87] block">
                            {proj.startDate} – {proj.endDate}
                          </span>
                        </div>
                      </div>

                      {/* Reference Contact */}
                      <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[14px]">
                        <div className="text-[#43525F] dark:text-[#B2C3D2]">
                          <span className="text-[#6B7A87]">Reference officer: </span>
                          <strong>{proj.referenceContact?.name || 'Contact'}</strong> (
                          {proj.referenceContact?.role || 'Officer'}) ·{' '}
                          <span>{proj.referenceContact?.phone || 'Phone'}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenEditProject(proj)}
                          className="text-[14px] text-[#1F5F99] dark:text-[#6FAEE0] hover:underline font-medium cursor-pointer self-start sm:self-auto"
                        >
                          Edit project
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= SECTION 5: Preference Status ================= */}
          {activeSection === 'preferences' && (
            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6 text-center">
              <div className="max-w-md mx-auto space-y-4 py-4">
                <div className="w-12 h-12 rounded-full bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#38BDF8] flex items-center gap-2 justify-center mx-auto">
                  <Award className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                    Statutory preference status & claims
                  </h2>
                  <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
                    Preference claims, citizen equity, and statutory compliance documents are now unified under <strong>Documents and eligibility</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav('vault')}
                  className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>Go to Documents and eligibility</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= SECTION 6: Team ================= */}
          {activeSection === 'team' && (
            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                <div>
                  <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                    Supplier team & access
                  </h2>
                  <p className="text-[14px] text-[#6B7A87] mt-0.5">
                    Authorized company staff authorized to prepare tender bids and submit electronic proposals.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Invite member</span>
                </button>
              </div>

              {/* Active Members Table */}
              <div className="space-y-3">
                <span className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Active members ({teamMembers.length})
                </span>

                <div className="overflow-x-auto border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px]">
                  <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
                    <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[14px]">
                      <tr>
                        <th className="p-3.5">Name</th>
                        <th className="p-3.5">Email address</th>
                        <th className="p-3.5">Role</th>
                        <th className="p-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                      {teamMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]">
                          <td className="p-3.5 font-semibold">{member.name}</td>
                          <td className="p-3.5 text-[#43525F] dark:text-[#B2C3D2]">
                            {member.email || 'N/A'}
                          </td>
                          <td className="p-3.5">
                            <span className="text-[13px] px-2.5 py-0.5 rounded-[4px] font-medium bg-[#EAF2FA] text-[#1F5F99]">
                              {member.role}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="text-[13px] bg-[#ECFDF5] text-[#2F8F5B] px-2 py-0.5 rounded-[4px] font-medium">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pending Invitations List */}
              {pendingInvites.length > 0 && (
                <div className="space-y-3 pt-3">
                  <span className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Pending invitations ({pendingInvites.length})
                  </span>

                  <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px]">
                    {pendingInvites.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3.5 flex items-center justify-between gap-4 text-[14px]"
                      >
                        <div className="space-y-0.5">
                          <span className="font-semibold text-[#10212E] dark:text-white block">
                            {inv.email}
                          </span>
                          <span className="text-[#6B7A87]">
                            Role: {inv.role} · Sent {inv.sentDate}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPendingInvites(pendingInvites.filter((i) => i.id !== inv.id));
                              showToast(`Cancelled invitation for ${inv.email}`);
                            }}
                            className="text-[14px] text-[#C2412D] hover:underline cursor-pointer"
                          >
                            Revoke
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. MODAL: Add Director */}
      {isDirectorDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-xl animate-fade-in my-8">
            <div className="flex items-start justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div>
                <h3 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
                  Add director or beneficial owner
                </h3>
                <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] mt-0.5">
                  Record CIPA registered person and equity allocation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDirectorDrawerOpen(false)}
                className="p-1 text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white rounded-[4px] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDirectorSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Full legal name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Boitumelo Masire"
                  value={newDirectorForm.fullName}
                  onChange={(e) =>
                    setNewDirectorForm({ ...newDirectorForm, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    National ID / Omang *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 529124018"
                    value={newDirectorForm.idNumber}
                    onChange={(e) =>
                      setNewDirectorForm({ ...newDirectorForm, idNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Nationality *
                  </label>
                  <input
                    type="text"
                    required
                    value={newDirectorForm.nationality}
                    onChange={(e) =>
                      setNewDirectorForm({ ...newDirectorForm, nationality: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Shareholding percentage (%) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={newDirectorForm.shareholdingPercentage}
                    onChange={(e) =>
                      setNewDirectorForm({
                        ...newDirectorForm,
                        shareholdingPercentage: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Statutory role
                  </label>
                  <select
                    value={newDirectorForm.role}
                    onChange={(e) =>
                      setNewDirectorForm({ ...newDirectorForm, role: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  >
                    <option value="Director">Director</option>
                    <option value="Managing Director">Managing Director</option>
                    <option value="Shareholder">Shareholder</option>
                    <option value="Company Secretary">Company Secretary</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDirectorDrawerOpen(false)}
                  className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add person</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: Add / Edit Project */}
      {isProjectDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-xl animate-fade-in my-8">
            <div className="flex items-start justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div>
                <h3 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
                  {editingProject ? 'Edit past project' : 'Add past project'}
                </h3>
                <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] mt-0.5">
                  Record contract details and reference official contact.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProjectDrawerOpen(false)}
                className="p-1 text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white rounded-[4px] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Client / Buying organization *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ministry of Local Government & Rural Development"
                  value={projectForm.client}
                  onChange={(e) => setProjectForm({ ...projectForm, client: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Project title & scope *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supply and delivery of structural roofing materials"
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Contract value (BWP) *
                  </label>
                  <input
                    type="number"
                    required
                    value={projectForm.valueBWP}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, valueBWP: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Start date
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jan 2024"
                    value={projectForm.startDate}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Status
                  </label>
                  <select
                    value={projectForm.status}
                    onChange={(e) =>
                      setProjectForm({
                        ...projectForm,
                        status: e.target.value as 'Completed' | 'Ongoing',
                      })
                    }
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  >
                    <option value="Completed">Completed</option>
                    <option value="Ongoing">Ongoing</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Reference contact officer name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kagiso Tau"
                  value={projectForm.referenceContact?.name || ''}
                  onChange={(e) =>
                    setProjectForm({
                      ...projectForm,
                      referenceContact: {
                        ...(projectForm.referenceContact || { role: '', email: '', phone: '' }),
                        name: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>

              <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProjectDrawerOpen(false)}
                  className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Save project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: Invite Team Member */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] max-w-md w-full p-6 sm:p-8 space-y-6 shadow-xl animate-fade-in my-8">
            <div className="flex items-start justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div>
                <h3 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
                  Invite team member
                </h3>
                <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] mt-0.5">
                  Grant company access to prepare bids or administer the profile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white rounded-[4px] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Colleague email address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. name@example.com, gmail.com, or any address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
                <p className="text-[12px] text-[#6B7A87] dark:text-[#8FA2B2]">
                  Use an email you check regularly. Company and personal addresses are both fine. Supplier admins can invite staff using any email domain.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Role & permissions *
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as 'Supplier admin' | 'Supplier staff')
                  }
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                >
                  <option value="Supplier staff">Supplier staff (Bid preparation & viewing)</option>
                  <option value="Supplier admin">Supplier admin (Full authority & sealing bids)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Send invitation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

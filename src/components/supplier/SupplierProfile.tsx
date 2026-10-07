import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Director } from '../../mockData';
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
  Info,
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
      { code: 'Subcode 01', name: 'Road Construction & Earthworks' },
      { code: 'Subcode 02', name: 'Water Pipelines & Sewerage Works' },
      { code: 'Subcode 03', name: 'Bridges & Culverts' },
    ],
  },
  {
    code: 'Code 08',
    name: 'Mechanical Engineering',
    children: [
      { code: 'Subcode 01', name: 'HVAC & Air Conditioning' },
      { code: 'Subcode 02', name: 'Plumbing & Drainage Works' },
    ],
  },
  {
    code: 'Code 13',
    name: 'Information Technology & Telecommunications',
    children: [
      { code: 'Subcode 01', name: 'Hardware Supply & Networking' },
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
  const { supplier, updateSupplierProfile, addAuditEvent } = useApp();

  // Active section state
  const [activeSection, setActiveSection] = useState<
    'details' | 'directors' | 'categories' | 'projects' | 'preferences' | 'team'
  >('details');

  // Company Details Form State
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [detailsLastUpdated, setDetailsLastUpdated] = useState('3 October 2026');
  const [detailsForm, setDetailsForm] = useState({
    legalName: supplier.legalName,
    tradingName: supplier.tradingName,
    cipaNumber: supplier.cipaNumber,
    tinNumber: supplier.tinNumber,
    companyType: 'Private Company (Pty) Ltd',
    yearEstablished: supplier.yearEstablished,
    physicalAddress: supplier.physicalAddress,
    postalAddress: supplier.postalAddress,
    primaryPhone: supplier.primaryPhone,
    email: supplier.email,
    website: supplier.website || 'https://www.kopanobuilding.co.bw',
    description:
      'Tier-1 supplier and building contractor established in Gaborone, specializing in commercial hardware supplies, structural timber, and municipal infrastructure works across Botswana.',
  });

  // Directors State & ID Masking
  const [directorsList, setDirectorsList] = useState<
    (Director & { idNumber: string; verificationStatus: 'Not started' | 'Pending' | 'Verified' })[]
  >([
    {
      id: 'dir-1',
      fullName: 'Kagiso Boitumelo Molosiwa',
      nationalIdOrPassport: '618219401',
      idNumber: '618219401',
      nationality: 'Motswana',
      isCitizen: true,
      shareholdingPercentage: 60,
      role: 'Managing Director',
      verificationStatus: 'Verified',
    },
    {
      id: 'dir-2',
      fullName: 'Lesego Tebogo Kgosi',
      nationalIdOrPassport: '529124018',
      idNumber: '529124018',
      nationality: 'Motswana',
      isCitizen: true,
      shareholdingPercentage: 40,
      role: 'Director',
      verificationStatus: 'Verified',
    },
  ]);
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Code 01 — Building Works & Materials',
    'Subcode 01: Building Construction',
    'Subcode 02: Structural Timber & Roofing',
    'Subcode 03: General Hardware Supply',
    'Code 03 — Civil Engineering Infrastructure',
  ]);

  // Past Projects State
  const [projectsList, setProjectsList] = useState<PastProject[]>([
    {
      id: 'proj-1',
      client: 'Gaborone Regional Council',
      title: 'Supply of Structural Timber & Roofing Trusses for Block 8 Clinic Expansion',
      valueBWP: 2340000,
      startDate: 'Jan 2025',
      endDate: 'Aug 2025',
      referenceContact: {
        name: 'K. Tau',
        role: 'Lead Procurement Specialist',
        email: 'k.tau@grc.gov.bw',
        phone: '+267 72 310 980',
      },
      status: 'Completed',
    },
    {
      id: 'proj-2',
      client: 'Botswana Housing Corporation',
      title: 'Bulk Delivery of SABS Certified Cement & Masonry Supplies (Tsholofelo Park)',
      valueBWP: 4850000,
      startDate: 'Mar 2024',
      endDate: 'Nov 2024',
      referenceContact: {
        name: 'O. Sechele',
        role: 'Project Director',
        email: 'o.sechele@bhc.bw',
        phone: '+267 360 5100',
      },
      status: 'Completed',
    },
    {
      id: 'proj-3',
      client: 'National Training Agency',
      title: 'Workshop Renovation & Facility Hardware Upgrade',
      valueBWP: 980000,
      startDate: 'Sep 2025',
      endDate: 'Ongoing',
      referenceContact: {
        name: 'M. Phiri',
        role: 'Facilities Engineer',
        email: 'm.phiri@nta.org.bw',
        phone: '+267 395 2100',
      },
      status: 'Ongoing',
    },
  ]);
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

  // Preference Status State
  const [preferenceClaims, setPreferenceClaims] = useState<PreferenceClaim[]>([
    {
      id: 'pref-citizen',
      title: '100% Citizen shareholding',
      description: '100% Batswana citizen equity held by registered resident directors.',
      basis: 'Citizen Economic Empowerment Programme (CEEP)',
      evidenceFile: 'CIPA_Annual_Return_Shareholders_2026.pdf',
      status: 'Verified',
      verifiedDate: '15 Jan 2026',
    },
    {
      id: 'pref-edd',
      title: 'Economic Diversification Drive (EDD)',
      description: 'Certified locally manufactured timber and certified building assembly products.',
      basis: 'Ministry of Trade & Industry EDD Certificate',
      evidenceFile: 'EDD_Manufacturing_Registration_2026.pdf',
      status: 'Verified',
      verifiedDate: '10 Feb 2026',
    },
    {
      id: 'pref-women',
      title: 'Women-owned business preference',
      description: '40% equity and active directorship held by female citizen partner.',
      basis: 'National Gender Equity Procurement Margin',
      evidenceFile: 'Director_Omang_Certified_Returns.pdf',
      status: 'Claimed',
    },
    {
      id: 'pref-local',
      title: 'Local district procurement preference',
      description: 'Registered operational premises and physical warehouse located in G-West, Gaborone.',
      basis: 'Gaborone City Council Commercial Trading Licence',
      evidenceFile: 'Trading_Licence_Plot22019_GWest.pdf',
      status: 'Verified',
      verifiedDate: '12 Mar 2026',
    },
    {
      id: 'pref-youth',
      title: 'Youth-owned business preference',
      description: 'Statutory preference margin for companies with youth management under 35 years.',
      basis: 'National Youth Procurement Framework',
      status: 'Rejected',
    },
  ]);

  // Team State
  const [teamMembers, setTeamMembers] = useState<SupplierTeamMember[]>([
    {
      id: 'tm-1',
      name: 'Kagiso Molosiwa',
      email: 'k.molosiwa@kopanobuilding.co.bw',
      role: 'Supplier admin',
      lastActive: 'Active now',
      status: 'Active',
    },
    {
      id: 'tm-2',
      name: 'Tshepo Matlapeng',
      email: 't.matlapeng@kopanobuilding.co.bw',
      role: 'Supplier staff',
      lastActive: '2 hrs ago',
      status: 'Active',
    },
  ]);
  const [pendingInvites, setPendingInvites] = useState<{ id: string; email: string; role: string; sentDate: string }[]>([
    {
      id: 'inv-1',
      email: 'accounts@kopanobuilding.co.bw',
      role: 'Supplier staff',
      sentDate: '4 Oct 2026',
    },
  ]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Supplier admin' | 'Supplier staff'>('Supplier staff');

  // Success Alert Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Section status calculation
  const sectionStatuses: Record<string, { label: 'Complete' | 'Incomplete' | 'Needs attention'; color: string }> = {
    details: { label: 'Complete', color: 'bg-[#ECFDF5] text-[#2F8F5B]' },
    directors: { label: 'Complete', color: 'bg-[#ECFDF5] text-[#2F8F5B]' },
    categories: { label: 'Complete', color: 'bg-[#ECFDF5] text-[#2F8F5B]' },
    projects: { label: 'Complete', color: 'bg-[#ECFDF5] text-[#2F8F5B]' },
    preferences: { label: 'Needs attention', color: 'bg-[#FFFBEB] text-[#D97706]' },
    team: { label: 'Needs attention', color: 'bg-[#FFFBEB] text-[#D97706]' },
  };

  // Total shareholding calculation
  const totalOwnership = directorsList.reduce((sum, d) => sum + d.shareholdingPercentage, 0);

  // Reveal masked ID handler
  const handleRevealId = (directorId: string, directorName: string) => {
    setRevealedIds((prev) => ({ ...prev, [directorId]: true }));
    addAuditEvent({
      action: 'National Identity Number Unmasked',
      actorName: 'Kagiso Molosiwa (Supplier Admin)',
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
      legalName: detailsForm.legalName,
      tradingName: detailsForm.tradingName,
      cipaNumber: detailsForm.cipaNumber,
      tinNumber: detailsForm.tinNumber,
      yearEstablished: Number(detailsForm.yearEstablished),
      physicalAddress: detailsForm.physicalAddress,
      postalAddress: detailsForm.postalAddress,
      primaryPhone: detailsForm.primaryPhone,
      email: detailsForm.email,
      website: detailsForm.website,
    });
    const nowStr = '5 October 2026';
    setDetailsLastUpdated(nowStr);
    setIsEditingDetails(false);
    addAuditEvent({
      action: 'Company Details Updated',
      actorName: 'Kagiso Molosiwa (Supplier Admin)',
      actorRole: 'Supplier',
      organizationName: detailsForm.legalName,
      entityType: 'Supplier',
      entityId: supplier.id,
      details: 'Updated statutory company details, registered address, and communication channels.',
      ipAddress: '168.167.23.41',
    });
    showToast('Company details saved successfully.');
  };

  // Add Director
  const handleAddDirectorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDirectorForm.fullName || !newDirectorForm.idNumber) return;

    const newDir = {
      id: `dir-${Date.now()}`,
      fullName: newDirectorForm.fullName,
      nationalIdOrPassport: newDirectorForm.idNumber,
      idNumber: newDirectorForm.idNumber,
      nationality: newDirectorForm.nationality,
      isCitizen: newDirectorForm.isCitizen,
      shareholdingPercentage: Number(newDirectorForm.shareholdingPercentage),
      role: newDirectorForm.role,
      verificationStatus: 'Pending' as const,
    };

    setDirectorsList([...directorsList, newDir]);
    addAuditEvent({
      action: 'Director / Shareholder Added',
      actorName: 'Kagiso Molosiwa (Supplier Admin)',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      entityType: 'Supplier',
      entityId: newDir.id,
      details: `Registered ${newDir.fullName} (${newDir.role}) with ${newDir.shareholdingPercentage}% shareholding.`,
      ipAddress: '168.167.23.41',
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
    showToast(`Added ${newDir.fullName} to registered directors list.`);
  };

  // Save Project
  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectForm.client || !projectForm.title) return;

    if (editingProject) {
      setProjectsList((prev) =>
        prev.map((p) => (p.id === editingProject.id ? { ...projectForm, id: p.id } : p))
      );
      showToast(`Updated project: ${projectForm.title}`);
    } else {
      const newProj: PastProject = {
        ...projectForm,
        id: `proj-${Date.now()}`,
      };
      setProjectsList([newProj, ...projectsList]);
      showToast(`Added past project: ${projectForm.title}`);
    }

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

  // Invite Team Member
  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setPendingInvites([
      ...pendingInvites,
      {
        id: `inv-${Date.now()}`,
        email: inviteEmail.trim(),
        role: inviteRole,
        sentDate: 'Just now',
      },
    ]);

    addAuditEvent({
      action: 'Team Member Invited',
      actorName: 'Kagiso Molosiwa (Supplier Admin)',
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

  return (
    <div className="space-y-8">
      {/* 1. Header with Completeness Meter & "What's missing" */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
              {supplier.legalName}
            </h1>
            <span className="bg-[#ECFDF5] text-[#2F8F5B] px-2.5 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified supplier</span>
            </span>
          </div>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            CIPA UIN: {supplier.cipaNumber} · Trading as {supplier.tradingName} · Central supplier database profile
          </p>
        </div>

        {/* Completeness Meter */}
        <div className="bg-white dark:bg-[#132635] p-4 rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center gap-4 shrink-0">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[14px] font-semibold text-[#10212E] dark:text-white">
                Profile completeness
              </span>
              <span className="font-heading font-semibold text-[15px] text-[#10212E] dark:text-white tabular-nums">
                86% complete
              </span>
            </div>

            <div className="w-48 h-2 bg-[#EAF2FA] dark:bg-[#1E364A] rounded-full overflow-hidden">
              <div className="h-full bg-[#1F5F99] rounded-full w-[86%]" />
            </div>

            <button
              type="button"
              onClick={() => setActiveSection('preferences')}
              className="text-[14px] text-[#1F5F99] dark:text-[#6FAEE0] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <span>What's missing?</span>
              <ChevronRight className="w-3 h-3" />
            </button>
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

      {/* 2. Main Two-Column Layout (Left Navigation + Right Section Content) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Left Section List (Tabs on Mobile) */}
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
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
                  <span className="truncate">{item.label}</span>
                </div>
                <span
                  className={`text-[14px] px-2 py-0.5 rounded-[4px] font-medium shrink-0 ${status.color}`}
                >
                  {status.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Section Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* ================= SECTION 1: Company Details ================= */}
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
                    className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer  transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit details</span>
                  </button>
                )}
              </div>

              {isEditingDetails ? (
                /* Inline Edit Form */
                <form onSubmit={handleSaveDetails} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Legal name *
                      </label>
                      <input
                        type="text"
                        required
                        value={detailsForm.legalName}
                        onChange={(e) => setDetailsForm({ ...detailsForm, legalName: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Trading name *
                      </label>
                      <input
                        type="text"
                        required
                        value={detailsForm.tradingName}
                        onChange={(e) => setDetailsForm({ ...detailsForm, tradingName: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Registration number (CIPA) *
                      </label>
                      <input
                        type="text"
                        required
                        value={detailsForm.cipaNumber}
                        onChange={(e) => setDetailsForm({ ...detailsForm, cipaNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Tax number (BURS TIN) *
                      </label>
                      <input
                        type="text"
                        required
                        value={detailsForm.tinNumber}
                        onChange={(e) => setDetailsForm({ ...detailsForm, tinNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Company type
                      </label>
                      <input
                        type="text"
                        value={detailsForm.companyType}
                        onChange={(e) => setDetailsForm({ ...detailsForm, companyType: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Year established
                      </label>
                      <input
                        type="number"
                        value={detailsForm.yearEstablished}
                        onChange={(e) => setDetailsForm({ ...detailsForm, yearEstablished: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Telephone *
                      </label>
                      <input
                        type="tel"
                        required
                        value={detailsForm.primaryPhone}
                        onChange={(e) => setDetailsForm({ ...detailsForm, primaryPhone: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Official email *
                      </label>
                      <input
                        type="email"
                        required
                        value={detailsForm.email}
                        onChange={(e) => setDetailsForm({ ...detailsForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                      Physical premises address *
                    </label>
                    <input
                      type="text"
                      required
                      value={detailsForm.physicalAddress}
                      onChange={(e) => setDetailsForm({ ...detailsForm, physicalAddress: e.target.value })}
                      className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Postal address
                      </label>
                      <input
                        type="text"
                        value={detailsForm.postalAddress}
                        onChange={(e) => setDetailsForm({ ...detailsForm, postalAddress: e.target.value })}
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                        Website URL
                      </label>
                      <input
                        type="url"
                        value={detailsForm.website}
                        onChange={(e) => setDetailsForm({ ...detailsForm, website: e.target.value })}
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
                      onChange={(e) => setDetailsForm({ ...detailsForm, description: e.target.value })}
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
                      className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer  transition-colors"
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
                        {detailsForm.legalName}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Trading name</span>
                      <span className="font-semibold text-[#10212E] dark:text-white block">
                        {detailsForm.tradingName}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">CIPA registration #</span>
                      <span className="font-semibold text-[#10212E] dark:text-white block tabular-nums">
                        {detailsForm.cipaNumber}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">BURS tax number (TIN)</span>
                      <span className="font-semibold text-[#10212E] dark:text-white block tabular-nums">
                        {detailsForm.tinNumber}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Company type</span>
                      <span className="font-medium text-[#10212E] dark:text-white block">
                        {detailsForm.companyType}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Year established</span>
                      <span className="font-semibold text-[#10212E] dark:text-white block tabular-nums">
                        {detailsForm.yearEstablished}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Telephone</span>
                      <span className="font-semibold text-[#10212E] dark:text-white block tabular-nums">
                        {detailsForm.primaryPhone}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Official email</span>
                      <span className="font-medium text-[#1F5F99] dark:text-[#6FAEE0] block">
                        {detailsForm.email}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Website</span>
                      <span className="font-medium text-[#1F5F99] dark:text-[#6FAEE0] block">
                        {detailsForm.website}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] space-y-4">
                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Registered address</span>
                      <span className="font-semibold text-[#10212E] dark:text-white block">
                        {detailsForm.physicalAddress}
                      </span>
                      <span className="text-[#43525F] dark:text-[#B2C3D2] block">
                        Postal: {detailsForm.postalAddress}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[14px] text-[#6B7A87] font-medium block">Company description</span>
                      <p className="text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                        {detailsForm.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= SECTION 2: Directors and Owners ================= */}
          {activeSection === 'directors' && (
            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                <div>
                  <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                    Directors and beneficial owners
                  </h2>
                  <p className="text-[14px] text-[#6B7A87] mt-0.5">
                    Statutory ownership registry. National IDs are masked for privacy until authorized reveal.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDirectorDrawerOpen(true)}
                  className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer  transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add person</span>
                </button>
              </div>

              {/* Ownership Total & Warning */}
              <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[14px]">
                <div className="flex items-center gap-2">
                  <span className="text-[#6B7A87]">Running equity total:</span>
                  <span className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white tabular-nums">
                    {totalOwnership}%
                  </span>
                  {totalOwnership === 100 ? (
                    <span className="bg-[#ECFDF5] text-[#2F8F5B] px-2 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Balanced (100%)</span>
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
                <span className="text-[14px] text-[#6B7A87]">
                  Statutory requirement: Shareholding must tally exactly to 100%
                </span>
              </div>

              {/* Directors Table */}
              <div className="overflow-x-auto border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px]">
                <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
                  <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[14px]">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Role</th>
                      <th className="p-4 text-right">Ownership</th>
                      <th className="p-4">ID number</th>
                      <th className="p-4">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                    {directorsList.map((dir) => {
                      const isRevealed = revealedIds[dir.id];
                      const maskedId = `••••••${dir.idNumber.slice(-4)}`;

                      return (
                        <tr key={dir.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors">
                          <td className="p-4">
                            <div className="space-y-0.5">
                              <span className="font-semibold block">{dir.fullName}</span>
                              <span className="text-[14px] text-[#6B7A87] block">{dir.nationality}</span>
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
                                  className="text-[14px] text-[#1F5F99] dark:text-[#6FAEE0] hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
                                  title="Unmask identity number (action logged)"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Reveal</span>
                                </button>
                              ) : (
                                <span className="text-[14px] text-[#2F8F5B] bg-[#ECFDF5] px-1.5 py-0.5 rounded">
                                  Audit logged
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-4">
                            <span
                              className={`text-[14px] px-2.5 py-0.5 rounded-[4px] font-medium inline-flex items-center gap-1 ${
                                dir.verificationStatus === 'Verified'
                                  ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                                  : dir.verificationStatus === 'Pending'
                                  ? 'bg-[#FFFBEB] text-[#D97706]'
                                  : 'bg-[#F7FAFD] text-[#6B7A87]'
                              }`}
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>{dir.verificationStatus}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
                <div className="flex flex-wrap gap-2">
                  {selectedCategories.map((cat) => (
                    <span
                      key={cat}
                      className="bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] px-3 py-1.5 rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2"
                    >
                      <span>{cat}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedCategories(selectedCategories.filter((c) => c !== cat))}
                        className="hover:opacity-75 cursor-pointer text-[#1F5F99] dark:text-[#6FAEE0]"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Search Category Tree */}
              <div className="space-y-3 pt-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#6B7A87] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Search supply categories, subsectors, and commodities..."
                    className="w-full pl-9 pr-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-[#F7FAFD] dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  />
                </div>

                {/* Tree View */}
                <div className="border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] p-4 space-y-4 max-h-96 overflow-y-auto">
                  {CATEGORY_TREE.filter(
                    (node) =>
                      node.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
                      node.code.toLowerCase().includes(categorySearch.toLowerCase()) ||
                      node.children?.some((c) => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                  ).map((parent) => {
                    const parentKey = `${parent.code} — ${parent.name}`;
                    const isParentSelected = selectedCategories.includes(parentKey);

                    return (
                      <div key={parent.code} className="space-y-2 border-b border-[#D5E0EA]/60 dark:border-[#1E364A]/60 pb-3 last:border-b-0">
                        <label className="flex items-center gap-2.5 font-semibold text-[14px] text-[#10212E] dark:text-white cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isParentSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategories([...selectedCategories, parentKey]);
                              } else {
                                setSelectedCategories(selectedCategories.filter((c) => c !== parentKey));
                              }
                            }}
                            className="rounded border-[#D5E0EA] text-[#1F5F99] focus:ring-[#1F5F99]"
                          />
                          <span>
                            {parent.code}: {parent.name}
                          </span>
                        </label>

                        {/* Children Subcodes */}
                        {parent.children && (
                          <div className="pl-6 space-y-1.5">
                            {parent.children.map((child) => {
                              const childKey = `${child.code}: ${child.name}`;
                              const isChildSelected = selectedCategories.includes(childKey);

                              return (
                                <label
                                  key={child.code}
                                  className="flex items-center gap-2.5 text-[14px] text-[#43525F] dark:text-[#B2C3D2] cursor-pointer hover:text-[#10212E]"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChildSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedCategories([...selectedCategories, childKey]);
                                      } else {
                                        setSelectedCategories(selectedCategories.filter((c) => c !== childKey));
                                      }
                                    }}
                                    className="rounded border-[#D5E0EA] text-[#1F5F99] focus:ring-[#1F5F99]"
                                  />
                                  <span>
                                    {child.code}: {child.name}
                                  </span>
                                </label>
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
                  <p className="text-[14px] text-[#6B7A87] mt-0.5">
                    Demonstrate technical capability with completed and ongoing contract performance references.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingProject(null);
                    setProjectForm({
                      client: '',
                      title: '',
                      valueBWP: 1500000,
                      startDate: 'Jan 2025',
                      endDate: 'Dec 2025',
                      referenceContact: { name: '', role: '', email: '', phone: '' },
                      status: 'Completed',
                    });
                    setIsProjectDrawerOpen(true);
                  }}
                  className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer  transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add project</span>
                </button>
              </div>

              {/* Projects Card List */}
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
                            className={`text-[14px] px-2 py-0.5 rounded-[4px] font-medium ${
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
                        <span className="text-[14px] text-[#6B7A87] block">
                          {proj.startDate} – {proj.endDate}
                        </span>
                      </div>
                    </div>

                    {/* Reference Contact */}
                    <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[14px]">
                      <div className="text-[#43525F] dark:text-[#B2C3D2]">
                        <span className="text-[#6B7A87]">Reference officer: </span>
                        <strong>{proj.referenceContact.name}</strong> ({proj.referenceContact.role}) ·{' '}
                        <span>{proj.referenceContact.phone}</span> ·{' '}
                        <span>{proj.referenceContact.email}</span>
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
            </div>
          )}

          {/* ================= SECTION 5: Preference Status ================= */}
          {activeSection === 'preferences' && (
            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
              <div className="space-y-1 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                  Statutory preference status & claims
                </h2>
                <p className="text-[14px] text-[#6B7A87]">
                  Record economic empowerment, local content, and preference claims recognized under Botswana public procurement laws.
                </p>
              </div>

              {/* Plain Words Notice */}
              <div className="p-4 rounded-[8px] bg-[#EAF2FA] dark:bg-[#1E364A]/50 border border-[#D5E0EA] dark:border-[#1E364A] flex items-start gap-3 text-[14px]">
                <Info className="w-5 h-5 text-[#1F5F99] dark:text-[#6FAEE0] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="font-semibold text-[#10212E] dark:text-white">
                    How preference claims are used
                  </strong>
                  <p className="text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                    Buying organizations and tender evaluation committees independently decide how these preference margins are applied in according with specific tender evaluation criteria and the Public Procurement Act. Uploading valid evidence ensures automated verification during bid evaluation.
                  </p>
                </div>
              </div>

              {/* Claims List */}
              <div className="space-y-4">
                {preferenceClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="p-5 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-heading font-semibold text-[17px] text-[#10212E] dark:text-white">
                            {claim.title}
                          </h3>
                          <span
                            className={`text-[14px] px-2.5 py-0.5 rounded-[4px] font-medium ${
                              claim.status === 'Verified'
                                ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                                : claim.status === 'Claimed'
                                ? 'bg-[#FFFBEB] text-[#D97706]'
                                : claim.status === 'Rejected'
                                ? 'bg-[#FEF2F2] text-[#C2412D]'
                                : 'bg-[#F7FAFD] text-[#6B7A87]'
                            }`}
                          >
                            {claim.status}
                          </span>
                        </div>
                        <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
                          {claim.description}
                        </p>
                        <span className="text-[14px] text-[#6B7A87] block">
                          Statutory basis: {claim.basis}
                        </span>
                      </div>

                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() => showToast(`Evidence document upload requested for ${claim.title}.`)}
                          className="px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD] text-[14px] font-medium text-[#10212E] dark:text-white rounded-[6px] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#1F5F99]" />
                          <span>{claim.evidenceFile ? 'Replace evidence' : 'Upload evidence'}</span>
                        </button>
                      </div>
                    </div>

                    {claim.evidenceFile && (
                      <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between text-[14px] text-[#6B7A87]">
                        <span>Evidence attached: <strong>{claim.evidenceFile}</strong></span>
                        {claim.verifiedDate && <span>Verified on {claim.verifiedDate}</span>}
                      </div>
                    )}
                  </div>
                ))}
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
                    Manage company staff authorized to prepare tender bids and submit sealed proposals.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer  transition-colors shrink-0"
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
                          <td className="p-3.5 text-[#43525F] dark:text-[#B2C3D2]">{member.email}</td>
                          <td className="p-3.5">
                            <span
                              className={`text-[14px] px-2.5 py-0.5 rounded-[4px] font-medium ${
                                member.role === 'Supplier admin'
                                  ? 'bg-[#EAF2FA] text-[#1F5F99]'
                                  : 'bg-[#F7FAFD] text-[#43525F]'
                              }`}
                            >
                              {member.role}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="text-[14px] bg-[#ECFDF5] text-[#2F8F5B] px-2 py-0.5 rounded-[4px] font-medium">
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
                            onClick={() => showToast(`Invitation re-sent to ${inv.email}`)}
                            className="text-[14px] text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer font-medium"
                          >
                            Resend
                          </button>
                          <span>·</span>
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

      {/* 3. MODAL / DRAWER: Add Person (Director / Owner) */}
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
                  onChange={(e) => setNewDirectorForm({ ...newDirectorForm, fullName: e.target.value })}
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
                    onChange={(e) => setNewDirectorForm({ ...newDirectorForm, idNumber: e.target.value })}
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
                    onChange={(e) => setNewDirectorForm({ ...newDirectorForm, nationality: e.target.value })}
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
                    onChange={(e) => setNewDirectorForm({ ...newDirectorForm, role: e.target.value })}
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
                  className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer  transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add person</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL / DRAWER: Add / Edit Project */}
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
                    min="0"
                    value={projectForm.valueBWP}
                    onChange={(e) => setProjectForm({ ...projectForm, valueBWP: Number(e.target.value) })}
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
                    onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    End / Completion date
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dec 2024"
                    value={projectForm.endDate}
                    onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  />
                </div>
              </div>

              {/* Reference Contact */}
              <div className="p-4 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] space-y-3">
                <span className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Client reference contact
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[14px] text-[#6B7A87] block">Contact person name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kagiso Tau"
                      value={projectForm.referenceContact.name}
                      onChange={(e) =>
                        setProjectForm({
                          ...projectForm,
                          referenceContact: { ...projectForm.referenceContact, name: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[14px] text-[#6B7A87] block">Designation / Role</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Buyer"
                      value={projectForm.referenceContact.role}
                      onChange={(e) =>
                        setProjectForm({
                          ...projectForm,
                          referenceContact: { ...projectForm.referenceContact, role: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[14px] text-[#6B7A87] block">Official email</label>
                    <input
                      type="email"
                      placeholder="e.g. k.tau@client.gov.bw"
                      value={projectForm.referenceContact.email}
                      onChange={(e) =>
                        setProjectForm({
                          ...projectForm,
                          referenceContact: { ...projectForm.referenceContact, email: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[14px] text-[#6B7A87] block">Phone number</label>
                    <input
                      type="tel"
                      placeholder="e.g. +267 72 000 000"
                      value={projectForm.referenceContact.phone}
                      onChange={(e) =>
                        setProjectForm({
                          ...projectForm,
                          referenceContact: { ...projectForm.referenceContact, phone: e.target.value },
                        })
                      }
                      className="w-full px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white"
                    />
                  </div>
                </div>
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
                  className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer  transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingProject ? 'Update project' : 'Save project'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: Invite Team Member */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] max-w-md w-full p-6 sm:p-8 space-y-6 shadow-xl animate-fade-in my-8">
            <div className="flex items-start justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div>
                <h3 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
                  Invite team member
                </h3>
                <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] mt-0.5">
                  Send an email invitation to join {supplier.legalName}.
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
                  Work email address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="colleague@kopanobuilding.co.bw"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Assigned role *
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                >
                  <option value="Supplier staff">Supplier staff (Draft bids & upload certificates)</option>
                  <option value="Supplier admin">Supplier admin (Full authority & electronic signing)</option>
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
                  className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer  transition-colors"
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

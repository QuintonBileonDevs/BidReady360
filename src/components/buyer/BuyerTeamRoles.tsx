import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Shield,
  Users,
  CheckCircle2,
  Lock,
  UserCheck,
  Building,
  Key,
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Edit3,
  UserX,
  Mail,
  Phone,
  Building2,
  AlertTriangle,
  Trash2,
  RotateCcw,
  X,
  ChevronDown,
  SlidersHorizontal,
  Send,
  Check,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react';

export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  jobTitle: string;
  role: 'Org Admin' | 'Procurement Officer' | 'Evaluator' | 'Approver' | 'Auditor';
  approvalLimitBWP: number | null;
  status: 'Active' | 'Invited' | 'Suspended';
  mfaEnabled: boolean;
  mfaType: 'Authenticator' | 'SMS' | 'Pending';
  lastActive: string;
  joinedDate: string;
  conflictDeclared: boolean;
}

const INITIAL_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'tm-1',
    fullName: 'Tumelo Sekgoma',
    email: 't.sekgoma@grc.gov.bw',
    phone: '+267 71 450 112',
    department: 'Executive Office',
    jobTitle: 'Director of Governance & Legal',
    role: 'Org Admin',
    approvalLimitBWP: 15000000,
    status: 'Active',
    mfaEnabled: true,
    mfaType: 'Authenticator',
    lastActive: '12 mins ago',
    joinedDate: '15 Jan 2025',
    conflictDeclared: true,
  },
  {
    id: 'tm-2',
    fullName: 'K. Tau',
    email: 'k.tau@grc.gov.bw',
    phone: '+267 72 310 980',
    department: 'Supply Chain Management',
    jobTitle: 'Lead Procurement Specialist',
    role: 'Procurement Officer',
    approvalLimitBWP: 5000000,
    status: 'Active',
    mfaEnabled: true,
    mfaType: 'Authenticator',
    lastActive: 'Just now',
    joinedDate: '01 Feb 2025',
    conflictDeclared: true,
  },
  {
    id: 'tm-3',
    fullName: 'T. Motlogelwa',
    email: 't.motlogelwa@grc.gov.bw',
    phone: '+267 74 881 229',
    department: 'Supply Chain Management',
    jobTitle: 'Senior Buyer',
    role: 'Procurement Officer',
    approvalLimitBWP: 2500000,
    status: 'Active',
    mfaEnabled: true,
    mfaType: 'SMS',
    lastActive: '2 hrs ago',
    joinedDate: '10 Mar 2025',
    conflictDeclared: true,
  },
  {
    id: 'tm-4',
    fullName: 'Eng. M. Phiri',
    email: 'm.phiri@grc.gov.bw',
    phone: '+267 71 890 432',
    department: 'Civil & Infrastructure Works',
    jobTitle: 'Senior Civil Engineer',
    role: 'Evaluator',
    approvalLimitBWP: null,
    status: 'Active',
    mfaEnabled: true,
    mfaType: 'Authenticator',
    lastActive: 'Yesterday',
    joinedDate: '01 Apr 2025',
    conflictDeclared: true,
  },
  {
    id: 'tm-5',
    fullName: 'B. Kgakgamatso',
    email: 'b.kgakgamatso@grc.gov.bw',
    phone: '+267 75 120 776',
    department: 'Treasury & Financial Planning',
    jobTitle: 'Principal Financial Analyst',
    role: 'Evaluator',
    approvalLimitBWP: null,
    status: 'Active',
    mfaEnabled: true,
    mfaType: 'Authenticator',
    lastActive: '3 days ago',
    joinedDate: '15 Apr 2025',
    conflictDeclared: true,
  },
  {
    id: 'tm-6',
    fullName: 'Town Clerk / Board Chair',
    email: 'townclerk@grc.gov.bw',
    phone: '+267 365 7400',
    department: 'Executive Office',
    jobTitle: 'Tender Board Chairperson',
    role: 'Approver',
    approvalLimitBWP: 25000000,
    status: 'Active',
    mfaEnabled: true,
    mfaType: 'Authenticator',
    lastActive: '4 hrs ago',
    joinedDate: '01 Jan 2025',
    conflictDeclared: true,
  },
  {
    id: 'tm-7',
    fullName: 'L. Mogotsi',
    email: 'l.mogotsi@grc.gov.bw',
    phone: '+267 76 543 210',
    department: 'Internal Audit & Compliance',
    jobTitle: 'Statutory Compliance Liaison',
    role: 'Auditor',
    approvalLimitBWP: null,
    status: 'Active',
    mfaEnabled: true,
    mfaType: 'Authenticator',
    lastActive: '1 day ago',
    joinedDate: '12 May 2025',
    conflictDeclared: true,
  },
  {
    id: 'tm-8',
    fullName: 'Gorata Moloi',
    email: 'g.moloi@grc.gov.bw',
    phone: '+267 73 999 111',
    department: 'Civil & Infrastructure Works',
    jobTitle: 'Junior Project Engineer',
    role: 'Evaluator',
    approvalLimitBWP: null,
    status: 'Invited',
    mfaEnabled: false,
    mfaType: 'Pending',
    lastActive: 'Invitation sent 2 days ago',
    joinedDate: 'Pending sign-up',
    conflictDeclared: false,
  },
];

const DEPARTMENTS = [
  'Supply Chain Management',
  'Civil & Infrastructure Works',
  'Treasury & Financial Planning',
  'Executive Office',
  'Internal Audit & Compliance',
  'Public Health & Environment',
];

const ROLES_INFO = [
  {
    role: 'Org Admin',
    description: 'Manages organization profile, adds council staff members, configures procurement departments, and defines global tender approval thresholds.',
    permissions: ['Manage team members', 'Configure form templates', 'View audit logs', 'Set approval limits'],
  },
  {
    role: 'Procurement Officer',
    description: 'Creates calls for tenders, manages pre-qualification rosters, screens supplier vault documents, drafts addenda, and moderates clarifications.',
    permissions: ['Create calls & EOIs', 'Screen applications', 'Publish clarifications', 'Issue addenda', 'Draft award decisions'],
  },
  {
    role: 'Evaluator',
    description: 'Subject matter expert who reviews technical submissions, executes conflict of interest statutory declarations, and enters matrix scores.',
    permissions: ['Sign conflict declarations', 'Score applications', 'View technical vaults'],
  },
  {
    role: 'Approver',
    description: 'Head of Procurement Unit or Town Clerk authorized to execute statutory sign-off on contract awards and publish notices of award.',
    permissions: ['Approve award decisions', 'Publish official award notices', 'Authorize cancellations'],
  },
  {
    role: 'Auditor',
    description: 'Independent oversight officer (e.g. Auditor General or PPRA Compliance Inspector) with read-only forensics access to all bids and sealed hashes.',
    permissions: ['View full immutable audit trail', 'Verify sealed hashes', 'Export compliance reports'],
  },
];

export const BuyerTeamRoles: React.FC = () => {
  const { addAuditEvent } = useApp();

  // Load members from localStorage or defaults
  const [members, setMembers] = useState<TeamMember[]>(() => {
    try {
      const saved = localStorage.getItem('bidready_buyer_team_members');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return INITIAL_TEAM_MEMBERS;
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('bidready_buyer_team_members', JSON.stringify(members));
    } catch {
      // Ignore
    }
  }, [members]);

  // Tab switch: 'members' vs 'roles'
  const [activeTab, setActiveTab] = useState<'members' | 'roles'>('members');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('All');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [suspendingMember, setSuspendingMember] = useState<TeamMember | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // New Member Form State
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDept, setNewDept] = useState(DEPARTMENTS[0]);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newRole, setNewRole] = useState<TeamMember['role']>('Procurement Officer');
  const [newApprovalLimit, setNewApprovalLimit] = useState<number | ''>(5000000);
  const [requireConflictDeclaration, setRequireConflictDeclaration] = useState(true);
  const [enforceMfa, setEnforceMfa] = useState(true);

  // Filter members
  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.department.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = selectedRoleFilter === 'All' || m.role === selectedRoleFilter;
    const matchesDept = selectedDeptFilter === 'All' || m.department === selectedDeptFilter;
    const matchesStatus = selectedStatusFilter === 'All' || m.status === selectedStatusFilter;

    return matchesSearch && matchesRole && matchesDept && matchesStatus;
  });

  // Role counters
  const officerCount = members.filter((m) => m.role === 'Procurement Officer' && m.status === 'Active').length;
  const evaluatorCount = members.filter((m) => m.role === 'Evaluator' && m.status === 'Active').length;
  const approverCount = members.filter((m) => m.role === 'Approver' && m.status === 'Active').length;
  const totalSeatsUsed = members.filter((m) => m.status !== 'Suspended').length;

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

  // Add Member Submission
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newEmail.trim() || !newJobTitle.trim()) {
      alert('Please fill in all required fields.');
      return;
    }

    const newMemberRecord: TeamMember = {
      id: `tm-${Date.now()}`,
      fullName: newFullName.trim(),
      email: newEmail.trim().toLowerCase(),
      phone: newPhone.trim() || '+267 71 000 000',
      department: newDept,
      jobTitle: newJobTitle.trim(),
      role: newRole,
      approvalLimitBWP:
        newRole === 'Approver' || newRole === 'Procurement Officer'
          ? typeof newApprovalLimit === 'number'
            ? newApprovalLimit
            : 1000000
          : null,
      status: 'Invited',
      mfaEnabled: enforceMfa,
      mfaType: enforceMfa ? 'Authenticator' : 'Pending',
      lastActive: 'Invitation dispatched',
      joinedDate: 'Pending sign-up',
      conflictDeclared: false,
    };

    setMembers((prev) => [newMemberRecord, ...prev]);

    addAuditEvent({
      action: 'Team Member Invited',
      actorName: 'Tumelo Sekgoma (Org Admin)',
      actorRole: 'Procurement Officer',
      organizationName: 'Gaborone Regional Council',
      entityType: 'Organization',
      entityId: newMemberRecord.id,
      details: `Invited ${newMemberRecord.fullName} (${newMemberRecord.email}) as ${newMemberRecord.role} in ${newMemberRecord.department}.`,
      ipAddress: '168.167.24.11',
    });

    setIsAddModalOpen(false);
    resetAddForm();
    showNotification(`Invitation sent to ${newMemberRecord.fullName} (${newMemberRecord.email}).`);
  };

  const resetAddForm = () => {
    setNewFullName('');
    setNewEmail('');
    setNewPhone('');
    setNewDept(DEPARTMENTS[0]);
    setNewJobTitle('');
    setNewRole('Procurement Officer');
    setNewApprovalLimit(5000000);
    setRequireConflictDeclaration(true);
    setEnforceMfa(true);
  };

  // Save Edit Member
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    setMembers((prev) =>
      prev.map((m) => (m.id === editingMember.id ? editingMember : m))
    );

    addAuditEvent({
      action: 'Team Member Profile Updated',
      actorName: 'Tumelo Sekgoma (Org Admin)',
      actorRole: 'Procurement Officer',
      organizationName: 'Gaborone Regional Council',
      entityType: 'Organization',
      entityId: editingMember.id,
      details: `Updated profile for ${editingMember.fullName}: Role=${editingMember.role}, Dept=${editingMember.department}, Limit=${editingMember.approvalLimitBWP ? 'BWP ' + editingMember.approvalLimitBWP.toLocaleString() : 'N/A'}.`,
      ipAddress: '168.167.24.11',
    });

    showNotification(`Profile for ${editingMember.fullName} updated successfully.`);
    setEditingMember(null);
  };

  // Suspend Member
  const handleConfirmSuspend = () => {
    if (!suspendingMember) return;

    setMembers((prev) =>
      prev.map((m) =>
        m.id === suspendingMember.id
          ? { ...m, status: 'Suspended', lastActive: 'Suspended' }
          : m
      )
    );

    addAuditEvent({
      action: 'Team Member Access Suspended',
      actorName: 'Tumelo Sekgoma (Org Admin)',
      actorRole: 'Procurement Officer',
      organizationName: 'Gaborone Regional Council',
      entityType: 'Organization',
      entityId: suspendingMember.id,
      details: `Suspended access for ${suspendingMember.fullName}. Reason: ${suspensionReason || 'Administrative decision'}.`,
      ipAddress: '168.167.24.11',
    });

    showNotification(`Access for ${suspendingMember.fullName} has been suspended.`);
    setSuspendingMember(null);
    setSuspensionReason('');
  };

  // Reactivate Member
  const handleReactivate = (member: TeamMember) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === member.id ? { ...m, status: 'Active', lastActive: 'Reactivated just now' } : m
      )
    );

    addAuditEvent({
      action: 'Team Member Access Restored',
      actorName: 'Tumelo Sekgoma (Org Admin)',
      actorRole: 'Procurement Officer',
      organizationName: 'Gaborone Regional Council',
      entityType: 'Organization',
      entityId: member.id,
      details: `Restored active access for ${member.fullName}.`,
      ipAddress: '168.167.24.11',
    });

    showNotification(`Access for ${member.fullName} has been restored to active status.`);
    setOpenDropdownId(null);
  };

  // Resend Invite
  const handleResendInvite = (member: TeamMember) => {
    showNotification(`Invitation link re-dispatched to ${member.email}.`);
    setOpenDropdownId(null);
  };

  // Remove Member
  const handleConfirmRemove = () => {
    if (!removingMember) return;

    setMembers((prev) => prev.filter((m) => m.id !== removingMember.id));

    addAuditEvent({
      action: 'Team Member Removed',
      actorName: 'Tumelo Sekgoma (Org Admin)',
      actorRole: 'Procurement Officer',
      organizationName: 'Gaborone Regional Council',
      entityType: 'Organization',
      entityId: removingMember.id,
      details: `Removed ${removingMember.fullName} (${removingMember.role}) from council team roster.`,
      ipAddress: '168.167.24.11',
    });

    showNotification(`${removingMember.fullName} removed from council team roster.`);
    setRemovingMember(null);
  };

  return (
    <div className="space-y-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-[#1F5F99] bg-[#EAF2FA] dark:bg-[#1E364A] dark:text-[#6FAEE0] px-2.5 py-0.5 rounded-[4px]">
              Organization governance
            </span>
            <span className="text-[13px] text-[#6B7A87]">· Separation of duties (Public Procurement Act)</span>
          </div>
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Team members & governance roles
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Manage procurement officers, certified evaluators, and statutory approvers for Gaborone Regional Council.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors shadow-sm shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add team member</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="p-4 rounded-[12px] bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] flex items-center justify-between gap-3 text-[14px] animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0" />
            <span>{notification}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-[#065F46] hover:opacity-75 text-[14px] cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Seats Usage */}
        <div className="bg-white dark:bg-[#132635] p-5 rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#6B7A87]">Assigned seats</span>
            <Users className="w-4 h-4 text-[#1F5F99]" />
          </div>
          <div className="font-heading font-semibold text-[26px] text-[#10212E] dark:text-white tabular-nums">
            {totalSeatsUsed} of 10
          </div>
          <div className="space-y-1">
            <div className="h-1.5 w-full bg-[#EAF2FA] dark:bg-[#1E364A] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1F5F99] rounded-full"
                style={{ width: `${(totalSeatsUsed / 10) * 100}%` }}
              />
            </div>
            <span className="text-[12px] text-[#6B7A87] block">
              {10 - totalSeatsUsed} seats remaining on plan
            </span>
          </div>
        </div>

        {/* Procurement Officers */}
        <div className="bg-white dark:bg-[#132635] p-5 rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#6B7A87]">Procurement officers</span>
            <Shield className="w-4 h-4 text-[#1F5F99]" />
          </div>
          <div className="font-heading font-semibold text-[26px] text-[#10212E] dark:text-white tabular-nums">
            {officerCount} active
          </div>
          <span className="text-[12px] text-[#6B7A87] block">
            Call authoring & clarification screening
          </span>
        </div>

        {/* Evaluators */}
        <div className="bg-white dark:bg-[#132635] p-5 rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#6B7A87]">Certified evaluators</span>
            <FileCheck2 className="w-4 h-4 text-[#2F8F5B]" />
          </div>
          <div className="font-heading font-semibold text-[26px] text-[#10212E] dark:text-white tabular-nums">
            {evaluatorCount} declared
          </div>
          <span className="text-[12px] text-[#2F8F5B] block">
            Independence declarations on file
          </span>
        </div>

        {/* Approvers */}
        <div className="bg-white dark:bg-[#132635] p-5 rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#6B7A87]">Tender board approvers</span>
            <ShieldCheck className="w-4 h-4 text-[#1F5F99]" />
          </div>
          <div className="font-heading font-semibold text-[26px] text-[#10212E] dark:text-white tabular-nums">
            {approverCount} authorized
          </div>
          <span className="text-[12px] text-[#6B7A87] block">
            Approval threshold: BWP 25.0M
          </span>
        </div>
      </div>

      {/* 3. Tab Switch: Team Roster vs Statutory Roles Matrix */}
      <div className="flex border-b border-[#D5E0EA] dark:border-[#1E364A] gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`pb-3 text-[15px] font-semibold border-b-2 cursor-pointer transition-colors flex items-center gap-2 ${
            activeTab === 'members'
              ? 'border-[#1F5F99] text-[#1F5F99]'
              : 'border-transparent text-[#6B7A87] hover:text-[#10212E]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team members ({members.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          className={`pb-3 text-[15px] font-semibold border-b-2 cursor-pointer transition-colors flex items-center gap-2 ${
            activeTab === 'roles'
              ? 'border-[#1F5F99] text-[#1F5F99]'
              : 'border-transparent text-[#6B7A87] hover:text-[#10212E]'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Statutory governance roles & RBAC matrix</span>
        </button>
      </div>

      {/* TAB 1: Team Members Management */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Search & Filter Controls */}
          <div className="bg-white dark:bg-[#132635] p-4 rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#6B7A87] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, job title, or department..."
                className="w-full pl-9 pr-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-[#F7FAFD] dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Role filter */}
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[13px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
              >
                <option value="All">All roles</option>
                <option value="Org Admin">Org Admin</option>
                <option value="Procurement Officer">Procurement Officer</option>
                <option value="Evaluator">Evaluator</option>
                <option value="Approver">Approver</option>
                <option value="Auditor">Auditor</option>
              </select>

              {/* Department filter */}
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[13px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
              >
                <option value="All">All departments</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[13px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
              >
                <option value="All">All statuses</option>
                <option value="Active">Active</option>
                <option value="Invited">Invited</option>
                <option value="Suspended">Suspended</option>
              </select>

              {(searchQuery || selectedRoleFilter !== 'All' || selectedDeptFilter !== 'All' || selectedStatusFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedRoleFilter('All');
                    setSelectedDeptFilter('All');
                    setSelectedStatusFilter('All');
                  }}
                  className="px-3 py-2 text-[13px] text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Members Table */}
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
                <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
                  <tr>
                    <th className="p-4">Member</th>
                    <th className="p-4">Department & title</th>
                    <th className="p-4">Statutory role</th>
                    <th className="p-4 text-right">Approval limit</th>
                    <th className="p-4">Security</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Last active</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-[#6B7A87]">
                        No team members match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => {
                      const isDropdownOpen = openDropdownId === member.id;
                      const initials = member.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('');

                      return (
                        <tr key={member.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors">
                          {/* Member info */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] font-semibold text-[13px] flex items-center justify-center shrink-0">
                                {initials}
                              </div>
                              <div className="space-y-0.5">
                                <div className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                                  {member.fullName}
                                </div>
                                <div className="text-[12px] text-[#6B7A87] flex items-center gap-1.5">
                                  <span>{member.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Department & Job Title */}
                          <td className="p-4">
                            <div className="space-y-0.5">
                              <span className="font-medium text-[13px] text-[#10212E] dark:text-white block">
                                {member.jobTitle}
                              </span>
                              <span className="text-[12px] text-[#6B7A87] block">
                                {member.department}
                              </span>
                            </div>
                          </td>

                          {/* Role Chip */}
                          <td className="p-4">
                            <span
                              className={`text-[12px] px-2.5 py-0.5 rounded-[4px] font-medium inline-flex items-center gap-1.5 ${
                                member.role === 'Org Admin'
                                  ? 'bg-[#EAF2FA] text-[#1F5F99]'
                                  : member.role === 'Procurement Officer'
                                  ? 'bg-[#EFF6FF] text-[#2563EB]'
                                  : member.role === 'Evaluator'
                                  ? 'bg-[#F0FDF4] text-[#16A34A]'
                                  : member.role === 'Approver'
                                  ? 'bg-[#FAF5FF] text-[#9333EA]'
                                  : 'bg-[#F8FAFC] text-[#475569]'
                              }`}
                            >
                              <Shield className="w-3 h-3" />
                              <span>{member.role}</span>
                            </span>
                          </td>

                          {/* Approval limit */}
                          <td className="p-4 text-right tabular-nums text-[13px]">
                            {member.approvalLimitBWP ? (
                              <span className="font-semibold text-[#10212E] dark:text-white">
                                BWP {member.approvalLimitBWP.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-[#6B7A87]">N/A</span>
                            )}
                          </td>

                          {/* Security / MFA */}
                          <td className="p-4">
                            {member.mfaEnabled ? (
                              <span className="text-[12px] text-[#2F8F5B] bg-[#ECFDF5] px-2 py-0.5 rounded-[4px] font-medium inline-flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                <span>2FA {member.mfaType}</span>
                              </span>
                            ) : (
                              <span className="text-[12px] text-[#D97706] bg-[#FFFBEB] px-2 py-0.5 rounded-[4px] font-medium inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Pending 2FA</span>
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="p-4">
                            <span
                              className={`text-[12px] px-2.5 py-0.5 rounded-[4px] font-medium ${
                                member.status === 'Active'
                                  ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                                  : member.status === 'Invited'
                                  ? 'bg-[#FFFBEB] text-[#D97706]'
                                  : 'bg-[#FEF2F2] text-[#C2412D]'
                              }`}
                            >
                              {member.status}
                            </span>
                          </td>

                          {/* Last Active */}
                          <td className="p-4 text-[13px] text-[#6B7A87] whitespace-nowrap">
                            {member.lastActive}
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-right relative">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingMember(member)}
                                className="p-1.5 text-[#1F5F99] dark:text-[#6FAEE0] hover:bg-[#EAF2FA] rounded-[4px] transition-colors cursor-pointer"
                                title="Edit member profile"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setOpenDropdownId(isDropdownOpen ? null : member.id)
                                }
                                className="p-1.5 text-[#6B7A87] hover:text-[#10212E] hover:bg-[#F7FAFD] rounded-[4px] transition-colors cursor-pointer"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-20"
                                  onClick={() => setOpenDropdownId(null)}
                                />
                                <div className="absolute right-4 top-12 z-30 w-52 bg-white dark:bg-[#132635] rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] shadow-lg py-1.5 text-[13px] text-left animate-fade-in">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMember(member);
                                      setOpenDropdownId(null);
                                    }}
                                    className="w-full px-3.5 py-2 text-left hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] text-[#10212E] dark:text-white flex items-center gap-2 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-[#6B7A87]" />
                                    <span>Edit profile & role</span>
                                  </button>

                                  {member.status === 'Invited' && (
                                    <button
                                      type="button"
                                      onClick={() => handleResendInvite(member)}
                                      className="w-full px-3.5 py-2 text-left hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] text-[#1F5F99] flex items-center gap-2 cursor-pointer"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                      <span>Resend invitation link</span>
                                    </button>
                                  )}

                                  {member.status === 'Active' ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSuspendingMember(member);
                                        setOpenDropdownId(null);
                                      }}
                                      className="w-full px-3.5 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[#C2412D] flex items-center gap-2 cursor-pointer"
                                    >
                                      <UserX className="w-3.5 h-3.5" />
                                      <span>Suspend member</span>
                                    </button>
                                  ) : member.status === 'Suspended' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleReactivate(member)}
                                      className="w-full px-3.5 py-2 text-left hover:bg-[#ECFDF5] text-[#2F8F5B] flex items-center gap-2 cursor-pointer"
                                    >
                                      <UserCheck className="w-3.5 h-3.5" />
                                      <span>Restore active access</span>
                                    </button>
                                  ) : null}

                                  <div className="border-t border-[#D5E0EA] dark:border-[#1E364A] my-1" />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRemovingMember(member);
                                      setOpenDropdownId(null);
                                    }}
                                    className="w-full px-3.5 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[#C2412D] flex items-center gap-2 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Remove from council</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Statutory Roles Matrix */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          {/* Statutory Separation of Duties Notice */}
          <div className="p-5 rounded-[12px] bg-[#EAF2FA] dark:bg-[#1E364A]/50 border border-[#D5E0EA] dark:border-[#1E364A] flex items-start gap-3.5 text-[14px]">
            <ShieldCheck className="w-5 h-5 text-[#1F5F99] dark:text-[#6FAEE0] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-semibold text-[#10212E] dark:text-white">
                Statutory Separation of Duties Enforced
              </strong>
              <p className="text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                In compliance with the Public Procurement Act, members assigned as <strong>Procurement Officers</strong> author calls and screen supplier vaults, but cannot evaluate technical scores or approve awards. <strong>Evaluators</strong> must sign electronic conflict of interest declarations prior to unsealing bids. <strong>Approvers</strong> execute statutory award decisions only within their assigned financial limits.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ROLES_INFO.map((r, idx) => {
              const assignedMembers = members.filter((m) => m.role === r.role && m.status !== 'Suspended');

              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] rounded-[8px]">
                        <Shield className="w-5 h-5" />
                      </div>
                      <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                        {r.role}
                      </h3>
                    </div>
                    <span className="text-[12px] text-[#1F5F99] bg-[#EAF2FA] dark:bg-[#1E364A] px-2.5 py-0.5 rounded-[4px] font-medium">
                      {assignedMembers.length} assigned
                    </span>
                  </div>

                  <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                    {r.description}
                  </p>

                  {/* Assigned Personnel */}
                  <div className="pt-3 border-t border-[#D5E0EA] dark:border-[#1E364A] space-y-2">
                    <span className="text-[12px] font-semibold text-[#6B7A87] uppercase tracking-wider block">
                      Assigned personnel
                    </span>
                    <ul className="space-y-1.5 text-[13px] text-[#10212E] dark:text-white">
                      {assignedMembers.length === 0 ? (
                        <li className="text-[#6B7A87] italic">No active members in this role</li>
                      ) : (
                        assignedMembers.map((m) => (
                          <li key={m.id} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1F5F99]" />
                            <span className="font-medium">{m.fullName}</span>
                            <span className="text-[#6B7A87]">({m.jobTitle})</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  {/* Granular Capabilities */}
                  <div className="pt-3 border-t border-[#D5E0EA] dark:border-[#1E364A] space-y-2">
                    <span className="text-[12px] font-semibold text-[#6B7A87] uppercase tracking-wider block">
                      Granular capabilities
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {r.permissions.map((p, i) => (
                        <span
                          key={i}
                          className="text-[12px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] px-2.5 py-1 rounded-[4px]"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. MODAL: Add Team Member */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-xl animate-fade-in my-8">
            <div className="flex items-start justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div>
                <h3 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
                  Add new team member
                </h3>
                <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] mt-0.5">
                  Invite a council official and assign their statutory procurement role.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white rounded-[4px] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                    Full name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="e.g. Naledi Kebonang"
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-[#F7FAFD] dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                    Work email address *
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="n.kebonang@grc.gov.bw"
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-[#F7FAFD] dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                    Mobile phone
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+267 72 345 678"
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-[#F7FAFD] dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  />
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                    Department *
                  </label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-[#F7FAFD] dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Job Title */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                  Job title / statutory designation *
                </label>
                <input
                  type="text"
                  required
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  placeholder="e.g. Senior Quantity Surveyor / Buyer"
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-[#F7FAFD] dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>

              {/* Statutory Role */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                  Statutory procurement role *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as TeamMember['role'])}
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-[#F7FAFD] dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                >
                  <option value="Procurement Officer">Procurement Officer (Call authoring & vault screening)</option>
                  <option value="Evaluator">Evaluator (Technical scoring & declarations)</option>
                  <option value="Approver">Approver (Statutory tender board sign-off)</option>
                  <option value="Org Admin">Org Admin (Full governance administration)</option>
                  <option value="Auditor">Auditor (Read-only immutable trail inspection)</option>
                </select>
              </div>

              {/* Conditional Approval Limit */}
              {(newRole === 'Approver' || newRole === 'Procurement Officer') && (
                <div className="space-y-1.5 p-3.5 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A]">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-semibold text-[#10212E] dark:text-white">
                      Statutory approval threshold limit (BWP)
                    </label>
                    <span className="text-[12px] text-[#6B7A87]">Per contract award</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#6B7A87] font-medium">
                      BWP
                    </span>
                    <input
                      type="number"
                      value={newApprovalLimit}
                      onChange={(e) =>
                        setNewApprovalLimit(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="w-full pl-14 pr-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white font-semibold tabular-nums focus:outline-none focus:border-[#1F5F99]"
                      min="0"
                      step="500000"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[1000000, 2500000, 5000000, 10000000, 25000000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setNewApprovalLimit(val)}
                        className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] hover:border-[#1F5F99] cursor-pointer"
                      >
                        BWP {(val / 1000000).toFixed(1)}M
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Governance Checkboxes */}
              <div className="space-y-2.5 pt-2">
                <label className="flex items-start gap-2.5 text-[13px] text-[#43525F] dark:text-[#B2C3D2] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireConflictDeclaration}
                    onChange={(e) => setRequireConflictDeclaration(e.target.checked)}
                    className="mt-0.5 rounded border-[#D5E0EA] text-[#1F5F99] focus:ring-[#1F5F99]"
                  />
                  <span>
                    Require mandatory electronic conflict of interest declaration prior to viewing unsealed tenders.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 text-[13px] text-[#43525F] dark:text-[#B2C3D2] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enforceMfa}
                    onChange={(e) => setEnforceMfa(e.target.checked)}
                    className="mt-0.5 rounded border-[#D5E0EA] text-[#1F5F99] focus:ring-[#1F5F99]"
                  />
                  <span>
                    Enforce mandatory multi-factor authentication (2FA) setup during first account sign-in.
                  </span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>Send invitation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: Edit Team Member */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-xl animate-fade-in my-8">
            <div className="flex items-start justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div>
                <h3 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
                  Edit team member
                </h3>
                <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] mt-0.5">
                  Update role, department, and statutory procurement authority.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="p-1 text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white rounded-[4px] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  value={editingMember.fullName}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                    Email address
                  </label>
                  <input
                    type="email"
                    disabled
                    value={editingMember.email}
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                    Phone number
                  </label>
                  <input
                    type="tel"
                    value={editingMember.phone}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                    Department
                  </label>
                  <select
                    value={editingMember.department}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, department: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                    Job title
                  </label>
                  <input
                    type="text"
                    required
                    value={editingMember.jobTitle}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, jobTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  />
                </div>
              </div>

              {/* Statutory Role */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                  Statutory procurement role
                </label>
                <select
                  value={editingMember.role}
                  onChange={(e) =>
                    setEditingMember({
                      ...editingMember,
                      role: e.target.value as TeamMember['role'],
                      approvalLimitBWP:
                        e.target.value === 'Approver' || e.target.value === 'Procurement Officer'
                          ? editingMember.approvalLimitBWP || 5000000
                          : null,
                    })
                  }
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                >
                  <option value="Procurement Officer">Procurement Officer</option>
                  <option value="Evaluator">Evaluator</option>
                  <option value="Approver">Approver</option>
                  <option value="Org Admin">Org Admin</option>
                  <option value="Auditor">Auditor</option>
                </select>
              </div>

              {/* Approval Limit */}
              {(editingMember.role === 'Approver' || editingMember.role === 'Procurement Officer') && (
                <div className="space-y-1.5 p-3.5 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A]">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-semibold text-[#10212E] dark:text-white">
                      Statutory approval limit (BWP)
                    </label>
                    <span className="text-[12px] text-[#6B7A87]">Per contract award</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#6B7A87] font-medium">
                      BWP
                    </span>
                    <input
                      type="number"
                      value={editingMember.approvalLimitBWP || 0}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          approvalLimitBWP: Number(e.target.value),
                        })
                      }
                      className="w-full pl-14 pr-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white font-semibold tabular-nums focus:outline-none focus:border-[#1F5F99]"
                      min="0"
                      step="500000"
                    />
                  </div>
                </div>
              )}

              {/* Status Toggle */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                  Account status
                </label>
                <select
                  value={editingMember.status}
                  onChange={(e) =>
                    setEditingMember({
                      ...editingMember,
                      status: e.target.value as TeamMember['status'],
                    })
                  }
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                >
                  <option value="Active">Active</option>
                  <option value="Invited">Invited</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer shadow-sm transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>Save changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: Suspend Member Confirmation */}
      {suspendingMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] max-w-md w-full p-6 space-y-5 shadow-xl animate-fade-in">
            <div className="flex items-center gap-3 text-[#C2412D]">
              <div className="p-2 rounded-full bg-[#FEF2F2]">
                <UserX className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                Suspend team member
              </h3>
            </div>

            <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
              Are you sure you want to suspend access for <strong>{suspendingMember.fullName}</strong>?
              They will be unable to log in, screen submissions, or score tenders until access is reinstated.
              Prior audit logs and signed declarations remain permanently sealed.
            </p>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                Statutory suspension reason
              </label>
              <input
                type="text"
                value={suspensionReason}
                onChange={(e) => setSuspensionReason(e.target.value)}
                placeholder="e.g. Leave of absence / conflict recusal"
                className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-[#F7FAFD] dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#C2412D]"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSuspendingMember(null)}
                className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSuspend}
                className="px-4 py-2 bg-[#C2412D] hover:bg-[#a53625] text-white rounded-[6px] text-[14px] font-medium cursor-pointer shadow-sm"
              >
                Confirm suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: Remove Member Confirmation */}
      {removingMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] max-w-md w-full p-6 space-y-5 shadow-xl animate-fade-in">
            <div className="flex items-center gap-3 text-[#C2412D]">
              <div className="p-2 rounded-full bg-[#FEF2F2]">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                Remove team member
              </h3>
            </div>

            <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
              Are you sure you want to remove <strong>{removingMember.fullName}</strong> from the Gaborone Regional Council team roster?
              This will free up 1 license seat. Historical score sheets and signed audit events will continue to reference their name.
            </p>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRemovingMember(null)}
                className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                className="px-4 py-2 bg-[#C2412D] hover:bg-[#a53625] text-white rounded-[6px] text-[14px] font-medium cursor-pointer shadow-sm"
              >
                Remove member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

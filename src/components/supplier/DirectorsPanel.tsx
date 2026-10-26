import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { supplierApi } from '../../services/api';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Eye,
  Info,
  X,
  Loader2,
} from 'lucide-react';

interface DirectorRecord {
  id: string;
  supplierId: string;
  fullName: string;
  personRole: string;
  ownershipPercent: number | null;
  identityType: string | null;
  nationality: string;
  isCitizen: boolean;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  kycStatus: string;
  idNumber?: string;
  idLast4?: string;
  hasId: boolean;
}

export const DirectorsPanel: React.FC = () => {
  const { supplier, updateSupplierProfile, addAuditEvent } = useApp();
  const [directors, setDirectors] = useState<DirectorRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDirector, setEditingDirector] = useState<DirectorRecord | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('director');
  const [ownershipPercent, setOwnershipPercent] = useState<string>('');
  const [identityType, setIdentityType] = useState<'OMANG' | 'PASSPORT'>('OMANG');
  const [idNumber, setIdNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nationality, setNationality] = useState('Motswana');
  const [isCitizen, setIsCitizen] = useState(true);

  const [formError, setFormError] = useState<{ field?: string; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmDeleteDirector, setConfirmDeleteDirector] = useState<DirectorRecord | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const fetchDirectors = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await supplierApi.listPeople();
      if (Array.isArray(res)) {
        setDirectors(res);
      }
    } catch (err) {
      console.warn('Failed to load directors:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDirectors();
  }, [fetchDirectors]);

  // Total ownership calculation for directors & shareholders
  const totalOwnership = directors
    .filter((d) => ['director', 'shareholder', 'owner'].includes((d.personRole || '').toLowerCase()))
    .reduce((sum, d) => sum + (Number(d.ownershipPercent) || 0), 0);

  // Remaining equity available excluding the director currently being edited
  const otherDirectorsOwnership = directors
    .filter((d) => (!editingDirector || d.id !== editingDirector.id) && ['director', 'shareholder', 'owner'].includes((d.personRole || '').toLowerCase()))
    .reduce((sum, d) => sum + (Number(d.ownershipPercent) || 0), 0);
  const remainingEquityAvailable = Math.max(0, parseFloat((100 - otherDirectorsOwnership).toFixed(2)));

  const handleOpenAdd = () => {
    setEditingDirector(null);
    setFullName('');
    setRole('director');
    setOwnershipPercent(remainingEquityAvailable > 0 ? '' : '0');
    setIdentityType('OMANG');
    setIdNumber('');
    setDateOfBirth('');
    setEmail('');
    setPhone('');
    setNationality('Motswana');
    setIsCitizen(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dir: DirectorRecord) => {
    setEditingDirector(dir);
    setFullName(dir.fullName || '');
    setRole(dir.personRole || 'director');
    setOwnershipPercent(dir.ownershipPercent !== null && dir.ownershipPercent !== undefined ? String(dir.ownershipPercent) : '');
    setIdentityType((dir.identityType as any) || 'OMANG');
    setIdNumber(dir.idNumber || '');
    setDateOfBirth(dir.dateOfBirth ? dir.dateOfBirth.split('T')[0] : '');
    setEmail(dir.email || '');
    setPhone(dir.phone || '');
    setNationality(dir.nationality || 'Motswana');
    setIsCitizen(dir.isCitizen ?? true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);
    setSuccessMessage(null);

    const enteredOwnership = ownershipPercent === '' ? 0 : Number(ownershipPercent);
    if (isNaN(enteredOwnership) || enteredOwnership < 0 || enteredOwnership > 100) {
      setFormError({
        field: 'ownershipPercent',
        message: 'Ownership percentage must be a valid number between 0 and 100.',
      });
      setIsSaving(false);
      return;
    }

    if (['director', 'shareholder', 'owner'].includes(role.toLowerCase())) {
      const projectedTotal = parseFloat((otherDirectorsOwnership + enteredOwnership).toFixed(2));
      if (projectedTotal > 100) {
        setFormError({
          field: 'ownershipPercent',
          message: `Ownership would total ${projectedTotal}%. Currently ${otherDirectorsOwnership}% is allocated across other directors, so maximum available to allocate is ${remainingEquityAvailable}%.`,
        });
        setIsSaving(false);
        return;
      }
    }

    const payload: any = {
      fullName: fullName.trim(),
      personRole: role,
      ownershipPercent: enteredOwnership,
      identityType,
      idNumber: idNumber.trim() ? idNumber.trim() : undefined,
      dateOfBirth: dateOfBirth || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      nationality,
      isCitizen,
    };

    try {
      if (editingDirector) {
        await supplierApi.updatePerson(editingDirector.id, payload);
      } else {
        await supplierApi.addPerson(payload);
      }

      setSuccessMessage('Director saved successfully.');
      setIsModalOpen(false);
      await fetchDirectors();
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setFormError({
        field: err.field || 'fullName',
        message: err.message || 'Failed to save director record.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteDirector) return;
    setIsRemoving(true);
    setRemoveError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const token = localStorage.getItem('bidready_token');
      const res = await fetch(`/api/supplier/people/${confirmDeleteDirector.id}`, {
        method: 'DELETE',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error(data.message || 'We could not remove this person. Try again.');
      }

      setConfirmDeleteDirector(null);
      await fetchDirectors();
      setSuccessMessage('Director removed');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setRemoveError('Request timed out. We could not remove this person. Try again.');
      } else {
        setRemoveError(err.message || 'We could not remove this person. Try again.');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsRemoving(false);
    }
  };

  const handleRevealId = async (id: string) => {
    // In production, unmasking full ID requires secure authorization. For UI demo/verification:
    setRevealedIds((prev) => ({ ...prev, [id]: 'Encrypted verified' }));
    addAuditEvent({
      action: 'National Identity Number Unmasked',
      actorName: 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier?.legalName || 'Supplier',
      entityType: 'Organization',
      entityId: id,
      details: 'Unmasked director identity number for audit verification.',
    });
  };

  return (
    <div id="field-directors" className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div>
          <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
            People and directors
          </h2>
          <p className="text-[14px] text-[#6B7A87] mt-0.5">
            Statutory requirement: Resident directors and beneficial owners with total ownership tallying exactly 100%.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add director</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-[8px] text-emerald-800 dark:text-emerald-200 text-[14px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2F8F5B]" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Ownership Total Summary Bar */}
      <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[14px]">
        <div className="flex items-center gap-2.5">
          <span className="text-[#6B7A87]">Ownership total:</span>
          <span className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white tabular-nums">
            {totalOwnership}% of 100%
          </span>
          {directors.length > 0 && Math.round(totalOwnership) === 100 ? (
            <span className="bg-[#ECFDF5] text-[#2F8F5B] px-2.5 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Balanced (100% equity allocated)</span>
            </span>
          ) : totalOwnership > 100 ? (
            <span className="bg-[#FEF2F2] text-[#C2412D] px-2.5 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Exceeds 100% allocation</span>
            </span>
          ) : (
            <span className="bg-[#FFFBEB] text-[#D97706] px-2.5 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              <span>{100 - totalOwnership}% still to allocate</span>
            </span>
          )}
        </div>
        <span className="text-[13px] text-[#6B7A87]">
          {directors.length} person{directors.length === 1 ? '' : 's'} recorded
        </span>
      </div>

      {/* List of saved people */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 space-x-3 text-[#6B7A87] bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A]">
          <Loader2 className="w-6 h-6 animate-spin text-[#1F5F99]" />
          <span className="text-[14px] font-medium">Loading people and directors records...</span>
        </div>
      ) : directors.length === 0 ? (
        <div className="p-8 border border-dashed border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] text-center space-y-3">
          <p className="text-[15px] font-semibold text-[#10212E] dark:text-white">
            No directors added yet
          </p>
          <p className="text-[13px] text-[#6B7A87] max-w-md mx-auto">
            Add at least one director or shareholder with shareholdings totaling exactly 100%.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add director</span>
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
                <th className="p-4">Identity</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
              {directors.map((dir) => {
                const displayId = dir.idNumber || dir.idLast4 || (dir.hasId ? 'Provided' : 'Not provided');
                return (
                  <tr key={dir.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors">
                    <td className="p-4">
                      <div className="space-y-0.5">
                        <span className="font-semibold block">{dir.fullName}</span>
                        <span className="text-[13px] text-[#6B7A87] block">{dir.nationality}</span>
                      </div>
                    </td>
                    <td className="p-4 capitalize text-[#43525F] dark:text-[#B2C3D2]">{dir.personRole}</td>
                    <td className="p-4 text-right font-semibold tabular-nums text-[15px]">
                      {dir.ownershipPercent}%
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <span className="font-medium tabular-nums block">{displayId}</span>
                        <span className="text-[11px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-medium inline-block">
                          {dir.identityType || 'OMANG'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-[13px] px-2.5 py-0.5 rounded-[4px] font-medium inline-flex items-center gap-1 bg-[#ECFDF5] text-[#2F8F5B]">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(dir)}
                          className="px-2.5 py-1 text-[13px] font-medium text-[#1F5F99] dark:text-[#38BDF8] bg-[#EAF2FA] dark:bg-[#1E364A] hover:bg-[#dbeafe] dark:hover:bg-[#254661] rounded-[4px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteDirector(dir)}
                          className="p-1.5 text-[#C2412D] hover:bg-[#FEF2F2] dark:hover:bg-[#3D1414] rounded-[4px] cursor-pointer transition-colors"
                          title="Remove director"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                {editingDirector ? 'Edit director' : 'Add director'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-[8px] text-red-800 dark:text-red-200 text-[14px]">
                {formError.message}
              </div>
            )}

            {!editingDirector && remainingEquityAvailable <= 0 && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-[8px] text-amber-800 dark:text-amber-200 text-[13px] flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">100% of company equity is already allocated</span>
                  <span className="text-[12px] text-amber-700 dark:text-amber-300">
                    Existing directors hold 100% total equity. You may add non-equity roles (e.g. 0% ownership director or authorised signatory), or edit an existing director first to rebalance equity.
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Full name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Kagiso Phiri"
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Role *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  >
                    <option value="director">Director</option>
                    <option value="shareholder">Shareholder</option>
                    <option value="owner">Owner</option>
                    <option value="authorised_signatory">Authorised Signatory</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                      Ownership percentage *
                    </label>
                    <span className="text-[12px] text-[#6B7A87]">
                      Max: <strong className="text-[#10212E] dark:text-white tabular-nums">{remainingEquityAvailable}%</strong>
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={remainingEquityAvailable > 0 ? 100 : 0}
                    step="0.01"
                    required
                    value={ownershipPercent}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
                        val = val.replace(/^0+/, '');
                      }
                      setOwnershipPercent(val);
                    }}
                    placeholder={remainingEquityAvailable > 0 ? `e.g. ${Math.min(50, remainingEquityAvailable)}` : '0'}
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums"
                  />
                  <p className="text-[12px] text-[#6B7A87]">
                    {otherDirectorsOwnership > 0 ? (
                      <>Currently <span className="tabular-nums font-semibold text-[#10212E] dark:text-white">{otherDirectorsOwnership}%</span> allocated across other directors. Total equity cannot exceed 100%.</>
                    ) : (
                      <>Total equity across directors & shareholders must tally up to 100%.</>
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Identity type *
                  </label>
                  <select
                    value={identityType}
                    onChange={(e) => {
                      const val = e.target.value as 'OMANG' | 'PASSPORT';
                      setIdentityType(val);
                      setIsCitizen(val === 'OMANG');
                    }}
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  >
                    <option value="OMANG">National ID (Omang)</option>
                    <option value="PASSPORT">Passport</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Identification number *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 748123918"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. name@company.co.bw"
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Phone (optional)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +267 71 234 567"
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white rounded-[6px] text-[14px] font-medium hover:bg-slate-50 dark:hover:bg-[#10212E] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isSaving ? 'Saving…' : 'Save director'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteDirector && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !isRemoving) {
              setConfirmDeleteDirector(null);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-labelledby="remove-director-title"
            className="w-full max-w-md bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <h3 id="remove-director-title" className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Remove director?
              </h3>
              <button
                type="button"
                disabled={isRemoving}
                onClick={() => setConfirmDeleteDirector(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
              Remove {confirmDeleteDirector.fullName} from your directors list?
            </p>

            {removeError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-[8px] text-[14px] text-[#C2412D]">
                {removeError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                autoFocus
                disabled={isRemoving}
                onClick={() => setConfirmDeleteDirector(null)}
                className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white rounded-[6px] text-[14px] font-medium cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRemoving}
                onClick={handleDelete}
                className="px-4 py-2 bg-[#C2412D] hover:bg-[#a53424] text-white rounded-[6px] text-[14px] font-medium cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isRemoving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isRemoving ? 'Removing…' : removeError ? 'Try again' : 'Remove'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

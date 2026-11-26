import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { supplierApi } from '../../services/api';
import { normaliseOmang, validateOmang, genderFromOmang } from '../../../shared/omang';
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Clock,
  Info,
  X,
  Loader2,
} from 'lucide-react';

export interface DirectorRecord {
  id: string;
  supplierId: string;
  fullName: string;
  personRole: string;
  ownershipPercent: number | null;
  identityType: string | null;
  gender?: 'male' | 'female' | null;
  nationality: string;
  isCitizen: boolean;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  kycStatus: 'not_started' | 'pending' | 'verified' | 'failed' | string;
  kycVerifiedAt?: string | null;
  kycReference?: string | null;
  idLast4?: string | null;
  hasId: boolean;
}

interface DirectorFormModalProps {
  editingDirector: DirectorRecord | null;
  otherDirectorsOwnership: number;
  remainingEquityAvailable: number;
  onClose: () => void;
  onSaved: (saved?: DirectorRecord) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}

const DirectorFormModal: React.FC<DirectorFormModalProps> = ({
  editingDirector,
  otherDirectorsOwnership,
  remainingEquityAvailable,
  onClose,
  onSaved,
  onDirtyChange,
}) => {
  // Initialised ONCE per open (component is keyed by editingDirector?.id ?? 'new')
  const [fullName, setFullName] = useState<string>(() => editingDirector?.fullName || '');
  const [role, setRole] = useState<string>(() => editingDirector?.personRole || 'director');
  const [ownershipPercent, setOwnershipPercent] = useState<string>(() => {
    if (editingDirector && editingDirector.ownershipPercent !== null && editingDirector.ownershipPercent !== undefined) {
      return String(editingDirector.ownershipPercent);
    }
    return remainingEquityAvailable > 0 ? '' : '0';
  });
  const [identityType, setIdentityType] = useState<'OMANG' | 'PASSPORT'>(() =>
    editingDirector?.identityType === 'PASSPORT' ? 'PASSPORT' : 'OMANG'
  );
  const [gender, setGender] = useState<'male' | 'female' | ''>(() =>
    editingDirector?.gender === 'male' || editingDirector?.gender === 'female' ? editingDirector.gender : ''
  );
  const [idNumber, setIdNumber] = useState<string>('');
  const [idTouched, setIdTouched] = useState<boolean>(false);
  const [email, setEmail] = useState<string>(() => editingDirector?.email || '');
  const [phone, setPhone] = useState<string>(() => editingDirector?.phone || '');
  const [nationality, setNationality] = useState<string>(() => editingDirector?.nationality || 'Motswana');
  const [isCitizen, setIsCitizen] = useState<boolean>(() => editingDirector?.isCitizen ?? true);

  const [formError, setFormError] = useState<{ field?: string; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;

  const markDirty = useCallback(() => {
    onDirtyChangeRef.current(true);
  }, []);

  useEffect(() => {
    onDirtyChangeRef.current(false);
    return () => {
      onDirtyChangeRef.current(false);
    };
  }, []);

  const handleOmangValue = (rawInput: string) => {
    const digitsOnly = normaliseOmang(rawInput).replace(/\D/g, '').slice(0, 9);
    setIdNumber(digitsOnly);
    setIdTouched(true);
    markDirty();
    if (formError?.field === 'idNumber' || formError?.field === 'gender') {
      setFormError(null);
    }
    // Preselect gender from 5th digit only when gender is currently empty
    if (gender === '') {
      const derived = genderFromOmang(digitsOnly);
      if (derived) {
        setGender(derived);
      }
    }
  };

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (identityType === 'OMANG') {
      handleOmangValue(e.target.value);
    } else {
      setIdNumber(e.target.value);
      setIdTouched(true);
      markDirty();
      if (formError?.field === 'idNumber') {
        setFormError(null);
      }
    }
  };

  const handleIdPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (identityType !== 'OMANG') return;
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    handleOmangValue(pasted);
  };

  // Live Omang validation message when Omang is selected and user has typed an ID
  const liveOmangResult =
    identityType === 'OMANG' && idNumber.length > 0
      ? validateOmang(idNumber, gender || undefined)
      : null;

  const liveIdError =
    identityType === 'OMANG' && idTouched && idNumber.length > 0 && liveOmangResult && !liveOmangResult.ok
      ? liveOmangResult.message
      : formError?.field === 'idNumber'
      ? formError.message
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIdTouched(true);

    const enteredOwnership = ownershipPercent === '' ? 0 : Number(ownershipPercent);
    if (isNaN(enteredOwnership) || enteredOwnership < 0 || enteredOwnership > 100) {
      setFormError({
        field: 'ownershipPercent',
        message: 'Ownership percentage must be a valid number between 0 and 100.',
      });
      return;
    }

    if (['director', 'shareholder', 'owner'].includes(role.toLowerCase())) {
      const projectedTotal = parseFloat((otherDirectorsOwnership + enteredOwnership).toFixed(2));
      if (projectedTotal > 100) {
        setFormError({
          field: 'ownershipPercent',
          message: `Ownership would total ${projectedTotal}%. Currently ${otherDirectorsOwnership}% is allocated across other directors, so maximum available to allocate is ${remainingEquityAvailable}%.`,
        });
        return;
      }
    }

    const trimmedId = idNumber.trim();
    const keepingExistingId = Boolean(editingDirector?.hasId) && trimmedId === '';

    if (identityType === 'OMANG') {
      if (!gender) {
        setFormError({
          field: 'gender',
          message: 'Please select a gender for Omang ID.',
        });
        return;
      }
      if (!keepingExistingId) {
        const omangCheck = validateOmang(trimmedId, gender);
        if (!omangCheck.ok) {
          setFormError({
            field: 'idNumber',
            message: omangCheck.message,
          });
          return;
        }
      }
    } else if (!keepingExistingId && !trimmedId) {
      setFormError({
        field: 'idNumber',
        message: 'Identification number is required.',
      });
      return;
    }

    const payload: Record<string, any> = {
      fullName: fullName.trim(),
      personRole: role,
      ownershipPercent: enteredOwnership,
      identityType,
      gender: identityType === 'OMANG' ? gender : undefined,
      idNumber: trimmedId ? (identityType === 'OMANG' ? normaliseOmang(trimmedId) : trimmedId) : undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      nationality,
      isCitizen,
    };

    setIsSaving(true);
    try {
      const saved = editingDirector
        ? await supplierApi.updatePerson(editingDirector.id, payload)
        : await supplierApi.addPerson(payload);

      onDirtyChangeRef.current(false);
      await onSaved(saved);
    } catch (err: any) {
      setFormError({
        field: err.field || 'fullName',
        message: err.message || 'Failed to save director record.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-[#1C364B] border border-[#D5E0EA] dark:border-[#244157] rounded-[12px] p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[#D5E0EA] dark:border-[#244157]">
          <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            {editingDirector ? 'Edit director' : 'Add director'}
          </h3>
          <button
            type="button"
            onClick={onClose}
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
              onChange={(e) => {
                setFullName(e.target.value);
                markDirty();
              }}
              placeholder="e.g. Kagiso Phiri"
              className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                Role *
              </label>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  markDirty();
                }}
                className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
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
                <span className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">
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
                  markDirty();
                }}
                placeholder={remainingEquityAvailable > 0 ? `e.g. ${Math.min(50, remainingEquityAvailable)}` : '0'}
                className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums"
              />
              <p className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">
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
                  setNationality(val === 'OMANG' ? 'Motswana' : 'Foreign');
                  setFormError(null);
                  markDirty();
                }}
                className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
              >
                <option value="OMANG">National ID (Omang)</option>
                <option value="PASSPORT">Passport</option>
              </select>
            </div>

            {identityType === 'OMANG' ? (
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Gender *
                </label>
                <select
                  required
                  value={gender}
                  onChange={(e) => {
                    setGender(e.target.value as 'male' | 'female' | '');
                    markDirty();
                    if (formError?.field === 'gender' || formError?.field === 'idNumber') {
                      setFormError(null);
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] ${
                    formError?.field === 'gender'
                      ? 'border-red-400 dark:border-red-600'
                      : 'border-[#D5E0EA] dark:border-[#244157]'
                  }`}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Nationality
                </label>
                <input
                  type="text"
                  value={nationality}
                  onChange={(e) => {
                    setNationality(e.target.value);
                    markDirty();
                  }}
                  placeholder="e.g. South African"
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
              {identityType === 'OMANG' ? 'Omang ID number' : 'Passport number'} {editingDirector?.hasId ? '(leave blank to keep saved)' : '*'}
            </label>
            <input
              type="text"
              inputMode={identityType === 'OMANG' ? 'numeric' : 'text'}
              maxLength={identityType === 'OMANG' ? 9 : 40}
              required={!editingDirector?.hasId}
              placeholder={
                editingDirector?.hasId && editingDirector.idLast4
                  ? `Saved ending ${editingDirector.idLast4} — enter new ID to replace`
                  : identityType === 'OMANG'
                  ? 'e.g. 123416789 (9 digits)'
                  : 'e.g. P12345678'
              }
              value={idNumber}
              onChange={handleIdChange}
              onPaste={handleIdPaste}
              onBlur={() => setIdTouched(true)}
              className={`w-full px-3 py-2 border rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99] tabular-nums ${
                liveIdError
                  ? 'border-red-400 dark:border-red-600'
                  : 'border-[#D5E0EA] dark:border-[#244157]'
              }`}
            />
            {liveIdError ? (
              <p className="text-[12px] text-[#C2412D] dark:text-red-400 font-medium" role="alert">
                {liveIdError}
              </p>
            ) : identityType === 'OMANG' ? (
              <p className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">
                {editingDirector?.hasId && editingDirector.idLast4
                  ? `Saved ID ending ${editingDirector.idLast4}. Leave blank to keep existing ID, or enter a 9-digit Omang (5th digit: 1 = male, 2 = female).`
                  : '9 digits only. The 5th digit indicates gender (1 = male, 2 = female).'}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                Email (optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  markDirty();
                }}
                placeholder="e.g. name@company.co.bw"
                className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                Phone (optional)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  markDirty();
                }}
                placeholder="e.g. +267 71 234 567"
                className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#D5E0EA] dark:border-[#244157]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#D5E0EA] dark:border-[#244157] text-[#10212E] dark:text-white rounded-[6px] text-[14px] font-medium hover:bg-slate-50 dark:hover:bg-[#10212E] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || Boolean(liveIdError)}
              className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSaving ? 'Saving…' : 'Save director'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteDirectorModalProps {
  director: DirectorRecord;
  isRemoving: boolean;
  removeError: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteDirectorModal: React.FC<DeleteDirectorModalProps> = ({
  director,
  isRemoving,
  removeError,
  onClose,
  onConfirm,
}) => (
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    onKeyDown={(e) => {
      if (e.key === 'Escape' && !isRemoving) {
        onClose();
      }
    }}
  >
    <div
      role="alertdialog"
      aria-labelledby="remove-director-title"
      className="w-full max-w-md bg-white dark:bg-[#1C364B] border border-[#D5E0EA] dark:border-[#244157] rounded-[12px] p-6 shadow-2xl space-y-4"
    >
      <div className="flex items-center justify-between pb-3 border-b border-[#D5E0EA] dark:border-[#244157]">
        <h3 id="remove-director-title" className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
          Remove director?
        </h3>
        <button
          type="button"
          disabled={isRemoving}
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <p className="text-[14px] text-[#43525F] dark:text-[#D3E3F2]">
        Remove {director.fullName} from your directors list?
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
          onClick={onClose}
          className="px-4 py-2 border border-[#D5E0EA] dark:border-[#244157] text-[#10212E] dark:text-white rounded-[6px] text-[14px] font-medium cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isRemoving}
          onClick={onConfirm}
          className="px-4 py-2 bg-[#C2412D] hover:bg-[#a53424] text-white rounded-[6px] text-[14px] font-medium cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
        >
          {isRemoving && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{isRemoving ? 'Removing…' : removeError ? 'Try again' : 'Remove'}</span>
        </button>
      </div>
    </div>
  </div>
);

export const DirectorsPanel: React.FC = () => {
  const { updateSupplierProfile } = useApp();
  const [directors, setDirectors] = useState<DirectorRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDirector, setEditingDirector] = useState<DirectorRecord | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmDeleteDirector, setConfirmDeleteDirector] = useState<DirectorRecord | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const updateSupplierProfileRef = useRef(updateSupplierProfile);
  updateSupplierProfileRef.current = updateSupplierProfile;

  const isModalOpenRef = useRef(false);
  isModalOpenRef.current = isModalOpen;

  const isFormDirtyRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  const fetchDirectors = useCallback(async (options?: { force?: boolean }) => {
    // Never refetch the list while the form is open and dirty
    if (!options?.force && isModalOpenRef.current && isFormDirtyRef.current) {
      return;
    }
    try {
      if (!hasLoadedOnceRef.current) {
        setIsLoading(true);
      }
      const res = await supplierApi.listPeople();
      if (Array.isArray(res)) {
        setDirectors(res);
        hasLoadedOnceRef.current = true;
        // Synchronize with AppContext supplier.directors so completeness and checklist update immediately
        const mapped = res.map((p: any) => ({
          id: p.id,
          fullName: p.fullName || p.full_name || '',
          nationalIdOrPassport: p.idLast4 ? `ending ${p.idLast4}` : (p.hasId ? 'Provided' : ''),
          idLast4: p.idLast4 ?? null,
          hasId: Boolean(p.hasId),
          gender: p.gender ?? null,
          idType: (p.identityType === 'PASSPORT' || p.identity_type === 'PASSPORT') ? 'Passport' as const : 'National ID (Omang)' as const,
          nationality: p.nationality || 'Motswana',
          isCitizen: p.isCitizen ?? p.is_citizen ?? true,
          shareholdingPercentage: Number(p.ownershipPercent ?? p.ownership_percent ?? p.shareholdingPercentage) || 0,
          ownershipPercent: Number(p.ownershipPercent ?? p.ownership_percent ?? p.shareholdingPercentage) || 0,
          role: p.personRole || p.person_role || 'Director',
          kycStatus: p.kycStatus || p.kyc_status || 'not_started',
          kycVerifiedAt: p.kycVerifiedAt ?? p.kyc_verified_at ?? null,
          kycReference: p.kycReference ?? p.kyc_reference ?? null,
        }));
        updateSupplierProfileRef.current({ directors: mapped });
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
  const totalOwnership = directors.reduce(
    (sum, d: any) => sum + (Number(d.ownershipPercent ?? d.shareholdingPercentage ?? d.ownership_percent) || 0),
    0
  );

  // Remaining equity available excluding the director currently being edited
  const otherDirectorsOwnership = directors
    .filter((d: any) => !editingDirector || d.id !== editingDirector.id)
    .reduce((sum, d: any) => sum + (Number(d.ownershipPercent ?? d.shareholdingPercentage ?? d.ownership_percent) || 0), 0);
  const remainingEquityAvailable = Math.max(0, parseFloat((100 - otherDirectorsOwnership).toFixed(2)));

  const handleOpenAdd = useCallback(() => {
    setEditingDirector(null);
    setIsModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((dir: DirectorRecord) => {
    setEditingDirector(dir);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    isFormDirtyRef.current = false;
    setIsModalOpen(false);
  }, []);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    isFormDirtyRef.current = dirty;
  }, []);

  const handleSaved = useCallback(async (saved?: DirectorRecord) => {
    isFormDirtyRef.current = false;
    setIsModalOpen(false);
    if (saved && saved.id) {
      setDirectors((prev) => {
        const exists = prev.some((d) => d.id === saved.id);
        return exists ? prev.map((d) => (d.id === saved.id ? { ...d, ...saved } : d)) : [...prev, saved];
      });
    }
    setSuccessMessage('Director saved successfully.');
    await fetchDirectors({ force: true });
    setTimeout(() => setSuccessMessage(null), 3500);
  }, [fetchDirectors]);

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
      await fetchDirectors({ force: true });
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

  return (
    <div id="field-directors" className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#244157]">
        <div>
          <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
            People and directors
          </h2>
          <p className="text-[14px] text-[#6B7A87] mt-0.5 dark:text-[#9CB4C9]">
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
      <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#244157] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[14px]">
        <div className="flex items-center gap-2.5">
          <span className="text-[#6B7A87] dark:text-[#9CB4C9]">Ownership total:</span>
          <span className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white tabular-nums">
            {totalOwnership}% of 100%
          </span>
          {directors.length > 0 && Math.round(totalOwnership) === 100 ? (
            <span className="bg-[#ECFDF5] text-[#2F8F5B] px-2.5 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1 dark:bg-[#2F8F5B]/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Balanced (100% equity allocated)</span>
            </span>
          ) : totalOwnership > 100 ? (
            <span className="bg-[#FEF2F2] text-[#C2412D] px-2.5 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1 dark:bg-[#C2412D]/20">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Exceeds 100% allocation</span>
            </span>
          ) : (
            <span className="bg-[#FFFBEB] text-[#D97706] px-2.5 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1 dark:bg-[#E8A33D]/20 dark:text-[#FCD34D]">
              <Info className="w-3.5 h-3.5" />
              <span>{100 - totalOwnership}% still to allocate</span>
            </span>
          )}
        </div>
        <span className="text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">
          {directors.length} person{directors.length === 1 ? '' : 's'} recorded
        </span>
      </div>

      {/* List of saved people */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 space-x-3 text-[#6B7A87] bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] border border-[#D5E0EA] dark:border-[#244157] dark:text-[#9CB4C9]">
          <Loader2 className="w-6 h-6 animate-spin text-[#1F5F99] dark:text-[#6FAEE0]" />
          <span className="text-[14px] font-medium">Loading people and directors records...</span>
        </div>
      ) : directors.length === 0 ? (
        <div className="p-8 border border-dashed border-[#D5E0EA] dark:border-[#244157] rounded-[8px] text-center space-y-3">
          <p className="text-[15px] font-semibold text-[#10212E] dark:text-white">
            No directors added yet
          </p>
          <p className="text-[13px] text-[#6B7A87] max-w-md mx-auto dark:text-[#9CB4C9]">
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
        <div className="overflow-x-auto border border-[#D5E0EA] dark:border-[#244157] rounded-[8px]">
          <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#244157]">
            <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[14px] dark:text-[#9CB4C9]">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Role</th>
                <th className="p-4 text-right">Ownership</th>
                <th className="p-4">Identity</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#244157] text-[#10212E] dark:text-white">
              {directors.map((dir) => {
                const displayId = dir.idLast4
                  ? `ending ${dir.idLast4}`
                  : dir.hasId
                  ? 'Provided'
                  : 'Not provided';
                const isOmang = (dir.identityType || 'OMANG') === 'OMANG';
                const needsGender = dir.hasId && isOmang && !dir.gender;
                return (
                  <tr key={dir.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors">
                    <td className="p-4">
                      <div className="space-y-0.5">
                        <span className="font-semibold block">{dir.fullName}</span>
                        <span className="text-[13px] text-[#6B7A87] block dark:text-[#9CB4C9]">{dir.nationality}</span>
                      </div>
                    </td>
                    <td className="p-4 capitalize text-[#43525F] dark:text-[#D3E3F2]">{dir.personRole.replace('_', ' ')}</td>
                    <td className="p-4 text-right font-semibold tabular-nums text-[15px]">
                      {dir.ownershipPercent}%
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <span className="font-medium tabular-nums block">{displayId}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-medium inline-block">
                            {dir.identityType || 'OMANG'}
                          </span>
                          {dir.gender ? (
                            <span className="text-[11px] px-2 py-0.5 bg-[#EAF2FA] dark:bg-[#244157] text-[#1F5F99] dark:text-[#38BDF8] rounded font-medium capitalize inline-block">
                              {dir.gender}
                            </span>
                          ) : needsGender ? (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(dir)}
                              className="text-[11px] px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded font-medium hover:bg-amber-200 dark:hover:bg-amber-900/60 cursor-pointer"
                            >
                              Add gender
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {dir.kycStatus === 'verified' ? (
                        <span
                          className="text-[13px] px-2.5 py-0.5 rounded-[4px] font-medium inline-flex items-center gap-1 bg-[#ECFDF5] text-[#2F8F5B] dark:bg-[#2F8F5B]/20"
                          title={dir.kycVerifiedAt ? `Verified by admin on ${new Date(dir.kycVerifiedAt).toLocaleDateString()}` : 'Verified by platform admin'}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Verified</span>
                        </span>
                      ) : dir.kycStatus === 'failed' ? (
                        <div className="space-y-0.5">
                          <span className="text-[13px] px-2.5 py-0.5 rounded-[4px] font-medium inline-flex items-center gap-1 bg-[#FEF2F2] text-[#C2412D] dark:bg-[#C2412D]/20">
                            <AlertCircle className="w-3 h-3" />
                            <span>Rejected</span>
                          </span>
                          {dir.kycReference && (
                            <span className="block text-[11px] text-[#C2412D] max-w-[180px] truncate" title={dir.kycReference}>
                              {dir.kycReference}
                            </span>
                          )}
                        </div>
                      ) : dir.kycStatus === 'pending' ? (
                        <span
                          className="text-[13px] px-2.5 py-0.5 rounded-[4px] font-medium inline-flex items-center gap-1 bg-[#FFFBEB] text-[#92400E] dark:bg-amber-950/50 dark:text-amber-300"
                          title="Awaiting admin review against uploaded identity documents"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Pending admin review</span>
                        </span>
                      ) : (
                        <span
                          className="text-[13px] px-2.5 py-0.5 rounded-[4px] font-medium inline-flex items-center gap-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          title="Not yet verified by platform admin"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Unverified</span>
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(dir)}
                          className="px-2.5 py-1 text-[13px] font-medium text-[#1F5F99] dark:text-[#38BDF8] bg-[#EAF2FA] dark:bg-[#244157] hover:bg-[#dbeafe] dark:hover:bg-[#254661] rounded-[4px] inline-flex items-center gap-1 cursor-pointer transition-colors"
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

      {/* Module-level Add / Edit Modal with stable key */}
      {isModalOpen && (
        <DirectorFormModal
          key={editingDirector ? editingDirector.id : 'new'}
          editingDirector={editingDirector}
          otherDirectorsOwnership={otherDirectorsOwnership}
          remainingEquityAvailable={remainingEquityAvailable}
          onClose={handleCloseModal}
          onSaved={handleSaved}
          onDirtyChange={handleDirtyChange}
        />
      )}

      {/* Module-level Delete Confirmation Modal */}
      {confirmDeleteDirector && (
        <DeleteDirectorModal
          key={confirmDeleteDirector.id}
          director={confirmDeleteDirector}
          isRemoving={isRemoving}
          removeError={removeError}
          onClose={() => setConfirmDeleteDirector(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};

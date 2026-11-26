import React, { useState, useEffect, useCallback } from 'react';
import { buyerApi } from '../../services/api';
import { StatusChip } from '../common/StatusChip';
import {
  Search,
  Download,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Lock,
  Eye,
  X,
  FileText,
  Users,
  Briefcase,
  Building2,
} from 'lucide-react';

export const BuyerSupplierDatabase: React.FC = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedCitizenFilter, setSelectedCitizenFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Consent-scoped profile inspection modal
  const [inspectingSupplierId, setInspectingSupplierId] = useState<string | null>(null);
  const [inspectedProfile, setInspectedProfile] = useState<any | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string; mimeType: string } | null>(null);
  const [isOpeningDocId, setIsOpeningDocId] = useState<string | null>(null);

  const loadSuppliers = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await buyerApi.listSuppliers();
      setSuppliers(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load supplier roster.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const handleInspectProfile = async (supplierId: string) => {
    setInspectingSupplierId(supplierId);
    setInspectedProfile(null);
    setIsLoadingProfile(true);
    setErrorMsg(null);
    try {
      const profile = await buyerApi.getSupplierProfile(supplierId);
      setInspectedProfile(profile);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load supplier profile.');
      setInspectingSupplierId(null);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handlePreviewDocument = async (doc: any) => {
    const targetId = doc.versionId || doc.id;
    setIsOpeningDocId(targetId);
    setErrorMsg(null);
    try {
      const { objectUrl, fileName, mimeType } = await buyerApi.fetchDocumentBlob(targetId);
      setPreviewDoc({ title: doc.documentType || fileName, url: objectUrl, mimeType });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to open document preview.');
    } finally {
      setIsOpeningDocId(null);
    }
  };

  const closePreviewDoc = () => {
    if (previewDoc?.url) {
      URL.revokeObjectURL(previewDoc.url);
    }
    setPreviewDoc(null);
  };

  const categoriesAvailable = Array.from(
    new Set(suppliers.flatMap((s) => (Array.isArray(s.categories) ? s.categories : [])))
  ).sort();

  const filteredSuppliers = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      String(s.legalName || '').toLowerCase().includes(q) ||
      String(s.tradingName || '').toLowerCase().includes(q) ||
      String(s.cipaNumber || '').toLowerCase().includes(q) ||
      String(s.city || '').toLowerCase().includes(q) ||
      (Array.isArray(s.categories) && s.categories.some((cat: string) => cat.toLowerCase().includes(q)));

    const matchesCategory =
      selectedCategory === 'ALL' ||
      (Array.isArray(s.categories) && s.categories.includes(selectedCategory));
    const matchesCitizen =
      selectedCitizenFilter === 'ALL' ||
      (selectedCitizenFilter === '100' && Number(s.citizenOwnedPercentage) === 100);

    return matchesSearch && matchesCategory && matchesCitizen;
  });

  const handleExport = () => {
    const headers = 'LegalName,TradingName,ConsentStatus,CIPA,TIN,CitizenPct,City,ComplianceStatus,ApprovedRoster\n';
    const rows = filteredSuppliers
      .map(
        (s) =>
          `"${(s.legalName || '').replace(/"/g, '""')}","${(s.tradingName || '').replace(/"/g, '""')}","${s.consentStatus}","${s.cipaNumber || '[Consent restricted]'}","${s.tinNumber || '[Consent restricted]'}","${s.citizenOwnedPercentage ?? ''}","${s.city || ''}","${s.complianceStatus || ''}","${s.isApprovedRoster ? 'Yes' : 'No'}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Consented-Supplier-Roster-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    setToastMessage(`Exported ${filteredSuppliers.length} suppliers (respecting active consent redaction).`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const renderConsentBadge = (status: string) => {
    if (status === 'active') {
      return <span className="text-[10px] font-semibold bg-emerald-50 text-[#2F8F5B] px-2 py-0.5 rounded">Active Consent</span>;
    }
    if (status === 'revoked') {
      return <span className="text-[10px] font-semibold bg-rose-50 text-[#C2412D] px-2 py-0.5 rounded">Consent Revoked</span>;
    }
    if (status === 'expired') {
      return <span className="text-[10px] font-semibold bg-amber-50 text-amber-900 px-2 py-0.5 rounded">Consent Expired</span>;
    }
    return <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">No Direct Consent</span>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {toastMessage && (
        <div className="p-4 bg-emerald-50 text-[#2F8F5B] border border-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 text-[#C2412D] border border-rose-300 rounded-xl text-xs">
          {errorMsg}
        </div>
      )}

      {/* Header */}
      <div className="card-elevated p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border-l-4 border-l-[#1F5F99]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
              Central Roster
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">· {suppliers.length} Active Suppliers Tracked</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white">
            Registered & Pre-Qualified Supplier Database
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Search approved contractors and applicants. Statutory registration, directors, and compliance documents appear strictly within active supplier consent scopes, and every inspection is logged.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSuppliers}
            disabled={isLoading}
            className="px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={filteredSuppliers.length === 0}
            className="btn-alt py-2.5 px-4 text-xs cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export Roster (CSV)</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#EAF2FA]/50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by company name, city, or category..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
        >
          <option value="ALL">All Supply Categories</option>
          {categoriesAvailable.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={selectedCitizenFilter}
          onChange={(e) => setSelectedCitizenFilter(e.target.value)}
          className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
        >
          <option value="ALL">All Ownership Types</option>
          <option value="100">100% Citizen-Owned Only (CEEP)</option>
        </select>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading consent-scoped supplier directory...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Supplier / Trading Name</th>
                  <th className="py-3 px-4">Consent Scope</th>
                  <th className="py-3 px-4">CIPA UIN & TIN</th>
                  <th className="py-3 px-4">Categories</th>
                  <th className="py-3 px-4">Citizen Equity</th>
                  <th className="py-3 px-4">Compliance Status</th>
                  <th className="py-3 px-4 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No suppliers match your current filters.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#10212E]">{sup.legalName}</div>
                        <span className="text-[11px] text-slate-500">
                          {sup.tradingName || sup.city || 'Botswana'}
                        </span>
                        {sup.isApprovedRoster && (
                          <span className="ml-2 text-[10px] bg-emerald-50 text-[#2F8F5B] px-1.5 py-0.5 rounded font-semibold">
                            Approved Roster
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 space-y-1">
                        {renderConsentBadge(sup.consentStatus)}
                        {sup.hasSubmittedApplication && (
                          <span className="block text-[10px] text-[#1F5F99] font-medium">
                            Submitted Applicant
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        {sup.cipaNumber ? (
                          <div className="text-slate-800 font-bold">{sup.cipaNumber}</div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 italic">
                            <Lock className="w-3 h-3" /> [Consent restricted]
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 block">
                          TIN: {sup.tinNumber || '[Consent restricted]'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {Array.isArray(sup.categories) && sup.categories.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {sup.categories.slice(0, 2).map((c: string) => (
                              <span key={c} className="text-[10px] bg-[#EAF2FA] text-[#1F5F99] px-1.5 py-0.5 rounded">
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#2F8F5B] block font-mono">
                          {sup.citizenOwnedPercentage ?? 0}% Citizen
                        </span>
                        {sup.eddCertified && (
                          <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                            EDD Active
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusChip status={sup.complianceStatus || 'Action required'} />
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleInspectProfile(sup.id)}
                          className="px-3 py-1.5 rounded-lg border border-[#1F5F99] text-[#1F5F99] hover:bg-[#EAF2FA] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Consent-Scoped Supplier Profile Modal */}
      {inspectingSupplierId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-xs">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-[#1F5F99]" />
                <div>
                  <h3 className="font-heading font-bold text-base text-[#10212E]">
                    {inspectedProfile?.legalName || 'Supplier Profile Inspection'}
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Consent-scoped dossier · Access event recorded to supplier audit ledger
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInspectingSupplierId(null);
                  setInspectedProfile(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {isLoadingProfile ? (
                <div className="py-12 flex items-center justify-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading consent-scoped dossier...</span>
                </div>
              ) : inspectedProfile ? (
                <>
                  {/* Consent Status Banner */}
                  <div className="p-3.5 rounded-xl bg-[#F7FAFD] border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {renderConsentBadge(inspectedProfile.consentStatus)}
                      {inspectedProfile.consentExpiresAt && (
                        <span className="text-[11px] text-slate-500">
                          Expires {String(inspectedProfile.consentExpiresAt).slice(0, 10)}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {inspectedProfile.city || 'Botswana'} · {inspectedProfile.citizenOwnedPercentage ?? 0}% Citizen Owned
                    </span>
                  </div>

                  {/* Company Details */}
                  <div className="space-y-2">
                    <h4 className="font-heading font-bold text-sm text-[#10212E]">Company Details</h4>
                    {inspectedProfile.scopes?.companyDetails ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                          <span className="text-slate-500 block">CIPA UIN</span>
                          <strong className="font-mono text-[#10212E]">{inspectedProfile.cipaNumber || '—'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">BURS TIN</span>
                          <strong className="font-mono text-[#10212E]">{inspectedProfile.tinNumber || '—'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Contact Email</span>
                          <strong className="text-[#10212E]">{inspectedProfile.email || '—'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Phone</span>
                          <strong className="text-[#10212E]">{inspectedProfile.phone || '—'}</strong>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-slate-500 block">Physical Address</span>
                          <strong className="text-[#10212E]">{inspectedProfile.physicalAddress || '—'}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 inline-flex items-center gap-2 w-full">
                        <Lock className="w-4 h-4 shrink-0" />
                        <span>Company statutory details are not shared under the supplier's current consent scope.</span>
                      </div>
                    )}
                  </div>

                  {/* Directors & Beneficial Owners */}
                  <div className="space-y-2">
                    <h4 className="font-heading font-bold text-sm text-[#10212E] inline-flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[#1F5F99]" />
                      <span>Directors & Beneficial Owners</span>
                    </h4>
                    {inspectedProfile.scopes?.directorsOwners ? (
                      Array.isArray(inspectedProfile.directors) && inspectedProfile.directors.length > 0 ? (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                          {inspectedProfile.directors.map((d: any) => (
                            <div key={d.id} className="p-3 flex items-center justify-between">
                              <div>
                                <div className="font-bold text-[#10212E]">{d.fullName}</div>
                                <span className="text-[11px] text-slate-500">
                                  {d.role} · {d.citizenship || 'Citizenship not specified'}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-[#1F5F99]">
                                {d.ownershipPercentage ?? 0}%
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400">No directors recorded on supplier profile.</p>
                      )
                    ) : (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 inline-flex items-center gap-2 w-full">
                        <Lock className="w-4 h-4 shrink-0" />
                        <span>Directors & ownership records require supplier consent.</span>
                      </div>
                    )}
                  </div>

                  {/* Past Projects */}
                  <div className="space-y-2">
                    <h4 className="font-heading font-bold text-sm text-[#10212E] inline-flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-[#1F5F99]" />
                      <span>Past Projects & References</span>
                    </h4>
                    {inspectedProfile.scopes?.pastProjects ? (
                      Array.isArray(inspectedProfile.pastProjects) && inspectedProfile.pastProjects.length > 0 ? (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                          {inspectedProfile.pastProjects.map((p: any) => (
                            <div key={p.id} className="p-3 flex items-center justify-between gap-3">
                              <div>
                                <div className="font-bold text-[#10212E]">{p.title}</div>
                                <span className="text-[11px] text-slate-500">
                                  Client: {p.clientName} {p.year ? `· ${p.year}` : ''}
                                </span>
                              </div>
                              {p.valueBwp != null && (
                                <span className="font-mono font-bold text-[#2F8F5B]">
                                  P {Number(p.valueBwp).toLocaleString()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400">No past projects listed.</p>
                      )
                    ) : (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 inline-flex items-center gap-2 w-full">
                        <Lock className="w-4 h-4 shrink-0" />
                        <span>Past project history requires supplier consent.</span>
                      </div>
                    )}
                  </div>

                  {/* Shared Documents */}
                  <div className="space-y-2">
                    <h4 className="font-heading font-bold text-sm text-[#10212E] inline-flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#1F5F99]" />
                      <span>Shared Compliance Documents ({inspectedProfile.documents?.length || 0})</span>
                    </h4>
                    {Array.isArray(inspectedProfile.documents) && inspectedProfile.documents.length > 0 ? (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                        {inspectedProfile.documents.map((doc: any) => (
                          <div key={doc.id} className="p-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="font-bold text-[#10212E]">{doc.documentType}</div>
                              <span className="text-[11px] text-slate-500">
                                {doc.fileName} · Status: {doc.status}
                                {doc.expiryDate ? ` · Expires ${String(doc.expiryDate).slice(0, 10)}` : ''}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={isOpeningDocId === (doc.versionId || doc.id)}
                              onClick={() => handlePreviewDocument(doc)}
                              className="px-3 py-1.5 rounded-lg bg-[#EAF2FA] text-[#1F5F99] hover:bg-[#d8e8f7] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{isOpeningDocId === (doc.versionId || doc.id) ? 'Opening...' : 'View'}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500">
                        No vault documents are shared with your organization under the active consent scope.
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Overlay */}
      {previewDoc && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between text-xs">
              <strong className="text-sm text-[#10212E]">{previewDoc.title}</strong>
              <button
                type="button"
                onClick={closePreviewDoc}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 overflow-hidden">
              {previewDoc.mimeType.startsWith('image/') ? (
                <img src={previewDoc.url} alt={previewDoc.title} className="w-full h-full object-contain" />
              ) : (
                <iframe src={previewDoc.url} title={previewDoc.title} className="w-full h-full border-0" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import {
  adminApi,
  AdminCategoryRecord,
  AdminDocumentTypeRecord,
} from '../../services/api';
import {
  Folder,
  ChevronRight,
  ChevronDown,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export const AdminCatalogues: React.FC = () => {
  const [categories, setCategories] = useState<AdminCategoryRecord[]>([]);
  const [documentTypes, setDocumentTypes] = useState<AdminDocumentTypeRecord[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Add Category Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catCode, setCatCode] = useState('');
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catParentId, setCatParentId] = useState('');

  // Add Document Type Modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docCode, setDocCode] = useState('');
  const [docName, setDocName] = useState('');
  const [docAuthority, setDocAuthority] = useState('');
  const [docDesc, setDocDesc] = useState('');
  const [docRequiresExpiry, setDocRequiresExpiry] = useState(true);
  const [docMandatory, setDocMandatory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCatalogues = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.getCatalogues();
      const loadedCats = Array.isArray(data.categories) ? data.categories : [];
      const loadedDocs = Array.isArray(data.documentTypes) ? data.documentTypes : [];
      setCategories(loadedCats);
      setDocumentTypes(loadedDocs);
      setExpandedNodes((prev) =>
        prev.length > 0 ? prev : loadedCats.filter((c) => !c.parentId).slice(0, 3).map((c) => c.id)
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to load reference catalogues.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogues();
  }, [loadCatalogues]);

  const showSuccess = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleCategoryActive = async (cat: AdminCategoryRecord) => {
    setBusyId(cat.id);
    setError(null);
    try {
      await adminApi.updateCategory(cat.id, { isActive: !cat.isActive });
      await loadCatalogues();
      showSuccess(`${cat.name} marked ${!cat.isActive ? 'active' : 'inactive'}.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to update category.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catCode.trim() || !catName.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await adminApi.createCategory({
        code: catCode.trim(),
        name: catName.trim(),
        description: catDesc.trim() || undefined,
        parentId: catParentId || null,
        level: catParentId ? 2 : 1,
      });
      setIsCatModalOpen(false);
      setCatCode('');
      setCatName('');
      setCatDesc('');
      setCatParentId('');
      await loadCatalogues();
      showSuccess(`Added procurement category "${catName.trim()}".`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDocType = async (
    dt: AdminDocumentTypeRecord,
    field: 'isActive' | 'isMandatoryDefault'
  ) => {
    setBusyId(dt.id);
    setError(null);
    try {
      await adminApi.updateDocumentType(dt.id, { [field]: !dt[field] });
      await loadCatalogues();
      showSuccess(`Updated compliance rule for "${dt.name}".`);
    } catch (err: any) {
      setError(err?.message || 'Failed to update document type.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateDocType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docCode.trim() || !docName.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await adminApi.createDocumentType({
        code: docCode.trim(),
        name: docName.trim(),
        issuingAuthority: docAuthority.trim() || undefined,
        description: docDesc.trim() || undefined,
        requiresExpiry: docRequiresExpiry,
        isMandatoryDefault: docMandatory,
      });
      setIsDocModalOpen(false);
      setDocCode('');
      setDocName('');
      setDocAuthority('');
      setDocDesc('');
      await loadCatalogues();
      showSuccess(`Added compliance document type "${docName.trim()}".`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create document type.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const topCategories = categories.filter((c) => !c.parentId);
  const childrenByParent = new Map<string, AdminCategoryRecord[]>();
  for (const cat of categories) {
    if (cat.parentId) {
      const list = childrenByParent.get(cat.parentId) || [];
      list.push(cat);
      childrenByParent.set(cat.parentId, list);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#244157]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Master catalogues &amp; reference data
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#D3E3F2]">
            Manage standardized procurement categories and mandatory statutory compliance document types stored in PostgreSQL.
          </p>
        </div>
        <button
          type="button"
          onClick={loadCatalogues}
          disabled={isLoading}
          className="px-3.5 py-2 border border-[#D5E0EA] dark:border-[#244157] bg-white dark:bg-[#1C364B] hover:bg-[#F7FAFD] text-[#10212E] dark:text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto dark:hover:bg-[#162C3D]"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[#C2412D] dark:text-rose-200 text-[14px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div className="p-3.5 rounded-[8px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[14px] flex items-center gap-2 dark:bg-[#2F8F5B]/20 dark:text-[#6EE7B7] dark:border-[#2F8F5B]/40">
          <CheckCircle2 className="w-4 h-4 text-[#2F8F5B] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-12 flex items-center justify-center gap-2 text-[#6B7A87] dark:text-[#9CB4C9]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1F5F99] dark:text-[#6FAEE0]" />
          <span>Loading reference catalogues...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Category Tree Card */}
          <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                  Procurement categories
                </h2>
                <span className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">
                  {topCategories.length} top-level · {categories.length} total
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCatModalOpen(true)}
                className="px-3 py-1.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add category</span>
              </button>
            </div>

            {topCategories.length === 0 ? (
              <div className="py-8 text-center text-[14px] text-[#6B7A87] dark:text-[#9CB4C9]">
                No procurement categories configured yet.
              </div>
            ) : (
              <div className="space-y-2 text-[14px]">
                {topCategories.map((cat) => {
                  const isExpanded = expandedNodes.includes(cat.id);
                  const children = childrenByParent.get(cat.id) || [];
                  return (
                    <div
                      key={cat.id}
                      className="border border-[#D5E0EA] dark:border-[#244157] rounded-[8px] overflow-hidden"
                    >
                      <div className="p-3 bg-[#F7FAFD] dark:bg-[#10212E] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleNode(cat.id)}
                          className="flex items-center gap-2 font-semibold text-[#10212E] dark:text-white text-left cursor-pointer min-w-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-[#6B7A87] shrink-0 dark:text-[#9CB4C9]" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[#6B7A87] shrink-0 dark:text-[#9CB4C9]" />
                          )}
                          <Folder className="w-4 h-4 text-[#1F5F99] shrink-0 dark:text-[#6FAEE0]" />
                          <span className="truncate">{cat.name}</span>
                          <span className="text-[11px] font-normal text-[#6B7A87] shrink-0 dark:text-[#9CB4C9]">({cat.code})</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyId === cat.id}
                          onClick={() => handleToggleCategoryActive(cat)}
                          className={`text-[11px] px-2 py-0.5 rounded-[4px] font-medium cursor-pointer shrink-0 ${
                            cat.isActive
                              ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                              : 'bg-slate-200 text-slate-600 dark:bg-[#162C3D] dark:text-[#D3E3F2]'
                          }`}
                        >
                          {cat.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="p-3 space-y-2 bg-white dark:bg-[#1C364B] border-t border-[#D5E0EA] dark:border-[#244157]">
                          {children.length === 0 ? (
                            <div className="pl-6 text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">No subcategories</div>
                          ) : (
                            children.map((sub) => (
                              <div
                                key={sub.id}
                                className="flex items-center justify-between gap-2 pl-4 text-[13px] text-[#43525F] dark:text-[#D3E3F2]"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#1F5F99] shrink-0" />
                                  <span className="truncate">{sub.name}</span>
                                  <span className="text-[11px] text-[#6B7A87] dark:text-[#9CB4C9]">({sub.code})</span>
                                </div>
                                <button
                                  type="button"
                                  disabled={busyId === sub.id}
                                  onClick={() => handleToggleCategoryActive(sub)}
                                  className={`text-[11px] px-2 py-0.5 rounded-[4px] font-medium cursor-pointer shrink-0 ${
                                    sub.isActive
                                      ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                                      : 'bg-slate-200 text-slate-600 dark:bg-[#162C3D] dark:text-[#D3E3F2]'
                                  }`}
                                >
                                  {sub.isActive ? 'Active' : 'Inactive'}
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Compliance Document Types Card */}
          <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                  Compliance document types
                </h2>
                <span className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">
                  {documentTypes.length} configured document types
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDocModalOpen(true)}
                className="px-3 py-1.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add document type</span>
              </button>
            </div>

            {documentTypes.length === 0 ? (
              <div className="py-8 text-center text-[14px] text-[#6B7A87] dark:text-[#9CB4C9]">
                No compliance document types configured yet.
              </div>
            ) : (
              <div className="divide-y divide-[#D5E0EA] dark:divide-[#244157] text-[14px]">
                {documentTypes.map((dt) => (
                  <div key={dt.id} className="py-3.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-semibold text-[#10212E] dark:text-white">
                          {dt.name}
                        </span>{' '}
                        <span className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">({dt.code})</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={busyId === dt.id}
                          onClick={() => handleToggleDocType(dt, 'isMandatoryDefault')}
                          className={`text-[11px] px-2 py-0.5 rounded-[4px] font-medium cursor-pointer ${
                            dt.isMandatoryDefault
                              ? 'bg-[#EAF2FA] text-[#1F5F99]'
                              : 'bg-slate-100 text-[#6B7A87] dark:bg-[#162C3D] dark:text-[#9CB4C9]'
                          }`}
                        >
                          {dt.isMandatoryDefault ? 'Mandatory' : 'Optional'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === dt.id}
                          onClick={() => handleToggleDocType(dt, 'isActive')}
                          className={`text-[11px] px-2 py-0.5 rounded-[4px] font-medium cursor-pointer ${
                            dt.isActive
                              ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                              : 'bg-slate-200 text-slate-600 dark:bg-[#162C3D] dark:text-[#D3E3F2]'
                          }`}
                        >
                          {dt.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    </div>
                    <p className="text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">
                      {dt.description || 'Statutory compliance document'}{' '}
                      {dt.issuingAuthority ? `· Issuer: ${dt.issuingAuthority}` : ''}
                      {dt.requiresExpiry ? ' · Expiry required' : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/70 backdrop-blur-xs">
          <form
            onSubmit={handleCreateCategory}
            className="w-full max-w-md bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 space-y-4 text-[14px]"
          >
            <h3 className="font-heading font-semibold text-[18px]">Add procurement category</h3>
            <div className="space-y-1">
              <label className="font-medium block">Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. ICT-CLOUD"
                value={catCode}
                onChange={(e) => setCatCode(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E]"
              />
            </div>
            <div className="space-y-1">
              <label className="font-medium block">Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Cloud & Cybersecurity Services"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E]"
              />
            </div>
            <div className="space-y-1">
              <label className="font-medium block">Parent category (optional)</label>
              <select
                value={catParentId}
                onChange={(e) => setCatParentId(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E]"
              >
                <option value="">None (Top-level group)</option>
                {topCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-medium block">Description</label>
              <textarea
                rows={2}
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsCatModalOpen(false)} className="px-4 py-2 text-[#43525F] cursor-pointer dark:text-[#D3E3F2]">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#1F5F99] text-white rounded-[6px] font-medium cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Create category'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Document Type Modal */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/70 backdrop-blur-xs">
          <form
            onSubmit={handleCreateDocType}
            className="w-full max-w-md bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 space-y-4 text-[14px]"
          >
            <h3 className="font-heading font-semibold text-[18px]">Add compliance document type</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium block">Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PPRA_CERT"
                  value={docCode}
                  onChange={(e) => setDocCode(e.target.value)}
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium block">Issuing authority</label>
                <input
                  type="text"
                  placeholder="e.g. PPRA / BURS"
                  value={docAuthority}
                  onChange={(e) => setDocAuthority(e.target.value)}
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="font-medium block">Document name *</label>
              <input
                type="text"
                required
                placeholder="e.g. PPRA Registration Certificate"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E]"
              />
            </div>
            <div className="space-y-1">
              <label className="font-medium block">Description</label>
              <textarea
                rows={2}
                value={docDesc}
                onChange={(e) => setDocDesc(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E]"
              />
            </div>
            <div className="flex flex-col gap-2 text-[13px]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={docRequiresExpiry}
                  onChange={(e) => setDocRequiresExpiry(e.target.checked)}
                />
                <span>Requires expiry date tracking</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={docMandatory}
                  onChange={(e) => setDocMandatory(e.target.checked)}
                />
                <span>Mandatory by default for tender eligibility</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsDocModalOpen(false)} className="px-4 py-2 text-[#43525F] cursor-pointer dark:text-[#D3E3F2]">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#1F5F99] text-white rounded-[6px] font-medium cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Create document type'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

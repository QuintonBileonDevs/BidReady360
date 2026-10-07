import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { FormField, FormTemplate } from '../../mockData';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  Save,
  CheckCircle2,
  Copy,
  Settings,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

export const BuyerFormBuilder: React.FC = () => {
  const { formTemplates, createFormTemplate, updateFormTemplate } = useApp();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(formTemplates[0]?.id || '');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentTemplate = formTemplates.find((t) => t.id === selectedTemplateId) || formTemplates[0];

  // Local state for live editing
  const [templateTitle, setTemplateTitle] = useState(currentTemplate?.title || 'Custom Tender Questionnaire');
  const [templateVersion, setTemplateVersion] = useState(currentTemplate?.version || 'v1.0');
  const [templateDesc, setTemplateDesc] = useState(currentTemplate?.description || '');
  const [fields, setFields] = useState<FormField[]>(currentTemplate?.fields ? JSON.parse(JSON.stringify(currentTemplate.fields)) : []);

  // Live preview test form state
  const [previewValues, setPreviewValues] = useState<Record<string, any>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSwitchTemplate = (id: string) => {
    const tmpl = formTemplates.find((t) => t.id === id);
    if (tmpl) {
      setSelectedTemplateId(id);
      setTemplateTitle(tmpl.title);
      setTemplateVersion(tmpl.version);
      setTemplateDesc(tmpl.description);
      setFields(JSON.parse(JSON.stringify(tmpl.fields)));
      setPreviewValues({});
    }
  };

  const handleAddField = () => {
    const newField: FormField = {
      id: `f-${Date.now()}`,
      label: 'New Question Title',
      type: 'text',
      required: false,
      placeholder: 'Enter response...',
      helpText: '',
    };
    setFields([...fields, newField]);
  };

  const handleUpdateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const handleDeleteField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...fields];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);
    setFields(reordered);
  };

  const handleSave = () => {
    if (currentTemplate) {
      updateFormTemplate(currentTemplate.id, {
        title: templateTitle,
        version: templateVersion,
        description: templateDesc,
        fields,
      });
      showToast(`Form template "${templateTitle}" (${templateVersion}) saved successfully.`);
    }
  };

  const handleCreateNewTemplate = () => {
    const newId = createFormTemplate({
      organizationId: 'org-grc',
      title: 'New Procurement Questionnaire',
      version: 'v1.0',
      description: 'Custom tender questions configured by procurement unit.',
      fields: [
        {
          id: `f-${Date.now()}-1`,
          label: 'Delivery Lead Time (Days)',
          type: 'number',
          required: true,
          placeholder: 'e.g. 14',
        },
        {
          id: `f-${Date.now()}-2`,
          label: 'Do you offer warranty on supplied equipment?',
          type: 'yes_no',
          required: true,
        },
      ],
    });
    setSelectedTemplateId(newId);
    showToast('Created new blank form template.');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Toast */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-[#2F8F5B] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="card-elevated p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border-l-4 border-l-[#1F5F99]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
              Form Builder Studio
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">· Versioning & Conditional Logic Enabled</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white">
            Custom Tender Form & Questionnaire Builder
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Configure custom technical, commercial, and JV qualification questionnaires for buying drives.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCreateNewTemplate}
            className="btn-alt py-2.5 px-4 text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Template</span>
          </button>
          <button
            onClick={handleSave}
            className="btn-primary py-2.5 px-4 text-xs shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Save Template ({templateVersion})</span>
          </button>
        </div>
      </div>

      {/* Template Selector & Meta */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Active Template</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleSwitchTemplate(e.target.value)}
            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-[#10212E]"
          >
            {formTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.version})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Template Title</label>
          <input
            type="text"
            value={templateTitle}
            onChange={(e) => setTemplateTitle(e.target.value)}
            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Version Tag</label>
          <input
            type="text"
            value={templateVersion}
            onChange={(e) => setTemplateVersion(e.target.value)}
            placeholder="e.g. v2.2"
            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
          />
        </div>
      </div>

      {/* 2-Column Split: Builder on Left, Live Interactive Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Field Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-semibold text-base text-[#10212E]">
              Configured Questionnaire Fields ({fields.length})
            </h3>
            <button
              onClick={handleAddField}
              className="px-3 py-1.5 bg-[#1F5F99] text-white text-xs font-semibold rounded-lg flex items-center gap-1 hover:bg-[#184a77] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Field</span>
            </button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-2xs"
              >
                {/* Field Top Row */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center font-mono">
                      {index + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      Field: {field.type.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveField(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                      title="Move Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveField(index, 'down')}
                      disabled={index === fields.length - 1}
                      className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                      title="Move Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteField(field.id)}
                      className="p-1.5 text-slate-400 hover:text-[#C2412D] rounded hover:bg-slate-100 ml-1"
                      title="Delete Field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Field Configuration Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Question / Field Label</label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Input Field Type</label>
                    <select
                      value={field.type}
                      onChange={(e) => handleUpdateField(field.id, { type: e.target.value as FormField['type'] })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="text">Single-line Text</option>
                      <option value="number">Number</option>
                      <option value="dropdown">Dropdown Selection</option>
                      <option value="yes_no">Yes / No Radio</option>
                      <option value="date">Date</option>
                      <option value="file_upload">File Upload</option>
                      <option value="textarea">Multi-line Textarea</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Placeholder Text</label>
                    <input
                      type="text"
                      value={field.placeholder || ''}
                      onChange={(e) => handleUpdateField(field.id, { placeholder: e.target.value })}
                      placeholder="e.g. Enter details..."
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Guidance / Help Text</label>
                    <input
                      type="text"
                      value={field.helpText || ''}
                      onChange={(e) => handleUpdateField(field.id, { helpText: e.target.value })}
                      placeholder="Brief instructions for bidders..."
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  {/* Required Toggle */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id={`req-${field.id}`}
                      checked={field.required}
                      onChange={(e) => handleUpdateField(field.id, { required: e.target.checked })}
                      className="rounded border-slate-300 text-[#1F5F99]"
                    />
                    <label htmlFor={`req-${field.id}`} className="font-semibold text-slate-700">
                      Mandatory Required Field
                    </label>
                  </div>

                  {/* Conditional Visibility Setup */}
                  <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Conditional Visibility Rules
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <select
                          value={field.conditionalOnFieldId || ''}
                          onChange={(e) =>
                            handleUpdateField(field.id, {
                              conditionalOnFieldId: e.target.value || undefined,
                            })
                          }
                          className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="">Always visible (No condition)</option>
                          {fields
                            .filter((f) => f.id !== field.id && (f.type === 'yes_no' || f.type === 'dropdown'))
                            .map((f) => (
                              <option key={f.id} value={f.id}>
                                Show only if "{f.label.substring(0, 30)}..."
                              </option>
                            ))}
                        </select>
                      </div>

                      {field.conditionalOnFieldId && (
                        <div>
                          <select
                            value={String(field.conditionalValue ?? 'true')}
                            onChange={(e) =>
                              handleUpdateField(field.id, {
                                conditionalValue: e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value,
                              })
                            }
                            className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                          >
                            <option value="true">Condition: Equals Yes / True</option>
                            <option value="false">Condition: Equals No / False</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Live Interactive Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-20 space-y-4">
            <div className="bg-[#10212E] text-white rounded-2xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#6FAEE0]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Live Supplier Preview
                  </span>
                </div>
                <span className="font-mono text-xs text-[#E8A33D] font-bold">
                  {templateVersion}
                </span>
              </div>
              <h3 className="font-heading font-bold text-base text-white">{templateTitle}</h3>
              <p className="text-xs text-slate-300">{templateDesc || 'Supplier view as rendered during submission.'}</p>
            </div>

            {/* Live Interactive Form Rendering */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm max-h-[600px] overflow-y-auto text-xs">
              {fields.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  No fields added yet. Add a question to view live preview.
                </div>
              ) : (
                fields.map((field) => {
                  // Check conditional visibility in live preview!
                  if (field.conditionalOnFieldId) {
                    const parentVal = previewValues[field.conditionalOnFieldId];
                    if (parentVal !== field.conditionalValue) {
                      return null; // hide in preview
                    }
                  }

                  return (
                    <div key={field.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <label className="block font-semibold text-slate-800">
                        {field.label} {field.required && <span className="text-[#C2412D]">*</span>}
                      </label>
                      {field.helpText && <p className="text-[11px] text-slate-500">{field.helpText}</p>}

                      {field.type === 'text' && (
                        <input
                          type="text"
                          value={previewValues[field.id] || ''}
                          onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      )}

                      {field.type === 'number' && (
                        <input
                          type="number"
                          value={previewValues[field.id] ?? ''}
                          onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: Number(e.target.value) })}
                          placeholder={field.placeholder}
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      )}

                      {field.type === 'yes_no' && (
                        <div className="flex items-center gap-4 pt-1">
                          <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                            <input
                              type="radio"
                              name={`preview-${field.id}`}
                              checked={previewValues[field.id] === true}
                              onChange={() => setPreviewValues({ ...previewValues, [field.id]: true })}
                              className="text-[#1F5F99]"
                            />
                            <span>Yes</span>
                          </label>
                          <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                            <input
                              type="radio"
                              name={`preview-${field.id}`}
                              checked={previewValues[field.id] === false}
                              onChange={() => setPreviewValues({ ...previewValues, [field.id]: false })}
                              className="text-[#1F5F99]"
                            />
                            <span>No</span>
                          </label>
                        </div>
                      )}

                      {field.type === 'dropdown' && (
                        <select
                          value={previewValues[field.id] || ''}
                          onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: e.target.value })}
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="">Select option...</option>
                          <option value="BW_LOCAL">Option A (Botswana)</option>
                          <option value="SADC">Option B (SADC)</option>
                        </select>
                      )}

                      {field.type === 'file_upload' && (
                        <div className="p-2.5 border border-dashed border-slate-300 bg-white rounded-lg text-center text-slate-400">
                          Upload file attachment simulation
                        </div>
                      )}

                      {field.type === 'textarea' && (
                        <textarea
                          rows={2}
                          value={previewValues[field.id] || ''}
                          onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

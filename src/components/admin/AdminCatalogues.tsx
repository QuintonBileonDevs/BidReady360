import React, { useState } from 'react';
import { Folder, ChevronRight, ChevronDown, FileText, Tag, MessageSquare } from 'lucide-react';

export const AdminCatalogues: React.FC = () => {
  const [expandedNodes, setExpandedNodes] = useState<string[]>(['cat-works', 'cat-services']);

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const categories = [
    {
      id: 'cat-works',
      title: 'Works & Infrastructure',
      subcategories: [
        'Building Construction & Maintenance',
        'Civil Engineering & Earthworks',
        'Electrical & High Voltage Infrastructure',
        'Road Surfacing & Asphalt Works',
      ],
    },
    {
      id: 'cat-supplies',
      title: 'Supplies & Commodities',
      subcategories: [
        'Office Stationery & IT Hardware',
        'Protective Clothing & Uniforms',
        'Building Materials & Timber',
        'Medical Supplies & Pharmaceuticals',
      ],
    },
    {
      id: 'cat-services',
      title: 'Professional & Consulting Services',
      subcategories: [
        'Architectural & Engineering Consulting',
        'Auditing & Financial Advisory',
        'Security Guarding & Surveillance',
        'ICT Software Development & Cloud Support',
      ],
    },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            System catalogues & taxonomies
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Maintain standardized procurement classification trees, mandatory statutory document types, and message templates.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Tree Card */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              Procurement category taxonomy
            </h2>
            <span className="text-[13px] text-[#6B7A87]">3 top-level groups</span>
          </div>

          <div className="space-y-2 text-[14px]">
            {categories.map((cat) => {
              const isExpanded = expandedNodes.includes(cat.id);
              return (
                <div key={cat.id} className="border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleNode(cat.id)}
                    className="w-full p-3 bg-[#F7FAFD] dark:bg-[#10212E] flex items-center justify-between font-semibold text-[#10212E] dark:text-white text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Folder className="w-4 h-4 text-[#1F5F99]" />
                      <span>{cat.title}</span>
                    </div>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-[#6B7A87]" /> : <ChevronRight className="w-4 h-4 text-[#6B7A87]" />}
                  </button>

                  {isExpanded && (
                    <div className="p-3 space-y-2 bg-white dark:bg-[#132635] border-t border-[#D5E0EA] dark:border-[#1E364A]">
                      {cat.subcategories.map((sub, idx) => (
                        <div key={idx} className="flex items-center gap-2 pl-4 text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1F5F99]" />
                          <span>{sub}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mandatory Document Types Card */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              Statutory document catalog
            </h2>
            <span className="text-[13px] text-[#6B7A87]">5 core document types</span>
          </div>

          <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[14px]">
            <div className="py-3 space-y-1">
              <span className="font-semibold text-[#10212E] dark:text-white block">
                BURS Tax Clearance Certificate
              </span>
              <p className="text-[13px] text-[#6B7A87]">
                Verified via BURS electronic taxpayer gateway. Valid for 12 months from issuance.
              </p>
            </div>
            <div className="py-3 space-y-1">
              <span className="font-semibold text-[#10212E] dark:text-white block">
                CIPA Certificate of Incorporation
              </span>
              <p className="text-[13px] text-[#6B7A87]">
                Authenticates UIN registration, current directorship, and annual return standing.
              </p>
            </div>
            <div className="py-3 space-y-1">
              <span className="font-semibold text-[#10212E] dark:text-white block">
                Workers Compensation Insurance Policy
              </span>
              <p className="text-[13px] text-[#6B7A87]">
                Mandatory for physical works, transport, and hazardous facility services.
              </p>
            </div>
            <div className="py-3 space-y-1">
              <span className="font-semibold text-[#10212E] dark:text-white block">
                Banking Confirmation Letter
              </span>
              <p className="text-[13px] text-[#6B7A87]">
                Validates corporate banking details for direct electronic funds disbursement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

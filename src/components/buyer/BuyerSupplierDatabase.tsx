import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StatusChip } from '../common/StatusChip';
import {
  Users,
  Search,
  Download,
  ShieldCheck,
  Building2,
  Calendar,
  Phone,
  Mail,
  Filter,
  CheckCircle2,
} from 'lucide-react';

export const BuyerSupplierDatabase: React.FC = () => {
  const { allSuppliers } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedCitizenFilter, setSelectedCitizenFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const filteredSuppliers = allSuppliers.filter((s) => {
    const matchesSearch =
      s.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.cipaNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ppraCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || s.category === selectedCategory;
    const matchesCitizen = selectedCitizenFilter === 'ALL' || (selectedCitizenFilter === '100' && s.citizenOwnedPercentage === 100);

    return matchesSearch && matchesCategory && matchesCitizen;
  });

  const handleExport = () => {
    setToastMessage('Exporting approved supplier roster (CSV) with CIPA registration codes.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 text-[#2F8F5B] border border-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="card-elevated p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border-l-4 border-l-[#1F5F99]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
              Central Roster
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">· {allSuppliers.length} Verified Vendors in Database</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white">
            Registered & Pre-Qualified Supplier Database
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Search approved contractors, monitor document expiration status, and filter by Citizen Economic Empowerment equity.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="btn-alt py-2.5 px-4 text-xs"
        >
          <Download className="w-4 h-4" />
          <span>Export Roster (CSV)</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#EAF2FA]/50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by company name, CIPA UIN, or category..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
          >
            <option value="ALL">All Contractor Categories</option>
            <option value="Building & Civil Construction">Building & Civil Construction</option>
            <option value="Stationery & Printing">Stationery & Printing</option>
            <option value="ICT & Technology">ICT & Technology</option>
            <option value="Electrical & Clean Energy">Electrical & Clean Energy</option>
          </select>
        </div>

        <div>
          <select
            value={selectedCitizenFilter}
            onChange={(e) => setSelectedCitizenFilter(e.target.value)}
            className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
          >
            <option value="ALL">All Ownership Types</option>
            <option value="100">100% Citizen-Owned Only (CEEP)</option>
          </select>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Supplier / Trading Name</th>
                <th className="py-3 px-4">CIPA UIN & TIN</th>
                <th className="py-3 px-4">Supply Category</th>
                <th className="py-3 px-4">Citizen Equity</th>
                <th className="py-3 px-4">City / District</th>
                <th className="py-3 px-4">Compliance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.map((sup) => (
                <tr key={sup.id} className="hover:bg-slate-50/70">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[#10212E]">{sup.legalName}</div>
                    <span className="text-[11px] text-slate-500">{sup.tradingName}</span>
                  </td>

                  <td className="py-3.5 px-4 font-mono">
                    <div className="text-slate-800 font-bold">{sup.cipaNumber}</div>
                    <span className="text-[11px] text-slate-400">TIN: {sup.tinNumber}</span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-slate-800 block">{sup.ppraCode?.replace('Code ', 'Discipline ') || 'Works & Supplies'}</span>
                    <span className="text-[11px] text-[#1F5F99] font-medium">{sup.ppraGrade?.replace('Grade ', 'Tier ') || 'Standard tier'}</span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="font-bold text-[#2F8F5B] block font-mono">
                      {sup.citizenOwnedPercentage}% Citizen
                    </span>
                    {sup.eddCertified && (
                      <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                        EDD Active
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-slate-600">
                    <span className="font-medium text-slate-800">{sup.city}</span>
                    <span className="block text-[11px] text-slate-400">{sup.district}</span>
                  </td>

                  <td className="py-3.5 px-4">
                    <StatusChip status={sup.complianceStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Call } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { EmptyState } from '../ui/EmptyState';
import { RingMotif } from '../ui/RingMotif';
import {
  Search,
  Filter,
  ArrowUpDown,
  Building2,
  Calendar,
  Clock,
  Lock,
  ChevronRight,
  X,
  FileText,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react';

interface PublicOpportunitiesProps {
  onSelectCall: (callId: string) => void;
}

export const PublicOpportunities: React.FC<PublicOpportunitiesProps> = ({ onSelectCall }) => {
  const { calls, setSelectedCallId } = useApp();

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedOrg, setSelectedOrg] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'deadline' | 'value' | 'title'>('deadline');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Categories & Organizations extracted from data
  const categories = ['All', 'Works & Civil Construction', 'Supplies & Commodities', 'Consulting & Services', 'ICT & Software Solutions'];
  const types = ['All', 'EOI', 'RFP', 'Annual Registration'];
  const organizations = useMemo(() => {
    const set = new Set<string>();
    calls.forEach((c) => set.add(c.organizationName));
    return ['All', ...Array.from(set)];
  }, [calls]);

  // Filtered & Sorted Data
  const filteredCalls = useMemo(() => {
    return calls
      .filter((call) => {
        const matchesSearch =
          searchTerm === '' ||
          call.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          call.callNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          call.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
          call.organizationName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = selectedCategory === 'All' || call.category === selectedCategory;
        const matchesType = selectedType === 'All' || call.type === selectedType;
        const matchesOrg = selectedOrg === 'All' || call.organizationName === selectedOrg;

        return matchesSearch && matchesCategory && matchesType && matchesOrg;
      })
      .sort((a, b) => {
        if (sortBy === 'deadline') {
          return new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime();
        }
        if (sortBy === 'value') {
          const valA = a.estimatedBudgetBWP || 0;
          const valB = b.estimatedBudgetBWP || 0;
          return valB - valA;
        }
        return a.title.localeCompare(b.title);
      });
  }, [calls, searchTerm, selectedCategory, selectedType, selectedOrg, sortBy]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCalls.length / itemsPerPage) || 1;
  const paginatedCalls = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCalls.slice(start, start + itemsPerPage);
  }, [filteredCalls, currentPage]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All');
    setSelectedType('All');
    setSelectedOrg('All');
    setCurrentPage(1);
  };

  const getDaysRemaining = (deadlineStr: string) => {
    const now = new Date('2026-10-05T00:00:00');
    const deadline = new Date(deadlineStr);
    const diffTime = deadline.getTime() - now.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="space-y-8 py-2">
      {/* Editorial Page Header */}
      <div className="relative border-b border-[#D5E0EA] dark:border-[#1E364A] pb-8 overflow-hidden">
        <RingMotif size={360} dotAngle={35} opacity={0.3} position="top-right" />

        <div className="max-w-2xl space-y-3 relative z-10">
          <Badge variant="pula" size="md">
            Public Procurement Directory
          </Badge>

          <h1 className="text-3xl sm:text-4xl font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Tenders & Calls for Expression of Interest
          </h1>

          <p className="text-sm text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
            Browse published procurement opportunities across Botswana town councils, parastatals, and commercial buyers. Apply with your verified Supplier Passport.
          </p>
        </div>
      </div>

      {/* Main Layout: 12-Column Grid (Sidebar + Results) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ======================================================== */}
        {/* DESKTOP FILTER SIDEBAR (4 columns on lg)                 */}
        {/* ======================================================== */}
        <div className="hidden lg:block lg:col-span-4 space-y-6">
          <Card variant="surface" padding="md" className="space-y-5">
            <div className="flex items-center justify-between border-b border-[#D5E0EA] dark:border-[#1E364A] pb-3">
              <span className="text-xs font-heading font-semibold text-[#10212E] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-[#1F5F99] dark:text-[#6FAEE0]" strokeWidth={1.5} />
                <span>Filter Opportunities</span>
              </span>
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-[#6B7A87] hover:text-[#1F5F99] dark:hover:text-[#6FAEE0]"
              >
                Clear all
              </button>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#10212E] dark:text-white block">
                Procurement Category
              </label>
              <div className="space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat);
                      setCurrentPage(1);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-[6px] text-xs transition-colors flex items-center justify-between ${
                      selectedCategory === cat
                        ? 'bg-[#1F5F99] text-white font-semibold'
                        : 'text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#EAF2FA] dark:hover:bg-[#162C3E]'
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    {cat === 'All' ? (
                      <span className="text-[10px] opacity-75 font-mono">{calls.length}</span>
                    ) : (
                      <span className="text-[10px] opacity-75 font-mono">
                        {calls.filter((c) => c.category === cat).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Opportunity Type Filter */}
            <div className="space-y-2 pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A]">
              <label className="text-xs font-semibold text-[#10212E] dark:text-white block">
                Procurement Format
              </label>
              <div className="flex flex-wrap gap-1.5">
                {types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setSelectedType(type);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors ${
                      selectedType === type
                        ? 'bg-[#1F5F99] text-white font-semibold shadow-subtle'
                        : 'bg-white dark:bg-[#132635] text-[#43525F] dark:text-[#B2C3D2] border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Organization Dropdown */}
            <div className="space-y-2 pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A]">
              <Select
                label="Procuring Entity"
                value={selectedOrg}
                onChange={(e) => {
                  setSelectedOrg(e.target.value);
                  setCurrentPage(1);
                }}
              >
                {organizations.map((org) => (
                  <option key={org} value={org}>
                    {org}
                  </option>
                ))}
              </Select>
            </div>
          </Card>
        </div>

        {/* ======================================================== */}
        {/* RESULTS COLUMN (8 columns on lg)                         */}
        {/* ======================================================== */}
        <div className="lg:col-span-8 space-y-4">
          {/* Top Control Bar: Search & Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Search by tender title, reference, or keyword..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Mobile Filter Button */}
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                className="lg:hidden h-10 px-3.5 rounded-[6px] bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] text-xs font-semibold text-[#10212E] dark:text-white flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-4 h-4 text-[#1F5F99]" strokeWidth={1.5} />
                <span>Filters</span>
              </button>

              {/* Sort Selector */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-10 px-3 rounded-[6px] bg-white dark:bg-[#132635] text-xs font-medium text-[#10212E] dark:text-white border border-[#D5E0EA] dark:border-[#1E364A] focus:border-[#1F5F99]"
              >
                <option value="deadline">Sort: Closing Date (Soonest)</option>
                <option value="value">Sort: Estimated Budget (High to Low)</option>
                <option value="title">Sort: Title (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Mobile Collapsible Filter Drawer / Bottom Sheet */}
          {isMobileFilterOpen && (
            <Card variant="surface" padding="md" className="lg:hidden space-y-4 border-hairline">
              <div className="flex items-center justify-between pb-2 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                <span className="text-xs font-heading font-semibold uppercase text-[#10212E] dark:text-white">
                  Filter Active Opportunities
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="text-[#6B7A87]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <Select
                  label="Category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>

                <Select
                  label="Type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  {types.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs text-[#6B7A87]"
                >
                  Reset all
                </button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsMobileFilterOpen(false)}
                >
                  Apply Filters
                </Button>
              </div>
            </Card>
          )}

          {/* Active Filter Chips Bar */}
          {(selectedCategory !== 'All' || selectedType !== 'All' || selectedOrg !== 'All' || searchTerm) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#6B7A87]">Active filters:</span>
              {selectedCategory !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0]">
                  Category: {selectedCategory}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedCategory('All')} />
                </span>
              )}
              {selectedType !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0]">
                  Type: {selectedType}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedType('All')} />
                </span>
              )}
              {selectedOrg !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0]">
                  Org: {selectedOrg}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedOrg('All')} />
                </span>
              )}
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-[#6B7A87] hover:underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* RESULTS: TABLE ON DESKTOP, STACKED CARDS ON MOBILE        */}
          {/* ======================================================== */}
          {filteredCalls.length === 0 ? (
            <EmptyState
              title="No opportunities matched your criteria"
              description="Try broadening your keyword search or resetting category filters to view all tenders in Botswana."
              action={
                <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                  Clear all filters
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-hidden rounded-[10px] border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] shadow-subtle">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7FAFD] dark:bg-[#10212E] border-b border-[#D5E0EA] dark:border-[#1E364A] text-[#6B7A87] uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Tender Details</th>
                      <th className="py-3 px-4 font-semibold">Procuring Entity</th>
                      <th className="py-3 px-4 font-semibold">Type</th>
                      <th className="py-3 px-4 font-semibold">Est. Value</th>
                      <th className="py-3 px-4 font-semibold">Closing Date</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
                    {paginatedCalls.map((call) => {
                      const days = getDaysRemaining(call.closingDate);
                      const isUrgent = days <= 5 && days >= 0;

                      return (
                        <tr
                          key={call.id}
                          onClick={() => onSelectCall(call.id)}
                          className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]/70 cursor-pointer transition-colors group"
                        >
                          <td className="py-3.5 px-4 space-y-1 max-w-[280px]">
                            <span className="font-mono text-[10px] text-[#6B7A87] block">
                              {call.callNumber}
                            </span>
                            <span className="font-heading font-semibold text-xs text-[#10212E] dark:text-white group-hover:text-[#1F5F99] dark:group-hover:text-[#6FAEE0] line-clamp-2 leading-snug">
                              {call.title}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-[#43525F] dark:text-[#B2C3D2]">
                            <span className="block truncate max-w-[160px]">{call.organizationName}</span>
                            <span className="text-[10px] text-[#6B7A87]">{call.category}</span>
                          </td>

                          <td className="py-3.5 px-4">
                            <Badge variant={call.type === 'RFP' ? 'pula' : 'neutral'} size="sm">
                              {call.type}
                            </Badge>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-[#10212E] dark:text-white font-medium">
                            {call.estimatedBudgetBWP
                              ? `BWP ${(call.estimatedBudgetBWP / 1000).toLocaleString()}k`
                              : 'Disclosed in Call'}
                          </td>

                          <td className="py-3.5 px-4 space-y-0.5">
                            <span className="font-mono text-[#10212E] dark:text-white block">
                              {call.closingDate}
                            </span>
                            <span
                              className={`text-[10px] font-medium block ${
                                isUrgent ? 'text-[#C2412D]' : 'text-[#6B7A87]'
                              }`}
                            >
                              {days > 0 ? `${days} days left` : 'Closed'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <span className="text-[#1F5F99] dark:text-[#6FAEE0] font-semibold flex items-center justify-end gap-1 group-hover:translate-x-0.5 transition-transform">
                              <span>Details</span>
                              <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards View */}
              <div className="md:hidden space-y-3">
                {paginatedCalls.map((call) => {
                  const days = getDaysRemaining(call.closingDate);
                  return (
                    <Card
                      key={call.id}
                      variant="interactive"
                      padding="md"
                      onClick={() => onSelectCall(call.id)}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-[#6B7A87]">
                          {call.callNumber}
                        </span>
                        <Badge variant={call.type === 'RFP' ? 'pula' : 'neutral'} size="sm">
                          {call.type}
                        </Badge>
                      </div>

                      <h3 className="font-heading font-semibold text-sm text-[#10212E] dark:text-white leading-snug">
                        {call.title}
                      </h3>

                      <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-[#6B7A87] block">Procuring Entity</span>
                          <span className="text-[#10212E] dark:text-white truncate block">{call.organizationName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#6B7A87] block">Closing Date</span>
                          <span className="font-mono text-[#10212E] dark:text-white">{call.closingDate}</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B7A87]">
                <div>
                  Showing{' '}
                  <span className="font-semibold text-[#10212E] dark:text-white font-mono">
                    {(currentPage - 1) * itemsPerPage + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-[#10212E] dark:text-white font-mono">
                    {Math.min(currentPage * itemsPerPage, filteredCalls.length)}
                  </span>{' '}
                  of{' '}
                  <span className="font-semibold text-[#10212E] dark:text-white font-mono">
                    {filteredCalls.length}
                  </span>{' '}
                  opportunities
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    leftIcon={<ChevronLeft />}
                  >
                    Previous
                  </Button>

                  <span className="px-2 font-mono font-medium text-[#10212E] dark:text-white">
                    {currentPage} / {totalPages}
                  </span>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    rightIcon={<ChevronRightIcon />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

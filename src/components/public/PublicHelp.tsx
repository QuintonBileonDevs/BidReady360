import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Accordion, AccordionItem } from '../ui/Accordion';
import { Button } from '../ui/Button';
import { RingMotif } from '../ui/RingMotif';
import { Search, HelpCircle, Mail, BookOpen, ShieldCheck, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const PublicHelp: React.FC = () => {
  const { setActiveNav } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const faqItems: AccordionItem[] = [
    {
      id: 'faq-1',
      category: 'passport',
      title: 'What is the BidReady360 Supplier Passport?',
      content: (
        <>
          <p>
            The Supplier Passport is a single, reusable digital company profile that stores and verifies your statutory documentation (CIPA company registration, BURS tax clearance, PPRA contractor grading, and citizen equity/EDD records).
          </p>
          <p>
            Instead of resubmitting and recertifying identical documentation for every municipal council, ministry, or corporate tender in Botswana, you grant buying bodies permission to inspect your verified profile in one click.
          </p>
        </>
      ),
    },
    {
      id: 'faq-2',
      category: 'security',
      title: 'How does sealed-bid cryptography protect our price proposals?',
      content: (
        <>
          <p>
            When you submit a commercial price bid or bill of quantities on BidReady360, your proposal is encrypted using asymmetric public-key cryptography. The encrypted payload is locked until the official closing date and time configured by the procuring entity.
          </p>
          <p>
            Neither the buying organization’s procurement staff nor system administrators can view the pricing proposals before the deadline. Unsealing requires authorized digital keys from the designated tender evaluation committee.
          </p>
        </>
      ),
    },
    {
      id: 'faq-3',
      category: 'compliance',
      title: 'How does the platform verify Botswana CIPA and BURS status?',
      content: (
        <>
          <p>
            BidReady360 validates unique identifier formats (CIPA UIN and BURS TIN). Uploaded certificates are timestamped and assigned cryptographic SHA-256 checksums to verify document authenticity and integrity.
          </p>
          <p>
            The platform alerts suppliers 30 days and 7 days prior to tax clearance expiration, ensuring you never miss a tender due to an inadvertent paperwork lapse.
          </p>
        </>
      ),
    },
    {
      id: 'faq-4',
      category: 'passport',
      title: 'Can I revoke access to my documents after a tender concludes?',
      content: (
        <>
          <p>
            Yes. Suppliers have full sovereignty over their data through the Sharing & Consent manager. You can review all buying entities that currently hold access to your company documents and revoke access at any time once an evaluation or contract is concluded.
          </p>
        </>
      ),
    },
    {
      id: 'faq-5',
      category: 'buyers',
      title: 'How do buying organizations configure multi-evaluator panels?',
      content: (
        <>
          <p>
            Procurement officers can set up weighted technical scoring matrices and assign multiple panel evaluators with specific roles (Technical Evaluator, SCM Officer, Board Approver).
          </p>
          <p>
            Panelists must sign an electronic Conflict of Interest Declaration before opening scoring sheets. Scores and comments are recorded with immutable timestamps for statutory audit compliance.
          </p>
        </>
      ),
    },
    {
      id: 'faq-6',
      category: 'compliance',
      title: 'Does BidReady360 support Economic Diversification Drive (EDD) preferences?',
      content: (
        <>
          <p>
            Yes. The platform includes dedicated fields for citizen ownership percentage, youth-owned enterprises, women-owned enterprises, and official EDD registration numbers.
          </p>
          <p>
            Procuring entities can configure statutory preference margins directly in their evaluation formulas in alignment with PPRA regulations.
          </p>
        </>
      ),
    },
    {
      id: 'faq-7',
      category: 'buyers',
      title: 'Can we export complete audit dossiers for PPRA or Auditor General reviews?',
      content: (
        <>
          <p>
            Yes. Every tender lifecycle generates a tamper-evident audit dossier documenting the call publication timestamp, clarification addenda, supplier submission hashes, evaluator scorecards, and formal award decisions.
          </p>
        </>
      ),
    },
  ];

  const filteredItems = faqItems.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      (typeof item.title === 'string' && item.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: 'all', label: 'All Questions' },
    { id: 'passport', label: 'Supplier Passport' },
    { id: 'security', label: 'Sealed Bids & Security' },
    { id: 'compliance', label: 'PPRA & Compliance' },
    { id: 'buyers', label: 'Buying Entities' },
  ];

  return (
    <div className="space-y-10 sm:space-y-12 py-4">
      {/* Header */}
      <div className="relative border-b border-[#D5E0EA] dark:border-[#1E364A] pb-10 overflow-hidden">
        <RingMotif size={360} dotAngle={60} opacity={0.3} position="top-right" />

        <div className="max-w-2xl space-y-4 relative z-10">
          <Badge variant="pula" size="md">
            Help & Documentation
          </Badge>

          <h1 className="text-3xl sm:text-4xl font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Frequently Asked Questions
          </h1>

          <p className="text-base text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
            Find clear answers about the Supplier Passport, sealed-bid cryptographic protocols, buyer workspaces, and Botswana public procurement compliance.
          </p>

          <div className="pt-2 max-w-lg">
            <Input
              type="text"
              placeholder="Search help topics by keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? 'bg-[#1F5F99] text-white shadow-subtle'
                : 'bg-[#F7FAFD] dark:bg-[#132635] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#EAF2FA] dark:hover:bg-[#162C3E] border border-[#D5E0EA] dark:border-[#1E364A]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* FAQ Accordion List */}
      <div className="max-w-3xl">
        {filteredItems.length > 0 ? (
          <Accordion items={filteredItems} allowMultiple />
        ) : (
          <div className="p-8 text-center text-sm text-[#6B7A87] border border-dashed border-[#D5E0EA] dark:border-[#1E364A] rounded-[10px]">
            No answers matched your search query "{searchQuery}". Try a different keyword.
          </div>
        )}
      </div>

      {/* Support Card */}
      <Card variant="surface" padding="md" className="max-w-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-base font-heading font-semibold text-[#10212E] dark:text-white">
            Need statutory guidance on PPRA regulations?
          </h4>
          <p className="text-xs text-[#6B7A87]">
            Review official contractor grading thresholds, commodity subcodes, and dispute resolution procedures.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setActiveNav('guidelines')}
          rightIcon={<ArrowRight />}
        >
          View PPRA Guidance
        </Button>
      </Card>
    </div>
  );
};

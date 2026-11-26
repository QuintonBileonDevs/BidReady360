import React from 'react';
import { Logo } from './Logo';
import { Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Footer: React.FC = () => {
  const { setActiveNav } = useApp();

  const handleNav = (navId: string) => {
    setActiveNav(navId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-white dark:bg-[#10212E] text-[#43525F] dark:text-[#D3E3F2] border-t border-[#D5E0EA] dark:border-[#244157] transition-colors mt-auto">
      <div className="container-1160 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-[#D5E0EA] dark:border-[#244157]">
          {/* Brand & Purpose Column */}
          <div className="md:col-span-5 space-y-3">
            <Logo size="md" />
            <p className="text-[15px] text-[#43525F] dark:text-[#D3E3F2] leading-relaxed max-w-sm">
              A 360° picture of procurement. The unified platform for discovering opportunities, managing document vaults, and submitting sealed price bids.
            </p>
            <p className="text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">
              Independent platform. Registration with any regulator is separate.
            </p>
          </div>

          {/* Navigation Link Columns */}
          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-6 text-[14px]">
            {/* Column 1: Opportunities */}
            <div className="space-y-3">
              <h4 className="font-semibold text-[#10212E] dark:text-white text-[15px]">
                Opportunities
              </h4>
              <ul className="space-y-2 text-[#43525F] dark:text-[#D3E3F2]">
                <li>
                  <button
                    type="button"
                    onClick={() => handleNav('opportunities')}
                    className="hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] transition-colors text-left cursor-pointer"
                  >
                    Open tenders
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNav('opportunities')}
                    className="hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] transition-colors text-left cursor-pointer"
                  >
                    Expressions of interest
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNav('opportunities')}
                    className="hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] transition-colors text-left cursor-pointer"
                  >
                    Registration drives
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 2: Solutions */}
            <div className="space-y-3">
              <h4 className="font-semibold text-[#10212E] dark:text-white text-[15px]">
                Portals
              </h4>
              <ul className="space-y-2 text-[#43525F] dark:text-[#D3E3F2]">
                <li>
                  <button
                    type="button"
                    onClick={() => handleNav('suppliers')}
                    className="hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] transition-colors text-left cursor-pointer"
                  >
                    For suppliers
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNav('buyers')}
                    className="hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] transition-colors text-left cursor-pointer"
                  >
                    For buyers
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNav('help')}
                    className="hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] transition-colors text-left cursor-pointer"
                  >
                    Help &amp; FAQs
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Trust & Security */}
            <div className="space-y-3">
              <h4 className="font-semibold text-[#10212E] dark:text-white text-[15px]">
                Security
              </h4>
              <div className="space-y-2 text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-[#1F5F99] dark:text-[#6FAEE0] shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span>Price proposals are protected with asymmetric encryption and unsealed only at the official opening.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">
          <div>
            © {new Date().getFullYear()} BidReady360. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleNav('help')}
              className="hover:text-[#10212E] dark:hover:text-white transition-colors cursor-pointer"
            >
              Privacy notice
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => handleNav('help')}
              className="hover:text-[#10212E] dark:hover:text-white transition-colors cursor-pointer"
            >
              Terms of use
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

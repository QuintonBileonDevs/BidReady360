import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface AccordionItem {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
  category?: string;
}

export interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultOpenId?: string;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  items,
  allowMultiple = false,
  defaultOpenId,
  className = '',
}) => {
  const [openIds, setOpenIds] = useState<string[]>(defaultOpenId ? [defaultOpenId] : []);

  const toggle = (id: string) => {
    if (allowMultiple) {
      setOpenIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
    } else {
      setOpenIds((prev) => (prev.includes(id) ? [] : [id]));
    }
  };

  return (
    <div className={`divide-y divide-[#D5E0EA] dark:divide-[#1E364A] border-y border-[#D5E0EA] dark:border-[#1E364A] ${className}`}>
      {items.map((item) => {
        const isOpen = openIds.includes(item.id);
        return (
          <div key={item.id} className="py-4">
            <button
              type="button"
              onClick={() => toggle(item.id)}
              className="w-full flex items-center justify-between gap-4 text-left group focus:outline-none select-none"
              aria-expanded={isOpen}
            >
              <span className="text-base font-heading font-semibold text-[#10212E] dark:text-white group-hover:text-[#1F5F99] dark:group-hover:text-[#6FAEE0] transition-colors">
                {item.title}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-[#6B7A87] shrink-0 transition-transform duration-200 ${
                  isOpen ? 'rotate-180 text-[#1F5F99] dark:text-[#6FAEE0]' : ''
                }`}
                strokeWidth={1.5}
              />
            </button>

            {isOpen && (
              <div className="pt-3 pr-6 text-sm text-[#43525F] dark:text-[#B2C3D2] leading-relaxed space-y-2">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

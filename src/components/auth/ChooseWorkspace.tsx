import React from 'react';
import { AuthLayout } from './AuthLayout';
import { useApp } from '../../context/AppContext';
import { Badge } from '../ui/Badge';
import { ChevronRight } from 'lucide-react';

interface ChooseWorkspaceProps {
  onNavigate: (route: string) => void;
}

export const ChooseWorkspace: React.FC<ChooseWorkspaceProps> = ({ onNavigate }) => {
  const { setRole, setActiveNav } = useApp();

  const workspaces = [
    {
      id: 'ws-1',
      name: 'Kopano Building Supplies (Pty) Ltd',
      type: 'Supplier · Civil infrastructure and building works',
      role: 'Director / Account owner',
      lastUsed: true,
      roleTarget: 'supplier',
      navTarget: 'dashboard',
    },
    {
      id: 'ws-2',
      name: 'Kalahari Plant Hire Joint Venture',
      type: 'Supplier · Plant hire and earthworks',
      role: 'Authorized bidder',
      lastUsed: false,
      roleTarget: 'supplier',
      navTarget: 'dashboard',
    },
    {
      id: 'ws-3',
      name: 'Gaborone Regional Council',
      type: 'Procuring organization · SCM unit',
      role: 'Technical evaluation panelist',
      lastUsed: false,
      roleTarget: 'buyer',
      navTarget: 'evaluation',
    },
  ];

  const handleSelect = (ws: typeof workspaces[0]) => {
    setRole(ws.roleTarget as any);
    setActiveNav(ws.navTarget);
  };

  return (
    <AuthLayout
      leftMessage="Select your workspace"
      tagline="Your account has access to multiple procurement workspaces in Botswana."
    >
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Choose workspace
          </h2>
          <p className="text-[14px] text-[#6B7A87]">
            Select the organization or supplier company you wish to work in today.
          </p>
        </div>

        <div className="space-y-3">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              onClick={() => handleSelect(ws)}
              className="p-4 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors cursor-pointer space-y-2 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-heading font-semibold text-[#10212E] dark:text-white group-hover:text-[#1F5F99] dark:group-hover:text-[#6FAEE0] transition-colors">
                      {ws.name}
                    </h3>
                    {ws.lastUsed && (
                      <Badge variant="verified" size="sm">
                        Last used
                      </Badge>
                    )}
                  </div>
                  <p className="text-[13px] text-[#6B7A87]">{ws.type}</p>
                </div>

                <ChevronRight className="w-4 h-4 text-[#6B7A87] group-hover:translate-x-1 transition-transform shrink-0 mt-1" />
              </div>

              <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
                <span>Role: {ws.role}</span>
                <span className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0]">
                  Open workspace →
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between text-[14px] text-[#6B7A87]">
          <span>Have an invitation to another entity?</span>
          <button
            type="button"
            onClick={() => onNavigate('accept-invite')}
            className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
          >
            Accept invite
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};

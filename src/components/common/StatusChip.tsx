import React from 'react';

export type StatusType =
  | 'Verified'
  | 'Valid'
  | 'Passed'
  | 'Pending'
  | 'Pending verification'
  | 'Expiring soon'
  | 'Expired'
  | 'Missing'
  | 'Submitted'
  | 'Under review'
  | 'More information requested'
  | 'Approved'
  | 'Rejected'
  | 'Withdrawn'
  | 'Cannot verify'
  | 'Not started'
  | 'Claimed'
  | 'Complete'
  | 'Incomplete'
  | 'Needs attention'
  | 'Open'
  | 'Closed'
  | 'Under evaluation'
  | 'Awarded'
  | 'Draft'
  | 'Pending approval'
  | 'Approved & Published'
  | 'Active'
  | 'Revoked'
  | 'Fully compliant'
  | 'Action required'
  | 'Non-compliant';

interface StatusChipProps {
  status: StatusType | string;
  size?: 'sm' | 'md';
  className?: string;
  customLabel?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  size = 'md',
  className = '',
  customLabel,
}) => {
  const sizeClasses = size === 'sm' ? 'text-[14px] py-0.5 px-2.5' : 'text-[14px] py-1 px-3';

  const getStyle = () => {
    switch (status) {
      case 'Verified':
      case 'Valid':
      case 'Passed':
      case 'Approved':
      case 'Approved & Published':
      case 'Fully compliant':
      case 'Complete':
      case 'Active':
      case 'Open':
        return {
          bg: 'bg-[#DDF1E5] text-[#1E6B41]',
          label: customLabel || (status === 'Open' ? 'Open for submissions' : status),
        };
      case 'Expired':
      case 'Rejected':
      case 'Revoked':
      case 'Non-compliant':
        return {
          bg: 'bg-[#F7DBD5] text-[#8E2A1B]',
          label: customLabel || status,
        };
      case 'Expiring soon':
      case 'Missing':
      case 'More information requested':
      case 'Action required':
      case 'Pending approval':
      case 'Needs attention':
      case 'Incomplete':
      case 'Cannot verify':
      case 'Warning':
        return {
          bg: 'bg-[#FCEBCB] text-[#7A4B00]',
          label: customLabel || status,
        };
      case 'Submitted':
      case 'Under review':
      case 'Under evaluation':
      case 'Pending':
      case 'Pending verification':
      case 'Claimed':
        return {
          bg: 'bg-[#EAF2FA] text-[#1F5F99]',
          label: customLabel || status,
        };
      case 'Not started':
      case 'Withdrawn':
        return {
          bg: 'bg-[#F0F4F8] text-[#43525F]',
          label: customLabel || status,
        };
      case 'Closed':
      default:
        return {
          bg: 'bg-[#EAF2FA] text-[#10212E]',
          label: customLabel || status,
        };
    }
  };

  const current = getStyle();

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium whitespace-nowrap tracking-tight ${current.bg} ${sizeClasses} ${className}`}
    >
      {current.label}
    </span>
  );
};

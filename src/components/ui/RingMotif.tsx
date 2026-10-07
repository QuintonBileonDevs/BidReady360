import React from 'react';

interface RingMotifProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  dotColor?: string;
  dotAngle?: number; // degrees, 0 is right, 90 is bottom
  dotSize?: number;
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left' | 'center' | 'custom';
  opacity?: number;
}

/**
 * Signature Brand Motif:
 * Large thin ring outline partially cropped off the edge of sections,
 * with a single Kalahari Amber (#E8A33D) dot as the focal point.
 */
export const RingMotif: React.FC<RingMotifProps> = ({
  className = '',
  size = 400,
  strokeWidth = 1,
  color = '#D5E0EA',
  dotColor = '#E8A33D',
  dotAngle = 45,
  dotSize = 7,
  position = 'custom',
  opacity = 1,
}) => {
  const radius = (size - 20) / 2;
  const center = size / 2;

  // Calculate amber dot coordinates based on dotAngle
  const radians = (dotAngle * Math.PI) / 180;
  const dotX = center + radius * Math.cos(radians);
  const dotY = center + radius * Math.sin(radians);

  const positionClasses = {
    'top-right': 'absolute -top-24 -right-24 pointer-events-none',
    'bottom-right': 'absolute -bottom-24 -right-24 pointer-events-none',
    'top-left': 'absolute -top-24 -left-24 pointer-events-none',
    'bottom-left': 'absolute -bottom-24 -left-24 pointer-events-none',
    'center': 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none',
    'custom': '',
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${positionClasses[position]} ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      {/* Outer subtle guide ring */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray="none"
      />
      
      {/* Single Amber Focal Dot */}
      <circle
        cx={dotX}
        cy={dotY}
        r={dotSize}
        fill={dotColor}
      />
    </svg>
  );
};

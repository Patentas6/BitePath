import React from 'react';

interface AndroidBrandIconProps extends React.SVGProps<SVGSVGElement> {}

export const AndroidBrandIcon: React.FC<AndroidBrandIconProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 10l0 6" />
    <path d="M20 10l0 6" />
    <path d="M7 9h10v8a1 1 0 0 1 -1 1h-8a1 1 0 0 1 -1 -1v-8a5 5 0 0 1 10 0" />
    <path d="M8 3l1 2" />
    <path d="M16 3l-1 2" />
    <path d="M9 18l0 3" />
    <path d="M15 18l0 3" />
  </svg>
);
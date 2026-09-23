"use client";

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, className, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    ...props,
  };
}

export function IconHouse(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-7h6v7" />
    </svg>
  );
}

export function IconLayout(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

export function IconBuilding(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 21V7l8-4 8 4v14" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
    </svg>
  );
}

export function IconUsers(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 19a5 5 0 0 1 5.5-4.8" />
    </svg>
  );
}

export function IconCalendar(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function IconKey(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="8" cy="14" r="4" />
      <path d="M11.5 11.5 20 3M16 4l3 3" />
    </svg>
  );
}

export function IconTag(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M20 12 12 4H5v7l8 8z" />
      <circle cx="8.5" cy="8.5" r="1.2" />
    </svg>
  );
}

export function IconWallet(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 17.5z" />
      <path d="M3 10h18" />
      <circle cx="17" cy="15" r="1.2" />
    </svg>
  );
}

export function IconSettings(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconBell(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconChevronDown(p: IconProps) {
  return (
    <svg {...base({ ...p, size: p.size ?? 14 })}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconChevronLeft(p: IconProps) {
  return (
    <svg {...base({ ...p, size: p.size ?? 16 })}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function IconChevronRight(p: IconProps) {
  return (
    <svg {...base({ ...p, size: p.size ?? 16 })}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function IconLogIn(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5" />
      <path d="M15 12H3M12 8l4 4-4 4" />
    </svg>
  );
}

export function IconLogOut(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
      <path d="M9 12h12M16 8l4 4-4 4" />
    </svg>
  );
}

export function IconEye(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function IconHandshake(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M8 13 4.5 9.5a2 2 0 0 1 0-2.8L7 4.2a2 2 0 0 1 2.8 0L12 6.4" />
      <path d="m16 11 3.5 3.5a2 2 0 0 1 0 2.8L17 20a2 2 0 0 1-2.8 0l-2.2-2.2" />
      <path d="M9 15.5 14.5 10" />
      <path d="m11 17 1.5 1.5a1.5 1.5 0 0 0 2.1 0L18 15" />
    </svg>
  );
}

export function IconDownload(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 4v11M7 10l5 5 5-5M5 19h14" />
    </svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconTrendingUp(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 17 10 10l4 4 7-7" />
      <path d="M14 7h7v7" />
    </svg>
  );
}

export function IconFolder(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export function IconPiggy(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M19 11a6.5 6.5 0 0 0-12.7-2H4v3h1.2A6.5 6.5 0 0 0 12 18.5h1v2h3v-2.1A6.5 6.5 0 0 0 19 11Z" />
      <circle cx="16" cy="10" r="0.8" fill="currentColor" stroke="none" />
      <path d="M8 14h.01" />
    </svg>
  );
}

export function IconChart(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 16v-5M12 16V8M16 16v-3" />
    </svg>
  );
}

export function IconMenu(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconX(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconArrowRight(p: IconProps) {
  return (
    <svg {...base({ ...p, size: p.size ?? 14 })}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

import type { CategoryKey } from "@/domain/categories";

/** Category and chrome icons, drawn for WeWalk. Decorative: label the control, not the icon. */
const PATHS = {
  coffee: (
    <g strokeWidth="2.6">
      <path d="M6 12h16v8a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z" />
      <path d="M22 14h2.5a3.5 3.5 0 0 1 0 7H22" />
      <path d="M11 4c-1 1.5 1 2.5 0 4M16 3.5c-1 1.5 1 2.5 0 4.5" />
    </g>
  ),
  wifi: (
    <g strokeWidth="2.6">
      <path d="M4 12.5a17 17 0 0 1 24 0" />
      <path d="M8.5 17a10.5 10.5 0 0 1 15 0" />
      <path d="M12.8 21.4a4.6 4.6 0 0 1 6.4 0" />
      <circle cx="16" cy="25.5" r="1.6" fill="currentColor" />
    </g>
  ),
  booths: (
    <g strokeWidth="2.6">
      <rect x="7" y="3.5" width="18" height="25" rx="3" />
      <path d="M7 9h18" />
      <path d="M13 15.5c0 4 2 6 6 6l1.5-2-2.4-1.6-1.1 1.2c-1-.5-1.6-1.1-2-2l1.2-1.1L14.6 13z" />
    </g>
  ),
  light: (
    <g strokeWidth="2.6">
      <circle cx="16" cy="16" r="5.5" />
      <path d="M16 3v3.5M16 25.5V29M3 16h3.5M25.5 16H29M6.8 6.8l2.5 2.5M22.7 22.7l2.5 2.5M6.8 25.2l2.5-2.5M22.7 9.3l2.5-2.5" />
    </g>
  ),
  noise: (
    <g strokeWidth="2.6">
      <path d="M5 12.5h5l6-5v17l-6-5H5z" />
      <path d="M21 12.5l6 7M27 12.5l-6 7" />
    </g>
  ),
  seating: (
    <g strokeWidth="2.6">
      <path d="M9 4.5h12a1 1 0 0 1 1 1v11H8v-11a1 1 0 0 1 1-1z" />
      <path d="M5.5 16.5h21v4h-21z" />
      <path d="M8 20.5v7M24 20.5v7" />
    </g>
  ),
  bathrooms: (
    <g strokeWidth="2.6">
      <path d="M6 4h7v9H6z" />
      <path d="M4.5 13h17a6 6 0 0 1-6 7h-5a6 6 0 0 1-6-7z" />
      <path d="M10 20l-1.5 8h10L17 20" />
    </g>
  ),
  lunch: (
    <g strokeWidth="2.6">
      <path d="M4 15h24" />
      <path d="M5 15a11 7 0 0 1 22 0" />
      <path d="M4.5 19.5c2 1.4 3.5-1.4 5.5 0s3.5-1.4 5.5 0 3.5-1.4 5.5 0 3.5-1.4 6 0" />
      <path d="M5.5 24h21a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3z" />
    </g>
  ),
  vibe: (
    <g strokeWidth="2.6">
      <path d="M16 3l3.2 8.6L28 13l-6.8 5.8L23.4 28 16 23.2 8.6 28l2.2-9.2L4 13l8.8-1.4z" />
    </g>
  ),
  explore: (
    <g strokeWidth="2.6">
      <path d="M16 28s-8.7-7.5-8.7-14.7a8.7 8.7 0 0 1 17.4 0C24.7 20.5 16 28 16 28z" />
      <circle cx="16" cy="13.3" r="3.2" />
    </g>
  ),
  ranks: (
    <g strokeWidth="2.6">
      <path d="M10.7 28h10.6M16 22.7V28M9.3 5.3h13.4V12a6.7 6.7 0 0 1-13.4 0z" />
      <path d="M9.3 8H6a3.3 3.3 0 0 0 3.5 4.7M22.7 8H26a3.3 3.3 0 0 1-3.5 4.7" />
    </g>
  ),
  passport: (
    <g strokeWidth="2.6">
      <rect x="6" y="4" width="20" height="24" rx="4" />
      <circle cx="16" cy="14" r="4.3" />
      <path d="M11.3 22.7h9.4" />
    </g>
  ),
  crew: (
    <g strokeWidth="2.6">
      <circle cx="12" cy="10.7" r="4.5" />
      <path d="M3.7 26.7a8.3 8.3 0 0 1 16.6 0" />
      <path d="M21.3 6.4a4.5 4.5 0 0 1 0 8.5M24.7 18.9a8.3 8.3 0 0 1 3.6 7.8" />
    </g>
  ),
  plus: (
    <g strokeWidth="3.4">
      <path d="M16 6.7v18.6M6.7 16h18.6" />
    </g>
  ),
  back: (
    <g strokeWidth="3.2">
      <path d="M20 6.7 10.7 16l9.3 9.3" />
    </g>
  ),
  close: (
    <g strokeWidth="3.2">
      <path d="M8 8l16 16M24 8 8 24" />
    </g>
  ),
  search: (
    <g strokeWidth="3">
      <circle cx="14.7" cy="14.7" r="8.7" />
      <path d="M21.3 21.3 27.3 27.3" />
    </g>
  ),
  moon: (
    <g strokeWidth="2.8">
      <path d="M26.7 19.3A10.7 10.7 0 1 1 12.7 5.3a8.7 8.7 0 0 0 14 14z" />
    </g>
  ),
} as const;

export type IconName = CategoryKey | keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name as keyof typeof PATHS]}
    </svg>
  );
}

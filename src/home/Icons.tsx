import type { SVGProps } from "react";

export type IconName =
  | "arrowRight"
  | "book"
  | "chevronLeft"
  | "chevronRight"
  | "close"
  | "compass"
  | "contour"
  | "grid"
  | "layers"
  | "menu"
  | "moon"
  | "road"
  | "search"
  | "sun";

const iconPaths: Record<IconName, React.ReactNode> = {
  arrowRight: (
    <>
      <path d="M4.5 12h15" />
      <path d="m13.5 6 6 6-6 6" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.3C10 4.8 7.6 4.1 4.2 4.1v13.7c3.4 0 5.8.7 7.8 2.2 2-1.5 4.4-2.2 7.8-2.2V4.1c-3.4 0-5.8.7-7.8 2.2Z" />
      <path d="M12 6.3v13.7" />
    </>
  ),
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5 5.5-2.1Z" />
    </>
  ),
  contour: (
    <>
      <path d="M3 8.2c3-4 6 2 9-2s6 1 9-3" />
      <path d="M3 13c3-4 6 2 9-2s6 1 9-3" />
      <path d="M3 17.8c3-4 6 2 9-2s6 1 9-3" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.4-9 5 9 5 9-5-9-5Z" />
      <path d="m3 13.7 9 5 9-5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  moon: <path d="M20.5 14.7A8.6 8.6 0 0 1 9.3 3.5a8.7 8.7 0 1 0 11.2 11.2Z" />,
  road: (
    <>
      <path d="M7.5 21 9 3M16.5 21 15 3" />
      <path d="M12 5.2v3M12 11.2v3M12 17.2v3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="m15.4 15.4 5.1 5.1" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
    </>
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.65"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {iconPaths[name]}
    </svg>
  );
}

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 48 48"
    >
      <rect
        fill="currentColor"
        height="48"
        rx="13"
        width="48"
      />
      <g
        stroke="var(--qh-logo-line, #f7f9f6)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      >
        <path d="M10 16.5c4-4.8 7.1 1.8 10.7-2.2 3.1-3.5 6.9.3 11.2-2.5" />
        <path d="M10 24c4-4.8 7.1 1.8 10.7-2.2 3.1-3.5 6.9.3 11.2-2.5" />
        <path d="M10 31.5c4-4.8 7.1 1.8 10.7-2.2 3.1-3.5 6.9.3 11.2-2.5" />
      </g>
      <circle cx="33.5" cy="34" fill="var(--qh-logo-accent, #d5a06f)" r="2.5" />
    </svg>
  );
}

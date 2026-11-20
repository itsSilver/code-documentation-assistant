import type { SVGProps } from "react";

function Icon({ children, size = 16, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement> & { size?: number };

export const ChevronDown = (p: P) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
export const ChevronRight = (p: P) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);
export const Check = (p: P) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
export const Plus = (p: P) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const X = (p: P) => (
  <Icon {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);
export const ArrowUp = (p: P) => (
  <Icon {...p}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Icon>
);
export const ArrowRight = (p: P) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const Square = (p: P) => (
  <Icon {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </Icon>
);
export const FileIcon = (p: P) => (
  <Icon {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Icon>
);
export const Folder = (p: P) => (
  <Icon {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Icon>
);
export const Repo = (p: P) => (
  <Icon {...p}>
    <path d="M5 19.5V5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2 2 2 0 0 0 2 2h12" />
    <path d="M9 7h6" />
  </Icon>
);
export const Upload = (p: P) => (
  <Icon {...p}>
    <path d="M12 15V4M7 9l5-5 5 5" />
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </Icon>
);
export const Archive = (p: P) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="5" rx="1.5" />
    <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
  </Icon>
);
export const Link = (p: P) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </Icon>
);
export const Alert = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.5v.01" />
  </Icon>
);
export const Search = (p: P) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
);
export const Sun = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);
export const Moon = (p: P) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
  </Icon>
);
export const Cpu = (p: P) => (
  <Icon {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <path d="M10 2v4M14 2v4M10 18v4M14 18v4M2 10h4M2 14h4M18 10h4M18 14h4" />
  </Icon>
);
export const Retry = (p: P) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
    <path d="M3 21v-5h5" />
  </Icon>
);

export const Logo = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="8" fill="var(--accent)" />
    <path
      d="M12.5 11 8 16l4.5 5M19.5 11 24 16l-4.5 5"
      fill="none"
      stroke="var(--accent-text)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** A small progress ring; an indeterminate spinner when `fraction` is null. */
export function Ring({ fraction, size = 14 }: { fraction: number | null; size?: number }) {
  if (fraction === null)
    return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
  const r = 5;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      className="ring"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="7" cy="7" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="2.2" />
      <circle
        cx="7"
        cy="7"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray={`${c * fraction} ${c}`}
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** Square ends and corners, for the toolbar's icons. */
const sharpIconProps = {
  ...iconProps,
  strokeLinecap: "square",
  strokeLinejoin: "miter",
} as const;

export function EyeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeClosedIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 10c2.2 3 5.3 5 9 5s6.8-2 9-5" />
      <path d="m5.5 13.5-2 2.5M9.5 15l-1 3M14.5 15l1 3M18.5 13.5l2 2.5" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...sharpIconProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MinusIcon() {
  return (
    <svg {...sharpIconProps}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function FlipHorizontalIcon() {
  return (
    <svg {...sharpIconProps}>
      <path d="M12 3v2M12 9v2M12 13v2M12 19v2" />
      <path d="M9 6 4 18h5V6ZM15 6l5 12h-5V6Z" />
    </svg>
  );
}

export function FlipVerticalIcon() {
  return (
    <svg {...sharpIconProps}>
      <path d="M3 12h2M9 12h2M13 12h2M19 12h2" />
      <path d="M6 9 18 4v5H6ZM6 15l12 5v-5H6Z" />
    </svg>
  );
}

export function BringForwardIcon() {
  return (
    <svg {...sharpIconProps}>
      <path d="M9 9H4v11h11v-5" />
      <path d="M9 4h11v11H9z" fill="currentColor" />
    </svg>
  );
}

export function SendBackIcon() {
  return (
    <svg {...sharpIconProps}>
      <path d="M9 4h11v11h-5V9H9z" fill="currentColor" />
      <path d="M4 9h11v11H4z" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...sharpIconProps}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

export function UndoIcon() {
  return (
    <svg {...sharpIconProps}>
      <path d="M8 5 4 9l4 4" />
      <path d="M4 9h11a5 5 0 0 1 0 10H9" />
    </svg>
  );
}

export function RedoIcon() {
  return (
    <svg {...sharpIconProps}>
      <path d="m16 5 4 4-4 4" />
      <path d="M20 9H9a5 5 0 0 0 0 10h6" />
    </svg>
  );
}

export function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg {...sharpIconProps} width={12} height={12} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function EraserIcon() {
  return (
    <svg {...sharpIconProps}>
      <path d="M8.5 19.5 3.5 14.5 13 5l7 7-7.5 7.5Z" />
      <path d="m8.5 9.5 7 7" />
      <path d="M8.5 19.5H21" />
    </svg>
  );
}

export function SidebarIcon() {
  return (
    <svg {...sharpIconProps}>
      <path d="M3 5h18v14H3zM9 5v14" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  );
}

export function XIcon() {
  return (
    <svg {...sharpIconProps}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

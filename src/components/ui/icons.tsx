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

export function EyeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 5v14M5 12h14" />
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

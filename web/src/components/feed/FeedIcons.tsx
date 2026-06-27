/** Iconografía mínima del feed — trazo propio, no emojis de X. */

export function IconResuena({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        d="M4 12c2-4 4-6 8-6s6 2 8 6c-2 4-4 6-8 6s-6-2-8-6z"
      />
      <circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconResponder({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        d="M5 6h14v9H9l-4 3V6z"
      />
    </svg>
  );
}

export function IconCompartir({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4v10m0 0l-3.5-3.5M12 14l3.5-3.5M6 18h12"
      />
    </svg>
  );
}

export function IconVoto({ up, className = "" }: { up: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d={
          up
            ? "M12 5l7 9H5l7-9z"
            : "M12 19l-7-9h14l-7 9z"
        }
      />
    </svg>
  );
}

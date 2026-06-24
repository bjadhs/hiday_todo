/**
 * Hiday Todo mark — a brutalist purple tile with a hard offset shadow and a
 * bold checkmark. Matches the "Bruddle" design language (hard borders + shadow).
 */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hiday-logo-fill" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
      {/* hard offset shadow */}
      <rect x="6" y="6" width="23" height="23" rx="7" fill="#1A1A1A" />
      {/* tile */}
      <rect x="3" y="3" width="23" height="23" rx="7" fill="url(#hiday-logo-fill)" stroke="#1A1A1A" strokeWidth="2" />
      {/* checkmark */}
      <path
        d="M9 15l4 4 7-8"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function RoomFitLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`} aria-hidden="true">
      <svg viewBox="0 0 36 36" className="w-full h-full" role="presentation">
        <defs>
          <linearGradient id="rf-teal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="33" height="33" rx="10.5" fill="url(#rf-teal)" />
        <rect x="1.5" y="1.5" width="33" height="33" rx="10.5" fill="none" stroke="#0b4f4a" strokeOpacity="0.35" strokeWidth="1.5" />
        {/* Stylised room: two beds + doorway — geometric, minimal */}
        <rect x="8" y="9.5" width="12" height="6.5" rx="2" fill="#ffffff" opacity="0.96" />
        <rect x="9.6" y="11" width="4.4" height="3.4" rx="1.2" fill="#0f766e" opacity="0.85" />
        <rect x="8" y="19.5" width="12" height="6.5" rx="2" fill="#ffffff" opacity="0.72" />
        <rect x="9.6" y="21" width="4.4" height="3.4" rx="1.2" fill="#ffffff" opacity="0.9" />
        {/* warm doorway accent */}
        <rect x="23.5" y="9.5" width="4.8" height="16.5" rx="2.4" fill="#fdba74" />
        <circle cx="26.4" cy="17.5" r="1.1" fill="#9a3412" />
      </svg>
    </span>
  );
}

// Static isometric render for prefers-reduced-motion, narrow/mobile viewports,
// and low-core-count devices - same room composition as HeroScene3D (two beds,
// desks, wardrobe, window, plant), recolored to match its Phase 2 light/teal/
// coral palette so switching between the two paths is never jarring, and so
// this never becomes the "leftover dark-themed static image" this revision
// was specifically checked against. A plain <svg>, not a screenshot - crisp
// at any size, zero extra network request.
export default function HeroSceneFallback() {
  return (
    <svg viewBox="0 0 520 420" className="w-full h-full" role="img" aria-label="Isometric illustration of a shared hostel room with two beds, desks, a wardrobe, and a window">
      <defs>
        <linearGradient id="floorGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e6ddcb" />
          <stop offset="100%" stopColor="#ded5c3" />
        </linearGradient>
        <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3ede0" />
          <stop offset="100%" stopColor="#eee7d9" />
        </linearGradient>
        <radialGradient id="windowGlow" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#fb923c" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* floor */}
      <polygon points="60,300 260,390 460,300 260,210" fill="url(#floorGrad)" />
      {/* back walls */}
      <polygon points="60,300 60,140 260,50 260,210" fill="url(#wallGrad)" />
      <polygon points="260,210 260,50 460,140 460,300" fill="#e6ddcb" />

      {/* window with warm glow */}
      <circle cx="360" cy="120" r="55" fill="url(#windowGlow)" />
      <rect x="325" y="90" width="70" height="70" rx="4" fill="#b45309" stroke="#fdba74" strokeWidth="2" />
      <line x1="360" y1="90" x2="360" y2="160" stroke="#fdba74" strokeWidth="2" />
      <line x1="325" y1="125" x2="395" y2="125" stroke="#fdba74" strokeWidth="2" />

      {/* bed 1 - teal */}
      <g transform="translate(90,230)">
        <polygon points="0,40 70,5 140,40 70,75" fill="#0d9488" />
        <polygon points="0,40 0,55 70,90 70,75" fill="#115e59" />
        <polygon points="140,40 140,55 70,90 70,75" fill="#134e4a" />
        <polygon points="10,25 35,13 50,20 25,32" fill="#fff7ed" />
      </g>
      {/* bed 2 - coral */}
      <g transform="translate(230,290)">
        <polygon points="0,40 70,5 140,40 70,75" fill="#fb923c" />
        <polygon points="0,40 0,55 70,90 70,75" fill="#ea580c" />
        <polygon points="140,40 140,55 70,90 70,75" fill="#c2410c" />
        <polygon points="10,25 35,13 50,20 25,32" fill="#fff7ed" />
      </g>

      {/* desks */}
      <g transform="translate(70,150)">
        <polygon points="0,20 45,0 90,20 45,40" fill="#d97706" />
        <polygon points="0,20 0,30 45,50 45,40" fill="#b45309" />
        <polygon points="90,20 90,30 45,50 45,40" fill="#92400e" />
      </g>

      {/* wardrobe */}
      <g transform="translate(370,190)">
        <polygon points="0,30 45,10 45,110 0,130" fill="#115e59" />
        <polygon points="45,10 80,25 80,125 45,110" fill="#134e4a" />
        <line x1="45" y1="14" x2="45" y2="114" stroke="#0f766e" strokeWidth="1.5" />
      </g>

      {/* plant */}
      <g transform="translate(140,220)">
        <ellipse cx="0" cy="18" rx="14" ry="6" fill="#78716c" opacity="0.4" />
        <circle cx="-6" cy="-4" r="10" fill="#34d399" opacity="0.9" />
        <circle cx="6" cy="-10" r="12" fill="#10b981" opacity="0.9" />
        <circle cx="2" cy="2" r="9" fill="#34d399" opacity="0.85" />
      </g>
    </svg>
  );
}

// Original, simple character - not a literal "panda" (there's no such asset
// anywhere in this repo's real assets), designed to sit comfortably beside
// docs/assets/banner.svg's illustration style. Used sparingly: one
// appearance near the CTA, a small one in the footer. The point is warmth,
// not mascot-as-logo. Phase 2 recolor: teal body (this page's primary
// accent) with a warm coral blush, matching the new light palette instead
// of Phase 1's all-violet character.
export default function Mascot({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" className={className} role="img" aria-label="RoomFit's little roomie character, waving">
      {/* shadow */}
      <ellipse cx="80" cy="142" rx="34" ry="6" fill="#000" opacity="0.12" />
      {/* body */}
      <ellipse cx="80" cy="95" rx="46" ry="42" fill="#2dd4bf" />
      <ellipse cx="80" cy="100" rx="46" ry="34" fill="#0d9488" />
      {/* tummy patch */}
      <ellipse cx="80" cy="105" rx="24" ry="20" fill="#fff7ed" opacity="0.95" />
      {/* ears */}
      <circle cx="46" cy="52" r="14" fill="#2dd4bf" />
      <circle cx="114" cy="52" r="14" fill="#2dd4bf" />
      <circle cx="46" cy="52" r="6" fill="#99f6e4" />
      <circle cx="114" cy="52" r="6" fill="#99f6e4" />
      {/* face */}
      <circle cx="80" cy="70" r="34" fill="#5eead4" />
      {/* eyes */}
      <circle cx="68" cy="68" r="4.5" fill="#1c1917" />
      <circle cx="92" cy="68" r="4.5" fill="#1c1917" />
      {/* blush */}
      <circle cx="60" cy="78" r="5" fill="#fb923c" opacity="0.55" />
      <circle cx="100" cy="78" r="5" fill="#fb923c" opacity="0.55" />
      {/* smile */}
      <path d="M70 80 Q80 88 90 80" stroke="#1c1917" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* waving arm */}
      <ellipse cx="122" cy="90" rx="9" ry="16" fill="#0d9488" transform="rotate(-25 122 90)" />
      {/* other arm */}
      <ellipse cx="42" cy="100" rx="8" ry="14" fill="#0d9488" transform="rotate(15 42 100)" />
    </svg>
  );
}

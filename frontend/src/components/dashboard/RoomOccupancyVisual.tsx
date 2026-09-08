// Deliberately NOT Three.js. The landing page's 3D hero is a one-time,
// once-per-session cost that a marketing page can justify; a dashboard is
// visited every login, often as the very first page a student ever loads
// (never having passed through the landing page in that browser session at
// all), so the same 942.5KB chunk would be a real, repeated cost for a much
// smaller payoff here. A student also cares about THEIR real room, not a
// generic illustration - so a small data-driven SVG that actually reflects
// real occupancy (who's assigned, how many beds are still open) beats a
// prettier generic scene anyway. Zero bundle cost, zero WebGL, no
// reduced-motion/mobile fallback needed because there's nothing heavy to
// fall back from.
interface Occupant {
  initials: string;
  name: string;
  isMe?: boolean;
}

interface RoomOccupancyVisualProps {
  capacity: number;
  occupants: Occupant[];
}

const BED_COLORS = {
  me: { fill: "#0f766e", face: "#115e59", top: "#14b8a6" }, // teal - you
  mate: { fill: "#ea580c", face: "#c2410c", top: "#fb923c" }, // coral - roommates
};

function Bed({ label, colorKey, name }: { label: string; colorKey: "me" | "mate"; name: string }) {
  const c = BED_COLORS[colorKey];
  return (
    <div className="flex flex-col items-center gap-1.5 w-16 shrink-0" title={name}>
      <svg viewBox="0 0 70 60" className="w-14 h-12" aria-hidden="true">
        <polygon points="5,28 35,14 65,28 35,42" fill={c.top} />
        <polygon points="5,28 5,38 35,52 35,42" fill={c.fill} />
        <polygon points="65,28 65,38 35,52 35,42" fill={c.face} />
      </svg>
      <span className="text-[10px] font-bold text-stone-700 truncate max-w-full">{label}</span>
    </div>
  );
}

function EmptyBed() {
  return (
    <div className="flex flex-col items-center gap-1.5 w-16 shrink-0">
      <svg viewBox="0 0 70 60" className="w-14 h-12" aria-hidden="true">
        <polygon points="5,28 35,14 65,28 35,42" fill="none" stroke="#a8a29e" strokeWidth="1.5" strokeDasharray="4,3" />
        <polygon points="5,28 5,38 35,52 35,42" fill="none" stroke="#a8a29e" strokeWidth="1.5" strokeDasharray="4,3" />
        <polygon points="65,28 65,38 35,52 35,42" fill="none" stroke="#a8a29e" strokeWidth="1.5" strokeDasharray="4,3" />
      </svg>
      <span className="text-[10px] font-medium text-stone-600">Open</span>
    </div>
  );
}

export default function RoomOccupancyVisual({ capacity, occupants }: RoomOccupancyVisualProps) {
  const safeCapacity = Math.max(capacity, occupants.length);
  const emptySlots = Math.max(safeCapacity - occupants.length, 0);

  return (
    <div className="relative rounded-2xl bg-gradient-to-b from-stone-100 to-stone-200/60 border border-stone-200 px-4 pt-6 pb-4">
      <div className="flex flex-wrap items-end justify-center gap-3">
        {occupants.map((o, i) => (
          <Bed key={i} label={o.isMe ? "You" : o.name.split(" ")[0]} colorKey={o.isMe ? "me" : "mate"} name={o.name} />
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <EmptyBed key={`empty-${i}`} />
        ))}
      </div>
      <p className="text-center text-[11px] text-stone-600 font-semibold mt-4">
        {occupants.length} of {safeCapacity} beds filled
      </p>
    </div>
  );
}

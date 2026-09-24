"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { X } from "lucide-react";
import { layoutBeds, BED_LEN, BED_WID, BED_SPACING as SPACING, placeDesks } from "@/lib/bedLayout";

/**
 * DollhouseRoom — a premium INTERACTIVE ARCHITECTURAL MODEL of a hostel room,
 * not decoration. It is fully data-driven:
 *
 *   beds.length            -> exact number of physical beds (== room capacity)
 *   bed.occupied           -> teal bedding vs muted gray bedding
 *   bed.occupant           -> hover tooltip + select panel content
 *
 * Open cutaway construction (back + left walls only, front fully open),
 * elevated 3/4 default view, drag rotation clamped to useful angles.
 */

export type BedOccupant = {
  name: string;
  detail: string;
  compat: number;
  traits: string[];
};

export type DollhouseBed = {
  occupied: boolean;
  occupant?: BedOccupant;
};

/* ------------------------------- palette -------------------------------- */

const TEAL_DEEP = "#115e59";
const TEAL = "#0f766e";
const TEAL_SOFT = "#5fb3ac";
const GRAY_BEDDING = "#ddd8cc";
const MATTRESS = "#ffffff";
const PILLOW = "#fbfaf7";
const WOOD = "#a16207";
const WOOD_LIGHT = "#d9a05b";
const WALL = "#efe9dd";
const FLOOR = "#f4f1ea";
const AMBER = "#f59e0b";
const INK = "#292524";

/* Bed geometry constants + slot type come from @/lib/bedLayout (pure,
   unit-verified): one slot per capacity, never overlapping, always inside. */

/* --------------------------------- bed ----------------------------------- */

function BedModel({
  slot,
  occupied,
  hovered,
  selected,
  onHover,
  onLeave,
  onSelect,
}: {
  slot: BedSlot;
  occupied: boolean;
  hovered: boolean;
  selected: boolean;
  onHover: (e: ThreeEvent<PointerEvent>) => void;
  onLeave: () => void;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const lift = useRef(0);
  useFrame((_, delta) => {
    const target = selected ? 0.16 : hovered ? 0.1 : 0;
    lift.current = THREE.MathUtils.damp(lift.current, target, 12, delta);
    if (group.current) group.current.position.y = lift.current;
  });

  const blanket = occupied ? TEAL : GRAY_BEDDING;
  const frame = occupied ? TEAL_DEEP : "#c9c2b2";
  const glow = selected ? 0.45 : hovered ? 0.3 : 0;

  return (
    <group
      ref={group}
      position={[slot.x, 0, slot.z]}
      rotation={[0, slot.rotationY, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(e);
      }}
      onPointerOut={onLeave}
      onClick={(e) => {
        e.stopPropagation();
        if (occupied) onSelect();
      }}
    >
      {/* legs */}
      {[
        [-1.25, -0.65],
        [1.25, -0.65],
        [-1.25, 0.65],
        [1.25, 0.65],
      ].map(([lx, lz], i) => (
        <mesh key={i} castShadow position={[lx, 0.12, lz]}>
          <boxGeometry args={[0.12, 0.24, 0.12]} />
          <meshStandardMaterial color={WOOD} roughness={0.7} />
        </mesh>
      ))}
      {/* frame */}
      <mesh castShadow receiveShadow position={[0, 0.32, 0]}>
        <boxGeometry args={[BED_LEN, 0.22, BED_WID]} />
        <meshStandardMaterial color={frame} roughness={0.65} />
      </mesh>
      {/* headboard */}
      <mesh castShadow position={[-BED_LEN / 2 + 0.06, 0.75, 0]}>
        <boxGeometry args={[0.12, 1.05, BED_WID]} />
        <meshStandardMaterial color={frame} roughness={0.65} />
      </mesh>
      {/* mattress */}
      <mesh castShadow receiveShadow position={[0.04, 0.52, 0]}>
        <boxGeometry args={[BED_LEN - 0.2, 0.24, BED_WID - 0.14]} />
        <meshStandardMaterial color={MATTRESS} roughness={0.9} />
      </mesh>
      {/* blanket */}
      <mesh castShadow position={[0.5, 0.58, 0]}>
        <boxGeometry args={[1.6, 0.2, BED_WID - 0.1]} />
        <meshStandardMaterial
          color={blanket}
          roughness={0.85}
          emissive={occupied ? TEAL_SOFT : "#000000"}
          emissiveIntensity={glow}
        />
      </mesh>
      {/* pillow */}
      <mesh castShadow position={[-0.95, 0.68, 0]} rotation={[0, 0, 0.05]}>
        <boxGeometry args={[0.55, 0.18, 0.95]} />
        <meshStandardMaterial color={occupied ? PILLOW : "#e8e2d4"} roughness={0.9} />
      </mesh>
      {/* cushion: occupied beds only, an extra at-a-glance cue */}
      {occupied && (
        <mesh castShadow position={[-0.5, 0.7, 0.28]} rotation={[0, 0.35, 0]}>
          <boxGeometry args={[0.32, 0.15, 0.32]} />
          <meshStandardMaterial color={AMBER} roughness={0.8} />
        </mesh>
      )}
    </group>
  );
}

/* ------------------------------- furniture ------------------------------- */

function Desk({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.62, 0]}>
        <boxGeometry args={[1.7, 0.09, 0.9]} />
        <meshStandardMaterial color={WOOD_LIGHT} roughness={0.6} />
      </mesh>
      {[
        [-0.75, -0.35],
        [0.75, -0.35],
        [-0.75, 0.35],
        [0.75, 0.35],
      ].map(([lx, lz], i) => (
        <mesh key={i} castShadow position={[lx, 0.29, lz]}>
          <boxGeometry args={[0.09, 0.58, 0.09]} />
          <meshStandardMaterial color={WOOD} roughness={0.7} />
        </mesh>
      ))}
      {/* stool tucked at the desk edge */}
      <mesh castShadow position={[0.25, 0.24, 0.62]}>
        <boxGeometry args={[0.44, 0.48, 0.4]} />
        <meshStandardMaterial color={TEAL_DEEP} roughness={0.7} />
      </mesh>
      {/* book */}
      <mesh castShadow position={[-0.35, 0.71, -0.05]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.42, 0.08, 0.3]} />
        <meshStandardMaterial color={TEAL} roughness={0.8} />
      </mesh>
      {/* mug */}
      <mesh castShadow position={[0.45, 0.75, -0.15]}>
        <cylinderGeometry args={[0.09, 0.08, 0.16, 20]} />
        <meshStandardMaterial color={AMBER} roughness={0.7} />
      </mesh>
    </group>
  );
}

function Wardrobe({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.95, 0]}>
        <boxGeometry args={[1.25, 1.9, 0.62]} />
        <meshStandardMaterial color="#e3dccb" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.95, 0.32]}>
        <boxGeometry args={[0.03, 1.6, 0.02]} />
        <meshStandardMaterial color="#b8ae97" roughness={0.85} />
      </mesh>
      {[-0.18, 0.18].map((hx, i) => (
        <mesh key={i} position={[hx, 0.95, 0.34]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color={WOOD} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function BedsideTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.28, 0]}>
        <boxGeometry args={[0.52, 0.56, 0.52]} />
        <meshStandardMaterial color="#e3dccb" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color={AMBER} emissive={AMBER} emissiveIntensity={0.35} roughness={0.5} />
      </mesh>
    </group>
  );
}

/* --------------------------------- scene --------------------------------- */

const WALL_H = 2.2;
const WALL_T = 0.18;

function RoomScene({
  beds,
  hovered,
  selected,
  onHoverBed,
  onLeaveBed,
  onSelectBed,
  yawTarget,
  sway,
}: {
  beds: DollhouseBed[];
  hovered: number | null;
  selected: number | null;
  onHoverBed: (i: number, e: ThreeEvent<PointerEvent>) => void;
  onLeaveBed: () => void;
  onSelectBed: (i: number) => void;
  yawTarget: number;
  sway: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const yaw = useRef(0);
  const layout = useMemo(() => layoutBeds(beds.length), [beds.length]);

  useFrame((state, delta) => {
    if (!group.current) return;
    yaw.current = THREE.MathUtils.damp(yaw.current, yawTarget, 6, delta);
    // Gentle idle sway around the user's chosen angle (off under
    // reduced motion); drag rotation always stays user-initiated.
    const swayAngle = sway ? Math.sin(state.clock.elapsedTime * 0.35) * 0.18 : 0;
    group.current.rotation.y = yaw.current + swayAngle;
  });

  const { W, D, scale, slots } = layout;
  const backCount = beds.length <= 2 ? beds.length : Math.ceil(beds.length / 2);
  const backRightEdge = backCount > 0 ? ((backCount - 1) / 2) * SPACING + BED_WID / 2 : 0;
  // Right of the back row always has 2.55 units free (room is sized for it):
  // wardrobe (1.25 wide) fits with clearance, never touching beds or table.
  const showWardrobe = backCount === 0 || backRightEdge < W / 2 - 1.9;
  const backZ = -D / 2 + 0.35 + BED_LEN / 2;

  // One desk+stool set per occupant, placed into genuinely free floor by
  // placeDesks (collision-checked, so the room can never overcrowd itself).
  // The wardrobe rect doubles as an obstacle so sets never touch it.
  const desks = useMemo(() => {
    const wardrobeRect = showWardrobe
      ? { minX: W / 2 - 1.575, maxX: W / 2 - 0.325, minZ: -D / 2 + 0.84, maxZ: -D / 2 + 1.46 }
      : null;
    return placeDesks(slots, W, D, beds.filter((b) => b.occupied).length, wardrobeRect);
  }, [beds, slots, W, D, showWardrobe]);

  return (
    <group ref={group} scale={scale}>
      {/* floor slab with a lip, like a model base */}
      <mesh receiveShadow position={[0, -0.14, 0]}>
        <boxGeometry args={[W + 1.1, 0.28, D + 1.1]} />
        <meshStandardMaterial color={FLOOR} roughness={0.95} />
      </mesh>

      {/* back wall */}
      <mesh receiveShadow position={[0, WALL_H / 2, -D / 2 - WALL_T / 2]}>
        <boxGeometry args={[W + WALL_T, WALL_H, WALL_T]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      {/* left wall (front left open = the cutaway) */}
      <mesh receiveShadow position={[-W / 2 - WALL_T / 2, WALL_H / 2, 0]}>
        <boxGeometry args={[WALL_T, WALL_H, D + WALL_T]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>

      {/* window: flat frame + glass on the back wall, above headboard height */}
      <mesh position={[-W / 4, 1.55, -D / 2 + 0.02]}>
        <boxGeometry args={[1.15, 0.85, 0.06]} />
        <meshStandardMaterial color={TEAL_DEEP} roughness={0.7} />
      </mesh>
      <mesh position={[-W / 4, 1.55, -D / 2 + 0.05]}>
        <boxGeometry args={[0.95, 0.65, 0.03]} />
        <meshStandardMaterial color="#cfe3de" roughness={0.25} metalness={0.1} />
      </mesh>

      {/* door slab ajar at the open front edge = the entrance cue */}
      <group position={[W / 2 - 0.9, 0, D / 2 + 0.15]} rotation={[0, -0.5, 0]}>
        <mesh castShadow position={[0, 1.0, 0]}>
          <boxGeometry args={[0.9, 2.0, 0.09]} />
          <meshStandardMaterial color={AMBER} roughness={0.7} />
        </mesh>
        <mesh position={[0.28, 1.0, 0.07]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color={INK} roughness={0.5} />
        </mesh>
      </group>

      {/* beds: exactly one per capacity slot */}
      {slots.map((slot, i) => (
        <BedModel
          key={i}
          slot={slot}
          occupied={!!beds[i]?.occupied}
          hovered={hovered === i}
          selected={selected === i}
          onHover={(e) => onHoverBed(i, e)}
          onLeave={onLeaveBed}
          onSelect={() => onSelectBed(i)}
        />
      ))}

      {/* secondary furniture in leftover zones only (left end + right end
          of the back row are sized clear, so nothing touches the beds) */}
      {backCount >= 1 && (
        <BedsideTable position={[slots[0].x - 1.35, 0, backZ]} />
      )}
      {/* desk+chair per occupant, placed collision-free above */}
      {desks.map((d, i) => (
        <Desk key={i} position={[d.x, 0, d.z]} rotationY={d.rot} />
      ))}
      {showWardrobe && <Wardrobe position={[W / 2 - 0.95, 0, -D / 2 + 1.15]} />}
    </group>
  );
}

/* ------------------------------- component ------------------------------- */

export default function DollhouseRoom({ beds }: { beds: DollhouseBed[] }) {
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; w: number } | null>(null);
  const [yawTarget, setYawTarget] = useState(0);
  const drag = useRef<{ x: number; active: boolean }>({ x: 0, active: false });
  const wrapRef = useRef<HTMLDivElement>(null);

  const occupiedCount = beds.filter((b) => b.occupied).length;

  const clampYaw = (v: number) => THREE.MathUtils.clamp(v, -0.9, 0.9);

  const toLocal = (clientX: number, clientY: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0, w: 400 };
    return { x: clientX - rect.left, y: clientY - rect.top, w: rect.width };
  };

  const selectedBed = selected !== null ? beds[selected] : null;

  return (
    <div
      ref={wrapRef}
      className="relative select-none"
      style={{ touchAction: "pan-y" }}
      onPointerMove={(e) => {
        if (drag.current.active) {
          const dx = e.clientX - drag.current.x;
          drag.current.x = e.clientX;
          setYawTarget((t) => clampYaw(t + dx * 0.006));
        }
        if (hovered !== null) setTip(toLocal(e.clientX, e.clientY));
      }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, active: true };
      }}
      onPointerUp={() => {
        drag.current.active = false;
      }}
      onPointerLeave={() => {
        drag.current.active = false;
        setHovered(null);
        setTip(null);
      }}
    >
      <div className="h-[300px] sm:h-[360px] cursor-grab active:cursor-grabbing">
        <Canvas
          dpr={[1, 1.75]}
          camera={{ position: [7.4, 8.8, 7.4], fov: 30 }}
          gl={{ antialias: true, alpha: true }}
          aria-hidden="true"
        >
          <ambientLight intensity={0.9} />
          <hemisphereLight args={["#ffffff", "#e7e0d2", 0.45]} />
          <directionalLight
            position={[6, 10, 4]}
            intensity={1.3}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-8}
            shadow-camera-right={8}
            shadow-camera-top={8}
            shadow-camera-bottom={-8}
          />
          <directionalLight position={[-4, 3, -5]} intensity={0.28} />
          <RoomScene
            beds={beds}
            hovered={hovered}
            selected={selected}
            onHoverBed={(i, e) => {
              if (!beds[i]?.occupied) {
                setHovered(null);
                setTip(null);
                return;
              }
              setHovered(i);
              document.body.style.cursor = "pointer";
              const native = e.nativeEvent as PointerEvent;
              setTip(toLocal(native.clientX, native.clientY));
            }}
            onLeaveBed={() => {
              setHovered(null);
              setTip(null);
              document.body.style.cursor = "";
            }}
            onSelectBed={(i) => setSelected(selected === i ? null : i)}
            yawTarget={yawTarget}
            sway={!reduced}
          />
        </Canvas>
      </div>

      {/* hover tooltip: follows the cursor, occupied beds only */}
      {hovered !== null && tip && beds[hovered]?.occupant && (
        <div
          className="absolute z-20 pointer-events-none card-premium rounded-xl px-3.5 py-2.5 shadow-lift min-w-[150px] max-w-[200px]"
          style={{
            left: Math.max(8, Math.min(tip.x + 16, tip.w - 190)),
            top: Math.max(tip.y - 10, 8),
          }}
        >
          <p className="text-[13px] font-bold text-stone-900 leading-tight">{beds[hovered].occupant!.name}</p>
          <p className="text-[11px] text-stone-500 mt-0.5">{beds[hovered].occupant!.detail}</p>
          <p className="text-[12px] font-bold text-teal-900 mt-1 tabular-nums">
            {beds[hovered].occupant!.compat}% compatibility
          </p>
        </div>
      )}

      {/* bed-count dots: transparent, always agrees with the physical model */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-3 z-10 flex items-center gap-2 whitespace-nowrap"
        role="img"
        aria-label={`${beds.length} beds, ${occupiedCount} occupied, ${beds.length - occupiedCount} available`}
      >
        <span className="flex items-center gap-1" aria-hidden="true">
          {beds.map((b, i) => (
            <span
              key={i}
              className={`w-2.5 h-2.5 rounded-full ${b.occupied ? "bg-teal-800" : "bg-white/70 border-[1.5px] border-stone-400"}`}
            />
          ))}
        </span>
        <span className="text-[11px] font-semibold text-stone-500 tabular-nums">
          {beds.length - occupiedCount === 0
            ? `${occupiedCount} occupied · fully occupied`
            : `${occupiedCount} occupied · ${beds.length - occupiedCount} available`}
        </span>
      </div>

      {/* selected bed panel */}
      {selected !== null && selectedBed?.occupant && (
        <div className="absolute inset-x-3 bottom-3 z-20 card-premium rounded-2xl p-4 shadow-lift border-l-4 border-l-teal-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-bold text-stone-900">{selectedBed.occupant.name}</p>
              <p className="text-xs text-stone-500 mt-0.5">{selectedBed.occupant.detail}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="chip chip-teal">{selectedBed.occupant.compat}% match</span>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close bed details"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <ul className="flex flex-wrap gap-1.5 mt-2.5">
            {selectedBed.occupant.traits.map((t) => (
              <li key={t} className="chip chip-stone">{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

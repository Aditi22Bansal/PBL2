/**
 * Dollhouse bed-layout algorithm (pure, no 3D imports - independently
 * testable). Given a room capacity, produces exactly one bed slot per bed,
 * split across a back row (heads to the back wall) and a left-wall row
 * (heads to the left wall), then sizes the room shell around them.
 *
 * Invariants (asserted by the verification script):
 *  - slots.length === capacity for 0..12
 *  - no two slots overlap (footprints separated by >= 0.3 gap)
 *  - every slot sits fully inside the room shell
 */

export type BedSlot = { x: number; z: number; rotationY: number };

export type RoomLayout = {
  slots: BedSlot[];
  W: number;
  D: number;
  scale: number;
};

export const BED_SPACING = 1.9;
export const BED_LEN = 2.8;
export const BED_WID = 1.6;

export function layoutBeds(count: number): RoomLayout {
  const n = Math.max(0, Math.min(Math.floor(count), 12));
  const backCount = n <= 2 ? n : Math.ceil(n / 2);
  const sideCount = n - backCount;

  const W = Math.max(6.4, backCount * BED_SPACING + 3.2);
  const D = Math.max(6.4, 6.0 + Math.max(0, sideCount - 1) * BED_SPACING);

  const slots: BedSlot[] = [];
  for (let i = 0; i < backCount; i++) {
    slots.push({
      x: (i - (backCount - 1) / 2) * BED_SPACING,
      z: -D / 2 + 0.35 + BED_LEN / 2,
      rotationY: -Math.PI / 2,
    });
  }
  const zStart = -D / 2 + 4.7;
  for (let j = 0; j < sideCount; j++) {
    slots.push({
      x: -W / 2 + 0.35 + BED_LEN / 2,
      z: zStart + j * BED_SPACING,
      rotationY: 0,
    });
  }
  // Normalize so every capacity frames identically in the fixed camera.
  const scale = 6.8 / Math.max(W, D);
  return { slots, W, D, scale };
}

/** Footprint of a slot in room XZ (accounts for rotation). */
export function slotFootprint(slot: BedSlot): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const alongX = Math.abs(Math.cos(slot.rotationY)) > 0.5;
  const hx = (alongX ? BED_LEN : BED_WID) / 2;
  const hz = (alongX ? BED_WID : BED_LEN) / 2;
  return { minX: slot.x - hx, maxX: slot.x + hx, minZ: slot.z - hz, maxZ: slot.z + hz };
}

export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };

export const rectsOverlap = (a: Rect, b: Rect, pad = 0) =>
  a.minX < b.maxX + pad && a.maxX + pad > b.minX && a.minZ < b.maxZ + pad && a.maxZ + pad > b.minZ;

export const insideRoom = (r: Rect, W: number, D: number, margin = 0.3) =>
  r.minX >= -W / 2 + margin && r.maxX <= W / 2 - margin && r.minZ >= -D / 2 + margin && r.maxZ <= D / 2 - margin;

/** Desk+stool footprint (stool tucked at the desk edge, facing it). */
export const deskFootprint = (x: number, z: number, rot: number): Rect =>
  rot === 0
    ? { minX: x - 0.9, maxX: x + 0.9, minZ: z - 0.5, maxZ: z + 0.8 }
    : { minX: x - 0.75, maxX: x + 0.5, minZ: z - 0.55, maxZ: z + 0.55 };

export type DeskSpot = { x: number; z: number; rot: number };

/**
 * Place up to `needed` desk+stool sets into genuinely free floor: the open
 * right side first (top-to-bottom), then the front row (center-out).
 * Candidates touching beds, the wardrobe, the door swing, or an earlier set
 * are skipped, so rooms never overcrowd. Returns placed spots (fewer than
 * needed only if nothing fits).
 */
export function placeDesks(
  slots: BedSlot[],
  W: number,
  D: number,
  needed: number,
  wardrobe: Rect | null
): DeskSpot[] {
  const BED_PAD = 0.05;
  const SET_PAD = 0.2;
  const obstacles: Rect[] = [
    ...slots.map((s) => {
      const f = slotFootprint(s);
      return { minX: f.minX - BED_PAD, maxX: f.maxX + BED_PAD, minZ: f.minZ - BED_PAD, maxZ: f.maxZ + BED_PAD };
    }),
    // real door slab zone at the open front-right edge
    { minX: W / 2 - 1.5, maxX: W / 2 - 0.3, minZ: D / 2 - 0.4, maxZ: D / 2 + 0.7 },
  ];
  if (wardrobe) obstacles.push(wardrobe);
  const placed: DeskSpot[] = [];
  const tryPlace = (x: number, z: number, rot: number) => {
    if (placed.length >= needed) return;
    const r = deskFootprint(x, z, rot);
    if (!insideRoom(r, W, D, 0.25)) return;
    if (obstacles.some((o) => rectsOverlap(r, o))) return;
    if (placed.some((p) => rectsOverlap(r, deskFootprint(p.x, p.z, p.rot), SET_PAD))) return;
    placed.push({ x, z, rot });
    obstacles.push(r);
  };
  // open right side, facing into the room, top-to-bottom
  for (let z = -D / 2 + 1.0; z <= D / 2 - 1.0 && placed.length < needed; z += 1.35) {
    tryPlace(W / 2 - 0.75, z, Math.PI / 2);
  }
  // front row, facing the entrance, center-out
  const frontZ = D / 2 - 1.7;
  const order: number[] = [0];
  for (let k = 1; k <= 4; k++) order.push(-k * 1.9, k * 1.9);
  for (const dx of order) {
    if (placed.length >= needed) break;
    tryPlace(dx, frontZ, 0);
  }
  return placed;
}

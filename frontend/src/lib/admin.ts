/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Shared admin-console helpers — pure presentation logic only.
 * No API shapes are changed here; every value rendered comes from the
 * existing backend endpoints (/admin/allocations, /admin/analytics,
 * /admin/requests, /admin/audit-log, hostel-configurations).
 */

export const RISK_HIGH = 0.8;
export const RISK_MEDIUM = 0.88;

export function getCapacityLabel(capacity: number) {
  switch (capacity) {
    case 1: return "Single";
    case 2: return "Double";
    case 3: return "Triple";
    case 4: return "Quad";
    default: return `${capacity}-Bed`;
  }
}

export function roomCapacity(a: any): number {
  return a.room_capacity || (a.members || []).length;
}

export function roomOccupied(a: any): number {
  return a.room_occupancy ?? (a.members || []).length;
}

export function roomBlock(a: any): string {
  if (a.block) return String(a.block);
  const m = String(a.room_number || "").match(/^([A-Za-z])/);
  return m ? m[1].toUpperCase() : "—";
}

export function memberNames(a: any): string[] {
  return a.memberDetails || a.members || [];
}

/** Compatibility display — mirrors the established backend thresholds. */
export function compatMeta(score: number | undefined | null) {
  const s = score ?? 0;
  if (s < 0) return { label: "Below average", pct: 0, tone: "muted" as const };
  const pct = Math.round(s * 100);
  if (s < RISK_HIGH) return { label: `${pct}%`, pct, tone: "bad" as const };
  if (s < RISK_MEDIUM) return { label: `${pct}%`, pct, tone: "warn" as const };
  return { label: `${pct}%`, pct, tone: "good" as const };
}

export const toneBar: Record<string, string> = {
  good: "bg-teal-800",
  warn: "bg-amber-500",
  bad: "bg-red-600",
  muted: "bg-stone-300",
};

export const toneText: Record<string, string> = {
  good: "text-teal-900",
  warn: "text-amber-700",
  bad: "text-red-700",
  muted: "text-stone-500",
};

/** Normalise the various risk labels the backend can produce. */
export function riskMeta(risk: string | undefined, genderGroup?: string) {
  const flex = (genderGroup || "").includes("FLEX");
  const r = risk || (flex ? "High Risk" : "Low");
  if (r === "High Risk" || r === "High")
    return { label: flex && risk !== "High Risk" ? "High Risk · flex" : "High risk", dot: "bg-red-700", text: "text-red-700", pill: "bg-red-50 text-red-800 border-red-200" };
  if (r === "Needs Attention" || r === "Medium")
    return { label: "Attention", dot: "bg-amber-500", text: "text-amber-700", pill: "bg-amber-50 text-amber-900 border-amber-200" };
  if (r === "Good" || r === "Excellent" || r === "Low")
    return { label: r === "Low" ? "Healthy" : r, dot: "bg-teal-800", text: "text-teal-900", pill: "bg-teal-50 text-teal-900 border-teal-200" };
  return { label: r, dot: "bg-stone-300", text: "text-stone-500", pill: "bg-stone-100 text-stone-600 border-stone-200" };
}

export function occupancyMeta(a: any) {
  const cap = roomCapacity(a);
  const occ = roomOccupied(a);
  const status = a.occupancy_status || (occ === 0 ? "Empty" : occ < cap ? "Partial" : "Full");
  return { cap, occ, status };
}

export function insightDot(type: string | undefined) {
  if (type === "danger") return "bg-red-700";
  if (type === "warning") return "bg-amber-500";
  if (type === "success") return "bg-teal-800";
  return "bg-stone-300";
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const AUDIT_LABELS: Record<string, string> = {
  TRIGGER_ALLOCATION: "Allocation run completed",
  CSV_SYNC: "Student responses synced",
  MANUAL_SWAP: "Manual room swap applied",
  ROOM_LOCK_TOGGLE: "Room lock updated",
  CHANGE_REQUEST_ACTION: "Change request reviewed",
  ACCOMMODATE_REQUEST: "Accessibility request accommodated",
  HOSTEL_CONFIG_CREATE: "Room configuration created",
  HOSTEL_CONFIG_UPDATE: "Room configuration updated",
  HOSTEL_CONFIG_ACTIVATE: "Room configuration activated",
  ORG_REGISTRATION: "Organization registered",
};

export function auditLabel(action: string) {
  return AUDIT_LABELS[action] || action.replace(/_/g, " ").toLowerCase();
}

/** CSV export — same columns as the existing overview export. */
export function exportAllocationsCSV(allocations: any[]) {
  if (!allocations || allocations.length === 0) return;
  const headers = ["Room Number", "Gender Group", "Compatibility %", "Capacity", "Occupancy Status", "Risk", "Conflict Reasons", "Members"];
  const rows = allocations.map((a: any) => [
    a.room_number,
    a.gender_group || "N/A",
    `${Math.round((a.compatibility_score || 0) * 100)}%`,
    roomCapacity(a),
    a.occupancy_status || "Full",
    a.conflict_analysis?.conflictRisk || "Low",
    (a.conflict_analysis?.conflictReasons || []).map((r: any) => r.text).join("; ") || "None",
    (a.members || []).join("; "),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `RoomFit_Allotments_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const inputCls =
  "bg-white border border-stone-300 rounded-lg px-3 py-2 text-[13px] text-stone-900 focus:outline-none focus:border-teal-800 transition-colors placeholder:text-stone-400";

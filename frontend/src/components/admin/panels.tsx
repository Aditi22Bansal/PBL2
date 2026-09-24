/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  AlertTriangle, BedDouble, CheckCircle2, CircleAlert, Clock3,
  DoorOpen, Users,
} from "lucide-react";
import {
  compatMeta, insightDot, memberNames, riskMeta,
  roomBlock, roomCapacity, roomOccupied, toneBar, toneText, auditLabel, formatTime,
} from "@/lib/admin";

/* ---------------------------------- bits ---------------------------------- */

export function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
      <div>
        <h2 className="text-[19px] font-bold tracking-tight text-stone-900">{title}</h2>
        {sub && <p className="text-[13px] text-stone-500 mt-1">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={label} className={`bg-white border border-stone-200/90 rounded-2xl shadow-soft ${className}`}>
      {children}
    </section>
  );
}

function BedGlyph({ filled }: { filled: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`w-3.5 h-3.5 rounded-[4px] shrink-0 ${filled ? "bg-teal-800" : "bg-white border border-stone-300"}`}
    />
  );
}

export function BedMap({ capacity, occupied }: { capacity: number; occupied: number }) {
  const total = Math.max(0, Math.min(capacity, 12));
  const filled = Math.max(0, Math.min(occupied, total));
  return (
    <span className="inline-flex flex-wrap gap-[3px] max-w-[96px] shrink-0" role="img" aria-label={`${filled} of ${total} beds occupied`}>
      {Array.from({ length: total }).map((_, i) => (
        <BedGlyph key={i} filled={i < filled} />
      ))}
    </span>
  );
}

/* -------------------------------- occupancy ------------------------------- */

export function OccupancyPanel({ totalBeds, occupiedBeds, totalRooms }: { totalBeds: number; occupiedBeds: number; totalRooms: number }) {
  const empty = Math.max(0, totalBeds - occupiedBeds);
  const pct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const R = 44;
  const C = 2 * Math.PI * R;
  return (
    <Panel label="Hostel utilization" className="p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Hostel utilization</p>
      <div className="flex items-center gap-5 mt-3">
        <div className="relative w-[104px] h-[104px] shrink-0" role="img" aria-label={`${pct}% beds occupied`}>
          <svg viewBox="0 0 104 104" className="w-full h-full -rotate-90">
            <circle cx="52" cy="52" r={R} fill="none" stroke="#e7e5e4" strokeWidth="11" />
            <circle
              cx="52" cy="52" r={R} fill="none" stroke="#115e59" strokeWidth="11" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C - (Math.min(pct, 100) / 100) * C}
              className="transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[22px] font-bold text-stone-900 tabular-nums">{pct}%</span>
        </div>
        <dl className="flex-1 space-y-2.5 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-stone-600"><span className="w-2 h-2 rounded-full bg-teal-800" />Occupied</dt>
            <dd className="font-semibold text-stone-900 tabular-nums">{occupiedBeds}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-stone-600"><span className="w-2 h-2 rounded-full bg-stone-300 border border-stone-300" />Available</dt>
            <dd className="font-semibold text-stone-900 tabular-nums">{empty}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-stone-100">
            <dt className="text-stone-500">Rooms · beds</dt>
            <dd className="font-semibold text-stone-900 tabular-nums">{totalRooms} · {totalBeds}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-stone-200 overflow-hidden" aria-hidden="true">
        <div className="h-full bg-teal-800 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="text-xs text-stone-500 mt-2.5">{occupiedBeds} occupied · {empty} available across {totalRooms} rooms</p>
    </Panel>
  );
}

/* ------------------------------ compatibility ----------------------------- */

export function CompatibilityPanel({ allocations }: { allocations: any[] }) {
  const excellent = allocations.filter((a) => (a.compatibility_score ?? 0) >= 0.88 && !(a.gender_group || "").includes("FLEX")).length;
  const good = allocations.filter((a) => { const s = a.compatibility_score ?? 0; return s >= 0.8 && s < 0.88; }).length;
  const review = allocations.filter((a) => (a.compatibility_score ?? 0) < 0.8).length;
  const total = Math.max(1, allocations.length);
  const rows = [
    { label: "Excellent", count: excellent, bar: "bg-teal-800", text: "text-teal-900" },
    { label: "Good", count: good, bar: "bg-teal-600", text: "text-teal-900" },
    { label: "Needs review", count: review, bar: "bg-amber-500", text: "text-amber-700" },
  ];
  return (
    <Panel label="Compatibility health" className="p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Compatibility health</p>
      <p className="text-[13px] text-stone-500 mt-1">Room match quality at a glance.</p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-[13px] mb-1.5">
              <span className="text-stone-600">{r.label}</span>
              <span className={`font-semibold tabular-nums ${r.text}`}>{r.count} <span className="font-normal text-stone-400">rooms</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div className={`h-full rounded-full ${r.bar} transition-all duration-500`} style={{ width: `${(r.count / total) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-3.5 border-t border-stone-100 flex items-center justify-between text-[13px]">
        <span className="text-stone-500">Rooms below 80%</span>
        <span className={`font-semibold tabular-nums ${review > 0 ? "text-amber-700" : "text-teal-900"}`}>{review}</span>
      </div>
    </Panel>
  );
}

/* -------------------------------- attention ------------------------------- */

export function AttentionPanel({ insights }: { insights: any[] }) {
  return (
    <Panel label="Requires attention" className="p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Requires attention</p>
        {insights.length > 0 && (
          <span className="text-xs font-semibold text-stone-500 tabular-nums">{insights.length} open</span>
        )}
      </div>
      {insights.length === 0 ? (
        <p className="mt-3 text-[13px] text-stone-500 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-800" /> Nothing needs review right now.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-stone-100">
          {insights.slice(0, 6).map((ins: any, i: number) => (
            <li key={ins.id || i} className="flex items-start gap-2.5 py-2.5">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${insightDot(ins.type)}`} aria-hidden="true" />
              <p className="text-[13px] text-stone-700 leading-relaxed">{ins.text}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* --------------------------------- activity ------------------------------- */

export function ActivityPanel({ entries, loading }: { entries: any[]; loading?: boolean }) {
  return (
    <Panel label="Recent activity" className="p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Recent activity</p>
        <Clock3 className="w-4 h-4 text-stone-300" aria-hidden="true" />
      </div>
      {loading ? (
        <p className="mt-3 text-[13px] text-stone-500">Loading activity…</p>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-[13px] text-stone-500 leading-relaxed">No recorded admin activity yet. Runs, syncs and reviews will appear here.</p>
      ) : (
        <ol className="mt-2 relative border-l border-stone-200 ml-1 space-y-4 py-1">
          {entries.slice(0, 7).map((e: any) => (
            <li key={e._id || `${e.action}-${e.createdAt}`} className="pl-4 relative">
              <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-teal-800 ring-2 ring-white" aria-hidden="true" />
              <p className="text-[13px] font-medium text-stone-800 leading-snug">{auditLabel(e.action)}</p>
              <p className="text-xs text-stone-500 mt-0.5 tabular-nums">
                {e.createdAt ? formatTime(e.createdAt) : ""}{e.actorEmail ? ` · ${e.actorEmail}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/* ------------------------------- room spotlight --------------------------- */

export function RoomSpotlight({ room, onClose }: { room: any; onClose?: () => void }) {
  if (!room) {
    return (
      <Panel label="Room spotlight" className="p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Room spotlight</p>
        <div className="mt-3 flex flex-col items-center text-center py-4">
          <DoorOpen className="w-6 h-6 text-stone-300" aria-hidden="true" />
          <p className="text-[13px] text-stone-500 mt-2 leading-relaxed">Select a room from the list<br />to preview its beds.</p>
        </div>
      </Panel>
    );
  }
  const cap = roomCapacity(room);
  const occ = roomOccupied(room);
  const names = memberNames(room);
  const compat = compatMeta(room.compatibility_score);
  const risk = riskMeta(room.conflict_analysis?.conflictRisk, room.gender_group);
  const cells = Array.from({ length: Math.min(cap, 8) }).map((_, i) => ({
    name: names[i],
    filled: i < occ && !!names[i],
  }));
  return (
    <Panel label={`Room ${room.room_number} spotlight`} className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Room spotlight</p>
          <p className="text-[20px] font-bold text-stone-900 tracking-tight mt-1">{room.room_number}</p>
          <p className="text-xs text-stone-500 mt-0.5">Block {roomBlock(room)} · {room.floor ? `Floor ${room.floor} · ` : ""}{room.gender_group || "—"}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-xs font-medium text-stone-400 hover:text-stone-700 transition-colors">Clear</button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2" role="img" aria-label={`${occ} of ${cap} beds occupied in room ${room.room_number}`}>
        {cells.map((c, i) => (
          <div
            key={i}
            className={`rounded-xl border px-3 py-2.5 min-h-[58px] flex flex-col justify-center gap-1 ${
              c.filled ? "bg-teal-50/60 border-teal-800/20" : "bg-white border-dashed border-stone-300"
            }`}
          >
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
              <BedDouble className="w-3.5 h-3.5" aria-hidden="true" /> Bed {i + 1}
            </span>
            <span className={`text-[13px] leading-tight truncate ${c.filled ? "font-semibold text-stone-900" : "text-stone-400"}`}>
              {c.filled ? c.name : "Available"}
            </span>
          </div>
        ))}
      </div>

      <dl className="mt-4 pt-3.5 border-t border-stone-100 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[11px] text-stone-500">Beds</dt>
          <dd className="text-sm font-bold text-stone-900 tabular-nums mt-0.5">{occ}/{cap}</dd>
        </div>
        <div className="border-l border-stone-100">
          <dt className="text-[11px] text-stone-500">Match</dt>
          <dd className={`text-sm font-bold tabular-nums mt-0.5 ${toneText[compat.tone]}`}>{compat.label}</dd>
        </div>
        <div className="border-l border-stone-100">
          <dt className="text-[11px] text-stone-500">Status</dt>
          <dd className={`text-sm font-bold mt-0.5 ${risk.text}`}>{risk.label}</dd>
        </div>
      </dl>

      <div className="mt-3 h-1.5 rounded-full bg-stone-100 overflow-hidden" aria-hidden="true">
        <div className={`h-full rounded-full ${toneBar[compat.tone]}`} style={{ width: `${compat.pct}%` }} />
      </div>
    </Panel>
  );
}

/* ------------------------------ status summary ---------------------------- */

export function HealthStrip({ unassigned, emptyBeds, highRisk, pending }: { unassigned: number; emptyBeds: number; highRisk: number; pending: number }) {
  const items = [
    { icon: CircleAlert, label: "High-risk rooms", value: highRisk, alert: highRisk > 0 },
    { icon: Users, label: "Unassigned students", value: unassigned, alert: unassigned > 0 },
    { icon: BedDouble, label: "Beds available", value: emptyBeds, alert: false },
    { icon: AlertTriangle, label: "Profiles pending", value: pending, alert: pending > 0 },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px bg-stone-200 border border-stone-200 rounded-2xl overflow-hidden">
      {items.map((it) => (
        <div key={it.label} className="bg-white px-4 py-3.5 flex items-center gap-3">
          <it.icon className={`w-[18px] h-[18px] shrink-0 ${it.alert ? "text-amber-600" : "text-teal-800"}`} aria-hidden="true" />
          <div className="min-w-0">
            <dd className="text-[18px] font-bold text-stone-900 leading-none tabular-nums">{it.value}</dd>
            <dt className="text-[11px] text-stone-500 mt-1 truncate">{it.label}</dt>
          </div>
        </div>
      ))}
    </dl>
  );
}

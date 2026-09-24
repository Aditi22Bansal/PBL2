/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Fragment, useMemo, useState } from "react";
import { Award, ChevronDown, Lock, Search, ShieldAlert, Smile, Unlock } from "lucide-react";
import {
  compatMeta, inputCls, memberNames, occupancyMeta, riskMeta,
  roomBlock, toneBar, toneText,
} from "@/lib/admin";
import { BedMap } from "./panels";

export type RoomExplorerProps = {
  allocations: any[];
  /** overview = compact preview w/ "view all"; manage = lock controls */
  variant?: "overview" | "manage";
  limit?: number;
  viewAllHref?: string;
  selectedId?: string | null;
  onSelect?: (room: any) => void;
  onToggleLock?: (roomId: string, current: boolean) => void;
  manageHref?: string;
};

const RISK_OPTIONS = ["All", "Excellent", "Good", "Needs Attention", "High Risk"];

export default function RoomExplorer({
  allocations, variant = "overview", limit, viewAllHref,
  selectedId, onSelect, onToggleLock, manageHref,
}: RoomExplorerProps) {
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("All");
  const [occupancy, setOccupancy] = useState("All");
  const [block, setBlock] = useState("All");
  const [size, setSize] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  const blocks = useMemo(() => {
    const s = new Set<string>();
    allocations.forEach((a) => s.add(roomBlock(a)));
    return ["All", ...Array.from(s).sort()];
  }, [allocations]);

  const sizes = useMemo(() => {
    const s = new Set<number>();
    allocations.forEach((a) => s.add(a.room_capacity || (a.members || []).length));
    return ["All" as const, ...Array.from(s).sort((x, y) => (x as number) - (y as number))];
  }, [allocations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allocations
      .filter((a) => {
        if (q) {
          const hay = [a.room_number, ...(memberNames(a))].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (risk !== "All" && (a.conflict_analysis?.conflictRisk || "Low") !== risk) return false;
        if (occupancy !== "All" && occupancyMeta(a).status !== occupancy) return false;
        if (block !== "All" && roomBlock(a) !== block) return false;
        if (size !== "All" && (a.room_capacity || (a.members || []).length) !== Number(size)) return false;
        return true;
      })
      .sort((x, y) => (x.compatibility_score || 0) - (y.compatibility_score || 0));
  }, [allocations, search, risk, occupancy, block, size]);

  const shown = limit ? filtered.slice(0, limit) : filtered;

  return (
    <div>
      {/* Filter bar — horizontally scrollable on small screens */}
      <div className="flex gap-2 mb-4 print-hidden overflow-x-auto nice-scroll pb-1" role="search" aria-label="Filter rooms">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <input
            type="text" placeholder="Search room or student…" value={search}
            onChange={(e) => setSearch(e.target.value)} aria-label="Search rooms or students"
            className={`${inputCls} w-full pl-9`}
          />
        </div>
        <select value={block} onChange={(e) => setBlock(e.target.value)} aria-label="Filter by block" className={`${inputCls} shrink-0`}>
          {blocks.map((b) => (<option key={b} value={b}>{b === "All" ? "All blocks" : `Block ${b}`}</option>))}
        </select>
        <select value={size} onChange={(e) => setSize(e.target.value)} aria-label="Filter by room size" className={`${inputCls} shrink-0`}>
          {sizes.map((s) => (<option key={String(s)} value={String(s)}>{s === "All" ? "All sizes" : `${s}-bed`}</option>))}
        </select>
        <select value={occupancy} onChange={(e) => setOccupancy(e.target.value)} aria-label="Filter by occupancy" className={`${inputCls} shrink-0`}>
          {["All", "Full", "Partial", "Empty"].map((o) => (<option key={o} value={o}>{o === "All" ? "All occupancy" : o}</option>))}
        </select>
        <select value={risk} onChange={(e) => setRisk(e.target.value)} aria-label="Filter by compatibility risk" className={`${inputCls} shrink-0`}>
          {RISK_OPTIONS.map((o) => (<option key={o} value={o}>{o === "All" ? "All risk levels" : o}</option>))}
        </select>
      </div>

      {/* Column labels — desktop only */}
      <div className="hidden lg:grid grid-cols-[92px_minmax(130px,170px)_minmax(0,1fr)_110px_130px_64px_28px] gap-x-5 px-5 pb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-stone-400" aria-hidden="true">
        <span>Room</span><span>Details</span><span>Students</span><span>Match</span><span>Status</span><span className="text-right">Beds</span><span />
      </div>

      <div className="bg-white border border-stone-200/90 rounded-2xl overflow-hidden shadow-soft">
        <div className="divide-y divide-stone-100">
          {shown.map((a: any) => {
            const isOpen = expanded === a._id;
            const isSel = selectedId === a._id;
            const analysis = a.conflict_analysis || {};
            const { cap, occ } = occupancyMeta(a);
            const compat = compatMeta(a.compatibility_score);
            const r = riskMeta(analysis.conflictRisk, a.gender_group);
            const names = memberNames(a);
            return (
              <Fragment key={a._id}>
                <div className={isSel ? "bg-teal-50/50" : ""}>
                  <button
                    onClick={() => { setExpanded(isOpen ? null : a._id); onSelect?.(a); }}
                    aria-expanded={isOpen}
                    className="w-full text-left px-4 sm:px-5 py-4 flex flex-col lg:grid lg:grid-cols-[92px_minmax(130px,170px)_minmax(0,1fr)_110px_130px_64px_28px] gap-x-5 gap-y-2.5 hover:bg-stone-50 transition-colors"
                  >
                    <span className="flex items-center gap-3 lg:block">
                      <BedMap capacity={cap} occupied={occ} />
                      <span className="lg:hidden text-[15px] font-bold text-stone-900">{a.room_number}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="hidden lg:block text-[15px] font-bold text-stone-900">{a.room_number}</span>
                      <span className="block text-xs text-stone-500 mt-0.5">
                        Block {roomBlock(a)} · {cap}-bed · {a.gender_group || "—"}
                        {a.isLocked && <span className="ml-1.5 inline-flex items-center gap-1 font-semibold text-stone-500"><Lock className="w-3 h-3" aria-hidden="true" />Locked</span>}
                      </span>
                    </span>
                    <span className="text-[13px] text-stone-600 leading-relaxed min-w-0 lg:truncate xl:whitespace-normal">
                      {names.join(" · ") || "No members yet"}
                    </span>
                    <span>
                      <span className={`text-[15px] font-bold tabular-nums ${toneText[compat.tone]}`}>{compat.label}</span>
                      <span className="block mt-1.5 h-1 rounded-full bg-stone-200 overflow-hidden max-w-[110px]">
                        <span className={`block h-full rounded-full ${toneBar[compat.tone]}`} style={{ width: `${compat.pct}%` }} />
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-stone-600">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${r.dot}`} aria-hidden="true" />{r.label}
                    </span>
                    <span className="text-xs text-stone-500 tabular-nums lg:text-right">{occ}/{cap}</span>
                    <span className="hidden lg:flex items-start justify-end">
                      <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    </span>
                  </button>

                  {variant === "manage" && onToggleLock && (
                    <div className="px-4 sm:px-5 pb-3.5 -mt-1 flex items-center gap-2 print-hidden">
                      <button
                        onClick={() => onToggleLock(a._id, !!a.isLocked)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${a.isLocked ? "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100" : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"}`}
                      >
                        {a.isLocked ? <Lock className="w-3.5 h-3.5" aria-hidden="true" /> : <Unlock className="w-3.5 h-3.5" aria-hidden="true" />}
                        {a.isLocked ? "Locked" : "Unlocked"}
                      </button>
                      <span className="text-[11px] text-stone-400 font-mono truncate select-all">{a._id}</span>
                    </div>
                  )}

                  {isOpen && (
                    <div className="border-t border-stone-100 bg-stone-50/70 px-4 sm:px-5 py-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div>
                          <h4 className="text-xs font-bold text-stone-900 mb-3 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />
                            Conflicts ({analysis.conflictReasons?.length || 0})
                          </h4>
                          {analysis.conflictReasons?.length > 0 ? (
                            <ul className="space-y-2.5">
                              {analysis.conflictReasons.map((reason: any, idx: number) => (
                                <li key={idx} className="text-[13px]">
                                  <span className="font-semibold text-stone-900">{reason.category}</span>
                                  <span className="text-stone-500"> · weight {reason.score}</span>
                                  <p className="text-stone-600 mt-0.5 leading-relaxed">{reason.text}</p>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[13px] text-stone-500 flex items-center gap-2">
                              <Smile className="w-4 h-4" aria-hidden="true" /> No conflicts detected in this room.
                            </p>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-stone-900 mb-3 flex items-center gap-1.5">
                            <Award className="w-3.5 h-3.5 text-teal-800" aria-hidden="true" />
                            Commonalities ({analysis.positiveFactors?.length || 0})
                          </h4>
                          {analysis.positiveFactors?.length > 0 ? (
                            <ul className="space-y-1.5">
                              {analysis.positiveFactors.map((f: string, idx: number) => (
                                <li key={idx} className="text-[13px] text-stone-600 flex items-start gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-teal-800 shrink-0 mt-1.5" aria-hidden="true" />{f}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[13px] text-stone-500">No significant matching indicators found.</p>
                          )}
                          {analysis.recommendations?.length > 0 && (
                            <>
                              <h4 className="text-xs font-bold text-stone-900 mt-5 mb-3">Recommendations</h4>
                              <ul className="space-y-1.5">
                                {analysis.recommendations.map((rec: string, idx: number) => (
                                  <li key={idx} className="text-[13px] text-stone-600 flex items-start gap-2">
                                    <span className="text-teal-800 font-bold shrink-0" aria-hidden="true">✓</span>{rec}
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                        {analysis.roommatePreferences?.length > 0 && (
                          <div className="md:col-span-2 overflow-x-auto nice-scroll">
                            <h4 className="text-xs font-bold text-stone-900 mb-3">Roommate preferences</h4>
                            <table className="w-full text-left text-[13px] whitespace-nowrap">
                              <thead>
                                <tr className="text-[11px] uppercase tracking-wider text-stone-500 border-b border-stone-200">
                                  <th className="py-2 pr-6 font-semibold">Roommate</th>
                                  <th className="py-2 pr-6 font-semibold">Sleep</th>
                                  <th className="py-2 pr-6 font-semibold">Cleanliness</th>
                                  <th className="py-2 pr-6 font-semibold">Study</th>
                                  <th className="py-2 pr-6 font-semibold">Smoking</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100 text-stone-700">
                                {analysis.roommatePreferences.map((pref: any, idx: number) => (
                                  <tr key={idx}>
                                    <td className="py-2 pr-6 font-semibold text-stone-900">{pref.name}</td>
                                    <td className="py-2 pr-6">{pref.sleep_time}</td>
                                    <td className="py-2 pr-6">{pref.cleanliness}</td>
                                    <td className="py-2 pr-6">{pref.study_env}</td>
                                    <td className="py-2 pr-6">{pref.smoking}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-semibold text-stone-900">{allocations.length === 0 ? "No rooms yet" : "No rooms match these filters"}</p>
            <p className="text-[13px] text-stone-500 mt-1">
              {allocations.length === 0 ? "Sync student responses and run allocation in Operations below." : "Try a different search or clear the filters."}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 print-hidden">
        <p className="text-xs text-stone-500">
          {filtered.length} room{filtered.length === 1 ? "" : "s"} · sorted by lowest compatibility · select a row for detail
        </p>
        {viewAllHref && filtered.length > (limit || 0) && (
          <a href={viewAllHref} className="text-[13px] font-semibold text-teal-900 hover:text-teal-950 transition-colors">
            View all {filtered.length} rooms →
          </a>
        )}
        {manageHref && (
          <a href={manageHref} className="text-[13px] font-semibold text-teal-900 hover:text-teal-950 transition-colors">
            Open allocation manager →
          </a>
        )}
      </div>
    </div>
  );
}

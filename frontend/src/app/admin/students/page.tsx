/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { Search } from "lucide-react";
import { PROXY_URL } from "@/lib/api";
import AdminShell from "@/components/admin/AdminShell";
import { Panel, SectionHead } from "@/components/admin/panels";
import { compatMeta, inputCls, riskMeta, roomBlock, toneText } from "@/lib/admin";

type StudentRow = {
  name: string;
  detail: string;
  branch: string;
  room: string;
  block: string;
  compat: number | null;
  risk: string;
  genderGroup: string;
  assigned: boolean;
};

function parseDetail(detail: string, email: string): { name: string; branch: string } {
  const m = String(detail || "").match(/^(.*)\s\(([^)]+)\)\s*$/);
  if (m) return { name: m[1].trim(), branch: m[2].trim() };
  return { name: String(detail || email), branch: "—" };
}

export default function AdminStudents() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [allocations, setAllocations] = useState<any[]>([]);
  const [unassigned, setUnassigned] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [block, setBlock] = useState("All");
  const [state, setState] = useState("All");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated" && session.user?.role !== "admin" && session.user?.role !== "ADMIN") {
      router.push("/unauthorized");
    } else if (status === "authenticated") {
      fetchData();
    }
  }, [status, router, session]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${PROXY_URL}/admin/allocations`);
      setAllocations(res.data.allocations || []);
      setUnassigned(res.data.unassigned || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const rows: StudentRow[] = useMemo(() => {
    const out: StudentRow[] = [];
    allocations.forEach((a: any) => {
      const details: string[] = a.memberDetails || a.members || [];
      const emails: string[] = a.members || [];
      details.forEach((d, i) => {
        const { name, branch } = parseDetail(d, emails[i] || d);
        out.push({
          name, detail: emails[i] || d, branch,
          room: a.room_number, block: roomBlock(a),
          compat: typeof a.compatibility_score === "number" ? a.compatibility_score : null,
          risk: a.conflict_analysis?.conflictRisk || "Low",
          genderGroup: a.gender_group || "—",
          assigned: true,
        });
      });
    });
    unassigned.forEach((u) => {
      const { name, branch } = parseDetail(u, u);
      out.push({ name, detail: u, branch, room: "—", block: "—", compat: null, risk: "Unassigned", genderGroup: "—", assigned: false });
    });
    return out.sort((x, y) => x.name.localeCompare(y.name));
  }, [allocations, unassigned]);

  const blocks = useMemo(() => {
    const s = new Set(rows.filter((r) => r.assigned).map((r) => r.block));
    return ["All", ...Array.from(s).sort()];
  }, [rows]);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q && !`${r.name} ${r.detail} ${r.branch} ${r.room}`.toLowerCase().includes(q)) return false;
    if (block !== "All" && r.block !== block) return false;
    if (state === "Assigned" && !r.assigned) return false;
    if (state === "Unassigned" && r.assigned) return false;
    return true;
  });

  const assigned = rows.filter((r) => r.assigned).length;
  const coverage = rows.length > 0 ? Math.round((assigned / rows.length) * 100) : 0;

  if (status === "loading") return null;

  return (
    <AdminShell>
      <div className="pt-8 pb-6">
        <p className="eyebrow text-teal-800 mb-2">RoomFit Console · Students</p>
        <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight text-stone-900 leading-tight">Students</h1>
        <p className="text-sm text-stone-500 mt-1.5">Every registered student and where they are placed. Sourced from live allocation data.</p>
      </div>

      <section aria-label="Student summary" className="bg-white border border-stone-200/90 rounded-[20px] overflow-hidden shadow-soft">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-stone-200">
          {[
            { label: "Total students", value: String(rows.length), sub: "registered" },
            { label: "Assigned", value: String(assigned), sub: `${coverage}% placement coverage` },
            { label: "Unassigned", value: String(rows.length - assigned), sub: "awaiting allocation" },
            { label: "Rooms occupied", value: String(allocations.length), sub: "with members placed" },
          ].map((s) => (
            <div key={s.label} className="bg-white px-5 sm:px-6 py-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">{s.label}</p>
              <p className="text-[30px] font-bold text-stone-900 leading-none tabular-nums mt-2">{s.value}</p>
              <p className="text-xs text-stone-500 mt-2">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6">
        <SectionHead title="Roster" sub={`${filtered.length} student${filtered.length === 1 ? "" : "s"} · sorted alphabetically`} />
        <div className="flex gap-2 mb-4 overflow-x-auto nice-scroll pb-1" role="search" aria-label="Filter students">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input type="text" placeholder="Search name, email or room…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" className={`${inputCls} w-full pl-9`} />
          </div>
          <select value={block} onChange={(e) => setBlock(e.target.value)} aria-label="Filter by block" className={`${inputCls} shrink-0`}>
            {blocks.map((b) => (<option key={b} value={b}>{b === "All" ? "All blocks" : `Block ${b}`}</option>))}
          </select>
          <select value={state} onChange={(e) => setState(e.target.value)} aria-label="Filter by placement" className={`${inputCls} shrink-0`}>
            {["All", "Assigned", "Unassigned"].map((o) => (<option key={o} value={o}>{o === "All" ? "All students" : o}</option>))}
          </select>
        </div>

        <Panel label="Student roster" className="overflow-hidden">
          {loading ? (
            <p className="px-5 py-14 text-center text-sm text-stone-500">Loading students…</p>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="text-sm font-semibold text-stone-900">No students match these filters</p>
              <p className="text-[13px] text-stone-500 mt-1">Try a different search or clear the filters.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_110px_110px_110px] gap-x-5 px-5 pb-2 pt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-stone-400" aria-hidden="true">
                <span>Student</span><span>Branch</span><span>Room</span><span>Match</span><span>Status</span>
              </div>
              <ul className="divide-y divide-stone-100">
                {filtered.map((r, i) => {
                  const c = r.compat !== null ? compatMeta(r.compat) : null;
                  const rk = r.assigned ? riskMeta(r.risk, r.genderGroup) : { label: "Unassigned", dot: "bg-amber-500", text: "text-amber-700", pill: "" };
                  return (
                    <li key={`${r.detail}-${i}`} className="px-5 py-3.5 grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_110px_110px_110px] gap-x-5 gap-y-1 hover:bg-stone-50 transition-colors">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-stone-900 truncate">{r.name}</span>
                        <span className="block text-xs text-stone-500 truncate mt-0.5">{r.detail}</span>
                      </span>
                      <span className="text-[13px] text-stone-600 truncate">{r.branch}</span>
                      <span className="text-[13px] font-semibold text-stone-900">
                        {r.assigned ? (<Link href="/admin/allocations" className="hover:text-teal-900 hover:underline">{r.room} <span className="font-normal text-stone-400">· {r.block}</span></Link>) : <span className="text-stone-400 font-normal">—</span>}
                      </span>
                      <span className={`text-[13px] font-bold tabular-nums ${c ? toneText[c.tone] : "text-stone-300"}`}>{c ? c.label : "—"}</span>
                      <span className="flex items-center gap-2 text-xs text-stone-600">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${rk.dot}`} aria-hidden="true" />{rk.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { PROXY_URL } from "@/lib/api";
import AdminShell from "@/components/admin/AdminShell";
import { Panel } from "@/components/admin/panels";
import { getCapacityLabel } from "@/lib/admin";

function Bars({ data, accent }: { data: [string, number][]; accent?: (k: string) => string }) {
  const max = Math.max(...data.map(([, v]) => v), 1);
  return (
    <ul className="space-y-2.5">
      {data.map(([k, v]) => (
        <li key={k} className="flex items-center gap-3">
          <span className="text-[13px] text-stone-600 w-28 shrink-0 truncate">{k}</span>
          <span className="flex-1 h-1.5 rounded-full bg-stone-200 overflow-hidden">
            <span className={`block h-full rounded-full ${accent ? accent(k) : "bg-teal-800"}`} style={{ width: `${(v / max) * 100}%` }} />
          </span>
          <span className="text-xs text-stone-600 tabular-nums w-8 text-right">{v}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AdminAnalytics() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated" && session.user?.role !== "admin" && session.user?.role !== "ADMIN") {
      router.push("/unauthorized");
    } else if (status === "authenticated") {
      axios.get(`${PROXY_URL}/admin/analytics`).then((r) => setAnalytics(r.data)).catch(console.error);
    }
  }, [status, router, session]);

  if (status === "loading") return null;

  const q = analytics?.allocationQuality;
  const ov = analytics?.systemOverview;

  return (
    <AdminShell>
      <div className="pt-8 pb-6">
        <p className="eyebrow text-teal-800 mb-2">RoomFit Console · Analytics</p>
        <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight text-stone-900 leading-tight">Analytics</h1>
        <p className="text-sm text-stone-500 mt-1.5">Match quality, distributions and demographics from live allocation data.</p>
      </div>

      {!analytics ? (
        <Panel label="Analytics" className="px-6 py-14 text-center"><p className="text-sm text-stone-500">Loading analytics…</p></Panel>
      ) : (
        <div className="grid grid-cols-12 gap-5 items-start">
          <div className="col-span-12 md:col-span-6 xl:col-span-4 min-w-0">
            <Panel label="Match quality" className="p-5 sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Match quality</p>
              <dl className="mt-2 divide-y divide-stone-100">
                <div className="flex items-baseline justify-between py-2.5">
                  <dt className="text-[13px] text-stone-500">Average compatibility</dt>
                  <dd className="text-sm font-bold text-stone-900 tabular-nums">{q.averageCompatibility}%</dd>
                </div>
                <div className="flex items-baseline justify-between py-2.5">
                  <dt className="text-[13px] text-stone-500">Average room size</dt>
                  <dd className="text-sm font-bold text-stone-900 tabular-nums">{q.averageRoomSize} / room</dd>
                </div>
                <div className="flex items-baseline justify-between py-2.5 gap-3">
                  <dt className="text-[13px] text-stone-500">Strongest match</dt>
                  <dd className="text-sm font-bold text-stone-900 text-right">
                    {q.highestCompatibilityRoom ? <>{q.highestCompatibilityRoom.room_number} · {q.highestCompatibilityRoom.raw_compatibility_score < 0 ? "below average" : `${q.highestCompatibilityRoom.compatibility_score}%`}</> : "—"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between py-2.5 gap-3">
                  <dt className="text-[13px] text-stone-500">Weakest match</dt>
                  <dd className="text-sm font-bold text-stone-900 text-right">
                    {q.lowestCompatibilityRoom ? <>{q.lowestCompatibilityRoom.room_number} · {q.lowestCompatibilityRoom.raw_compatibility_score < 0 ? "below average" : `${q.lowestCompatibilityRoom.compatibility_score}%`}</> : "—"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between py-2.5">
                  <dt className="text-[13px] text-stone-500">Unassigned students</dt>
                  <dd className={`text-sm font-bold tabular-nums ${q.unassignedStudents > 0 ? "text-amber-700" : "text-stone-900"}`}>{q.unassignedStudents}</dd>
                </div>
                <div className="flex items-baseline justify-between py-2.5">
                  <dt className="text-[13px] text-stone-500">Partially filled rooms</dt>
                  <dd className="text-sm font-bold text-stone-900 tabular-nums">{q.flexRooms}</dd>
                </div>
              </dl>
            </Panel>

            <Panel label="Room sizes" className="p-5 sm:p-6 mt-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Room sizes</p>
              <div className="mt-4">
                <Bars
                  data={Object.entries(analytics.roomSizeDistribution).map(([cap, n]: any) => [getCapacityLabel(Number(cap)), n])}
                />
              </div>
              {analytics.conflictAnalysis && (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500 mt-7">Conflict causes</p>
                  <div className="mt-4">
                    <Bars
                      data={Object.entries(analytics.conflictAnalysis.conflictCauses).map(([k, n]: any) => [k, n])}
                      accent={(k) => (k === "Smoking" ? "bg-red-500" : k === "Cleanliness" ? "bg-amber-500" : "bg-teal-800")}
                    />
                  </div>
                </>
              )}
            </Panel>
          </div>

          <div className="col-span-12 md:col-span-6 xl:col-span-4 min-w-0">
            <Panel label="Compatibility spread" className="p-5 sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Compatibility spread</p>
              <p className="text-[13px] text-stone-500 mt-1">Rooms grouped by match score.</p>
              <div className="mt-4">
                <Bars
                  data={Object.entries(analytics.compatibilityAnalytics).map(([k, n]: any) => [`${k}%`, n])}
                  accent={(k) => (k.includes("Below") ? "bg-red-500" : k.includes("80-85") ? "bg-amber-500" : "bg-teal-800")}
                />
              </div>
            </Panel>

            <Panel label="Risk mix" className="p-5 sm:p-6 mt-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Risk mix</p>
              <div className="mt-4">
                {(() => {
                  const ca = analytics.conflictAnalysis?.summary;
                  if (!ca) return <p className="text-[13px] text-stone-500">No conflict analysis available.</p>;
                  const rows: [string, number, string][] = [
                    ["Excellent", ca.excellentCount ?? 0, "bg-teal-800"],
                    ["Good", ca.goodCount ?? 0, "bg-teal-600"],
                    ["Needs attention", ca.needsAttentionCount ?? 0, "bg-amber-500"],
                    ["High risk", ca.highRiskCount ?? 0, "bg-red-600"],
                  ];
                  const max = Math.max(...rows.map(([, v]) => v), 1);
                  return (
                    <ul className="space-y-2.5">
                      {rows.map(([k, v, bar]) => (
                        <li key={k} className="flex items-center gap-3">
                          <span className="text-[13px] text-stone-600 w-28 shrink-0">{k}</span>
                          <span className="flex-1 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                            <span className={`block h-full rounded-full ${bar}`} style={{ width: `${(v / max) * 100}%` }} />
                          </span>
                          <span className="text-xs text-stone-600 tabular-nums w-8 text-right">{v}</span>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            </Panel>
          </div>

          <div className="col-span-12 md:col-span-12 xl:col-span-4 min-w-0">
            <Panel label="Student demographics" className="p-5 sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Students by branch</p>
              <div className="mt-4">
                <Bars data={Object.entries(analytics.studentDemographics.branch).map(([k, n]: any) => [k, n])} />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500 mt-7">By year</p>
              <p className="text-[13px] text-stone-600 mt-3 tabular-nums">
                {["1", "2", "3", "4"].map((yr) => `Year ${yr}: ${analytics.studentDemographics.year[yr] || 0}`).join(" · ")}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500 mt-6">By gender</p>
              <p className="text-[13px] text-stone-600 mt-3 tabular-nums">
                {Object.entries(analytics.studentDemographics.gender).map(([g, n]: any) => `${g}: ${n}`).join(" · ") || "—"}
              </p>
            </Panel>

            <Panel label="Utilization detail" className="p-5 sm:p-6 mt-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Capacity detail</p>
              <dl className="mt-2 divide-y divide-stone-100">
                {[
                  ["Total students", ov.totalStudents],
                  ["Profiles submitted", ov.profilesCompleted],
                  ["Profiles pending", ov.profilesPending],
                  ["Rooms formed", ov.totalRoomsGenerated],
                  ["Total beds", ov.totalBeds],
                  ["Occupied beds", ov.occupiedBeds],
                  ["Empty beds", ov.emptyBeds],
                  ["Hostel utilization", `${ov.hostelUtilization}%`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between py-2.5">
                    <dt className="text-[13px] text-stone-500">{k}</dt>
                    <dd className="text-sm font-bold text-stone-900 tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

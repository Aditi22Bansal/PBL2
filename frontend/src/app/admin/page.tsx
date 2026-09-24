/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { PROXY_URL } from "@/lib/api";
import {
  AlertTriangle, ArrowRight, Download, FileText, Play, Plus, Save, Trash2, Upload, X,
} from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import RoomExplorer from "@/components/admin/RoomExplorer";
import {
  ActivityPanel, AttentionPanel, CompatibilityPanel, HealthStrip,
  OccupancyPanel, Panel, RoomSpotlight, SectionHead,
} from "@/components/admin/panels";
import {
  exportAllocationsCSV, getCapacityLabel, greeting, inputCls,
} from "@/lib/admin";
import { CountUp } from "@/components/premium";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sheetUrl, setSheetUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [analytics, setAnalytics] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [openRequests, setOpenRequests] = useState(0);
  const [message, setMessage] = useState("");
  const [metrics, setMetrics] = useState<any>(null);
  const [spotlight, setSpotlight] = useState<any>(null);

  // Hostel configurations states
  const [configs, setConfigs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formConfigId, setFormConfigId] = useState<string | null>(null);
  const [formHostelName, setFormHostelName] = useState("");
  const [formHostelCode, setFormHostelCode] = useState("");
  const [formGender, setFormGender] = useState<"Male" | "Female" | "Mixed">("Mixed");
  const [formTemplates, setFormTemplates] = useState<Array<{ capacity: number | ""; count: number | ""; floor: string }>>([
    { capacity: 2, count: 20, floor: "Ground" },
    { capacity: 3, count: 40, floor: "1" },
    { capacity: 4, count: 10, floor: "2" }
  ]);
  const [formValidationError, setFormValidationError] = useState("");

  const formTotalRooms = formTemplates.reduce((sum, t) => sum + (typeof t.count === 'number' ? t.count : 0), 0);
  const formTotalBeds = formTemplates.reduce((sum, t) => sum + (typeof t.capacity === 'number' && typeof t.count === 'number' ? t.capacity * t.count : 0), 0);

  useEffect(() => {
    let err = "";
    if (showForm) {
      if (!formHostelName.trim()) {
        err = "Hostel name is required.";
      } else if (formTemplates.length === 0) {
        err = "At least one room type configuration is required.";
      } else {
        for (let i = 0; i < formTemplates.length; i++) {
          const t = formTemplates[i];
          if (t.capacity === "" || t.count === "") {
            err = "All room templates must have capacity and count values.";
            break;
          }
          if (t.capacity <= 0 || t.count <= 0) {
            err = "Capacity and count must be positive numbers.";
            break;
          }
        }
      }
    }
    setFormValidationError(err);
  }, [formTemplates, formHostelName, showForm]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated" && session.user?.role !== "admin" && session.user?.role !== "ADMIN") {
      router.push("/unauthorized");
    } else if (status === "authenticated") {
      fetchAllocations();
      fetchConfigs();
      fetchAnalytics();
      fetchActivity();
      fetchRequests();
    }
  }, [status, router, session]);

  const fetchAllocations = async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/admin/allocations`);
      setAllocations(res.data.allocations || []);
      setUnassignedCount((res.data.unassigned || []).length);
    } catch (error) {
      console.error("Failed to fetch allocations:", error);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/admin/hostel-configurations`);
      setConfigs(res.data);
    } catch (error) {
      console.error("Failed to fetch configurations:", error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/admin/analytics`);
      setAnalytics(res.data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    }
  };

  const fetchActivity = async () => {
    try {
      setActivityLoading(true);
      const res = await axios.get(`${PROXY_URL}/admin/audit-log?limit=8`);
      setActivity(res.data.entries || []);
    } catch (error) {
      console.error("Failed to fetch activity:", error);
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/admin/requests`);
      setOpenRequests((res.data || []).filter((r: any) => r.status === "Pending").length);
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    }
  };

  const handleCreateOrUpdate = async () => {
    if (formValidationError) return;
    try {
      const payload = {
        hostelName: formHostelName,
        hostelCode: formHostelCode,
        gender: formGender,
        roomTemplates: formTemplates.map(t => ({
          capacity: Number(t.capacity),
          count: Number(t.count),
          floor: t.floor.trim() || 'Ground'
        }))
      };

      if (formConfigId) {
        await axios.put(`${PROXY_URL}/admin/hostel-configurations/${formConfigId}`, payload);
      } else {
        await axios.post(`${PROXY_URL}/admin/hostel-configurations`, payload);
      }

      setShowForm(false);
      setFormConfigId(null);
      setFormHostelName("");
      setFormHostelCode("");
      setFormGender("Mixed");
      setFormTemplates([
        { capacity: 2, count: 20, floor: "Ground" },
        { capacity: 3, count: 40, floor: "1" },
        { capacity: 4, count: 10, floor: "2" }
      ]);
      fetchConfigs();
      fetchAnalytics();
      fetchActivity();
    } catch (err: any) {
      console.error(err);
      alert("Error saving configuration: " + (err.response?.data?.message || err.message));
    }
  };

  const handleActivateConfig = async (id: string) => {
    try {
      await axios.patch(`${PROXY_URL}/admin/hostel-configurations/${id}/activate`);
      fetchConfigs();
      fetchAnalytics();
      fetchActivity();
    } catch (err: any) {
      console.error(err);
      alert("Failed to activate: " + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm("Are you sure you want to delete this configuration?")) return;
    try {
      await axios.delete(`${PROXY_URL}/admin/hostel-configurations/${id}`);
      fetchConfigs();
      fetchAnalytics();
      fetchActivity();
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete: " + (err.response?.data?.message || err.message));
    }
  };

  const handleSync = async () => {
    if (!sheetUrl) return;
    setSyncing(true);
    setMessage("");
    try {
      const res = await axios.post(`${PROXY_URL}/admin/sync-csv`, { sheet_url: sheetUrl });
      setMessage(res.data.message);
      fetchAllocations();
      fetchAnalytics();
      fetchActivity();
    } catch (err: any) {
      setMessage("Error: " + (err.response?.data?.details || err.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleAllocate = async () => {
    setAllocating(true);
    setMessage("Running allocation — this can take several minutes for large batches. Please do not refresh.");
    try {
      const res = await axios.post(`${PROXY_URL}/admin/trigger-allocation`, {}, { timeout: 600000 });
      setMessage(res.data.message + ` | Rooms formed: ${res.data.total_rooms}`);
      if (res.data.metrics) setMetrics(res.data.metrics);
      fetchAllocations();
      fetchAnalytics();
      fetchActivity();
    } catch (err: any) {
      const data = err.response?.data;
      let errMsg = data?.error || data?.message || err.message;
      if (data?.capacityShortfall) {
        const cs = data.capacityShortfall;
        errMsg += ` (${cs.total_students} students, ${cs.total_beds} beds — short by ${cs.shortfall})`;
      }
      setMessage("Error: " + errMsg);
    } finally {
      setAllocating(false);
    }
  };

  const handleRepair = async () => {
    setRepairing(true);
    try {
      const res = await axios.post(`${PROXY_URL}/admin/repair-notifications`, {});
      setMessage(res.data.message);
      fetchActivity();
    } catch (err: any) {
      setMessage("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setRepairing(false);
    }
  };

  const exportToPDF = () => {
    window.print();
  };

  if (status === "loading") return null;

  const ov = analytics?.systemOverview;
  const insights = [...(analytics?.insights || [])];
  if (openRequests > 0) {
    insights.push({
      id: "open-requests",
      text: `${openRequests} room change request${openRequests === 1 ? "" : "s"} awaiting review in Requests.`,
      type: "warning",
    });
  }
  const highRiskRooms = allocations.filter(
    (a) => (a.compatibility_score ?? 0) < 0.8 || (a.gender_group || "").includes("FLEX")
  ).length;
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <AdminShell>
      {/* Page head */}
      <div className="flex flex-wrap items-end justify-between gap-4 pt-8 pb-6">
        <div>
          <p className="eyebrow text-teal-800 mb-2">RoomFit Console · Overview</p>
          <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight text-stone-900 leading-tight">
            {greeting()}, {session?.user?.name?.split(" ")[0] || "Administrator"}
          </h1>
          <p className="text-sm text-stone-500 mt-1.5">Here is the current accommodation and allocation overview · {today}.</p>
        </div>
        <div className="flex items-center gap-2.5 print-hidden">
          <button
            onClick={() => exportAllocationsCSV(allocations)}
            disabled={allocations.length === 0}
            className="px-4 py-2 bg-white border border-stone-300 hover:border-stone-500 text-stone-700 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" aria-hidden="true" /> Export CSV
          </button>
          <button
            onClick={exportToPDF}
            disabled={allocations.length === 0}
            className="btn-primary px-4 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" aria-hidden="true" /> PDF report
          </button>
        </div>
      </div>

      {message && (
        <p className="text-[13px] text-stone-700 border-l-2 border-teal-800 pl-3 py-1 mb-5 print-hidden" role="status">
          {message}
        </p>
      )}

      {/* Key metrics — all 8 statistics, one structured band */}
      <section aria-label="Key metrics" className="bg-white border border-stone-200/90 rounded-[20px] overflow-hidden shadow-soft">
        {ov ? (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-px bg-stone-200">
              <div className="bg-white px-5 sm:px-6 py-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Students</p>
                <p className="text-[32px] font-bold text-stone-900 leading-none tabular-nums mt-2"><CountUp value={ov.totalStudents} /></p>
                <p className="text-xs text-stone-500 mt-2">registered across institution</p>
              </div>
              <div className="bg-white px-5 sm:px-6 py-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Rooms formed</p>
                <p className="text-[32px] font-bold text-stone-900 leading-none tabular-nums mt-2"><CountUp value={ov.totalRoomsGenerated} /></p>
                <p className="text-xs text-stone-500 mt-2">
                  {ov.totalRoomsGenerated > 0 ? `~${Math.round(analytics.allocationQuality.averageRoomSize)} students per room` : "no rooms yet"}
                </p>
              </div>
              <div className="bg-white px-5 sm:px-6 py-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Beds occupied</p>
                <p className="text-[32px] font-bold text-stone-900 leading-none tabular-nums mt-2">
                  <CountUp value={ov.occupiedBeds} /><span className="text-stone-400 font-semibold text-[22px]"> / {ov.totalBeds}</span>
                </p>
                <p className="text-xs text-stone-500 mt-2">{ov.emptyBeds} bed{ov.emptyBeds === 1 ? "" : "s"} available</p>
              </div>
              <div className="bg-white px-5 sm:px-6 py-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Occupancy</p>
                <p className="text-[32px] font-bold text-stone-900 leading-none tabular-nums mt-2"><CountUp value={ov.hostelUtilization} suffix="%" /></p>
                <div className="mt-2.5 h-1.5 rounded-full bg-stone-200 overflow-hidden max-w-[220px]" role="img" aria-label={`${ov.hostelUtilization}% occupancy`}>
                  <div className="h-full bg-teal-800 rounded-full" style={{ width: `${Math.min(ov.hostelUtilization, 100)}%` }} />
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-px bg-stone-100 border-t border-stone-200">
              <div className="bg-stone-50/60 px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3">
                <dt className="text-xs text-stone-500 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-800 shrink-0" aria-hidden="true" />Profiles submitted
                </dt>
                <dd className="text-[15px] font-bold text-stone-900 tabular-nums">{ov.profilesCompleted}</dd>
              </div>
              <div className="bg-stone-50/60 px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3">
                <dt className="text-xs text-stone-500 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ov.profilesPending > 0 ? "bg-amber-500" : "bg-teal-800"}`} aria-hidden="true" />Profiles pending
                </dt>
                <dd className={`text-[15px] font-bold tabular-nums ${ov.profilesPending > 0 ? "text-amber-700" : "text-stone-900"}`}>{ov.profilesPending}</dd>
              </div>
              <div className="bg-stone-50/60 px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3">
                <dt className="text-xs text-stone-500 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-800 shrink-0" aria-hidden="true" />Total beds
                </dt>
                <dd className="text-[15px] font-bold text-stone-900 tabular-nums">{ov.totalBeds}</dd>
              </div>
              <div className="bg-stone-50/60 px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3">
                <dt className="text-xs text-stone-500 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ov.emptyBeds > 0 ? "bg-amber-500" : "bg-stone-300"}`} aria-hidden="true" />Empty beds
                </dt>
                <dd className="text-[15px] font-bold text-stone-900 tabular-nums">{ov.emptyBeds}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="px-6 py-10 text-sm text-stone-500">Loading metrics…</p>
        )}
      </section>

      {/* Main dashboard grid */}
      <div className="grid grid-cols-12 gap-5 mt-5 items-start">
        {/* Left — room allocation overview */}
        <div className="col-span-12 xl:col-span-8 min-w-0">
          <SectionHead
            title="Room allocation"
            sub={ov ? `${ov.totalRoomsGenerated} rooms · ${ov.totalStudents} students · ${ov.hostelUtilization}% occupied` : "Review room occupancy, compatibility and allocation health."}
            action={
              <Link href="/admin/allocations" className="text-[13px] font-semibold text-teal-900 hover:text-teal-950 flex items-center gap-1 transition-colors print-hidden">
                Open manager <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            }
          />
          <RoomExplorer
            allocations={allocations}
            variant="overview"
            limit={8}
            viewAllHref="/admin/allocations"
            selectedId={spotlight?._id || null}
            onSelect={setSpotlight}
          />

          {/* Operations */}
          <div className="mt-8 print-hidden">
            <SectionHead title="Operations" sub="Sync responses and run the matching engine." />
            <Panel label="Operations">
              <div className="grid md:grid-cols-2 gap-px bg-stone-100 rounded-2xl overflow-hidden">
                <div className="bg-white p-5 sm:p-6">
                  <h3 className="text-sm font-bold text-stone-900">Sync responses</h3>
                  <p className="text-[13px] text-stone-500 mt-1 mb-4 leading-relaxed">Import questionnaire responses from a viewer-accessible Google Sheet.</p>
                  <input
                    type="text" placeholder="Google Sheet CSV export URL" value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)} aria-label="Google Sheet CSV export URL"
                    className={`${inputCls} w-full mb-2.5`}
                  />
                  <button
                    onClick={handleSync} disabled={syncing || !sheetUrl}
                    className="btn-primary font-semibold text-[13px] px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {syncing ? "Syncing…" : "Sync responses"} <Upload className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="bg-white p-5 sm:p-6">
                  <h3 className="text-sm font-bold text-stone-900">Run allocation</h3>
                  <p className="text-[13px] text-stone-500 mt-1 mb-4 leading-relaxed">Match students into rooms using compatibility, cohort rules, and the active configuration.</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleAllocate} disabled={allocating || repairing || (analytics?.systemOverview.profilesCompleted === 0)}
                      className="btn-primary font-semibold text-[13px] px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                    >
                      {allocating ? "Running…" : "Run allocation"} <Play className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      onClick={handleRepair} disabled={allocating || repairing}
                      title="Collapse stacked allocation notifications so each student sees only their latest room"
                      className="font-semibold text-[13px] px-4 py-2 rounded-lg border border-stone-300 hover:border-stone-500 text-stone-600 transition-colors disabled:opacity-50"
                    >
                      {repairing ? "Cleaning…" : "Clean up notifications"}
                    </button>
                  </div>
                  {metrics && (
                    <dl className="mt-5 divide-y divide-stone-100 border-t border-b border-stone-100">
                      {Object.entries(metrics).map(([model, score]: any) => (
                        <div key={model} className="flex items-baseline justify-between py-2">
                          <dt className="text-[13px] text-stone-500">{model}</dt>
                          <dd className="text-sm font-semibold text-stone-900 tabular-nums">{(score * 100).toFixed(1)}%</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            </Panel>
          </div>

          {/* Room configurations */}
          <div className="mt-8 print-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight text-stone-900">Room configurations</h2>
                <p className="text-[13px] text-stone-500 mt-0.5">Define room inventory used by the allocation engine.</p>
              </div>
              {!showForm && (
                <button
                  onClick={() => {
                    setFormConfigId(null); setFormHostelName(""); setFormHostelCode(""); setFormGender("Mixed");
                    setFormTemplates([
                      { capacity: 2, count: 20, floor: "Ground" },
                      { capacity: 3, count: 40, floor: "1" },
                      { capacity: 4, count: 10, floor: "2" }
                    ]);
                    setShowForm(true);
                  }}
                  className="text-[13px] font-semibold text-teal-900 hover:text-teal-950 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" /> New configuration
                </button>
              )}
            </div>

            {showForm ? (
              <Panel label="Configuration form" className="overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
                  <h3 className="text-sm font-bold text-stone-900">{formConfigId ? "Edit configuration" : "New configuration"}</h3>
                  <button
                    onClick={() => { setShowForm(false); setFormConfigId(null); }} aria-label="Close form"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-500 hover:bg-stone-100 transition-colors"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="p-5 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">Hostel name</label>
                      <input type="text" placeholder="e.g. Boys Hostel 1" value={formHostelName} onChange={(e) => setFormHostelName(e.target.value)} className={`${inputCls} w-full`} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">Hostel code</label>
                      <input type="text" placeholder="e.g. BH1" value={formHostelCode} onChange={(e) => setFormHostelCode(e.target.value)} className={`${inputCls} w-full`} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">Gender</label>
                      <select value={formGender} onChange={(e) => setFormGender(e.target.value as any)} className={`${inputCls} w-full`}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Mixed">Mixed</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between mb-3">
                      <h4 className="text-xs font-bold text-stone-900">Room types</h4>
                      <p className="text-xs text-stone-500 tabular-nums">{formTotalRooms} rooms · {formTotalBeds} beds</p>
                    </div>
                    <div className="border border-stone-200 rounded-xl overflow-hidden overflow-x-auto nice-scroll">
                      <table className="w-full text-left text-[13px] min-w-[520px]">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wider text-stone-500 border-b border-stone-200 bg-stone-50">
                            <th className="px-4 py-2.5 font-semibold">Beds per room</th>
                            <th className="px-4 py-2.5 font-semibold">Room count</th>
                            <th className="px-4 py-2.5 font-semibold">Floor</th>
                            <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {formTemplates.map((t, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2">
                                <input type="number" aria-label="Beds per room" value={t.capacity}
                                  onChange={(e) => { const val = e.target.value === "" ? "" : Number(e.target.value); const u = [...formTemplates]; u[idx].capacity = val; setFormTemplates(u); }}
                                  className={`${inputCls} w-24`} />
                              </td>
                              <td className="px-4 py-2">
                                <input type="number" aria-label="Room count" value={t.count}
                                  onChange={(e) => { const val = e.target.value === "" ? "" : Number(e.target.value); const u = [...formTemplates]; u[idx].count = val; setFormTemplates(u); }}
                                  className={`${inputCls} w-24`} />
                              </td>
                              <td className="px-4 py-2">
                                <input type="text" aria-label="Floor" placeholder="Ground" value={t.floor}
                                  onChange={(e) => { const u = [...formTemplates]; u[idx].floor = e.target.value; setFormTemplates(u); }}
                                  className={`${inputCls} w-28`} />
                              </td>
                              <td className="px-4 py-2 text-right">
                                <button onClick={() => setFormTemplates(formTemplates.filter((_, i) => i !== idx))} className="text-[13px] font-medium text-red-700 hover:text-red-900">Remove</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button onClick={() => setFormTemplates([...formTemplates, { capacity: "", count: "", floor: "" }])} className="mt-3 text-[13px] font-semibold text-teal-900 hover:text-teal-950 flex items-center gap-1.5">
                      <Plus className="w-4 h-4" aria-hidden="true" /> Add room type
                    </button>
                  </div>
                  {formValidationError && (
                    <p className="text-[13px] text-red-700 flex items-center gap-2" role="alert">
                      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" /> {formValidationError}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-stone-200 bg-stone-50">
                  <button onClick={() => { setShowForm(false); setFormConfigId(null); }} className="px-4 py-2 border border-stone-300 hover:border-stone-500 rounded-lg text-[13px] font-semibold text-stone-700 transition-colors">Cancel</button>
                  <button onClick={handleCreateOrUpdate} disabled={!!formValidationError} className="btn-primary px-4 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2 disabled:opacity-50">
                    <Save className="w-4 h-4" aria-hidden="true" /> Save configuration
                  </button>
                </div>
              </Panel>
            ) : (
              <Panel label="Room configurations" className="overflow-hidden">
                {configs.length === 0 ? (
                  <p className="px-5 py-10 text-center text-[13px] text-stone-500">No configurations yet. Create one to define room inventory.</p>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {configs.map((c) => (
                      <li key={c._id} className={`px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2 ${c.isActive ? "bg-teal-50/40" : ""}`}>
                        <span className="min-w-[180px] flex-1">
                          <span className="block text-sm font-semibold text-stone-900">
                            {c.hostelName}
                            {c.hostelCode && <span className="text-stone-400 font-normal"> · {c.hostelCode}</span>}
                          </span>
                          <span className="block text-xs text-stone-500 mt-0.5">
                            {c.gender} · {c.roomTemplates.map((t: any) => `${t.count}× ${getCapacityLabel(t.capacity)} (floor ${t.floor || "Ground"})`).join(", ")}
                          </span>
                        </span>
                        <span className="text-[13px] text-stone-600 tabular-nums">
                          {c.roomTemplates.reduce((sum: number, t: any) => sum + (t.capacity * t.count), 0)} beds
                        </span>
                        {c.isActive && <span className="text-xs font-bold text-teal-900">Active</span>}
                        <span className="ml-auto flex items-center gap-4">
                          {!c.isActive && (
                            <button onClick={() => handleActivateConfig(c._id)} className="text-[13px] font-semibold text-teal-900 hover:text-teal-950">Activate</button>
                          )}
                          <button
                            onClick={() => {
                              setFormConfigId(c._id); setFormHostelName(c.hostelName); setFormHostelCode(c.hostelCode || "");
                              setFormGender(c.gender); setFormTemplates(c.roomTemplates.map((t: any) => ({ capacity: t.capacity, count: t.count, floor: t.floor || '' })));
                              setShowForm(true);
                            }}
                            className="text-[13px] font-medium text-stone-500 hover:text-stone-900"
                          >
                            Edit
                          </button>
                          <button onClick={() => handleDeleteConfig(c._id)} aria-label={`Delete ${c.hostelName}`} className="text-stone-400 hover:text-red-700 transition-colors">
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
          </div>
        </div>

        {/* Right rail — allocation health */}
        <aside className="col-span-12 xl:col-span-4 min-w-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-5 content-start" aria-label="Allocation health">
          {ov && (
            <div className="md:col-span-2 xl:col-span-1">
              <HealthStrip
                unassigned={unassignedCount}
                emptyBeds={ov.emptyBeds}
                highRisk={highRiskRooms}
                pending={ov.profilesPending}
              />
            </div>
          )}
          <RoomSpotlight room={spotlight} onClose={spotlight ? () => setSpotlight(null) : undefined} />
          {ov && (
            <OccupancyPanel totalBeds={ov.totalBeds} occupiedBeds={ov.occupiedBeds} totalRooms={ov.totalRoomsGenerated} />
          )}
          <CompatibilityPanel allocations={allocations} />
          <AttentionPanel insights={insights} />
          <ActivityPanel entries={activity} loading={activityLoading} />
          <button onClick={() => signOut({ callbackUrl: "/" })} className="w-full text-center text-xs text-stone-400 hover:text-stone-600 transition-colors print-hidden md:col-span-2 xl:col-span-1">
            Sign out of console
          </button>
        </aside>
      </div>
    </AdminShell>
  );
}

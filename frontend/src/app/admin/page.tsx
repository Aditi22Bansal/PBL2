"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, Fragment } from "react";
import axios from "axios";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import {
  LogOut, Home, Play, Upload, CheckCircle2, Database,
  Trash2, Plus, AlertTriangle, Download, FileText, Search, Filter, Sparkles,
  ChevronDown, ChevronUp, User, ShieldAlert, Award, Smile, HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sheetUrl, setSheetUrl] = useState("https://docs.google.com/spreadsheets/d/e/2PACX-1vTzPOiW7s1jbwfQlBcKpIuEDCmFqsI3uWZUNr3shrXuRlpsd6N_Jgdb34O3_pzgG_xCxn4cIBKbaNDr/pubhtml");
  const [syncing, setSyncing] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [metrics, setMetrics] = useState<any>(null);

  // Search & Filter state for Room Report
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [occupancyFilter, setOccupancyFilter] = useState("All");
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);

  // Hostel Configurations states
  const [configs, setConfigs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formConfigId, setFormConfigId] = useState<string | null>(null);
  const [formHostelName, setFormHostelName] = useState("");
  const [formHostelCode, setFormHostelCode] = useState("");
  const [formGender, setFormGender] = useState<"Male" | "Female" | "Mixed">("Mixed");
  const [formTemplates, setFormTemplates] = useState<Array<{ capacity: number | ""; count: number | "" }>>([
    { capacity: 2, count: 20 },
    { capacity: 3, count: 40 },
    { capacity: 4, count: 10 }
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
    }
  }, [status, router, session]);

  const fetchAllocations = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/allocations`);
      setAllocations(res.data.allocations || []);
    } catch (error) {
      console.error("Failed to fetch allocations:", error);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/hostel-configurations`);
      setConfigs(res.data);
    } catch (error) {
      console.error("Failed to fetch configurations:", error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/analytics`);
      setAnalytics(res.data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
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
          count: Number(t.count)
        }))
      };

      if (formConfigId) {
        await axios.put(`${API_URL}/api/admin/hostel-configurations/${formConfigId}`, payload);
      } else {
        await axios.post(`${API_URL}/api/admin/hostel-configurations`, payload);
      }

      setShowForm(false);
      setFormConfigId(null);
      setFormHostelName("");
      setFormHostelCode("");
      setFormGender("Mixed");
      setFormTemplates([
        { capacity: 2, count: 20 },
        { capacity: 3, count: 40 },
        { capacity: 4, count: 10 }
      ]);
      fetchConfigs();
      fetchAnalytics();
    } catch (err: any) {
      console.error(err);
      alert("Error saving configuration: " + (err.response?.data?.message || err.message));
    }
  };

  const handleActivateConfig = async (id: string) => {
    try {
      await axios.patch(`${API_URL}/api/admin/hostel-configurations/${id}/activate`);
      fetchConfigs();
      fetchAnalytics();
    } catch (err: any) {
      console.error(err);
      alert("Failed to activate: " + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm("Are you sure you want to delete this configuration?")) return;
    try {
      await axios.delete(`${API_URL}/api/admin/hostel-configurations/${id}`);
      fetchConfigs();
      fetchAnalytics();
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
      const res = await axios.post(`${API_URL}/api/admin/sync-csv`, { sheet_url: sheetUrl });
      setMessage(res.data.message);
      fetchAllocations();
      fetchAnalytics();
    } catch (err: any) {
      setMessage("Error: " + (err.response?.data?.details || err.message));
    } finally {
      setSyncing(false);
    }
  };

  const handleAllocate = async () => {
    setAllocating(true);
    setMessage("Running Similarity Matrix & Clustering... Please wait.");
    try {
      const res = await axios.post(`${API_URL}/api/admin/trigger-allocation`);
      setMessage(res.data.message + ` | Rooms Formed: ${res.data.total_rooms}`);
      if(res.data.metrics) setMetrics(res.data.metrics);
      fetchAllocations();
      fetchAnalytics();
    } catch (err: any) {
      setMessage("Error: " + (err.response?.data?.message || err.message));
    } finally {
      setAllocating(false);
    }
  };

  const exportToCSV = () => {
    if (!allocations || allocations.length === 0) return;
    const headers = ["Room Number", "Gender Group", "Compatibility %", "Capacity", "Occupancy Status", "Risk", "Conflict Reasons", "Members"];
    const rows = allocations.map((a: any) => [
      a.room_number,
      a.gender_group || "N/A",
      `${Math.round((a.compatibility_score || 0) * 100)}%`,
      a.room_capacity || (a.members || []).length,
      a.occupancy_status || "Full",
      a.conflict_analysis?.conflictRisk || "Low",
      (a.conflict_analysis?.conflictReasons || []).map((r: any) => r.text).join("; ") || "None",
      (a.members || []).join("; ")
    ]);
    const csvContent = [headers, ...rows].map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `RoomSync_Allotments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    window.print();
  };

  const getCapacityLabel = (capacity: number) => {
    switch (capacity) {
      case 1: return "Single";
      case 2: return "Double";
      case 3: return "Triple";
      case 4: return "Quad";
      default: return `${capacity}-Bed`;
    }
  };

  if (status === "loading") return null;

  // Filter and sort allocations for Room Report
  // Default Sort: Lowest compatibility first
  const filteredAllocations = allocations
    .filter((a: any) => {
      const matchQuery = 
        a.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.members || []).some((m: string) => m.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.memberDetails && a.memberDetails.some((d: string) => d.toLowerCase().includes(searchQuery.toLowerCase())));
      
      const matchRisk = riskFilter === "All" || (a.conflict_analysis?.conflictRisk === riskFilter);
      const matchOccupancy = occupancyFilter === "All" || a.occupancy_status === occupancyFilter;

      return matchQuery && matchRisk && matchOccupancy;
    })
    .sort((x: any, y: any) => (x.compatibility_score || 0) - (y.compatibility_score || 0));

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          nav, .print-hidden, button, input, select, .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .print-card {
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            margin-bottom: 24px !important;
            page-break-inside: avoid !important;
          }
          .print-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 24px !important;
          }
          .print-full {
            grid-column: span 2 !important;
          }
        }
      `}} />

      {/* Decorative Blur Circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-100/40 blur-[120px] pointer-events-none print-hidden" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-violet-100/40 blur-[120px] pointer-events-none print-hidden" />

      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-slate-200/80 px-8 py-5 flex items-center justify-between shadow-sm print-hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-150">
            <Home className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-800 tracking-tight text-lg">RoomSync Console</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Admin Management portal</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Link
              href="/admin/allocations"
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all"
            >
              <Database className="w-4 h-4" /> Allocations
            </Link>
            <Link
              href="/admin/requests"
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all"
            >
              <HelpCircle className="w-4 h-4" /> Requests
            </Link>
          </div>

          <div className="bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            Administrator Mode
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-5 rounded-xl text-xs transition-all shadow-sm"
          >
            Sign Out <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Main Admin Console */}
      <main className="w-full px-8 md:px-16 py-10 relative z-10 space-y-8">
        
        {/* Banner Title & Exports */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Explainable Room Allocations & Analytics</h1>
            <p className="text-slate-500 text-sm mt-1">Audit roommate compatibility, resolve conflicts pairwise, and monitor capacity.</p>
          </div>
          <div className="flex items-center gap-3 print-hidden">
            <button 
              onClick={exportToCSV}
              disabled={allocations.length === 0}
              className="px-4 py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-slate-500" /> Export CSV
            </button>
            <button 
              onClick={exportToPDF}
              disabled={allocations.length === 0}
              className="px-4 py-3 bg-violet-600 text-white hover:bg-violet-700 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-violet-100 transition-all disabled:opacity-50"
            >
              <FileText className="w-4 h-4" /> PDF Report
            </button>
          </div>
        </div>

        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50 border border-emerald-250/20 p-4 rounded-xl flex items-center gap-3 text-sm shadow-sm print-hidden"
          >
            <CheckCircle2 className="text-emerald-600 w-5 h-5 flex-shrink-0" />
            <span className="text-emerald-800 font-semibold">{message}</span>
          </motion.div>
        )}

        {/* SECTION 1: System Overview Metrics */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 print-grid">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px] print-card">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Students</span>
              <span className="text-3xl font-black text-slate-800 mt-2">{analytics.systemOverview.totalStudents}</span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px] print-card">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Profiles Submitted</span>
              <span className="text-3xl font-black text-emerald-600 mt-2">{analytics.systemOverview.profilesCompleted}</span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px] print-card">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Profiles Pending</span>
              <span className="text-3xl font-black text-amber-500 mt-2">{analytics.systemOverview.profilesPending}</span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px] print-card">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Rooms Formed</span>
              <span className="text-3xl font-black text-blue-600 mt-2">{analytics.systemOverview.totalRoomsGenerated}</span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px] print-card">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Beds Inventory</span>
              <span className="text-3xl font-black text-slate-800 mt-2">{analytics.systemOverview.totalBeds}</span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px] print-card">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Occupied Beds</span>
              <span className="text-3xl font-black text-blue-600 mt-2">{analytics.systemOverview.occupiedBeds}</span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px] print-card">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Empty Beds</span>
              <span className="text-3xl font-black text-indigo-600 mt-2">{analytics.systemOverview.emptyBeds}</span>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[110px] print-card">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Hostel Utilization</span>
              <span className="text-3xl font-black text-violet-600 mt-2">{analytics.systemOverview.hostelUtilization}%</span>
            </div>
          </div>
        )}

        {/* SECTION 8: Dynamic AI Insights & Alerts Banner */}
        {analytics && analytics.insights && analytics.insights.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm print-card"
          >
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600 animate-pulse" /> AI System Insights & Explanations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analytics.insights.map((insight: any, idx: number) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-2xl border flex gap-3 text-xs leading-relaxed font-semibold ${
                    insight.type === 'danger' ? 'bg-red-50/50 border-red-150 text-red-800' :
                    insight.type === 'warning' ? 'bg-amber-50/50 border-amber-200 text-amber-800' :
                    insight.type === 'success' ? 'bg-emerald-50/50 border-emerald-250/20 text-emerald-800' :
                    'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                    insight.type === 'danger' ? 'text-red-600' :
                    insight.type === 'warning' ? 'text-amber-500' :
                    insight.type === 'success' ? 'text-emerald-600' :
                    'text-slate-400'
                  }`} />
                  <span>{insight.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* SECTION: Conflict Analysis Risk Breakdown (New Section!) */}
        {analytics && analytics.conflictAnalysis && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print-grid">
            {/* Risk Levels Summary */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm print-card col-span-1">
              <h3 className="font-extrabold text-slate-800 text-md border-b border-slate-100 pb-3 mb-4">Conflict Risk Assessment</h3>
              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-xs font-bold p-3 bg-red-50 border border-red-100 rounded-2xl text-red-700">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    <span>High Risk Rooms</span>
                  </div>
                  <span className="text-lg font-black">{analytics.conflictAnalysis.summary.highRiskCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold p-3 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Needs Attention</span>
                  </div>
                  <span className="text-lg font-black">{analytics.conflictAnalysis.summary.needsAttentionCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Good Rooms</span>
                  </div>
                  <span className="text-lg font-black">{analytics.conflictAnalysis.summary.goodCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold p-3 bg-violet-50 border border-violet-100 rounded-2xl text-violet-700">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    <span>Excellent Match</span>
                  </div>
                  <span className="text-lg font-black">{analytics.conflictAnalysis.summary.excellentCount}</span>
                </div>
              </div>
            </div>

            {/* Top Conflict Causes SVG Chart (Section 5 & 6) */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm print-card col-span-2">
              <h3 className="font-extrabold text-slate-800 text-md border-b border-slate-100 pb-3 mb-4">Common Conflict Categories</h3>
              <div className="space-y-4">
                {Object.entries(analytics.conflictAnalysis.conflictCauses).map(([cause, count]: any) => {
                  const maxCount = Math.max(...Object.values(analytics.conflictAnalysis.conflictCauses) as number[], 1);
                  const pct = Math.round((count / maxCount) * 100);
                  
                  return (
                    <div key={cause} className="text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-600">
                        <span>{cause}</span>
                        <span className="text-slate-800 font-extrabold">{count} Room(s) ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5 }}
                          className={`h-full rounded-full ${
                            cause === 'Smoking' ? 'bg-red-500' :
                            cause === 'Sleep Schedule' ? 'bg-violet-600' :
                            cause === 'Cleanliness' ? 'bg-amber-500' :
                            'bg-blue-500'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2 & 3: Allocation Quality & Utilization Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print-grid">
            
            {/* Allocation Quality (Section 2) */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm print-card">
              <h3 className="font-extrabold text-slate-800 text-md border-b border-slate-100 pb-3 mb-4">Allocation Match Quality</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                  <div className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">Avg Compatibility</div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">{analytics.allocationQuality.averageCompatibility}%</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                  <div className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">Average Room Size</div>
                  <div className="text-2xl font-black text-slate-800 mt-1">{analytics.allocationQuality.averageRoomSize} Stud/Rm</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                  <div className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">Highest Room Match</div>
                  <div className="text-md font-bold text-slate-800 mt-1.5">
                    {analytics.allocationQuality.highestCompatibilityRoom ? (
                      <>
                        <span className="text-blue-600">{analytics.allocationQuality.highestCompatibilityRoom.room_number}</span> 
                        <span className="text-xs text-slate-400 font-medium ml-1">({analytics.allocationQuality.highestCompatibilityRoom.compatibility_score}%)</span>
                      </>
                    ) : "N/A"}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                  <div className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">Lowest Room Match</div>
                  <div className="text-md font-bold text-slate-800 mt-1.5">
                    {analytics.allocationQuality.lowestCompatibilityRoom ? (
                      <>
                        <span className="text-red-500">{analytics.allocationQuality.lowestCompatibilityRoom.room_number}</span> 
                        <span className="text-xs text-slate-400 font-medium ml-1">({analytics.allocationQuality.lowestCompatibilityRoom.compatibility_score}%)</span>
                      </>
                    ) : "N/A"}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                  <div className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">Unassigned Students</div>
                  <div className={`text-2xl font-black mt-1 ${analytics.allocationQuality.unassignedStudents > 0 ? 'text-amber-500' : 'text-slate-800'}`}>
                    {analytics.allocationQuality.unassignedStudents}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                  <div className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">Flex Rooms Formed</div>
                  <div className="text-2xl font-black text-slate-800 mt-1">{analytics.allocationQuality.flexRooms}</div>
                </div>
              </div>
            </div>

            {/* Hostel Utilization (Section 3) */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between print-card">
              <div>
                <h3 className="font-extrabold text-slate-800 text-md border-b border-slate-100 pb-3 mb-4">Hostel Bed Utilization</h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                    <div className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">Beds Occupied</div>
                    <div className="text-2xl font-black text-slate-800 mt-1">{analytics.systemOverview.occupiedBeds} Beds</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                    <div className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">Beds Remaining</div>
                    <div className="text-2xl font-black text-slate-800 mt-1">{analytics.systemOverview.emptyBeds} Beds</div>
                  </div>
                </div>
              </div>

              {/* Progress bar container */}
              <div className="space-y-2 mt-auto">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Overall Capacity Progress</span>
                  <span>{analytics.systemOverview.hostelUtilization}%</span>
                </div>
                <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden border border-slate-200">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${analytics.systemOverview.hostelUtilization}%` }}
                    transition={{ duration: 0.8 }}
                    className="bg-gradient-to-r from-violet-500 to-indigo-600 h-full rounded-full"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase mt-1">
                  <span>0 Assigned</span>
                  <span>{analytics.systemOverview.totalBeds} Max Beds</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4, 5 & 6: Charts & Distributions */}
        {analytics && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print-grid">
            
            {/* Compatibility Analytics Histogram (Section 4) */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm print-card">
              <h3 className="font-extrabold text-slate-800 text-md border-b border-slate-100 pb-3 mb-6">Compatibility Distribution</h3>
              
              <div className="h-[180px] flex items-end justify-between gap-2 px-2 relative border-b border-slate-200 pb-2">
                {Object.entries(analytics.compatibilityAnalytics).map(([bucket, count]: any) => {
                  const maxCount = Math.max(...(Object.values(analytics.compatibilityAnalytics) as number[]), 1);
                  const heightPct = (count / maxCount) * 100;
                  return (
                    <div key={bucket} className="flex-1 flex flex-col items-center gap-2 group relative">
                      {/* Tooltip */}
                      <div className="absolute top-[-30px] bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold pointer-events-none">
                        {count} Room(s)
                      </div>
                      
                      <div className="w-full bg-slate-50 hover:bg-slate-100 rounded-lg h-[140px] flex items-end overflow-hidden">
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPct}%` }}
                          transition={{ duration: 0.5 }}
                          className={`w-full rounded-t-md ${
                            bucket.includes('Below') ? 'bg-gradient-to-t from-red-500 to-red-400' :
                            bucket.includes('80-85') ? 'bg-gradient-to-t from-amber-500 to-amber-400' :
                            'bg-gradient-to-t from-violet-600 to-indigo-500'
                          }`}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-extrabold text-center truncate w-full">{bucket}</span>
                    </div>
                  );
                })}
              </div>
              <div className="text-center text-[10px] text-slate-400 font-bold uppercase mt-4">Room Compatibility Buckets (%)</div>
            </div>

            {/* Room Size Distribution Doughnut (Section 5) */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between print-card">
              <div>
                <h3 className="font-extrabold text-slate-800 text-md border-b border-slate-100 pb-3 mb-4">Room Size Breakdown</h3>
              </div>
              
              <div className="flex items-center justify-center relative py-4">
                <svg viewBox="0 0 100 100" className="w-36 h-36">
                  {Object.entries(analytics.roomSizeDistribution).map(([capStr, count]: any, idx) => {
                    const cap = Number(capStr);
                    const totalRooms = analytics.systemOverview.totalRoomsGenerated || 1;
                    const pct = (count / totalRooms) * 100;
                    const radius = 40 - (idx * 9);
                    const circ = 2 * Math.PI * radius;
                    const strokeDash = (pct / 100) * circ;

                    // Color palette
                    const colors = [
                      "#7c3aed", // double: violet-600
                      "#3b82f6", // triple: blue-500
                      "#10b981", // quad: emerald-500
                      "#f59e0b"  // other
                    ];
                    const color = colors[idx] || "#64748b";

                    return (
                      <g key={cap}>
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="transparent"
                          stroke="#f1f5f9"
                          strokeWidth="6"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="transparent"
                          stroke={color}
                          strokeWidth="6"
                          strokeDasharray={`${strokeDash} ${circ}`}
                          strokeLinecap="round"
                          transform="rotate(-90 50 50)"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Legends */}
              <div className="grid grid-cols-3 gap-2 mt-4 text-[10px] font-bold text-slate-500 border-t border-slate-100 pt-4">
                {Object.entries(analytics.roomSizeDistribution).map(([capStr, count]: any, idx) => {
                  const cap = Number(capStr);
                  const colors = ["bg-violet-600", "bg-blue-500", "bg-emerald-500", "bg-amber-500"];
                  const colorClass = colors[idx] || "bg-slate-500";
                  return (
                    <div key={cap} className="flex flex-col items-center">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`w-2 h-2 rounded-full ${colorClass}`} />
                        <span>{getCapacityLabel(cap)}</span>
                      </div>
                      <span className="text-slate-800 text-xs font-black">{count} Rms</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Student Demographics (Section 6) */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm print-card">
              <h3 className="font-extrabold text-slate-800 text-md border-b border-slate-100 pb-3 mb-4">Student Demographics</h3>
              
              <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                {/* Branch breakdown */}
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Branch Distribution</span>
                  {Object.entries(analytics.studentDemographics.branch).slice(0, 3).map(([branch, count]: any) => {
                    const totalComp = analytics.systemOverview.profilesCompleted || 1;
                    const pct = Math.round((count / totalComp) * 100);
                    return (
                      <div key={branch} className="text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-600">
                          <span>{branch}</span>
                          <span>{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div style={{ width: `${pct}%` }} className="bg-violet-600 h-full rounded-full" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Year breakdown */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Year of Study</span>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
                    {["1", "2", "3", "4"].map((yr) => {
                      const count = analytics.studentDemographics.year[yr] || 0;
                      const totalComp = analytics.systemOverview.profilesCompleted || 1;
                      const pct = Math.round((count / totalComp) * 100);
                      return (
                        <div key={yr} className="bg-slate-50 border border-slate-100 p-1.5 rounded-xl">
                          <span className="text-[10px] text-slate-400 block">Yr {yr}</span>
                          <span className="text-slate-800 font-extrabold">{count} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Sync Controls & Allocation triggering */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print-hidden">
          {/* Sync Card */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-700">
               <Database className="w-32 h-32 text-blue-900" />
            </div>
            
            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
               Google Sheet Synchronization
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed mt-2">
              Import room preferences directly from student compatibility response logs. Links must be set as viewer-accessible.
            </p>

            <div className="mt-8 space-y-4">
              <input
                type="text"
                placeholder="Google Sheet CSV Export URL..."
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-3.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
              />
              <button
                onClick={handleSync}
                disabled={syncing || !sheetUrl}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-150 disabled:opacity-50"
              >
                {syncing ? "Synchronizing database..." : "Synchronize Google Sheet responses"} <Upload className="w-4 h-4" />
              </button>
            </div>
          </motion.div>

          {/* Allocation Process Card */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-700">
               <Play className="w-32 h-32 text-violet-900" />
            </div>

            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
               Trigger AI Room Allocation
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed mt-2">
              Execute greedy heuristics room solver using compatibility matrices, branch cohorts, and active room configuration limits.
            </p>

            <div className="mt-8 pt-4">
              <button
                onClick={handleAllocate}
                disabled={allocating || (analytics?.systemOverview.profilesCompleted === 0)}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-4 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-violet-100 disabled:opacity-50"
              >
                {allocating ? "Running matching solver..." : "Trigger compatibility solver run"} <Play className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Model Metrics Benchmarks */}
        {metrics && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl relative border border-slate-200 shadow-sm print-card"
          >
            <h2 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
               Model Benchmark Performance
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(metrics).map(([model, score]: any) => (
                 <div key={model} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                    <div className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider">{model}</div>
                    <div className={`text-2xl font-black ${model.includes('Hybrid') ? 'text-violet-600' : 'text-slate-800'}`}>
                        {(score * 100).toFixed(1)}%
                    </div>
                 </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Hostel Configuration Inventory */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm print-hidden"
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-100 pb-5 mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Hostel Configurations</h2>
              <p className="text-slate-500 text-xs mt-1">Manage active room capacities, inventories, and gender categories.</p>
            </div>
            {!showForm && (
              <button 
                onClick={() => {
                  setFormConfigId(null);
                  setFormHostelName("");
                  setFormHostelCode("");
                  setFormGender("Mixed");
                  setFormTemplates([
                    { capacity: 2, count: 20 },
                    { capacity: 3, count: 40 },
                    { capacity: 4, count: 10 }
                  ]);
                  setShowForm(true);
                }}
                className="px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-violet-100"
              >
                <Plus className="w-4 h-4" /> Create Configuration
              </button>
            )}
          </div>

          {showForm ? (
            /* Create/Edit Form */
            <div className="space-y-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-150">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hostel Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. boys hostel 1"
                    value={formHostelName}
                    onChange={(e) => setFormHostelName(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-slate-400"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hostel Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. bh1"
                    value={formHostelCode}
                    onChange={(e) => setFormHostelCode(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-slate-400"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Gender Classification</label>
                  <select 
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as any)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Mixed">Mixed</option>
                  </select>
                </div>
              </div>

              {/* Room templates table */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">Room Capacity Layout Templates</label>
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4">Room Bed Capacity</th>
                        <th className="px-6 py-4">Number of Rooms Available</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formTemplates.map((t, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-3">
                            <input 
                              type="number" 
                              placeholder="e.g. 3 (triple)"
                              value={t.capacity}
                              onChange={(e) => {
                                const val = e.target.value === "" ? "" : Number(e.target.value);
                                const updated = [...formTemplates];
                                updated[idx].capacity = val;
                                setFormTemplates(updated);
                              }}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <input 
                              type="number" 
                              placeholder="e.g. 10 (rooms count)"
                              value={t.count}
                              onChange={(e) => {
                                const val = e.target.value === "" ? "" : Number(e.target.value);
                                const updated = [...formTemplates];
                                updated[idx].count = val;
                                setFormTemplates(updated);
                              }}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                            />
                          </td>
                          <td className="px-6 py-3 text-right">
                            <button 
                              onClick={() => {
                                const updated = formTemplates.filter((_, i) => i !== idx);
                                setFormTemplates(updated);
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-xl transition-all inline-flex items-center gap-1 border border-transparent font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <button 
                  onClick={() => setFormTemplates([...formTemplates, { capacity: "", count: "" }])}
                  className="px-4 py-2.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 self-start"
                >
                  <Plus className="w-4 h-4 text-slate-500" />
                  Add Room Type
                </button>
                
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-6 text-xs font-bold text-slate-500 shadow-sm">
                  <div>Total Rooms: <span className="text-violet-600 font-black">{formTotalRooms}</span></div>
                  <div className="border-l border-slate-200 pl-6">Total Beds: <span className="text-violet-600 font-black">{formTotalBeds}</span></div>
                </div>
              </div>

              {formValidationError && (
                <div className="text-red-600 text-xs font-semibold bg-red-50 border border-red-200 p-3 rounded-2xl">
                  ⚠️ {formValidationError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                <button 
                  onClick={() => {
                    setShowForm(false);
                    setFormConfigId(null);
                  }}
                  className="px-5 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateOrUpdate}
                  disabled={!!formValidationError}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          ) : (
            /* Configurations List */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {configs.map((c) => (
                <div 
                  key={c._id}
                  className={`p-6 rounded-[2rem] border transition-all flex flex-col justify-between h-full relative group ${c.isActive ? 'border-violet-300 bg-violet-50/10 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${c.gender === 'Male' ? 'bg-blue-50 text-blue-700 border border-blue-100' : c.gender === 'Female' ? 'bg-pink-50 text-pink-700 border border-pink-100' : 'bg-slate-50 text-slate-700 border border-slate-100'}`}>
                        {c.gender} Gender
                      </span>
                      {c.isActive && (
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-violet-600 text-white shadow-sm flex items-center gap-1">
                          Active
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-black text-slate-800 mb-1">{c.hostelName}</h3>
                    {c.hostelCode && <p className="text-slate-400 text-xs font-bold mb-4">{c.hostelCode}</p>}
                    
                    <div className="space-y-1.5 border-t border-slate-100/80 pt-4 mb-6">
                      {c.roomTemplates.map((t: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs font-semibold text-slate-600">
                          <span>{getCapacityLabel(t.capacity)} Rooms</span>
                          <span className="text-slate-500 font-bold">{t.count} Rooms</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-t border-slate-100 pt-2 mt-2">
                        <span>Total Beds</span>
                        <span className="text-violet-600 font-black">
                          {c.roomTemplates.reduce((sum: number, t: any) => sum + (t.capacity * t.count), 0)} Beds
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
                    {!c.isActive && (
                      <button 
                        onClick={() => handleActivateConfig(c._id)}
                        className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-all text-center"
                      >
                        Activate
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setFormConfigId(c._id);
                        setFormHostelName(c.hostelName);
                        setFormHostelCode(c.hostelCode || "");
                        setFormGender(c.gender);
                        setFormTemplates(c.roomTemplates.map((t: any) => ({ capacity: t.capacity, count: t.count })));
                        setShowForm(true);
                      }}
                      className="py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-lg text-xs transition-all"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteConfig(c._id)}
                      className="py-2 px-3 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {configs.length === 0 && (
                <div className="col-span-full py-16 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-slate-400">
                  <Database className="w-10 h-10 mb-2 text-slate-300" />
                  <p className="text-sm font-semibold">No Hostel Configurations found.</p>
                  <p className="text-xs">Create a new one to persist your room templates inventory.</p>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* SECTION 7: Explainable Room Report Table (with Collapsible Details!) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden mt-8 shadow-sm print-card"
        >
          {/* Header */}
          <div className="p-8 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-xl text-slate-800 tracking-wide">Explainable Room Allotments Report</h3>
              <p className="text-slate-500 text-sm mt-1">
                Risk assessment dashboard sorted by lowest compatibility rooms. Click rows to expand explanation details.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl text-xs font-bold text-blue-700 flex items-center gap-1.5 self-start">
              <Database className="w-4 h-4" /> {filteredAllocations.length} Active Records Filtered
            </div>
          </div>
          
          {/* Controls Bar - Hidden in Print */}
          <div className="p-6 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-center gap-4 print-hidden">
            {/* Search */}
            <div className="w-full sm:flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Room #, Student Email, or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all placeholder:text-slate-400 font-medium"
              />
            </div>

            {/* Filter Risk */}
            <div className="w-full sm:w-auto flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-bold text-slate-600"
              >
                <option value="All">Risk Level: All</option>
                <option value="Excellent">Risk Level: Excellent</option>
                <option value="Good">Risk Level: Good</option>
                <option value="Needs Attention">Risk Level: Needs Attention</option>
                <option value="High Risk">Risk Level: High Risk</option>
              </select>
            </div>

            {/* Filter Occupancy */}
            <div className="w-full sm:w-auto">
              <select
                value={occupancyFilter}
                onChange={(e) => setOccupancyFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all font-bold text-slate-600"
              >
                <option value="All">Occupancy: All</option>
                <option value="Full">Occupancy: Full</option>
                <option value="Partial">Occupancy: Partial</option>
                <option value="Empty">Occupancy: Empty</option>
              </select>
            </div>
          </div>
          
          {/* Table Container */}
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap relative">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-20 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-8 py-5">Room Number</th>
                  <th className="px-8 py-5">Assigned Students</th>
                  <th className="px-8 py-5 text-center">Beds Capacity</th>
                  <th className="px-8 py-5 text-center">Compatibility %</th>
                  <th className="px-8 py-5 text-center">Occupancy Status</th>
                  <th className="px-8 py-5 text-center">Conflict Risk</th>
                  <th className="px-8 py-5 text-center print-hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAllocations.map((a: any) => {
                  const isExpanded = expandedRoomId === a._id;
                  const analysis = a.conflict_analysis || {};
                  
                  return (
                    <Fragment key={a._id}>
                      <tr 
                        onClick={() => setExpandedRoomId(isExpanded ? null : a._id)}
                        className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                      >
                        <td className="px-8 py-5 font-bold text-slate-800">{a.room_number}</td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col gap-1">
                            {(a.memberDetails || a.members).map((member: string, idx: number) => (
                              <span key={idx} className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-slate-400" /> {member}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center font-extrabold text-slate-800">
                          {a.room_capacity || a.members.length} Beds
                        </td>
                        <td className="px-8 py-5 text-center font-black">
                          <span className={
                            (a.compatibility_score || 0) < 0.80 ? 'text-red-500' :
                            (a.compatibility_score || 0) < 0.88 ? 'text-amber-500' :
                            'text-emerald-600'
                          }>
                            {Math.round((a.compatibility_score || 0) * 100)}%
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            a.occupancy_status === 'Full' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' :
                            a.occupancy_status === 'Empty' ? 'bg-red-50 text-red-700 border border-red-150' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {a.occupancy_status || "Full"}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            analysis.conflictRisk === 'High Risk' ? 'bg-red-600 text-white shadow-sm animate-pulse' :
                            analysis.conflictRisk === 'Needs Attention' ? 'bg-amber-400 text-slate-900 font-extrabold' :
                            analysis.conflictRisk === 'Good' ? 'bg-emerald-500 text-white font-extrabold' :
                            'bg-violet-600 text-white'
                          }`}>
                            {analysis.conflictRisk || "Low"}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center print-hidden">
                          <button className="text-slate-400 group-hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Section */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="bg-slate-50/50 px-8 py-6 border-y border-slate-200">
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-6 overflow-hidden"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  
                                  {/* Conflict Reasons (Ranked) */}
                                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
                                    <h4 className="font-extrabold text-xs text-red-700 uppercase tracking-wide flex items-center gap-1.5">
                                      <ShieldAlert className="w-4 h-4" /> Compatibility Conflicts ({analysis.conflictReasons?.length || 0})
                                    </h4>
                                    
                                    {analysis.conflictReasons && analysis.conflictReasons.length > 0 ? (
                                      <div className="space-y-3">
                                        {analysis.conflictReasons.map((reason: any, idx: number) => (
                                          <div key={idx} className="p-3 bg-red-50/30 border border-red-100 rounded-xl space-y-1">
                                            <div className="flex items-center justify-between text-[10px] font-extrabold">
                                              <span className="text-red-700 uppercase">{reason.category}</span>
                                              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded">Weight: {reason.score}</span>
                                            </div>
                                            <p className="text-xs text-slate-700 leading-relaxed font-semibold">{reason.text}</p>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-slate-500 italic py-4 flex items-center gap-2">
                                        <Smile className="w-4 h-4 text-emerald-500" /> No compatibility conflicts detected in this room.
                                      </div>
                                    )}
                                  </div>

                                  {/* Positive Factors & Actionable Recommendations */}
                                  <div className="space-y-6">
                                    {/* Positive Factors */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                                      <h4 className="font-extrabold text-xs text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
                                        <Award className="w-4 h-4" /> Strong Roommate Commonalities ({analysis.positiveFactors?.length || 0})
                                      </h4>
                                      {analysis.positiveFactors && analysis.positiveFactors.length > 0 ? (
                                        <ul className="space-y-2">
                                          {analysis.positiveFactors.map((factor: string, idx: number) => (
                                            <li key={idx} className="text-xs text-slate-700 font-semibold flex items-center gap-2">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                              <span>{factor}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="text-xs text-slate-500 italic">No significant matching indicators found.</p>
                                      )}
                                    </div>

                                    {/* Recommendations */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                                      <h4 className="font-extrabold text-xs text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
                                        <Sparkles className="w-4 h-4" /> Dynamic Actionable Recommendations
                                      </h4>
                                      <ul className="space-y-2">
                                        {analysis.recommendations?.map((rec: string, idx: number) => (
                                          <li key={idx} className="text-xs text-slate-700 font-bold flex items-start gap-2">
                                            <span className="text-blue-500 mt-0.5 font-bold shrink-0">✓</span>
                                            <span>{rec}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>

                                  </div>
                                </div>

                                {/* Roommate Comparison Matrix (Privacy-Sensitive Admin View) */}
                                {analysis.roommatePreferences && analysis.roommatePreferences.length > 0 && (
                                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                                    <h4 className="font-extrabold text-xs text-slate-700 uppercase tracking-wide">
                                      Roommate Mismatch Resolution Matrix (Admin-Only View)
                                    </h4>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-xs text-slate-600 whitespace-nowrap">
                                        <thead>
                                          <tr className="border-b border-slate-100 font-bold uppercase text-[9px] tracking-wider text-slate-400">
                                            <th className="pb-2">Roommate</th>
                                            <th className="pb-2">Sleep Schedule</th>
                                            <th className="pb-2">Cleanliness</th>
                                            <th className="pb-2">Study Environment</th>
                                            <th className="pb-2">Smoking Habit</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                                          {analysis.roommatePreferences.map((pref: any, idx: number) => (
                                            <tr key={idx} className="h-8">
                                              <td>{pref.name}</td>
                                              <td>{pref.sleep_time}</td>
                                              <td>{pref.cleanliness}</td>
                                              <td>{pref.study_env}</td>
                                              <td>{pref.smoking}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
                {filteredAllocations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center text-slate-400 text-sm font-semibold">
                      No matching room records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

      </main>
    </div>
  );
}

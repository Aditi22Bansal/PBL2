"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { LogOut, Home, Play, Upload, CheckCircle2, RotateCw, Database, Microchip, Trash2, Plus } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sheetUrl, setSheetUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<any>(null);

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
          const { capacity, count } = formTemplates[i];
          if (capacity === "" && count === "") {
            err = "Empty rows are not allowed. Please fill in or remove the empty row.";
            break;
          }
          if (capacity !== "" && (typeof capacity !== 'number' || capacity <= 0)) {
            err = "Room capacity must be greater than 0.";
            break;
          }
          if (count !== "" && (typeof count !== 'number' || count < 0)) {
            err = "Room count cannot be negative.";
            break;
          }
          if (capacity === "" || count === "") {
            err = "Both Capacity and Count must be filled for each row.";
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
      fetchStats();
    }
  }, [status, router, session]);

  const fetchAllocations = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/allocations");
      setAllocations(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/hostel-configurations");
      setConfigs(res.data);
    } catch (error) {
      console.error("Failed to fetch configurations:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/submission-stats");
      setStats(res.data);
    } catch (error) {
      console.error("Failed to fetch submission stats:", error);
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
        await axios.put(`http://localhost:5000/api/admin/hostel-configurations/${formConfigId}`, payload);
      } else {
        await axios.post("http://localhost:5000/api/admin/hostel-configurations", payload);
      }
      
      setShowForm(false);
      setFormConfigId(null);
      setFormHostelName("");
      setFormHostelCode("");
      setFormGender("Mixed");
      setFormTemplates([{ capacity: 2, count: 20 }, { capacity: 3, count: 40 }, { capacity: 4, count: 10 }]);
      fetchConfigs();
    } catch (err: any) {
      alert("Error saving configuration: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm("Are you sure you want to delete this configuration?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/admin/hostel-configurations/${id}`);
      fetchConfigs();
    } catch (err: any) {
      alert("Error deleting configuration: " + (err.response?.data?.error || err.message));
    }
  };

  const handleActivateConfig = async (id: string) => {
    try {
      await axios.patch(`http://localhost:5000/api/admin/hostel-configurations/${id}/activate`);
      fetchConfigs();
    } catch (err: any) {
      alert("Error activating configuration: " + (err.response?.data?.error || err.message));
    }
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

  const handleSync = async () => {
    if (!sheetUrl) return;
    setSyncing(true);
    setMessage("");
    try {
      const res = await axios.post("http://localhost:5000/api/admin/sync-csv", { sheet_url: sheetUrl });
      setMessage(res.data.message);
      fetchStats();
    } catch (err: any) {
      setMessage("Error: " + err.response?.data?.details || err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleAllocate = async () => {
    setAllocating(true);
    setMessage("Running AI ML Engine... Please wait.");
    try {
      // Backend automatically retrieves and uses the active HostelConfiguration from MongoDB if no config body is sent
      const res = await axios.post("http://localhost:5000/api/admin/trigger-allocation");
      setMessage(res.data.message + ` | Rooms Formed: ${res.data.total_rooms}`);
      if(res.data.metrics) setMetrics(res.data.metrics);
      fetchAllocations();
    } catch (err: any) {
      setMessage("Error: " + (err.response?.data?.message || err.message));
    } finally {
      setAllocating(false);
    }
  };

  if (status === "loading") return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden">
      {/* Soft Top Gradient */}
      <div className="absolute top-0 right-0 w-full h-[60vh] bg-gradient-to-b from-blue-100/50 to-transparent pointer-events-none" />

      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="w-full px-8 md:px-16 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
              <Microchip className="w-5 h-5 text-violet-600" />
            </div>
            <span className="font-bold tracking-widest text-lg text-slate-800">ADMINISTRATOR DESK</span>
          </div>
          <button 
            onClick={() => signOut({ callbackUrl: '/' })}
            className="px-4 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-2 border border-transparent"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-semibold">Terminate Session</span>
          </button>
        </div>
      </nav>

      <main className="w-full px-8 md:px-16 py-10 relative z-10 space-y-8">
        
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 text-sm shadow-sm"
          >
            <CheckCircle2 className="text-emerald-600 w-5 h-5 flex-shrink-0" />
            <span className="text-emerald-800 font-medium">{message}</span>
          </motion.div>
        )}

        {stats && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
          >
            <h2 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
               Questionnaire Submission Overview
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                <div className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider text-center">Total Students</div>
                <div className="text-2xl font-black text-slate-800 mt-1">{stats.totalStudents}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                <div className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider text-center">Profiles Completed</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">{stats.profilesCompleted}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                <div className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider text-center">Profiles Pending</div>
                <div className="text-2xl font-black text-amber-600 mt-1">{stats.profilesPending}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
                <div className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-wider text-center">Submission Rate</div>
                <div className="text-2xl font-black text-violet-600 mt-1">{stats.submissionProgress}%</div>
              </div>
            </div>
          </motion.div>
        )}

        {metrics && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl relative border border-slate-200 shadow-sm"
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sync Card */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-700">
               <Database className="w-32 h-32 text-blue-900" />
            </div>
            
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 relative z-10">
              <Upload className="text-blue-600 w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold mb-2 relative z-10 text-slate-800">Data Synchronization</h2>
            <p className="text-slate-500 text-sm mb-8 relative z-10 leading-relaxed max-w-md">
              Securely import the latest student accommodation preferences directly from the registered Google Form into the central database.
            </p>
            
            <div className="relative z-10 space-y-4">
              <input 
                type="text" 
                placeholder="Paste Google Sheet CSV Endpoint URL..." 
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400"
              />
              <button 
                onClick={handleSync}
                disabled={syncing || !sheetUrl}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {syncing ? <RotateCw className="w-5 h-5 animate-spin" /> : "Sync Form Data"}
              </button>
            </div>
          </motion.div>

          {/* Trigger Card */}
          <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.2 }}
             className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group flex flex-col justify-between"
          >
             <div className="absolute top-0 right-0 p-8 opacity-5 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-700">
               <Microchip className="w-32 h-32 text-violet-900" />
            </div>

            <div>
              <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mb-6 relative z-10">
                <Play className="text-violet-600 w-7 h-7 ml-1" />
              </div>
              <h2 className="text-2xl font-bold mb-2 relative z-10 text-slate-800">Hostel Allotment Processing</h2>
              <p className="text-slate-500 text-sm mb-6 relative z-10 leading-relaxed max-w-md">
                Process the current database to automatically form optimal roommate clusters based on compatibility factors.
              </p>
              
              {/* Display current active configuration info */}
              <div className="relative z-10 bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Active Inventory Source</div>
                {configs.find(c => c.isActive) ? (
                  (() => {
                    const active = configs.find(c => c.isActive);
                    const beds = active.roomTemplates.reduce((sum: number, t: any) => sum + (t.capacity * t.count), 0);
                    const rooms = active.roomTemplates.reduce((sum: number, t: any) => sum + t.count, 0);
                    return (
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{active.hostelName}</div>
                        <div className="text-slate-500 text-xs mt-1 flex gap-3 font-semibold">
                          <span>Gender: {active.gender}</span>
                           <span>•</span>
                          <span>{rooms} Rooms</span>
                           <span>•</span>
                          <span>{beds} Beds</span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div>
                    <div className="font-semibold text-slate-700 text-sm">Default Allocations</div>
                    <div className="text-slate-400 text-xs mt-1 font-medium">Legacy Capacity = 3 (Unlimited Count)</div>
                  </div>
                )}
              </div>
            </div>
            
            <button 
              onClick={handleAllocate}
              disabled={allocating}
              className="w-full mt-4 bg-violet-600 hover:bg-violet-700 text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-md disabled:opacity-50"
            >
              {allocating ? <RotateCw className="w-6 h-6 animate-spin" /> : "Generate Room Allotments"}
            </button>
          </motion.div>
        </div>

        {/* Hostel Configurations persistent management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative mt-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-wide flex items-center gap-2">
                <Home className="w-6 h-6 text-violet-600 animate-pulse" />
                Hostel Configurations
              </h2>
              <p className="text-slate-500 text-sm mt-1">Manage persistent room capacity and counts template settings.</p>
            </div>
            
            {!showForm && (
              <button 
                onClick={() => {
                  setFormConfigId(null);
                  setFormHostelName("");
                  setFormHostelCode("");
                  setFormGender("Mixed");
                  setFormTemplates([{ capacity: 2, count: 20 }, { capacity: 3, count: 40 }, { capacity: 4, count: 10 }]);
                  setShowForm(true);
                }}
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 shadow-md shadow-violet-200"
              >
                <Plus className="w-4 h-4" />
                Create Configuration
              </button>
            )}
          </div>

          {showForm ? (
            /* Create / Edit Form */
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-150 space-y-6">
              <h3 className="text-lg font-bold text-slate-800">
                {formConfigId ? "Edit Hostel Configuration" : "New Hostel Configuration"}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hostel Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Boys Hostel A" 
                    value={formHostelName}
                    onChange={(e) => setFormHostelName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-violet-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hostel Code (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. BHA-01" 
                    value={formHostelCode}
                    onChange={(e) => setFormHostelCode(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-violet-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Gender</label>
                  <select 
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-violet-500 transition-all"
                  >
                    <option value="Mixed">Mixed</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Room Inventory Templates</label>
                <div className="overflow-x-auto border border-slate-200/60 rounded-xl bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 border-b border-slate-100">
                        <th className="px-4 py-3 font-semibold">Room Capacity (Beds)</th>
                        <th className="px-4 py-3 font-semibold">Number of Rooms</th>
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formTemplates.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2">
                            <input 
                              type="number"
                              placeholder="Capacity"
                              value={t.capacity}
                              onChange={(e) => {
                                const val = e.target.value === "" ? "" : parseInt(e.target.value);
                                const updated = [...formTemplates];
                                updated[idx].capacity = val;
                                setFormTemplates(updated);
                              }}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input 
                              type="number"
                              placeholder="Count"
                              value={t.count}
                              onChange={(e) => {
                                const val = e.target.value === "" ? "" : parseInt(e.target.value);
                                const updated = [...formTemplates];
                                updated[idx].count = val;
                                setFormTemplates(updated);
                              }}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
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

        {/* Results Data Table */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden mt-8 shadow-sm"
        >
          <div className="p-8 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-xl text-slate-800 tracking-wide">Generated Room Allotments</h3>
              <p className="text-slate-500 text-sm mt-1">Overview of the verified student housing placements.</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl text-sm font-semibold text-blue-700 flex items-center gap-2">
              <Database className="w-4 h-4" /> {allocations.length} Active Rooms
            </div>
          </div>
          
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap relative">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <th className="px-8 py-5 font-semibold tracking-wider uppercase text-xs">Room ID</th>
                  <th className="px-8 py-5 font-semibold tracking-wider uppercase text-xs">Classification</th>
                  <th className="px-8 py-5 font-semibold tracking-wider uppercase text-xs">Assigned Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {allocations.map((a: any) => (
                  <tr key={a._id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-5 font-bold text-slate-800">{a.room_number}</td>
                    <td className="px-8 py-5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${a.gender_group.includes('FLEX') ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {a.gender_group}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex gap-2">
                        {(a.memberDetails || a.members).map((member: string, idx: number) => (
                          <span key={idx} className="bg-white px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-600 truncate max-w-[200px]">
                            {member}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {allocations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-slate-400 text-lg">
                      No allotments generated yet.
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

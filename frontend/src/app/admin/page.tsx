"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { LogOut, Home, Play, Upload, CheckCircle2, RotateCw, Database, Microchip } from "lucide-react";
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated" && session.user?.role !== "admin" && session.user?.role !== "ADMIN") {
      router.push("/unauthorized");
    } else if (status === "authenticated") {
      fetchAllocations();
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

  const handleSync = async () => {
    if (!sheetUrl) return;
    setSyncing(true);
    setMessage("");
    try {
      const res = await axios.post("http://localhost:5000/api/admin/sync-csv", { sheet_url: sheetUrl });
      setMessage(res.data.message);
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
      const res = await axios.post("http://localhost:5000/api/admin/trigger-allocation");
      setMessage(res.data.message + ` | Rooms Formed: ${res.data.total_rooms}`);
      if(res.data.metrics) setMetrics(res.data.metrics);
      fetchAllocations();
    } catch (err: any) {
      setMessage("Error: " + err.response?.data?.message || err.message);
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
             className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group"
          >
             <div className="absolute top-0 right-0 p-8 opacity-5 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-700">
               <Microchip className="w-32 h-32 text-violet-900" />
            </div>

            <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mb-6 relative z-10">
              <Play className="text-violet-600 w-7 h-7 ml-1" />
            </div>
            <h2 className="text-2xl font-bold mb-2 relative z-10 text-slate-800">Hostel Allotment Processing</h2>
            <p className="text-slate-500 text-sm mb-8 relative z-10 leading-relaxed max-w-md">
              Process the current database to automatically form optimal roommate clusters based on compatibility factors.
            </p>
            
            <button 
              onClick={handleAllocate}
              disabled={allocating}
              className="w-full mt-10 bg-violet-600 hover:bg-violet-700 text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-md disabled:opacity-50"
            >
              {allocating ? <RotateCw className="w-6 h-6 animate-spin" /> : "Generate Room Allotments"}
            </button>
          </motion.div>
        </div>

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

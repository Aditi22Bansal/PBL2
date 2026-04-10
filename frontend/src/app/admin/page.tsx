"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { LogOut, Play, Upload, CheckCircle2, RotateCw, Database, Microchip, FileText, ClipboardList, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { API_URL } from "@/lib/api";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sheetUrl, setSheetUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [stats, setStats] = useState({ rooms: 0, unassigned: 0, pendingRequests: 0 });

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
          const resA = await axios.get(`${API_URL}/api/admin/allocations`);
          const resR = await axios.get(`${API_URL}/api/admin/requests`);
          
          let aCount = 0, uCount = 0, rCount = 0;
          if (resA.data.allocations) {
             aCount = resA.data.allocations.length;
             uCount = resA.data.unassigned?.length || 0;
          }
          if (resR.data) {
             rCount = resR.data.filter((r:any) => r.status === 'Pending').length;
          }
          setStats({ rooms: aCount, unassigned: uCount, pendingRequests: rCount });
      } catch (err) { }
  }

  const handleSync = async () => {
    if (!sheetUrl) return;
    setSyncing(true);
    setMessage("");
    setIsError(false);
    try {
      const res = await axios.post(`${API_URL}/api/admin/sync-csv`, { sheet_url: sheetUrl });
      setMessage(res.data.message);
      setIsError(false);
      fetchData();
    } catch (err: any) {
      setMessage("Error: " + (err.response?.data?.details || err.response?.data?.error || err.message));
      setIsError(true);
    } finally {
      setSyncing(false);
    }
  };

  const handleAllocate = async () => {
    setAllocating(true);
    setIsError(false);
    setMessage("⏳ Waking up the AI engine... This may take up to 60 seconds on first run.");
    try {
      // 3-minute timeout — backend retries up to 3× with 8s delays between them
      const res = await axios.post(`${API_URL}/api/admin/trigger-allocation`, {}, { timeout: 180000 });
      setMessage(`✓ ${res.data.message} | New Rooms Formed: ${res.data.total_new_rooms}`);
      setIsError(false);
      fetchData();
    } catch (err: any) {
      const serverMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      const isColdStart = err.response?.status === 502 || err.code === 'ECONNABORTED';
      setMessage(
        isColdStart
          ? "⚠️ The AI engine is waking up (Render cold start). Please wait 30–60 seconds and try again."
          : "Error: " + serverMsg
      );
      setIsError(true);
    } finally {
      setAllocating(false);
    }
  };

  if (status === "loading") return null;

  return (
    <div className="min-h-screen bg-[#F7F4EE] text-[#1A2820] font-['Outfit'] pb-20">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#F7F4EE]/90 backdrop-blur-[24px] border-b border-[#1A3A2A]/10">
        <div className="w-full px-6 md:px-12 h-[68px] flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="font-['Cormorant_Garamond'] text-[26px] font-semibold text-[#1A3A2A] flex items-center gap-1">
              Admin Portal<div className="w-2 h-2 rounded-full bg-[#C4613A] mb-2.5"></div>
            </div>
            
            <div className="hidden md:flex items-center gap-6 border-l border-[#1A3A2A]/10 pl-8 h-8 text-[14px]">
                <Link href="/admin" className="text-[#1A3A2A] font-semibold">Home</Link>
                <Link href="/admin/allocations" className="text-[#7A9088] hover:text-[#1A3A2A] transition-colors">Allocations</Link>
                <Link href="/admin/requests" className="text-[#7A9088] hover:text-[#1A3A2A] transition-colors flex items-center gap-1.5">
                    Requests {stats.pendingRequests > 0 && <span className="w-4 h-4 rounded-full bg-[#C4613A] text-white text-[9px] flex items-center justify-center font-bold px-[5px] py-[1px]">{stats.pendingRequests}</span>}
                </Link>
            </div>
          </div>
          
          <button 
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-[#7A9088] hover:text-[#C4613A] hover:bg-[#EDE9E0] p-2 rounded-full transition-colors flex items-center justify-center"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="w-full px-6 md:px-[6vw] pt-10 mt-4 relative z-10 space-y-10">
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl flex items-center gap-3 text-sm shadow-sm border ${
              isError
                ? "bg-[#FDF2F0] border-[#C4613A]/30"
                : "bg-[#EBF4EF] border-[#7BAE94]/30"
            }`}
          >
            <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${isError ? "text-[#C4613A]" : "text-[#2E6347]"}`} />
            <span className="text-[#1A3A2A] font-medium">{message}</span>
          </motion.div>
        )}

        <div className="flex flex-col gap-2 mb-8">
            <h1 className="text-4xl md:text-[54px] font-['Cormorant_Garamond'] font-semibold text-[#1A3A2A] leading-tight">
              Dashboard
            </h1>
            <p className="text-[#7A9088] text-[15px] font-light max-w-xl">System overview and allocation engine controls.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="bg-white p-7 rounded-[20px] border border-[#1A3A2A]/10 shadow-sm flex flex-col items-center justify-center relative overflow-hidden group hover:-translate-y-1 transition-all">
                <div className="text-[#1A3A2A] text-[11px] font-semibold tracking-[1px] uppercase mb-2 flex items-center gap-2"><Database size={14} className="text-[#7BAE94]"/> Active Rooms</div>
                <div className="font-['Cormorant_Garamond'] text-[52px] font-semibold text-[#1A3A2A] leading-none">{stats.rooms}</div>
            </motion.div>
            <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay:0.1}} className="bg-white p-7 rounded-[20px] border border-[#1A3A2A]/10 shadow-sm flex flex-col items-center justify-center relative overflow-hidden group hover:-translate-y-1 transition-all">
                <div className="text-[#1A3A2A] text-[11px] font-semibold tracking-[1px] uppercase mb-2 flex items-center gap-2"><ShieldAlert size={14} className="text-[#C9A84C]"/> Unassigned Pool</div>
                <div className="font-['Cormorant_Garamond'] text-[52px] font-semibold text-[#1A3A2A] leading-none">{stats.unassigned}</div>
            </motion.div>
            <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay:0.2}} className="bg-white p-7 rounded-[20px] border border-[#1A3A2A]/10 shadow-sm flex flex-col items-center justify-center relative overflow-hidden group hover:-translate-y-1 transition-all">
                <div className="text-[#1A3A2A] text-[11px] font-semibold tracking-[1px] uppercase mb-2 flex items-center gap-2"><ClipboardList size={14} className="text-[#C4613A]"/> Pending Change Requests</div>
                <div className="font-['Cormorant_Garamond'] text-[52px] font-semibold text-[#1A3A2A] leading-none">{stats.pendingRequests}</div>
            </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sync Card */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-10 rounded-[24px] border border-[#1A3A2A]/10 shadow-[0_8px_40px_rgba(26,56,42,0.07)] relative overflow-hidden group"
          >
            <div className="w-[52px] h-[52px] bg-[#EBF4EF] border border-[#7BAE94]/20 rounded-2xl flex items-center justify-center mb-6 relative z-10">
              <Upload className="text-[#2E6347] w-6 h-6" />
            </div>
            <h2 className="text-[22px] font-semibold mb-2 relative z-10 text-[#1A3A2A]">Data Synchronization</h2>
            <p className="text-[#3A4F44] text-[14px] mb-8 relative z-10 leading-[1.7] max-w-md font-light">
              Securely import the latest student accommodation preferences directly from the registered Google Form endpoint.
            </p>
            
            <div className="relative z-10 space-y-4">
              <input 
                type="text" 
                placeholder="Paste Google Sheet CSV Endpoint URL..." 
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                className="w-full bg-[#fcfbfa] border border-[#1A3A2A]/10 rounded-xl px-5 py-4 text-[14px] text-[#1A3A2A] focus:outline-none focus:border-[#7BAE94] focus:ring-1 focus:ring-[#7BAE94] transition-all placeholder:text-[#7A9088]/60"
              />
              <button 
                onClick={handleSync}
                disabled={syncing || !sheetUrl}
                className="w-full bg-white hover:bg-[#F7F4EE] text-[#1A3A2A] py-3.5 rounded-full font-medium transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 border-2 border-[#1A3A2A]/10 hover:border-[#1A3A2A]/20"
              >
                {syncing ? <RotateCw className="w-[18px] h-[18px] animate-spin" /> : "Sync Form Data"}
              </button>
            </div>
          </motion.div>

          {/* Trigger Card - Uses Forest theme */}
          <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.2 }}
             className="bg-[#1A3A2A] p-10 rounded-[24px] border border-[#1A3A2A] shadow-[0_12px_40px_rgba(26,56,42,0.2)] relative overflow-hidden group text-white"
          >
            <div className="w-[52px] h-[52px] bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center mb-6 relative z-10">
              <Play className="text-white w-6 h-6 ml-0.5" />
            </div>
            <h2 className="text-[22px] font-semibold mb-2 relative z-10 text-white">Hostel Allotment Engine</h2>
            <p className="text-white/60 text-[14px] mb-8 relative z-10 leading-[1.7] max-w-md font-light">
              Process the current database to automatically form optimal roommate clusters based on compatibility vectors. Manually locked rooms remain strictly untouched.
            </p>
            
            <button 
              onClick={handleAllocate}
              disabled={allocating}
              className="w-full mt-10 bg-[#C4613A] hover:bg-[#D4784F] text-white py-4 rounded-full font-medium transition-all flex items-center justify-center gap-3 shadow-[0_4px_24px_rgba(196,97,58,0.3)] disabled:opacity-50 disabled:transform-none hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(196,97,58,0.4)]"
            >
              {allocating ? <><RotateCw className="w-[18px] h-[18px] animate-spin" />&nbsp;Warming up engine...</> : "Run Engine"}
            </button>
          </motion.div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-5">
            <Link href="/admin/allocations" className="bg-white flex-1 p-6 rounded-[20px] border border-[#1A3A2A]/10 hover:border-[#1A3A2A]/30 hover:shadow-[0_8px_40px_rgba(26,56,42,0.05)] transition-all group flex items-center gap-5 cursor-pointer">
                <div className="bg-[#FAF0EB] p-4 rounded-xl text-[#C4613A] group-hover:scale-105 transition-transform"><FileText size={24}/></div>
                <div>
                    <h4 className="font-semibold text-[#1A3A2A] text-lg">Manage Allocations</h4>
                    <p className="text-[#7A9088] text-[13px] mt-0.5 font-light">Overrides, lock assignments, Reports</p>
                </div>
            </Link>
            
            <Link href="/admin/requests" className="bg-white flex-1 p-6 rounded-[20px] border border-[#1A3A2A]/10 hover:border-[#1A3A2A]/30 hover:shadow-[0_8px_40px_rgba(26,56,42,0.05)] transition-all group flex items-center gap-5 cursor-pointer">
                <div className="bg-[#FBF5E6] p-4 rounded-xl text-[#8A6A1A] group-hover:scale-105 transition-transform"><ClipboardList size={24}/></div>
                <div>
                    <h4 className="font-semibold text-[#1A3A2A] text-lg">Student Requests</h4>
                    <p className="text-[#7A9088] text-[13px] mt-0.5 font-light">Review room change tickets</p>
                </div>
            </Link>
        </div>

      </main>
    </div>
  );
}

"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { LogOut, Home, Users, Loader2, Sparkles, Building2, UserCircle, Save, CheckCircle2, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import RoomChat from "@/components/RoomChat";
import { API_URL } from "@/lib/api";

export default function StudentDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [allocation, setAllocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    // Failsafe timeout
    const failSafe = setTimeout(() => {
        if (loading) setLoading(false);
    }, 5000);
    return () => clearTimeout(failSafe);
  }, [loading]);
  
  // Note: Form answers are collected externally via Google Forms, 
  // so no internal state is needed here anymore.

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      if (session.user?.role === "admin" || session.user?.role === "ADMIN") {
        router.push("/admin");
      } else {
        fetchAllocation();
      }
    }
  }, [status, router, session]);

  const fetchAllocation = async () => {
    try {
      const email = session?.user?.email;
      if (!email) {
          setLoading(false);
          return;
      }
      
      const res = await axios.get(`${API_URL}/api/student/dashboard/${email}`);
      setAllocation(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="min-h-screen bg-[#F7F4EE] flex flex-col items-center justify-center font-['Outfit']">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="z-10">
          <Loader2 className="w-12 h-12 text-[#1A3A2A]" />
        </motion.div>
        <p className="text-[#3A4F44] mt-4 animate-pulse z-10 text-sm uppercase font-semibold tracking-widest">Synchronizing...</p>
        <p className="text-[#3A4F44]/50 mt-1 text-xs">Auth: {status} | API: {loading ? 'true' : 'false'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F4EE] text-[#1A2820] font-['Outfit'] pb-20">

      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 bg-[#F7F4EE]/90 backdrop-blur-[24px] border-b border-[#1A3A2A]/10">
        <div className="w-full px-6 md:px-12 h-[68px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-['Cormorant_Garamond'] text-[26px] font-semibold text-[#1A3A2A] flex items-center gap-1">
              Student Portal<div className="w-2 h-2 rounded-full bg-[#C4613A] mb-2.5"></div>
            </div>
          </div>
          
          <div className="flex items-center gap-5">
            <div className="text-right hidden sm:block">
              <p className="text-[14px] font-medium text-[#1A3A2A]">{session?.user?.name}</p>
              <p className="text-xs text-[#7A9088]">{session?.user?.email}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#EDE9E0] overflow-hidden border border-[#1A3A2A]/10 hidden sm:block">
              {session?.user?.image ? (
                <img src={session.user.image} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex justify-center items-center text-sm font-semibold text-[#1A3A2A]">{session?.user?.name?.charAt(0)}</div>
              )}
            </div>
            <button 
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-[#7A9088] hover:text-[#C4613A] hover:bg-[#EDE9E0] p-2 rounded-full transition-colors flex items-center justify-center"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="w-full px-6 md:px-[6vw] pt-16 mt-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between"
        >
          <div>
            <h1 className="text-5xl md:text-6xl font-['Cormorant_Garamond'] font-semibold text-[#1A3A2A] tracking-tight leading-[1.1]">
              Welcome back,<br /><i className="text-[#C4613A]">{session?.user?.name?.split(' ')[0]}</i>
            </h1>
            <p className="text-[#3A4F44] mt-4 text-[17px] font-light max-w-md leading-[1.75]">Here is your hostel allocation status for the upcoming semester.</p>
          </div>
          <div className="mt-6 sm:mt-0 bg-[#EBF4EF] px-5 py-2.5 rounded-full flex items-center gap-2.5 border border-[#1A3A2A]/10">
             <div className="h-2 w-2 rounded-full bg-[#2E6347] animate-pulse"></div>
             <span className="text-[12px] font-semibold text-[#2E6347] uppercase tracking-wider">System Online</span>
          </div>
        </motion.div>

        {/* Status Area */}
        <AnimatePresence mode="wait">
          {allocation?.status === 'NOT_SUBMITTED' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: 0.1, duration: 0.5, type: "spring" }}
              className="bg-white rounded-[20px] p-8 md:p-12 relative overflow-hidden group border border-[#1A3A2A]/10 shadow-[0_8px_40px_rgba(26,56,42,0.07)]"
            >
              <div className="text-center py-6 mb-10 border-b border-[#1A3A2A]/10">
                <div className="text-[11px] font-semibold tracking-[2px] uppercase text-[#C4613A] mb-4 flex items-center justify-center gap-2">
                    <span className="w-5 h-[1.5px] bg-[#C4613A] inline-block"></span>Complete Form
                </div>
                <h2 className="font-['Cormorant_Garamond'] text-[34px] md:text-[42px] font-semibold text-[#1A3A2A] mb-4 leading-tight">Room Preference Profile</h2>
                <p className="text-[#3A4F44] max-w-xl mx-auto leading-[1.75] font-light">
                  To match you with the best roommates, please fill out your lifestyle habits. You can only submit this form once.
                </p>
              </div>

              <div className="max-w-3xl mx-auto space-y-8 pb-4">
                <div className="bg-[#FAF0EB] border border-[#C4613A]/20 p-8 rounded-[20px]">
                    <h3 className="text-xl font-semibold text-[#1A3A2A] mb-3 flex items-center gap-2"><Sparkles className="text-[#C4613A] w-5 h-5"/> Required Survey</h3>
                    <p className="text-[#3A4F44] leading-relaxed font-light mb-6">
                        We use a highly detailed ML allocation format to ensure the best possible roommate pairing for you based on over 20+ lifestyle characteristics (including introversion, conflict styles, sleeping habits, and more). <br/><br/>
                        Please click the button below to access the secure Google Form. Once submitted, the administration checks and syncs responses periodically.
                    </p>
                    
                    <a 
                        href="https://docs.google.com/forms/d/e/1FAIpQLSffsvYgPJS0fN84o-FRqBLXyynteXzzMCWmTWg5JFFJJ_LbPw/viewform"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2.5 w-full sm:w-auto bg-[#1A3A2A] hover:bg-[#234D38] text-white font-medium py-4 px-8 rounded-full transition-all shadow-[0_4px_24px_rgba(26,56,42,0.2)] hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(26,56,42,0.3)]"
                    >
                        Go to Preference Form <span className="w-1.5 h-1.5 rounded-full bg-[#C4613A] ml-1"></span>
                    </a>
                </div>
                
                <p className="text-[#7A9088] text-xs font-light px-4">
                    <strong>Note:</strong> Your status will dynamically change from "NOT SUBMITTED" to "PENDING ALLOCATION" automatically when the administration executes the global form sync.
                </p>
              </div>
            </motion.div>

          ) : allocation?.status === 'PENDING_ALLOCATION' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[20px] p-16 text-center border border-[#1A3A2A]/10 shadow-[0_8px_40px_rgba(26,56,42,0.07)]"
            >
              <div className="w-24 h-24 bg-[#EBF4EF] border border-[#7BAE94]/30 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                <div className="absolute inset-0 border-t-2 border-r-2 border-[#2E6347] rounded-full animate-spin"></div>
                <Loader2 className="w-10 h-10 text-[#2E6347] animate-spin" />
              </div>
              <h2 className="font-['Cormorant_Garamond'] text-[34px] font-semibold text-[#1A3A2A] mb-4">Allocation in Progress</h2>
              <p className="text-[#3A4F44] max-w-sm mx-auto leading-[1.7] font-light">
                Your form has been received. Our algorithm is actively finding the perfect match with <span className="font-medium text-[#c4613a]">highly compatible</span> peers.
              </p>
            </motion.div>

          ) : allocation?.status === 'ALLOCATED' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[20px] p-8 md:p-14 relative overflow-hidden border border-[#1A3A2A]/10 shadow-[0_8px_40px_rgba(26,56,42,0.07)]"
            >
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-8">
                  <div>
                    <h2 className="text-[10px] font-semibold tracking-[1.5px] uppercase text-[#7A9088] mb-4">Your Assigned Room</h2>
                    <div className="font-['Cormorant_Garamond'] text-6xl md:text-7xl font-semibold text-[#1A3A2A] leading-none">{allocation.room_number}</div>
                    {allocation.block && (
                      <div className="mt-4 text-[15px] text-[#3A4F44] font-medium flex items-center gap-2">
                         <span className="bg-[#F7F4EE] px-3 py-1 rounded-full border border-[#1A3A2A]/10">Block {allocation.block}</span>
                         <span className="bg-[#F7F4EE] px-3 py-1 rounded-full border border-[#1A3A2A]/10">Floor {allocation.floor}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-4">
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="px-5 py-2.5 bg-[#EBF4EF] rounded-[50px] flex items-center shrink-0"
                    >
                      <p className="text-[#2E6347] text-[13px] font-semibold flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> Highly Compatible Match
                      </p>
                    </motion.div>
                    {allocation.changeRequestInfo ? (
                      <div className="px-5 py-2.5 bg-[#F7F4EE] border border-[#C4613A]/20 text-[#1A3A2A] text-[13px] font-medium rounded-[50px] flex items-center justify-center gap-2">
                         Change Request: <span className="text-[#C4613A] font-semibold">{allocation.changeRequestInfo.status}</span>
                      </div>
                    ) : (
                      <button onClick={() => router.push('/student/request')} className="px-5 py-2.5 bg-transparent border-2 border-[#1A3A2A]/10 hover:border-[#1A3A2A] text-[#1A3A2A] text-[13px] font-medium transition-all rounded-[50px] flex items-center justify-center">
                        Request Room Change
                      </button>
                    )}
                  </div>
                </div>
                
                <h3 className="text-xl font-semibold text-[#1A3A2A] flex items-center gap-3 mb-6 pt-10 border-t border-[#1A3A2A]/10">
                  <span className="w-8 h-8 rounded-full bg-[#FAF0EB] text-[#C4613A] flex items-center justify-center">
                    <Users size={16} />
                  </span>
                  Your Roommates
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allocation.roommates?.map((rm: any, idx: number) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + (idx * 0.1) }}
                      key={idx} 
                      className="bg-[#F7F4EE] border border-[#1A3A2A]/10 hover:border-[#1A3A2A]/20 transition-all p-5 rounded-2xl flex items-center gap-4 group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#EDE9E0] flex items-center justify-center text-lg font-semibold text-[#1A3A2A] shrink-0 group-hover:bg-[#C4613A] group-hover:text-white transition-colors">
                        {rm.name.charAt(0)}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-semibold text-[#1A3A2A] truncate text-[15px]">{rm.name}</p>
                        <p className="text-[13px] text-[#7A9088] flex items-center gap-1.5 truncate mt-0.5">
                          {rm.branch} <span className="w-1 h-1 bg-[#1A3A2A]/20 rounded-full"></span> {rm.year}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
                
                {/* Roommate Chat Area */}
                <div className="mt-12 pt-8 border-t border-[#1A3A2A]/10">
                  {!showChat ? (
                    <button onClick={() => setShowChat(true)} className="w-full py-5 bg-[#EBF4EF] hover:bg-[#7BAE94]/20 border border-[#7BAE94]/30 rounded-2xl flex items-center justify-center gap-3 text-[#2E6347] font-semibold transition-all">
                        <MessageSquare className="w-5 h-5"/> Open Private Roommate Chat
                    </button>
                  ) : (
                    <RoomChat 
                        roomId={allocation.room_id} 
                        currentUserEmail={session?.user?.email as string} 
                        currentUserName={session?.user?.name as string} 
                    />
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-8 text-[#7A9088] bg-white rounded-[20px] p-12 border border-[#1A3A2A]/10">
              Unable to load status. Please try again or contact administration.
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

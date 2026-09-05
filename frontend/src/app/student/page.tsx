"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import {
  LogOut, Home, Loader2, Sparkles,
  FileText, ShieldAlert, AlertCircle, RefreshCw, MessageSquare, Heart, BellRing, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import RoomChat from "@/components/RoomChat";
import QuestionnaireWizard from "@/components/QuestionnaireWizard";
import { API_URL, PROXY_URL } from "@/lib/api";

export default function StudentDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const email = session?.user?.email;
      if (!email) {
          setLoading(false);
          return;
      }
      
      const res = await axios.get(`${PROXY_URL}/student/dashboard`);
      setDashboardData(res.data);
      
      // If student hasn't submitted questionnaire, auto-show wizard
      if (res.data.status === 'NOT_SUBMITTED') {
        setShowWizard(true);
      } else {
        setShowWizard(false);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to retrieve dashboard details. Please reload.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Unread notifications the student missed while offline (allocated when they
  // weren't logged in). The live socket path below covers the online case.
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/student/notifications`);
      setNotifications(res.data);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }, []);

  const dismissNotifications = async () => {
    setNotifications([]);
    try {
      await axios.post(`${PROXY_URL}/student/notifications/read`, {});
    } catch (err) {
      console.error("Failed to mark notifications read", err);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      if (session.user?.role === "admin" || session.user?.role === "ADMIN") {
        router.push("/admin");
      } else {
        fetchDashboardData();
        fetchNotifications();
      }
    }
  }, [status, router, session, fetchDashboardData, fetchNotifications]);

  // Live push channel. Opened from the dashboard itself rather than RoomChat,
  // because RoomChat only mounts once a student already HAS a room - the
  // student who most needs this event is the one who doesn't have one yet.
  useEffect(() => {
    const email = session?.user?.email;
    if (status !== "authenticated" || !email) return;

    if (!socketRef.current) {
      socketRef.current = io(API_URL);
    }
    const socket = socketRef.current;

    const joinChannel = () => socket.emit("join_user", email);
    joinChannel();
    // Re-join after a reconnect, otherwise the room membership is silently lost.
    socket.on("connect", joinChannel);

    socket.on("room_allocated", (data: any) => {
      setNotifications(prev =>
        prev.some(n => n._id === data._id) ? prev : [data, ...prev]
      );
      // Status just flipped to ALLOCATED server-side - pull the real room data in.
      fetchDashboardData();
    });

    return () => {
      socket.off("connect", joinChannel);
      socket.off("room_allocated");
    };
  }, [status, session, fetchDashboardData]);

  const handleDownloadPDF = () => {
    window.print();
  };

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        >
          <Loader2 className="w-10 h-10 text-violet-600 animate-spin" />
        </motion.div>
        <p className="text-slate-500 mt-4 font-bold tracking-wide animate-pulse">Initializing Allocation Portal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-md text-center space-y-6">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold text-slate-800">Connection Error</h2>
          <p className="text-slate-500 text-sm">{error}</p>
          <button 
            onClick={fetchDashboardData}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-violet-100"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const getCapacityLabel = (capacity: number) => {
    switch (capacity) {
      case 1: return "Single";
      case 2: return "Double";
      case 3: return "Triple";
      case 4: return "Quad";
      default: return `${capacity}-Bed`;
    }
  };

  const profile = dashboardData?.profile;
  const allocation = dashboardData?.allocation;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden font-sans pb-16">
      
      {/* PDF Print CSS overrides */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          nav, .print-hidden, button, .chat-section, .action-center-card {
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
        }
      `}} />

      {/* Decorative background blur elements */}
      <div className="absolute top-0 right-0 w-full h-[60vh] bg-gradient-to-b from-violet-100/40 to-transparent pointer-events-none print-hidden" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-100/30 blur-[100px] pointer-events-none print-hidden" />

      {/* Navbar (hidden in print) */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-slate-200/80 px-8 py-5 flex items-center justify-between shadow-sm print-hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-150">
            <Home className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-800 tracking-tight text-md">RoomSync Portal</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Housing Placement Dashboard</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {profile && (
            <div className="bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hidden md:block">
              {profile.branch} • Year {profile.year_of_study}
            </div>
          )}
          <button 
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-5 rounded-xl text-xs transition-all shadow-sm"
          >
            Sign Out <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="w-full px-8 md:px-16 py-10 relative z-10 space-y-8">

        {/* Unread notifications - live socket pushes and anything that landed
            while the student was offline both surface here. */}
        <AnimatePresence>
          {notifications.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4 print-hidden"
            >
              <div className="w-10 h-10 bg-white border border-emerald-200 rounded-xl flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 space-y-1.5">
                {notifications.map((n, idx) => (
                  <p key={n._id || idx} className="text-sm font-semibold text-emerald-900">
                    {n.message}
                  </p>
                ))}
              </div>
              <button
                onClick={dismissNotifications}
                aria-label="Dismiss notifications"
                className="w-8 h-8 rounded-lg hover:bg-emerald-100 flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-4 h-4 text-emerald-700" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SECTION 1 & 2: Welcome Banner & Status Overview */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">
              Welcome back, {profile?.name ? profile.name.split(' ')[0] : (session?.user?.name ? session.user.name.split(' ')[0] : 'Student')}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {dashboardData?.status === 'ALLOCATED' 
                ? "Your housing details and roommate matches are ready."
                : "Complete your preferences to initialize roommate allocation."}
            </p>
          </div>
          <div className="flex items-center gap-3 print-hidden">
            <span className={`px-4 py-2.5 rounded-xl text-xs font-bold border uppercase tracking-wider ${
              dashboardData?.status === 'ALLOCATED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              dashboardData?.status === 'PENDING_ALLOCATION' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              Status: {dashboardData?.status?.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* If Questionnaire has not been submitted yet */}
        {dashboardData?.status === 'NOT_SUBMITTED' && showWizard && (
          <div className="space-y-6">
            {/* Visual Progress Card (Section 2) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 print-hidden">
              <div className="space-y-2">
                <h3 className="font-bold text-slate-800 text-md">Roommate Preference Questionnaire</h3>
                <p className="text-slate-500 text-xs">
                  Your profile responses are in draft mode. Complete the profile questionnaire to participate in matching runs.
                </p>
                {profile?.lastEditedAt && (
                  <p className="text-[10px] text-slate-400 font-bold uppercase">
                    Last Saved: {new Date(profile.lastEditedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="w-full md:w-auto flex items-center gap-4">
                <div className="w-32 bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200 shrink-0">
                  <div className="bg-amber-500 h-full rounded-full w-1/2" />
                </div>
                <span className="text-xs font-extrabold text-amber-600 shrink-0">50% Draft Mode</span>
              </div>
            </div>

            <QuestionnaireWizard onSubmitSuccess={fetchDashboardData} />
          </div>
        )}

        {/* If Allocation is submitted but still pending */}
        {dashboardData?.status === 'PENDING_ALLOCATION' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-slate-200 rounded-[2rem] p-8 md:p-12 text-center max-w-2xl mx-auto space-y-6 shadow-sm print-card"
          >
            <div className="w-20 h-20 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto relative">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Allocation Process In Progress</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Your questionnaire responses have been received! The hostel administration is currently running the greedy compatibility heuristics engine to map student preferences. Check back here shortly.
            </p>
            {profile?.submittedAt && (
              <p className="text-[10px] text-slate-400 font-bold uppercase">
                Submitted on: {new Date(profile.submittedAt).toLocaleDateString()}
              </p>
            )}
          </motion.div>
        )}

        {/* If Allocation exists */}
        {dashboardData?.status === 'ALLOCATED' && allocation && (
          <div className="space-y-8">
            
            {/* Top Row: Room Allocation & Match Indicators */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print-grid">
              
              {/* Room Details Card (Section 3) */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between print-card">
                <div>
                  <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest mb-3">Hostel Placement</h3>
                  <div className="text-6xl font-black text-slate-850 tracking-tight">{allocation.room_number}</div>
                  <h4 className="font-bold text-slate-800 text-sm mt-3">{allocation.hostelName}</h4>
                </div>
                <div className="border-t border-slate-100 pt-4 mt-6 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Room Size: {getCapacityLabel(allocation.room_capacity)}</span>
                  <span>Occupancy: {allocation.room_occupancy} / {allocation.room_capacity} Beds</span>
                </div>
              </div>

              {/* Compatibility Gauge Card (Section 3) */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center print-card relative overflow-hidden">
                <div className="absolute top-4 left-6 text-left">
                  <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest">Match Quality</h3>
                </div>
                
                <div className="relative w-32 h-32 flex items-center justify-center mt-4">
                  <svg className="w-full h-full transform -rotate-95" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      stroke="#10b981" 
                      strokeWidth="8" 
                      fill="transparent" 
                      strokeDasharray={`${2 * Math.PI * 40 * (allocation.compatibilityScore / 100)} 251.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-3xl font-black text-slate-800">{allocation.compatibilityScore}%</span>
                </div>
                
                <h4 className="text-emerald-600 font-extrabold text-sm mt-4 flex items-center gap-1.5 justify-center">
                  <Sparkles className="w-4 h-4" /> {allocation.matchLabel}
                </h4>
              </div>

              {/* Room Stability Score Card (Section 7) */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center print-card relative">
                <div className="absolute top-4 left-6 text-left">
                  <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest">Stability Index</h3>
                </div>
                
                <div className="relative w-32 h-32 flex items-center justify-center mt-4">
                  <svg className="w-full h-full transform -rotate-95" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      stroke="#8b5cf6" 
                      strokeWidth="8" 
                      fill="transparent" 
                      strokeDasharray={`${2 * Math.PI * 40 * (allocation.stabilityScore / 100)} 251.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-3xl font-black text-slate-800">{allocation.stabilityScore}/100</span>
                </div>
                
                <h4 className="text-violet-600 font-extrabold text-sm mt-4">
                  Stability Rating
                </h4>
              </div>

            </div>

            {/* Explanations & Positive Matches Timeline (Section 5 & 8) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print-grid">
              
              {/* Dynamic Matches Timeline (Section 5 & 8) */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm print-card flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-md border-b border-slate-100 pb-3 mb-4">Why We Matched</h3>
                  <p className="text-slate-500 text-xs leading-relaxed mb-6 font-semibold bg-violet-50/40 p-3.5 rounded-xl border border-violet-100/50">
                    {allocation.matchingExplanation}
                  </p>
                </div>
                
                <div className="space-y-3.5">
                  {allocation.whyWeMatched && allocation.whyWeMatched.length > 0 ? (
                    allocation.whyWeMatched.map((factor: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold">
                        <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                          <span className="text-emerald-600 font-black">✓</span>
                        </div>
                        <span>{factor}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic">Common preferences map complete.</p>
                  )}
                  {allocation.preferredRoomSizeSatisfied !== null && (
                    <div className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${allocation.preferredRoomSizeSatisfied ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
                        <span className={`font-black ${allocation.preferredRoomSizeSatisfied ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {allocation.preferredRoomSizeSatisfied ? '✓' : '!'}
                        </span>
                      </div>
                      <span>
                        {allocation.preferredRoomSizeSatisfied
                          ? 'You got your preferred room size.'
                          : 'Your room size differs from what you requested.'}
                      </span>
                    </div>
                  )}
                  {allocation.accessibilityNeedSatisfied !== null && (
                    <div className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${allocation.accessibilityNeedSatisfied ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
                        <span className={`font-black ${allocation.accessibilityNeedSatisfied ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {allocation.accessibilityNeedSatisfied ? '✓' : '!'}
                        </span>
                      </div>
                      <span>
                        {allocation.accessibilityNeedSatisfied
                          ? 'Your accessibility request was honored.'
                          : "We weren't able to accommodate your accessibility request this time."}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Constructive Potential Differences Card (Section 6) */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm print-card flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-md border-b border-slate-100 pb-3 mb-4">Things to discuss together</h3>
                  <p className="text-slate-500 text-xs leading-relaxed mb-6">
                    Mismatches are normal! We recommend talking through these parameters during roommate onboarding to prevent conflicts early on.
                  </p>
                </div>
                
                <div className="space-y-3.5">
                  {allocation.thingsToDiscuss && allocation.thingsToDiscuss.length > 0 ? (
                    allocation.thingsToDiscuss.map((diff: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold">
                        <div className="w-5 h-5 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                          <span className="text-amber-600 font-extrabold">⚠️</span>
                        </div>
                        <span>{diff}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <Heart className="w-4 h-4 shrink-0" />
                      <span>Zero routines differences detected! Roommates are highly synchronized.</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Roommate Cards (Section 4) */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm print-card">
              <h3 className="font-extrabold text-slate-800 text-md border-b border-slate-100 pb-3 mb-6">Your Roommates</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {allocation.roommates && allocation.roommates.length > 0 ? (
                  allocation.roommates.map((rm: any, idx: number) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex items-center gap-4 hover:border-violet-300 transition-colors">
                      <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center text-xl font-bold text-violet-700 shrink-0">
                        {rm.initials}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-md">{rm.name}</p>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                          {rm.branch} • Year {rm.year}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No assigned roommates found.</p>
                )}
              </div>
            </div>

            {/* Action Center Card (Section 9) */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm print-hidden action-center-card">
              <h3 className="font-extrabold text-slate-800 text-md border-b border-slate-100 pb-3 mb-6">Action & Onboarding Center</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button 
                  onClick={handleDownloadPDF}
                  className="p-4 bg-slate-50 border border-slate-200 hover:border-violet-300 rounded-2xl flex flex-col items-start gap-2 text-left transition-all"
                >
                  <FileText className="w-6 h-6 text-violet-600" />
                  <span className="text-xs font-bold text-slate-800">Print Assignment Ticket</span>
                  <span className="text-[10px] text-slate-400">Save a physical PDF copy of your matching placement.</span>
                </button>
                <button
                  onClick={() => router.push('/student/request')}
                  className="p-4 bg-slate-50 border border-slate-200 hover:border-red-300 rounded-2xl flex flex-col items-start gap-2 text-left transition-all"
                >
                  <ShieldAlert className="w-6 h-6 text-red-500" />
                  <span className="text-xs font-bold text-slate-800">Report Allocation Issue</span>
                  <span className="text-[10px] text-slate-400">Request review or schedule swap negotiations.</span>
                </button>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-start gap-2 text-left opacity-60">
                  <MessageSquare className="w-6 h-6 text-blue-500" />
                  <span className="text-xs font-bold text-slate-800">Room Swap Board (Coming Soon)</span>
                  <span className="text-[10px] text-slate-400">Exchange rooms with peers under supervisor audits.</span>
                </div>
              </div>
            </div>

            {/* Roommate Chat Area - Keep Chat active (Section 9) */}
            {session?.user?.email && session?.user?.name && (
            <div className="pt-6 border-t border-slate-200 chat-section">
              <RoomChat 
                roomId={allocation.roomId} 
                currentUserEmail={session.user.email}
                currentUserName={session.user.name}
              />
            </div>
            )}

          </div>
        )}

      </main>
    </div>
  );
}

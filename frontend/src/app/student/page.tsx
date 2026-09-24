"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import {
  LogOut, Loader2, Sparkles,
  FileText, ShieldAlert, AlertCircle, RefreshCw, MessageSquare, Heart, BellRing, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import RoomChat from "@/components/RoomChat";
import QuestionnaireWizard from "@/components/QuestionnaireWizard";
import RoomOccupancyVisual from "@/components/dashboard/RoomOccupancyVisual";
import RoomFitLogo from "@/components/landing/RoomFitLogo";
import { AnimatedRing, EyebrowBadge } from "@/components/premium";
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
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        >
          <Loader2 className="w-10 h-10 text-teal-700 animate-spin" />
        </motion.div>
        <p className="text-stone-600 mt-4 text-sm">Loading your dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center p-6">
        <div className="card p-8 rounded-xl max-w-md text-center space-y-5">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold text-stone-800">Connection Error</h2>
          <p className="text-stone-600 text-sm">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="w-full btn-primary font-semibold py-3 rounded-lg text-sm flex items-center justify-center gap-2"
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

  // Real occupants for the room hero visual - the signed-in student plus
  // their actual roommates, never a placeholder count.
  const occupants = allocation
    ? [
        { initials: (session?.user?.name || "You").split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase(), name: session?.user?.name || "You", isMe: true },
        ...((allocation.roommates || []).map((rm: any) => ({ initials: rm.initials, name: rm.name }))),
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#faf9f7] text-stone-800 relative overflow-hidden font-sans pb-16">

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
            border: 1px solid #e7e5e4 !important;
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

      {/* Decorative background - kept flat and print-hidden */}
      <div className="hidden" aria-hidden="true" />

      {/* Navbar (hidden in print) */}
      <nav className="sticky top-0 z-50 bg-white border-b border-stone-200 px-5 sm:px-6 py-3 flex items-center justify-between print-hidden">
        <div className="flex items-center gap-3">
          <RoomFitLogo className="w-7 h-7" />
          <div>
            <h1 className="font-bold text-stone-900 tracking-tight text-[15px] leading-none">RoomFit</h1>
            <p className="text-[10px] font-medium text-stone-500 mt-1">Student housing</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {profile && (
            <div className="bg-stone-100 border border-stone-200 px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hidden md:block">
              {profile.branch} • Year {profile.year_of_study}
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 bg-stone-900 hover:bg-stone-700 text-white font-semibold py-2 px-4 rounded-lg text-[13px] transition-colors"
          >
            Sign Out <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="w-full max-w-6xl mx-auto px-5 sm:px-6 py-8 relative z-10 space-y-6">

        {/* Unread notifications - live socket pushes and anything that landed
            while the student was offline both surface here. */}
        <AnimatePresence>
          {notifications.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-start gap-3 print-hidden shadow-soft"
            >
              <div className="w-9 h-9 bg-white border border-teal-200 rounded-lg flex items-center justify-center shrink-0">
                <BellRing className="w-4 h-4 text-teal-800" />
              </div>
              <div className="flex-1 space-y-1.5">
                {notifications.map((n, idx) => (
                  <p key={n._id || idx} className="text-sm font-medium text-teal-950">
                    {n.message}
                  </p>
                ))}
              </div>
              <button
                onClick={dismissNotifications}
                aria-label="Dismiss notifications"
                className="w-8 h-8 rounded-lg hover:bg-teal-100 flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-4 h-4 text-teal-800" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Welcome + status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-stone-950 tracking-tight">
              Welcome back, {profile?.name ? profile.name.split(' ')[0] : (session?.user?.name ? session.user.name.split(' ')[0] : 'Student')}
            </h1>
            <p className="text-stone-600 text-[15px] mt-2">
              {dashboardData?.status === 'ALLOCATED'
                ? "Your housing details and roommate matches are ready."
                : "Complete your preferences to initialize roommate allocation."}
            </p>
          </div>
          <div className="flex items-center gap-3 print-hidden">
            <span className={`px-3.5 py-2 rounded-full text-[12px] font-semibold border flex items-center gap-2 ${
              dashboardData?.status === 'ALLOCATED' ? 'bg-teal-800 text-white border-teal-800' :
              dashboardData?.status === 'PENDING_ALLOCATION' ? 'bg-amber-50 text-amber-900 border-amber-200' :
              'bg-white text-stone-700 border-stone-300'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dashboardData?.status === 'ALLOCATED' ? 'bg-teal-300' : dashboardData?.status === 'PENDING_ALLOCATION' ? 'bg-amber-500' : 'bg-stone-300'}`} aria-hidden="true" />
              {dashboardData?.status === 'ALLOCATED' ? 'Placed' :
               dashboardData?.status === 'PENDING_ALLOCATION' ? 'Matching in progress' :
               `${dashboardData?.status?.replace('_', ' ')}`}
            </span>
          </div>
        </div>

        {/* If Questionnaire has not been submitted yet */}
        {dashboardData?.status === 'NOT_SUBMITTED' && showWizard && (
          <div className="space-y-6">
            {/* Progress summary */}
            <div className="card p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print-hidden shadow-soft">
              <div className="space-y-2">
                <h3 className="font-bold text-stone-800 text-md">Roommate Preference Questionnaire</h3>
                <p className="text-stone-600 text-xs">
                  Your profile responses are in draft mode. Complete the profile questionnaire to participate in matching runs.
                </p>
                {profile?.lastEditedAt && (
                  <p className="text-[10px] text-stone-600 font-bold uppercase">
                    Last Saved: {new Date(profile.lastEditedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="w-full md:w-auto flex items-center gap-4">
                <div className="w-32 bg-stone-200 h-2.5 rounded-full overflow-hidden shrink-0">
                  <div className="bg-amber-500 h-full rounded-full w-1/2" />
                </div>
                <span className="text-xs font-extrabold text-amber-700 shrink-0">50% Draft Mode</span>
              </div>
            </div>

            <QuestionnaireWizard onSubmitSuccess={fetchDashboardData} />
          </div>
        )}

        {/* If Allocation is submitted but still pending */}
        {dashboardData?.status === 'PENDING_ALLOCATION' && (
          <div className="card-premium rounded-[24px] p-10 text-center max-w-xl mx-auto space-y-4 print-card shadow-soft">
            <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto">
              <Loader2 className="w-5 h-5 text-amber-700 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-stone-900">Allocation in progress</h2>
            <p className="text-stone-600 text-sm leading-relaxed">
              Your questionnaire responses have been received! The hostel administration is currently running the greedy compatibility heuristics engine to map student preferences. Check back here shortly.
            </p>
            {profile?.submittedAt && (
              <p className="text-[10px] text-stone-600 font-bold uppercase">
                Submitted on: {new Date(profile.submittedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* If Allocation exists */}
        {dashboardData?.status === 'ALLOCATED' && allocation && (
          <div className="space-y-6">

            {/* Room assignment hero */}
            <div className="card-premium rounded-[24px] overflow-hidden print-card shadow-soft">
              <div className="hero-wash px-6 sm:px-8 pt-7 pb-6 border-b border-stone-100">
                <EyebrowBadge>Your room assignment</EyebrowBadge>
                <div className="flex flex-wrap items-end justify-between gap-6 mt-4">
                  <div>
                    <div className="text-6xl sm:text-7xl font-bold text-stone-950 tracking-tight leading-none">{allocation.room_number}</div>
                    <h4 className="font-semibold text-stone-700 text-[15px] mt-3">{allocation.hostelName}{allocation.block ? ` · Block ${allocation.block}` : ""}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <span className="chip chip-stone">{getCapacityLabel(allocation.room_capacity)}</span>
                      <span className="chip chip-stone">{allocation.room_occupancy} of {allocation.room_capacity} beds filled</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="text-center">
                      <AnimatedRing score={allocation.compatibilityScore} size={112} />
                      <p className="text-[12px] text-teal-900 font-semibold mt-2 flex items-center justify-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> {allocation.matchLabel}
                      </p>
                    </div>
                    <div className="text-center pl-5 border-l border-stone-200">
                      <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Stability</p>
                      <p className="text-[30px] font-bold text-stone-900 leading-none mt-1 tabular-nums">{allocation.stabilityScore}</p>
                      <p className="text-[11px] text-stone-500 mt-1.5">Predicted room<br />stability</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 sm:px-8 py-6">
                <RoomOccupancyVisual capacity={allocation.room_capacity} occupants={occupants} />
              </div>
            </div>

            {/* Roommates */}
            <div className="card-premium p-6 sm:p-7 rounded-[20px] print-card shadow-soft">
              <h3 className="font-bold text-stone-900 text-[16px] border-b border-stone-100 pb-4 mb-5">Your roommates</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allocation.roommates && allocation.roommates.length > 0 ? (
                  allocation.roommates.map((rm: any, idx: number) => (
                    <div key={idx} className="border border-stone-200 p-4 rounded-2xl flex items-center gap-3.5 lift bg-white">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[14px] font-bold text-amber-900 shrink-0">
                        {rm.initials}
                      </div>
                      <div>
                        <p className="font-bold text-stone-900 text-[14px]">{rm.name}</p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {rm.branch} • Year {rm.year}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">No assigned roommates found.</p>
                )}
              </div>
            </div>

            {/* Explanations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print-grid">

              <div className="card-premium p-6 rounded-[20px] print-card shadow-soft">
                <div>
                  <h3 className="font-bold text-stone-900 text-[16px] border-b border-stone-100 pb-4 mb-5">Why you were matched</h3>
                  <p className="text-stone-700 text-[13px] leading-relaxed mb-5">
                    {allocation.matchingExplanation}
                  </p>
                </div>

                <ul className="space-y-2.5">
                  {allocation.whyWeMatched && allocation.whyWeMatched.length > 0 ? (
                    allocation.whyWeMatched.map((factor: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2.5 text-[13px] text-stone-700">
                        <span className="w-5 h-5 rounded-full bg-teal-800 text-white flex items-center justify-center text-[11px] font-bold shrink-0">✓</span>
                        <span>{factor}</span>
                      </li>
                    ))
                  ) : (
                    <p className="text-[13px] text-stone-500">Common preferences map complete.</p>
                  )}
                  {allocation.preferredRoomSizeSatisfied !== null && (
                    <li className="flex items-start gap-2.5 text-[13px] text-stone-700">
                      <span className="w-5 h-5 rounded-full bg-stone-800 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                        {allocation.preferredRoomSizeSatisfied ? '✓' : '!'}
                      </span>
                      <span>
                        {allocation.preferredRoomSizeSatisfied
                          ? 'You got your preferred room size.'
                          : 'Your room size differs from what you requested.'}
                      </span>
                    </li>
                  )}
                  {allocation.accessibilityNeedSatisfied !== null && (
                    <li className="flex items-start gap-2.5 text-[13px] text-stone-700">
                      <span className="w-5 h-5 rounded-full bg-stone-800 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                        {allocation.accessibilityNeedSatisfied ? '✓' : '!'}
                      </span>
                      <span>
                        {allocation.accessibilityNeedSatisfied
                          ? 'Your accessibility request was honored.'
                          : "We weren't able to accommodate your accessibility request this time."}
                      </span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="card-premium p-6 rounded-[20px] print-card shadow-soft">
                <div>
                  <h3 className="font-bold text-stone-900 text-[16px] border-b border-stone-100 pb-4 mb-5">Things to discuss together</h3>
                  <p className="text-stone-600 text-[13px] leading-relaxed mb-5">
                    Differences are normal. Talking through these early prevents conflicts later.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {allocation.thingsToDiscuss && allocation.thingsToDiscuss.length > 0 ? (
                    allocation.thingsToDiscuss.map((diff: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2.5 text-[13px] text-stone-700">
                        <span className="w-5 h-5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center text-[11px] font-bold shrink-0">!</span>
                        <span>{diff}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 text-[13px] text-teal-900 font-medium p-3 bg-teal-50 rounded-lg border border-teal-200">
                      <Heart className="w-4 h-4 shrink-0" />
                      <span>No routine differences detected — your room is well aligned.</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Roommate Chat Area */}
            {session?.user?.email && session?.user?.name && (
            <div className="pt-5 border-t border-stone-200 chat-section">
              <RoomChat
                roomId={allocation.roomId}
                currentUserEmail={session.user.email}
                currentUserName={session.user.name}
              />
            </div>
            )}

            {/* Actions */}
            <div className="card-premium p-6 rounded-[20px] print-hidden action-center-card shadow-soft">
              <h3 className="font-bold text-stone-900 text-[16px] border-b border-stone-100 pb-4 mb-5">Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={handleDownloadPDF}
                  className="p-5 border border-stone-200 hover:border-teal-800/40 hover:-translate-y-0.5 hover:shadow-soft rounded-2xl flex flex-col items-start gap-1.5 text-left transition-all bg-white"
                >
                  <FileText className="w-5 h-5 text-teal-800" />
                  <span className="text-[13px] font-bold text-stone-900">Print assignment</span>
                  <span className="text-xs text-stone-500">Save a copy of your placement.</span>
                </button>
                <button
                  onClick={() => router.push('/student/request')}
                  className="p-5 border border-stone-200 hover:border-teal-800/40 hover:-translate-y-0.5 hover:shadow-soft rounded-2xl flex flex-col items-start gap-1.5 text-left transition-all bg-white"
                >
                  <ShieldAlert className="w-5 h-5 text-amber-700" />
                  <span className="text-[13px] font-bold text-stone-900">Report an issue</span>
                  <span className="text-xs text-stone-500">Request a review of your allocation.</span>
                </button>
                <div className="p-4 border border-stone-200 rounded-lg flex flex-col items-start gap-1.5 text-left opacity-60">
                  <MessageSquare className="w-5 h-5 text-stone-400" />
                  <span className="text-[13px] font-bold text-stone-900">Room swaps (soon)</span>
                  <span className="text-xs text-stone-500">Exchange rooms under supervision.</span>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { ArrowLeft, Check, Loader2, Send, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { PROXY_URL } from "@/lib/api";

export default function StudentRequestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allocation, setAllocation] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [requestType, setRequestType] = useState<"GENERAL" | "ACCESSIBILITY">("GENERAL");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchAllocation = useCallback(async () => {
    try {
      const email = session?.user?.email;
      if (!email) return;
      const res = await axios.get(`${PROXY_URL}/student/dashboard`);
      if (res.data.status === 'ALLOCATED') {
          setAllocation(res.data.allocation);
      } else {
          router.push('/student');
      }
    } catch (err) {
      console.error(err);
    }
  }, [session, router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      fetchAllocation();
    }
  }, [status, router, fetchAllocation]);

  const canSubmit = allocation && (requestType === "ACCESSIBILITY" || reason.trim());

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;

      const email = session?.user?.email;
      const name = session?.user?.name;
      if (!email || !name) {
          alert('Session expired. Please log in again.');
          return;
      }

      setSubmitting(true);
      try {
          // email/name are derived server-side from the verified session by the
          // proxy + backend now, not sent from the client.
          await axios.post(`${PROXY_URL}/student/change-request`, {
              roomId: allocation.roomId,
              reason,
              requestType,
              requestedAccommodation: requestType === "ACCESSIBILITY" ? "Ground floor" : undefined
          });
          setSuccess(true);
      } catch {
          alert('Failed to submit request');
      } finally {
          setSubmitting(false);
      }
  }

  if (status === "loading" || !allocation) return <div className="min-h-screen bg-stone-50" />;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 flex justify-center p-6 md:p-[6vw] pb-20">

        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-5xl glass-card rounded-[2rem] p-10 md:p-14 relative z-10"
        >
            <button onClick={() => router.push('/student')} className="flex items-center gap-2 text-stone-600 hover:text-stone-800 font-medium transition-colors mb-8 text-sm">
                <ArrowLeft size={16}/> Back to Dashboard
            </button>

            <h1 className="text-4xl font-semibold text-stone-900 mb-3 leading-tight">Request Room Change</h1>
            <p className="text-stone-600 mb-8">Current Assignment: <span className="text-orange-800 font-medium bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">{allocation.room_number}</span> (Block {allocation.block})</p>

            {success ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-8 rounded-2xl text-center">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-sm">
                        <Check size={20} className="text-emerald-700" />
                    </div>
                    Your request has been successfully submitted to the administration. You will be notified of any structural changes on your dashboard.
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-orange-50 border border-orange-200 p-5 rounded-2xl flex items-start gap-4">
                        <AlertTriangle className="text-orange-700 shrink-0 mt-0.5" size={20} />
                        <p className="text-[13px] text-orange-800 font-medium leading-relaxed">Room changes are subject to availability and administration approval. Only submit a request if you have a valid, irreconcilable reason.</p>
                    </div>

                    <div>
                        <label className="block text-stone-800 mb-2 font-medium">What are you requesting?</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setRequestType("GENERAL")}
                                className={`text-left p-4 rounded-xl border transition-all ${requestType === "GENERAL" ? "bg-orange-50 border-orange-300" : "bg-stone-50 border-stone-200 hover:border-stone-300"}`}
                            >
                                <div className="font-medium text-stone-800">General room change</div>
                                <div className="text-[12px] text-stone-600 mt-1">Roommate conflict, personal reason, etc.</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setRequestType("ACCESSIBILITY")}
                                className={`text-left p-4 rounded-xl border transition-all ${requestType === "ACCESSIBILITY" ? "bg-orange-50 border-orange-300" : "bg-stone-50 border-stone-200 hover:border-stone-300"}`}
                            >
                                <div className="font-medium text-stone-800">Ground floor accommodation</div>
                                <div className="text-[12px] text-stone-600 mt-1">Structured accessibility request.</div>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-stone-800 mb-2 font-medium">
                            {requestType === "ACCESSIBILITY" ? "Additional details (optional)" : "Reason for change"}
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required={requestType === "GENERAL"}
                            rows={6}
                            placeholder="Please provide a detailed explanation for your request..."
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl p-4 text-stone-800 focus:bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none transition-all resize-none placeholder:text-stone-400"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || !canSubmit}
                        className="w-full flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-medium py-3.5 rounded-full transition-all shadow-md shadow-teal-900/15"
                    >
                        {submitting ? <Loader2 className="animate-spin w-5 h-5"/> : <Send className="w-4 h-4 ml-[-4px]" />}
                        Submit Request
                    </button>
                </form>
            )}
        </motion.div>
    </div>
  );
}



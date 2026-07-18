"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowLeft, Loader2, Send, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { API_URL } from "@/lib/api";

export default function StudentRequestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [allocation, setAllocation] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      fetchAllocation();
    }
  }, [status, router, session]);

  const fetchAllocation = async () => {
    try {
      const email = session?.user?.email;
      if (!email) return;
      const res = await axios.get(`${API_URL}/api/student/dashboard/${email}`);
      if (res.data.status === 'ALLOCATED') {
          setAllocation(res.data);
      } else {
          router.push('/student');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!reason.trim() || !allocation) return;
      
      setSubmitting(true);
      try {
          await axios.post(`${API_URL}/api/student/change-request`, {
              email: session?.user?.email,
              name: session?.user?.name,
              roomId: allocation.room_id,
              reason: reason
          });
          setSuccess(true);
      } catch (err) {
          alert('Failed to submit request');
      } finally {
          setSubmitting(false);
      }
  }

  if (status === "loading" || !allocation) return <div className="min-h-screen bg-[#F7F4EE]" />;

  return (
    <div className="min-h-screen bg-[#F7F4EE] font-['Outfit'] text-[#1A2820] flex justify-center p-6 md:p-[6vw] pb-20">

        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-5xl bg-white rounded-[20px] p-10 md:p-14 border border-[#1A3A2A]/10 shadow-[0_8px_40px_rgba(26,56,42,0.07)] relative z-10"
        >
            <button onClick={() => router.push('/student')} className="flex items-center gap-2 text-[#7A9088] hover:text-[#1A3A2A] font-medium transition-colors mb-8 text-sm">
                <ArrowLeft size={16}/> Back to Dashboard
            </button>

            <h1 className="text-4xl font-['Cormorant_Garamond'] font-semibold text-[#1A3A2A] mb-3 leading-tight">Request Room Change</h1>
            <p className="text-[#3A4F44] mb-8 font-light">Current Assignment: <span className="text-[#C4613A] font-medium bg-[#FAF0EB] px-2 py-0.5 rounded-md border border-[#C4613A]/20">{allocation.room_number}</span> (Block {allocation.block})</p>

            {success ? (
                <div className="bg-[#EBF4EF] border border-[#7BAE94]/30 text-[#2E6347] p-8 rounded-2xl text-center">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border border-[#7BAE94]/20 shadow-sm">
                        <Check size={20} className="text-[#2E6347]" />
                    </div>
                    Your request has been successfully submitted to the administration. You will be notified of any structural changes on your dashboard.
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-[#FAF0EB] border border-[#C4613A]/20 p-5 rounded-2xl flex items-start gap-4">
                        <AlertTriangle className="text-[#C4613A] shrink-0 mt-0.5" size={20} />
                        <p className="text-[13px] text-[#C4613A]/90 font-medium leading-relaxed">Room changes are subject to availability and administration approval. Only submit a request if you have a valid, irreconcilable reason.</p>
                    </div>

                    <div>
                        <label className="block text-[#1A3A2A] mb-2 font-medium">Reason for change</label>
                        <textarea 
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required
                            rows={6}
                            placeholder="Please provide a detailed explanation for your request..."
                            className="w-full bg-[#F7F4EE] border border-[#1A3A2A]/10 rounded-xl p-4 text-[#1A2820] focus:bg-white focus:border-[#C4613A] focus:ring-1 focus:ring-[#C4613A] outline-none transition-all resize-none placeholder:text-[#7A9088]/60"
                        />
                    </div>

                    <button 
                        type="submit"
                        disabled={submitting || !reason.trim()}
                        className="w-full flex items-center justify-center gap-2 bg-[#C4613A] hover:bg-[#D4784F] hover:-translate-y-[2px] hover:shadow-[0_12px_36px_rgba(196,97,58,0.4)] disabled:opacity-50 disabled:transform-none text-white font-medium py-3.5 rounded-full transition-all shadow-[0_4px_24px_rgba(196,97,58,0.3)]"
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

// Inline fallback for Check
const Check = ({className, size}: any) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"></polyline></svg>

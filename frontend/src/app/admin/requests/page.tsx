"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowLeft, Check, X, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function AdminRequests() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated" && session.user?.role !== "admin" && session.user?.role !== "ADMIN") {
      router.push("/unauthorized");
    } else if (status === "authenticated") {
      fetchRequests();
    }
  }, [status, router, session]);

  const fetchRequests = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/requests");
      setRequests(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAction = async (requestId: string, actionStatus: string) => {
      try {
          await axios.post("http://localhost:5000/api/admin/requests/action", {
              requestId: requestId,
              status: actionStatus
          });
          fetchRequests();
      } catch (err) {
          alert('Failed to update request status');
      }
  }

  if (status === "loading") return null;

  return (
    <div className="min-h-screen bg-[#F7F4EE] font-['Outfit'] text-[#1A2820] flex justify-center px-6 md:px-[6vw] py-6 pb-20">

        <div className="w-full relative z-10 pt-4">
            <div className="flex items-center justify-between mb-8">
                <Link href="/admin" className="flex items-center gap-2 text-[#7A9088] hover:text-[#1A3A2A] font-medium transition-colors text-sm">
                    <ArrowLeft size={16}/> Back to Dashboard
                </Link>
            </div>

            <div className="mb-10">
                <h1 className="text-4xl md:text-[44px] font-['Cormorant_Garamond'] font-semibold text-[#1A3A2A] mb-3 leading-tight">Room Change Requests</h1>
                <p className="text-[#3A4F44] mb-8 font-light max-w-2xl leading-[1.7]">Review change requests submitted by students. Approve to formally mark it, then execute manual overrides via the Allocations panel if necessary.</p>
            </div>

            <div className="space-y-6">
                {requests.length === 0 ? (
                    <div className="bg-white p-16 flex flex-col items-center justify-center text-[#7A9088] rounded-[24px] border border-[#1A3A2A]/10 shadow-sm">
                        <HelpCircle size={48} className="mb-4 opacity-30 text-[#1A3A2A]" />
                        <h3 className="text-xl font-semibold text-[#1A3A2A] mb-1">No requests</h3>
                        <p className="font-light">All students are happy with their assignment.</p>
                    </div>
                ) : requests.map((req: any, i: number) => (
                    <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay: i * 0.1}} key={req._id} className="bg-white p-8 rounded-[20px] border border-[#1A3A2A]/10 shadow-[0_8px_40px_rgba(26,56,42,0.06)] flex flex-col md:flex-row gap-8 justify-between group flex-wrap">
                        <div className="flex-1">
                            <div className="flex items-center gap-4 mb-2.5">
                                <h3 className="text-[20px] font-semibold text-[#1A3A2A]">{req.studentName || req.studentId}</h3>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-[1px] uppercase border
                                    ${req.status === 'Pending' ? 'bg-[#FBF5E6] text-[#8A6A1A] border-[#C9A84C]/30' : 
                                      req.status === 'Approved' ? 'bg-[#EBF4EF] text-[#2E6347] border-[#7BAE94]/30' : 
                                      'bg-[#FAF0EB] text-[#C4613A] border-[#C4613A]/20'}`}>
                                    {req.status}
                                </span>
                            </div>
                            <div className="text-[13px] text-[#7A9088] font-light mb-6 flex flex-col gap-1.5">
                                <div>Original Assigned Room: <span className="text-[#1A3A2A] font-semibold ml-1">{req.currentRoomId?.room_number || req.currentRoomId || 'Unknown'}</span> <span className="opacity-50 ml-2 font-mono tracking-tighter">(ID: {req.currentRoomId?._id || req.currentRoomId})</span></div>
                                {req.actualRoomNumber && (
                                   <div className="text-[#2E6347] font-medium">Currently Placed In: <span className="bg-[#EBF4EF] px-2 py-0.5 rounded-md border border-[#7BAE94]/30 ml-1 font-semibold">{req.actualRoomNumber}</span></div>
                                )}
                            </div>
                            <div className="bg-[#F7F4EE] p-5 rounded-2xl border border-[#1A3A2A]/5 text-[14px] text-[#3A4F44] leading-[1.7] italic font-light">
                                "{req.reason}"
                            </div>
                            <div className="text-[11px] text-[#7A9088] mt-3 font-medium">Submitted {new Date(req.createdAt).toLocaleString()}</div>
                        </div>

                        {req.status === 'Pending' && (
                            <div className="flex flex-row md:flex-col gap-3 justify-center md:w-48">
                                <button onClick={() => handleAction(req._id, 'Approved')} className="bg-white hover:bg-[#EBF4EF] text-[#2E6347] border border-[#1A3A2A]/10 hover:border-[#7BAE94]/40 font-medium px-4 md:px-6 py-2.5 md:py-3.5 rounded-full transition-all flex flex-1 items-center justify-center gap-2 text-[14px]">
                                    <Check size={18} strokeWidth={2.5} /> Approve
                                </button>
                                <button onClick={() => handleAction(req._id, 'Rejected')} className="bg-white hover:bg-[#FAF0EB] text-[#C4613A] border border-[#1A3A2A]/10 hover:border-[#C4613A]/30 font-medium px-4 md:px-6 py-2.5 md:py-3.5 rounded-full transition-all flex flex-1 items-center justify-center gap-2 text-[14px]">
                                    <X size={18} strokeWidth={2.5} /> Reject
                                </button>
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>

        </div>
    </div>
  );
}

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { ArrowLeft, Check, X, HelpCircle, DoorOpen, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { PROXY_URL } from "@/lib/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EligibleState = { loading: boolean; currentRoom?: any; eligibleRooms?: any[]; error?: string; moving?: string };

export default function AdminRequests() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [eligibleByRequest, setEligibleByRequest] = useState<Record<string, EligibleState>>({});

  const fetchRequests = useCallback(async () => {
    try {
      const res = await axios.get(`${PROXY_URL}/admin/requests`);
      setRequests(res.data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated" && session.user?.role !== "admin" && session.user?.role !== "ADMIN") {
      router.push("/unauthorized");
    } else if (status === "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRequests();
    }
  }, [status, router, session, fetchRequests]);

  const handleAction = async (requestId: string, actionStatus: string) => {
      try {
          await axios.post(`${PROXY_URL}/admin/requests/action`, {
              requestId: requestId,
              status: actionStatus
          });
          fetchRequests();
      } catch {
          alert('Failed to update request status');
      }
  }

  const handleFindEligibleRooms = async (requestId: string) => {
      setEligibleByRequest(prev => ({ ...prev, [requestId]: { loading: true } }));
      try {
          const res = await axios.get(`${PROXY_URL}/admin/requests/${requestId}/eligible-rooms`);
          setEligibleByRequest(prev => ({ ...prev, [requestId]: { loading: false, ...res.data } }));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
          setEligibleByRequest(prev => ({
              ...prev,
              [requestId]: { loading: false, error: err.response?.data?.error || 'Failed to load eligible rooms' }
          }));
      }
  }

  const handleAccommodate = async (requestId: string, targetRoomId: string) => {
      setEligibleByRequest(prev => ({ ...prev, [requestId]: { ...prev[requestId], moving: targetRoomId } }));
      try {
          await axios.post(`${PROXY_URL}/admin/requests/accommodate`, { requestId, targetRoomId });
          setEligibleByRequest(prev => {
              const next = { ...prev };
              delete next[requestId];
              return next;
          });
          fetchRequests();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
          alert(err.response?.data?.error || 'Failed to move student');
          setEligibleByRequest(prev => ({ ...prev, [requestId]: { ...prev[requestId], moving: undefined } }));
      }
  }

  if (status === "loading") return null;

  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#292524] flex justify-center px-6 md:px-[6vw] py-6 pb-20">

        <div className="w-full relative z-10 pt-4">
            <div className="flex items-center justify-between mb-8">
                <Link href="/admin" className="flex items-center gap-2 text-[#57534e] hover:text-[#115e59] font-medium transition-colors text-sm">
                    <ArrowLeft size={16}/> Back to Dashboard
                </Link>
            </div>

            <div className="mb-10">
                <h1 className="text-4xl md:text-[44px] font-semibold text-[#115e59] mb-3 leading-tight">Room Change Requests</h1>
                <p className="text-[#44403c] mb-8 font-light max-w-2xl leading-[1.7]">Review change requests submitted by students. Approve to formally mark it, then execute manual overrides via the Allocations panel if necessary.</p>
            </div>

            <div className="space-y-6">
                {requests.length === 0 ? (
                    <div className="bg-white p-16 flex flex-col items-center justify-center text-[#57534e] rounded-[24px] border border-[#115e59]/10 shadow-sm">
                        <HelpCircle size={48} className="mb-4 opacity-30 text-[#115e59]" />
                        <h3 className="text-xl font-semibold text-[#115e59] mb-1">No requests</h3>
                        <p className="font-light">All students are happy with their assignment.</p>
                    </div>
                ) : requests.map(// eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (req: any, i: number) => (
                    <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay: i * 0.1}} key={req._id} className="bg-white p-8 rounded-[20px] border border-[#115e59]/10 shadow-[0_8px_40px_rgba(26,56,42,0.06)] flex flex-col md:flex-row gap-8 justify-between group flex-wrap">
                        <div className="flex-1">
                            <div className="flex items-center gap-4 mb-2.5 flex-wrap">
                                <h3 className="text-[20px] font-semibold text-[#115e59]">{req.studentName || req.studentId}</h3>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-[1px] uppercase border
                                    ${req.status === 'Pending' ? 'bg-[#fffbeb] text-[#92400e] border-[#fbbf24]/30' :
                                      req.status === 'Approved' ? 'bg-[#ecfdf5] text-[#047857] border-[#34d399]/30' :
                                      'bg-[#fff7ed] text-[#c2410c] border-[#c2410c]/20'}`}>
                                    {req.status}
                                </span>
                                {req.requestType === 'ACCESSIBILITY' && (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-[1px] uppercase border bg-[#f0fdfa] text-[#0f766e] border-[#2dd4bf]/30">
                                        Accessibility · {req.requestedAccommodation}
                                    </span>
                                )}
                            </div>
                            <div className="text-[13px] text-[#57534e] font-light mb-6 flex flex-col gap-1.5">
                                <div>Original Assigned Room: <span className="text-[#115e59] font-semibold ml-1">{req.currentRoomId?.room_number || req.currentRoomId || 'Unknown'}</span> <span className="opacity-50 ml-2 font-mono tracking-tighter">(ID: {req.currentRoomId?._id || req.currentRoomId})</span></div>
                                {req.actualRoomNumber && (
                                   <div className="text-[#047857] font-medium">Currently Placed In: <span className="bg-[#ecfdf5] px-2 py-0.5 rounded-md border border-[#34d399]/30 ml-1 font-semibold">{req.actualRoomNumber}</span></div>
                                )}
                            </div>
                            {req.reason && (
                                <div className="bg-[#fafaf9] p-5 rounded-2xl border border-[#115e59]/5 text-[14px] text-[#44403c] leading-[1.7] italic font-light">
                                    &quot;{req.reason}&quot;
                                </div>
                            )}
                            <div className="text-[11px] text-[#57534e] mt-3 font-medium">Submitted {new Date(req.createdAt).toLocaleString()}</div>

                            {req.status === 'Pending' && req.requestType === 'ACCESSIBILITY' && (
                                <div className="mt-5 pt-5 border-t border-[#115e59]/10">
                                    {!eligibleByRequest[req._id] ? (
                                        <button
                                            onClick={() => handleFindEligibleRooms(req._id)}
                                            className="bg-[#f0fdfa] hover:bg-[#ccfbf1] text-[#0f766e] border border-[#2dd4bf]/30 font-medium px-5 py-2.5 rounded-full transition-all flex items-center gap-2 text-[13px]"
                                        >
                                            <DoorOpen size={16} /> Find Eligible Rooms
                                        </button>
                                    ) : eligibleByRequest[req._id].loading ? (
                                        <div className="flex items-center gap-2 text-[#57534e] text-[13px]"><Loader2 size={16} className="animate-spin" /> Loading eligible rooms...</div>
                                    ) : eligibleByRequest[req._id].error ? (
                                        <p className="text-[#c2410c] text-[13px] font-medium">{eligibleByRequest[req._id].error}</p>
                                    ) : (eligibleByRequest[req._id].eligibleRooms?.length ?? 0) === 0 ? (
                                        <p className="text-[#57534e] text-[13px] font-medium italic">No eligible ground-floor rooms with an open slot right now.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-[12px] text-[#57534e] font-semibold uppercase tracking-wide mb-2">Eligible rooms - pick one to move the student</p>
                                            {eligibleByRequest[req._id].eligibleRooms!.map((room) => (
                                                <div key={room._id} className="flex items-center justify-between bg-[#fafaf9] border border-[#115e59]/10 rounded-xl px-4 py-3">
                                                    <div className="text-[13px] text-[#115e59]">
                                                        <span className="font-semibold">{room.room_number}</span>
                                                        <span className="text-[#57534e] ml-2">Floor {room.floor} · {room.occupancy}/{room.room_capacity} occupied · {room.openSlots} open</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAccommodate(req._id, room._id)}
                                                        disabled={!!eligibleByRequest[req._id].moving}
                                                        className="bg-[#047857] hover:bg-[#115e59] disabled:opacity-50 text-white font-medium px-4 py-2 rounded-full transition-all flex items-center gap-2 text-[12px]"
                                                    >
                                                        {eligibleByRequest[req._id].moving === room._id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                        Move Here
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {req.status === 'Pending' && (
                            <div className="flex flex-row md:flex-col gap-3 justify-center md:w-48">
                                {req.requestType !== 'ACCESSIBILITY' && (
                                    <button onClick={() => handleAction(req._id, 'Approved')} className="bg-white hover:bg-[#ecfdf5] text-[#047857] border border-[#115e59]/10 hover:border-[#34d399]/40 font-medium px-4 md:px-6 py-2.5 md:py-3.5 rounded-full transition-all flex flex-1 items-center justify-center gap-2 text-[14px]">
                                        <Check size={18} strokeWidth={2.5} /> Approve
                                    </button>
                                )}
                                <button onClick={() => handleAction(req._id, 'Rejected')} className="bg-white hover:bg-[#fff7ed] text-[#c2410c] border border-[#115e59]/10 hover:border-[#c2410c]/30 font-medium px-4 md:px-6 py-2.5 md:py-3.5 rounded-full transition-all flex flex-1 items-center justify-center gap-2 text-[14px]">
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

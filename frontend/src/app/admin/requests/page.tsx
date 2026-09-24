/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Check, X, HelpCircle, DoorOpen, Loader2 } from "lucide-react";
import { PROXY_URL } from "@/lib/api";
import AdminShell from "@/components/admin/AdminShell";
import { Panel } from "@/components/admin/panels";

type EligibleState = { loading: boolean; currentRoom?: any; eligibleRooms?: any[]; error?: string; moving?: string };

export default function AdminRequests() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [eligibleByRequest, setEligibleByRequest] = useState<Record<string, EligibleState>>({});
  const [filter, setFilter] = useState("All");

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
      } catch (err: any) {
          alert(err.response?.data?.error || 'Failed to move student');
          setEligibleByRequest(prev => ({ ...prev, [requestId]: { ...prev[requestId], moving: undefined } }));
      }
  }

  if (status === "loading") return null;

  const pending = requests.filter((r: any) => r.status === "Pending").length;
  const visible = requests.filter((r: any) => filter === "All" || r.status === filter);

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-8 pb-6">
        <div>
          <p className="eyebrow text-teal-800 mb-2">RoomFit Console · Requests</p>
          <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight text-stone-900 leading-tight">Room change requests</h1>
          <p className="text-sm text-stone-500 mt-1.5">
            Review requests from students. {pending > 0 ? `${pending} awaiting review.` : "All caught up."}
          </p>
        </div>
        <div className="flex items-center gap-2 print-hidden" role="group" aria-label="Filter requests by status">
          {["All", "Pending", "Approved", "Rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={`px-3.5 py-2 rounded-lg text-[13px] font-semibold border transition-colors ${
                filter === s
                  ? "bg-teal-800 text-white border-teal-800"
                  : "bg-white text-stone-600 border-stone-300 hover:border-stone-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5 items-start">
        <div className="col-span-12 xl:col-span-8 space-y-4 min-w-0">
          {visible.length === 0 ? (
            <Panel label="Requests" className="p-12 flex flex-col items-center justify-center text-stone-500">
              <HelpCircle size={40} className="mb-3 text-stone-300" aria-hidden="true" />
              <h3 className="text-[16px] font-bold text-stone-900 mb-1">
                {requests.length === 0 ? "No open requests" : `No ${filter.toLowerCase()} requests`}
              </h3>
              <p className="text-sm">{requests.length === 0 ? "All students are settled with their assignment." : "Try a different status filter."}</p>
            </Panel>
          ) : visible.map((req: any) => (
            <Panel label={`Request from ${req.studentName || req.studentId}`} key={req._id} className="p-5">
              <div className="flex flex-col md:flex-row gap-5 justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                    <h3 className="text-[16px] font-bold text-stone-900">{req.studentName || req.studentId}</h3>
                    <span className={`px-2 py-1 rounded-md text-[11px] font-semibold border
                      ${req.status === 'Pending' ? 'bg-amber-50 text-amber-900 border-amber-200' :
                        req.status === 'Approved' ? 'bg-teal-50 text-teal-900 border-teal-200' :
                        'bg-stone-100 text-stone-600 border-stone-200'}`}>
                      {req.status}
                    </span>
                    {req.requestType === 'ACCESSIBILITY' && (
                      <span className="px-2 py-1 rounded-md text-[11px] font-semibold border bg-white text-stone-600 border-stone-300">
                        Accessibility · {req.requestedAccommodation}
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] text-stone-600 mb-4 flex flex-col gap-1">
                    <div>Assigned room: <span className="text-stone-900 font-semibold ml-1">{req.currentRoomId?.room_number || req.currentRoomId || 'Unknown'}</span></div>
                    {req.actualRoomNumber && (
                      <div className="text-teal-900 font-medium">Currently placed in: <span className="font-semibold">{req.actualRoomNumber}</span></div>
                    )}
                  </div>
                  {req.reason && (
                    <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 text-sm text-stone-700 leading-relaxed">
                      &quot;{req.reason}&quot;
                    </div>
                  )}
                  <div className="text-xs text-stone-500 mt-3 tabular-nums">Submitted {new Date(req.createdAt).toLocaleString()}</div>

                  {req.status === 'Pending' && req.requestType === 'ACCESSIBILITY' && (
                    <div className="mt-4 pt-4 border-t border-stone-200">
                      {!eligibleByRequest[req._id] ? (
                        <button
                          onClick={() => handleFindEligibleRooms(req._id)}
                          className="bg-white hover:border-stone-500 text-stone-800 border border-stone-300 font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-[13px]"
                        >
                          <DoorOpen size={16} aria-hidden="true" /> Find eligible rooms
                        </button>
                      ) : eligibleByRequest[req._id].loading ? (
                        <div className="flex items-center gap-2 text-stone-500 text-[13px]"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Loading eligible rooms…</div>
                      ) : eligibleByRequest[req._id].error ? (
                        <p className="text-red-700 text-[13px] font-medium" role="alert">{eligibleByRequest[req._id].error}</p>
                      ) : (eligibleByRequest[req._id].eligibleRooms?.length ?? 0) === 0 ? (
                        <p className="text-stone-500 text-[13px]">No eligible ground-floor rooms with an open slot right now.</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-stone-500 font-semibold mb-2">Eligible rooms — pick one to move the student</p>
                          {eligibleByRequest[req._id].eligibleRooms!.map((room) => (
                            <div key={room._id} className="flex flex-wrap items-center justify-between gap-2 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3">
                              <div className="text-[13px] text-stone-800">
                                <span className="font-bold">{room.room_number}</span>
                                <span className="text-stone-500 ml-2 tabular-nums">Floor {room.floor} · {room.occupancy}/{room.room_capacity} occupied · {room.openSlots} open</span>
                              </div>
                              <button
                                onClick={() => handleAccommodate(req._id, room._id)}
                                disabled={!!eligibleByRequest[req._id].moving}
                                className="btn-primary disabled:opacity-50 font-semibold px-4 py-2 rounded-lg flex items-center gap-2 text-xs"
                              >
                                {eligibleByRequest[req._id].moving === room._id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                                Move here
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {req.status === 'Pending' && (
                  <div className="flex flex-row md:flex-col gap-2.5 justify-center md:w-44 shrink-0">
                    {req.requestType !== 'ACCESSIBILITY' && (
                      <button onClick={() => handleAction(req._id, 'Approved')} className="bg-white hover:border-teal-800 text-teal-900 border border-stone-300 font-semibold px-4 py-2.5 rounded-lg transition-colors flex flex-1 items-center justify-center gap-2 text-sm">
                        <Check size={16} aria-hidden="true" /> Approve
                      </button>
                    )}
                    <button onClick={() => handleAction(req._id, 'Rejected')} className="bg-white hover:border-stone-500 text-stone-700 border border-stone-300 font-semibold px-4 py-2.5 rounded-lg transition-colors flex flex-1 items-center justify-center gap-2 text-sm">
                      <X size={16} aria-hidden="true" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </Panel>
          ))}
        </div>

        <aside className="col-span-12 xl:col-span-4 min-w-0" aria-label="Request summary">
          <Panel label="Request summary" className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">Queue summary</p>
            <dl className="mt-3 divide-y divide-stone-100">
              {[
                { label: "Pending review", value: pending, hot: pending > 0 },
                { label: "Approved", value: requests.filter((r: any) => r.status === "Approved").length, hot: false },
                { label: "Rejected", value: requests.filter((r: any) => r.status === "Rejected").length, hot: false },
                { label: "Total requests", value: requests.length, hot: false },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline justify-between py-2.5">
                  <dt className="text-[13px] text-stone-500">{row.label}</dt>
                  <dd className={`text-sm font-bold tabular-nums ${row.hot ? "text-amber-700" : "text-stone-900"}`}>{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-stone-500 leading-relaxed mt-3 pt-3 border-t border-stone-100">
              Accessibility requests can be resolved by moving the student to an eligible room directly. General requests are reviewed here, then applied from the Allocations panel.
            </p>
          </Panel>
        </aside>
      </div>
    </AdminShell>
  );
}

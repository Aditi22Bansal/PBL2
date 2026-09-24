/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { Database, FileText, ShieldAlert, Shuffle } from "lucide-react";
import { PROXY_URL } from "@/lib/api";
import AdminShell from "@/components/admin/AdminShell";
import RoomExplorer from "@/components/admin/RoomExplorer";
import { Panel } from "@/components/admin/panels";
import { inputCls } from "@/lib/admin";

export default function AdminAllocations() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [allocations, setAllocations] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forceAllocating, setForceAllocating] = useState(false);

  // Custom manual swap states
  const [swapping, setSwapping] = useState(false);
  const [swapData, setSwapData] = useState({ roomAId: '', memberA: '', roomBId: '', memberB: '' });

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
      setLoading(true);
      const res = await axios.get(`${PROXY_URL}/admin/allocations`);
      if (res.data.allocations) {
         setAllocations(res.data.allocations);
         setUnassigned(res.data.unassigned || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLock = async (roomId: string, currentLockStatus: boolean) => {
      const newStatus = !currentLockStatus;

       // Optimistic UI Update: Instantly change the button state before server replies
       setAllocations((prev: any) => prev.map((a: any) =>
          a._id === roomId ? { ...a, isLocked: newStatus } : a
      ));

       try {
           await axios.post(`${PROXY_URL}/admin/allocations/toggle-lock`, {
               roomId: roomId,
               isLocked: newStatus
           });
           // No need to fetchAllocations() again since we already updated the state!
       } catch {
            // Rollback the UI if the server actually fails
            setAllocations((prev: any) => prev.map((a: any) =>
               a._id === roomId ? { ...a, isLocked: currentLockStatus } : a
            ));
            alert('Failed to update lock status in the database.');
      }
  }

   const handleSwap = async (e: any) => {
      e.preventDefault();
      try {
          await axios.post(`${PROXY_URL}/admin/allocations/manual-swap`, swapData);
          setSwapping(false);
          setSwapData({ roomAId: '', memberA: '', roomBId: '', memberB: '' });
          alert("Swap completed successfully!");
          fetchAllocations();
       } catch (err: any) {
           alert(err.response?.data?.error || "Failed to swap members. Double check member IDs.");
       }
   }

  const handleForceAllocate = async () => {
      setForceAllocating(true);
      try {
          const res = await axios.post(`${PROXY_URL}/admin/force-allocate`);
          alert(res.data.message);
          fetchAllocations();
       } catch (err: any) {
           alert(err.response?.data?.error || "Force allocation failed.");
      } finally {
          setForceAllocating(false);
      }
  }

  const downloadPDF = async () => {
    if (allocations.length === 0) {
        alert("No allocations to export. Run the engine first.");
        return;
    }

    // Load jsPDF from CDN to completely avoid Next.js SSR/webpack issues
    const loadScript = (src: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(s);
        });
    };

    try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    } catch {
        alert("Failed to load PDF library. Check your internet connection.");
        return;
    }

    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const now = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });

    // Header
    doc.setFillColor(17, 94, 89); // #115e59
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('RoomFit — Hostel Room Allocation Report', 14, 14);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${now}  |  Total Rooms: ${allocations.length}  |  Unassigned: ${unassigned.length}`, 14, 22);

    // Sort allocations by room number
    const sorted = [...allocations].sort((a: any, b: any) => (a.room_number || '').localeCompare(b.room_number || ''));

    // Table data
    const tableRows = sorted.map((a: any) => {
        const members = (a.memberDetails || a.members || []).map((m: string, i: number) => `${i + 1}. ${m}`).join('\n');
        const score = typeof a.compatibility_score === 'number' ? `${(a.compatibility_score * 100).toFixed(1)}%` : 'N/A';
        return [
            a.room_number || '-',
            `Block ${a.block || '-'}\nFloor ${a.floor || '-'}`,
            a.gender_group || '-',
            score,
            members,
            a.isLocked ? 'LOCKED' : 'Open'
        ];
    });

    (doc as any).autoTable({
        startY: 34,
        head: [['Room', 'Location', 'Category', 'Match %', 'Assigned Students', 'Status']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
            fillColor: [194, 65, 12], // #c2410c
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
            halign: 'center',
            cellPadding: 4
        },
        bodyStyles: {
            fontSize: 8,
            cellPadding: 3,
            textColor: [68, 64, 60], // #44403c
            lineColor: [200, 200, 200],
            lineWidth: 0.25
        },
        alternateRowStyles: {
            fillColor: [250, 250, 249] // #fafaf9
        },
        columnStyles: {
            0: { halign: 'center', fontStyle: 'bold', cellWidth: 25 },
            1: { halign: 'center', cellWidth: 28 },
            2: { halign: 'center', cellWidth: 35 },
            3: { halign: 'center', cellWidth: 22 },
            4: { cellWidth: 'auto' },
            5: { halign: 'center', cellWidth: 22 }
        },
        didDrawPage: (data: any) => {
            // Footer on each page
            const pageCount = (doc as any).internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                `Page ${data.pageNumber} of ${pageCount}  —  Hostel Allocation System  —  RoomFit`,
                pageWidth / 2, doc.internal.pageSize.getHeight() - 8,
                { align: 'center' }
            );
        }
    });

    // Unassigned section (if any)
    if (unassigned.length > 0) {
        const finalY = (doc as any).lastAutoTable?.finalY || 40;
        const remainingSpace = doc.internal.pageSize.getHeight() - finalY;
        if (remainingSpace < 40) doc.addPage();
        const startY = remainingSpace < 40 ? 20 : finalY + 12;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(194, 65, 12); // #c2410c
        doc.text(`Unassigned Students (${unassigned.length})`, 14, startY);

    (doc as any).autoTable({
            startY: startY + 4,
            head: [['#', 'Student']],
            body: unassigned.map((u: string, i: number) => [String(i + 1), u]),
            theme: 'grid',
            headStyles: { fillColor: [120, 120, 120], fontSize: 9 },
            bodyStyles: { fontSize: 8 },
        });
    }

    doc.save('Hostel_Allocations_Report.pdf');
  }

  if (status === "loading") return null;

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-4 pt-8 pb-6 print-hidden">
        <div>
          <p className="eyebrow text-teal-800 mb-2">RoomFit Console · Allocations</p>
          <h1 className="text-[30px] sm:text-[34px] font-bold tracking-tight text-stone-900 leading-tight">Room allocations</h1>
          <p className="text-sm text-stone-500 mt-1.5">View, lock, or modify assigned rooms. Locked rooms are left untouched by later allocation runs.</p>
        </div>
        <div className="flex gap-2.5">
          <button onClick={() => setSwapping(!swapping)} className="bg-white border border-stone-300 hover:border-stone-500 text-stone-800 px-4 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition-colors">
            <Shuffle size={16} aria-hidden="true" /> Manual swap
          </button>
          <button onClick={downloadPDF} className="btn-primary px-4 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2">
            <FileText size={16} aria-hidden="true" /> Download PDF
          </button>
        </div>
      </div>

      {swapping && (
        <form onSubmit={handleSwap} className="bg-white border border-stone-200 rounded-2xl p-5 mb-6 grid grid-cols-1 md:grid-cols-5 gap-4 items-end shadow-[0_1px_2px_rgba(28,25,23,0.05)] print-hidden">
          <div>
            <label className="text-[12px] font-semibold text-stone-700 block mb-1.5">Room A ID</label>
            <input className={`${inputCls} w-full`} required value={swapData.roomAId} onChange={e=>setSwapData({...swapData, roomAId: e.target.value})} placeholder="Room A ID" />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-stone-700 block mb-1.5">Member A email</label>
            <input className={`${inputCls} w-full`} required value={swapData.memberA} onChange={e=>setSwapData({...swapData, memberA: e.target.value})} placeholder="Email to move"/>
          </div>
          <div>
            <label className="text-[12px] font-semibold text-stone-700 block mb-1.5">Room B ID</label>
            <input className={`${inputCls} w-full`} required value={swapData.roomBId} onChange={e=>setSwapData({...swapData, roomBId: e.target.value})} placeholder="Room B ID"/>
          </div>
          <div>
            <label className="text-[12px] font-semibold text-stone-700 block mb-1.5">Member B email</label>
            <input className={`${inputCls} w-full`} required value={swapData.memberB} onChange={e=>setSwapData({...swapData, memberB: e.target.value})} placeholder="Email to replace"/>
          </div>
          <button type="submit" className="w-full btn-primary rounded-lg p-2.5 font-semibold transition-colors text-sm">Execute swap</button>
        </form>
      )}

      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-[17px] font-semibold text-stone-900">Generated allotments</h2>
        <div className="bg-white px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 flex items-center gap-2 border border-stone-300">
          <Database className="w-3.5 h-3.5" aria-hidden="true" /> {allocations.length} rooms
        </div>
      </div>

      {loading ? (
        <Panel label="Allocations" className="px-5 py-16 text-center">
          <p className="text-sm text-stone-500">Loading room data…</p>
        </Panel>
      ) : (
        <RoomExplorer allocations={allocations} variant="manage" onToggleLock={toggleLock} />
      )}

      {unassigned.length > 0 && (
        <Panel label="Unassigned students" className="overflow-hidden mt-6">
          <div className="p-5 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/50">
            <div>
              <h3 className="font-bold text-[15px] text-stone-900">Unassigned students</h3>
              <p className="text-stone-600 text-[13px] mt-1">These students could not be matched. Force-allocate to assign them rooms.</p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="bg-white border border-stone-300 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 tabular-nums">
                {unassigned.length} pending
              </div>
              <button
                onClick={handleForceAllocate}
                disabled={forceAllocating}
                className="bg-amber-700 hover:bg-amber-800 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition-colors"
              >
                {forceAllocating ? "Allocating…" : (<><ShieldAlert size={14} aria-hidden="true" /> Force allocate all</>)}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto nice-scroll max-h-[400px] overflow-y-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-stone-50 text-stone-500 border-b border-stone-200 sticky top-0">
                <tr>
                  <th className="px-5 py-3 font-bold uppercase text-[11px] tracking-wider w-12">#</th>
                  <th className="px-5 py-3 font-bold uppercase text-[11px] tracking-wider">Student</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {unassigned.map((student: string, idx: number) => (
                  <tr key={idx} className="hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-2.5 text-stone-500 text-[13px] tabular-nums">{idx + 1}</td>
                    <td className="px-5 py-2.5 font-medium text-[14px]">{student}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </AdminShell>
  );
}

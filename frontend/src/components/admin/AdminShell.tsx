"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, LogOut } from "lucide-react";
import RoomFitLogo from "@/components/landing/RoomFitLogo";

const NAV = [
  { href: "/admin", label: "Overview", match: /^\/admin\/?$/ },
  { href: "/admin/allocations", label: "Allocations", match: /^\/admin\/allocations/ },
  { href: "/admin/students", label: "Students", match: /^\/admin\/students/ },
  { href: "/admin/requests", label: "Requests", match: /^\/admin\/requests/ },
  { href: "/admin/analytics", label: "Analytics", match: /^\/admin\/analytics/ },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [accountOpen, setAccountOpen] = useState(false);
  const adminInitial = (session?.user?.name?.trim()?.[0] || "A").toUpperCase();

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-stone-800">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            body { background: white !important; color: black !important; }
            header, .print-hidden, button, input, select, .no-print { display: none !important; }
            main { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; }
            section { page-break-inside: avoid; }
          }`,
        }}
      />

      <header className="bg-white border-b border-stone-200 sticky top-0 z-40 print-hidden">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center gap-5">
            <Link href="/admin" className="flex items-center gap-2.5 shrink-0" aria-label="RoomFit console home">
              <RoomFitLogo className="w-8 h-8" />
              <span className="leading-none">
                <span className="block font-bold text-[15px] tracking-tight text-stone-900">RoomFit</span>
                <span className="block text-[11px] text-stone-500 mt-0.5">Console</span>
              </span>
            </Link>

            <nav aria-label="Console" className="hidden md:flex items-center gap-1 self-stretch ml-2">
              {NAV.map((item) => {
                const active = item.match.test(pathname || "");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`px-3 flex items-center text-sm border-b-2 -mb-px transition-colors ${
                      active
                        ? "font-semibold text-teal-900 border-teal-800"
                        : "font-medium text-stone-500 hover:text-stone-900 border-transparent"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto relative">
              <button
                onClick={() => setAccountOpen((v) => !v)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 hover:bg-stone-100 transition-colors"
              >
                <span className="w-8 h-8 rounded-full bg-teal-800 text-white flex items-center justify-center text-[13px] font-bold" aria-hidden="true">
                  {adminInitial}
                </span>
                <span className="hidden sm:block text-left leading-tight">
                  <span className="block text-[13px] font-semibold text-stone-900 max-w-[150px] truncate">
                    {session?.user?.name || "Administrator"}
                  </span>
                  <span className="block text-[11px] text-stone-500">Administrator</span>
                </span>
                <ChevronDown className="w-4 h-4 text-stone-400" aria-hidden="true" />
              </button>
              {accountOpen && (
                <>
                  <button
                    aria-label="Close account menu"
                    className="fixed inset-0 z-10 cursor-default bg-transparent border-0 p-0"
                    onClick={() => setAccountOpen(false)}
                  />
                  <div role="menu" className="absolute right-0 mt-1.5 w-64 z-20 bg-white border border-stone-200 rounded-xl shadow-lg p-1.5">
                    <div className="px-3 py-2.5 border-b border-stone-100 mb-1">
                      <p className="text-[13px] font-semibold text-stone-900 truncate">{session?.user?.name || "Administrator"}</p>
                      <p className="text-xs text-stone-500 truncate mt-0.5">{session?.user?.email}</p>
                    </div>
                    <button
                      role="menuitem"
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] font-medium text-stone-700 hover:bg-stone-100 transition-colors"
                    >
                      <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile / tablet secondary nav row */}
          <nav aria-label="Console sections" className="md:hidden flex gap-1 overflow-x-auto nice-scroll -mb-px pb-0">
            {NAV.map((item) => {
              const active = item.match.test(pathname || "");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`px-3 py-2.5 text-[13px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    active
                      ? "font-semibold text-teal-900 border-teal-800"
                      : "font-medium text-stone-500 border-transparent"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-20">{children}</main>
    </div>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import RoomFitLogo from "@/components/landing/RoomFitLogo";

/** Shared auth layout — plain centered card on the warm canvas. */
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="min-h-screen hero-wash flex flex-col items-center px-4 py-10 sm:justify-center relative overflow-hidden">
      <div aria-hidden="true" className="absolute -top-24 right-[8%] w-64 h-64 rounded-full bg-teal-200/25 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-24 left-[8%] w-64 h-64 rounded-full bg-amber-200/25 blur-3xl" />
      <button
        onClick={() => router.push("/")}
        className="self-start sm:absolute sm:top-6 sm:left-6 flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors mb-6 sm:mb-0"
      >
        <ArrowLeft className="w-4 h-4" /> Back to home
      </button>

      <div className="w-full max-w-md relative">
        <div className="flex items-center justify-center gap-2 mb-6">
          <RoomFitLogo className="w-9 h-9" />
          <p className="font-bold text-stone-900 text-[16px]">RoomFit</p>
        </div>

        <div className="card-premium rounded-[24px] shadow-soft px-6 py-8 sm:px-8">
          <h1 className="text-[22px] font-bold tracking-tight text-stone-950 text-center">
            {title}
          </h1>
          {subtitle && (
            <p className="text-stone-600 text-sm text-center leading-relaxed mt-2 mb-7">
              {subtitle}
            </p>
          )}
          <div className={subtitle ? "" : "mt-7"}>{children}</div>
        </div>
        <p className="text-center text-xs text-stone-500 mt-4">
          Restricted to your institution&apos;s email domain
        </p>
      </div>
    </div>
  );
}

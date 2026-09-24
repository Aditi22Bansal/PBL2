import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import RoomFitLogo from "@/components/landing/RoomFitLogo";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center px-4 py-10 sm:justify-center">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <RoomFitLogo className="w-8 h-8" />
          <p className="font-bold text-stone-900 text-[15px]">RoomFit</p>
        </div>
        <div className="card rounded-2xl p-8 text-center">
          <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-6 h-6 text-amber-800" />
          </div>
          <h1 className="text-[20px] font-bold tracking-tight text-stone-950 mb-2">Access denied</h1>
          <p className="text-sm text-stone-600 mb-7 leading-relaxed">
            This area is restricted to <span className="text-stone-900 font-semibold">your institution&apos;s</span> accounts.
            Please log in again with your official email.
          </p>
          <Link
            href="/login"
            className="btn-primary inline-flex items-center gap-2 font-semibold text-sm py-2.5 px-5 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

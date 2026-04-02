import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="bg-slate-900 border border-red-500/20 p-8 rounded-2xl max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-50 mb-4">Access Denied</h1>
        <p className="text-slate-400 mb-8">
          This system is restricted to <span className="text-white font-medium">@sitpune.edu.in</span> accounts.
          Please try logging in again with your official college email.
        </p>
        <Link 
          href="/"
          className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>
      </div>
    </div>
  );
}

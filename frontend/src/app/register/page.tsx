"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ShieldCheck, Building2, Check, AlertTriangle, Loader2 } from "lucide-react";
import axios from "axios";
import { API_URL } from "@/lib/api";
import AuthShell from "@/components/AuthShell";

export default function RegisterPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [domain, setDomain] = useState("");
  const [founderName, setFounderName] = useState("");
  const [founderEmail, setFounderEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit = orgName.trim() && domain.trim() && founderName.trim() && founderEmail.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      // Public, unauthenticated endpoint - there's no session yet at this
      // point, so this goes straight to the backend (API_URL), not through
      // the authenticated proxy (which requires a session to already exist).
      await axios.post(`${API_URL}/api/auth/register-organization`, {
        orgName: orgName.trim(),
        domain: domain.trim(),
        founderName: founderName.trim(),
        founderEmail: founderEmail.trim(),
      });
      setSuccess(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create organization. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full bg-white border border-stone-300 rounded-lg px-3.5 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-teal-800 transition-colors placeholder:text-stone-400";

  return (
    <AuthShell
      title="Create your organization"
      subtitle="Set up RoomFit for your institution. Your email domain becomes the gate — only your organization's addresses will be accepted."
    >
      <div className="mx-auto bg-teal-50 text-teal-800 border border-teal-200 p-3 rounded-lg w-12 h-12 flex items-center justify-center mb-5">
        <Building2 className="w-6 h-6" strokeWidth={1.5} />
      </div>

      {success ? (
        <div className="bg-teal-50 border border-teal-200 text-teal-900 p-5 rounded-lg text-center space-y-4">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto border border-teal-200">
            <Check size={18} className="text-teal-800" />
          </div>
          <p className="text-sm leading-relaxed">
            Organization created. You&apos;re registered as the founding administrator for{" "}
            <span className="font-bold">{domain.trim()}</span>.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="btn-primary w-full font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm"
          >
            Log in now <ChevronRight size={16} />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-lg flex items-start gap-2.5 text-[13px] leading-relaxed">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-semibold text-stone-700 mb-1.5">
              Organization name
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Greenfield University"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-stone-700 mb-1.5">
              Email domain
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. greenfield.edu"
              className={inputCls}
            />
            <p className="text-[12px] text-stone-500 mt-1.5">
              Only accounts ending in this domain will be able to sign in.
            </p>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-stone-700 mb-1.5">
              Your name
            </label>
            <input
              type="text"
              value={founderName}
              onChange={(e) => setFounderName(e.target.value)}
              placeholder="e.g. Ananya Sharma"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-stone-700 mb-1.5">
              Your email
            </label>
            <input
              type="email"
              value={founderEmail}
              onChange={(e) => setFounderEmail(e.target.value)}
              placeholder="e.g. aditi@greenfield.edu"
              className={inputCls}
            />
            <p className="text-[12px] text-stone-500 mt-1.5">
              Must belong to the domain above — this becomes your founding admin account.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed font-semibold py-3 px-5 rounded-lg text-sm"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Create organization
                <ChevronRight className="w-4 h-4 opacity-70" />
              </>
            )}
          </button>
        </form>
      )}

      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-stone-500">
        <ShieldCheck className="w-4 h-4 text-teal-800" />
        <span>One founding admin per organization</span>
      </div>

      <div className="mt-3 text-center">
        <span className="text-xs text-stone-500">Already have an organization? </span>
        <button
          onClick={() => router.push("/login")}
          className="text-xs text-teal-800 hover:text-teal-950 font-semibold transition-colors"
        >
          Log in here →
        </button>
      </div>
    </AuthShell>
  );
}

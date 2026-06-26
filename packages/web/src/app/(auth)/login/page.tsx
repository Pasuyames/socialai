"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail, Lock, Zap, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router     = useRouter();
  const params     = useSearchParams();
  // Açık yönlendirme koruması: yalnızca site-içi mutlak path'e izin ver
  // ("//evil.com" ve "https://evil.com" gibi harici hedefler reddedilir)
  const rawCallback = params.get("callbackUrl") ?? "/dashboard";
  const callbackUrl = /^\/(?!\/)/.test(rawCallback) ? rawCallback : "/dashboard";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", { email, password, redirect: false });

    if (res?.error) {
      setError("Email veya şifre hatalı.");
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "#05050A" }}>

      {/* Background glow orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-[0.07]"
        style={{ background: "radial-gradient(circle, #6C5CE7 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] rounded-full opacity-[0.05]"
        style={{ background: "radial-gradient(circle, #00D2FF 0%, transparent 70%)" }} />

      <div className="w-full max-w-sm relative z-10 animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 relative"
            style={{ background: "linear-gradient(135deg, #6C5CE7, #00D2FF)", boxShadow: "0 0 40px rgba(108,92,231,0.4)" }}>
            <Zap size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">SocialAI</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Ajans otomasyonuna giriş yap</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#1E1E2E] p-7 space-y-5"
          style={{ background: "rgba(12,12,22,0.9)", backdropFilter: "blur(20px)" }}>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block font-medium">
                Email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@sirket.com"
                  required
                  className="w-full bg-[#08080F] border border-[#1E1E2E] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(108,92,231,0.1)] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block font-medium">
                Şifre
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#08080F] border border-[#1E1E2E] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(108,92,231,0.1)] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
              style={{
                background: "linear-gradient(135deg, #6C5CE7, #5a4dd4)",
                boxShadow: "0 0 20px rgba(108,92,231,0.35)",
              }}
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Giriş yapılıyor...</>
                : <><ArrowRight size={15} /> Giriş Yap</>
              }
            </button>
          </form>

          <div className="h-px bg-[#1A1A2E]" />

          <p className="text-center text-sm text-muted-foreground">
            Hesabın yok mu?{" "}
            <Link href="/register" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Ücretsiz başla →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

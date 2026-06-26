"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Loader2, Mail, Lock, User, Building2, Zap, ArrowRight, CheckCircle2 } from "lucide-react";

const features = [
  "20 AI ajan otomatik çalışır",
  "Instagram içerikleri üretilir",
  "Aylık strateji planlanır",
];

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({ name: "", email: "", password: "", orgName: "" });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Bir hata oluştu.");
      setLoading(false);
      return;
    }

    await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    router.push("/dashboard");
    router.refresh();
  }

  const inputCls = "w-full bg-[#08080F] border border-[#1E1E2E] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(108,92,231,0.1)] transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{ background: "#05050A" }}>

      {/* Background orbs */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.06] pointer-events-none"
        style={{ background: "radial-gradient(circle, #6C5CE7 0%, transparent 70%)" }} />

      <div className="w-full max-w-sm relative z-10 animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-13 h-13 rounded-2xl mb-4 relative"
            style={{ background: "linear-gradient(135deg, #6C5CE7, #00D2FF)", boxShadow: "0 0 40px rgba(108,92,231,0.35)", width: 52, height: 52 }}>
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">SocialAI</h1>
          <p className="text-sm text-muted-foreground mt-1.5">14 günlük ücretsiz deneme ile başla</p>
        </div>

        {/* Features */}
        <div className="flex flex-col gap-1.5 mb-6">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 size={13} className="text-primary shrink-0" />
              {f}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#1E1E2E] p-7 space-y-4"
          style={{ background: "rgba(12,12,22,0.9)", backdropFilter: "blur(20px)" }}>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block font-medium">Adın</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={form.name} onChange={update("name")}
                    placeholder="Mustafa" required className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block font-medium">Ajans</label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={form.orgName} onChange={update("orgName")}
                    placeholder="Ajansım" required className={inputCls} />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block font-medium">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="email" value={form.email} onChange={update("email")}
                  placeholder="ornek@sirket.com" required className={inputCls} />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block font-medium">Şifre</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" value={form.password} onChange={update("password")}
                  placeholder="En az 8 karakter" required minLength={8} className={inputCls} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60 mt-1"
              style={{ background: "linear-gradient(135deg, #6C5CE7, #5a4dd4)", boxShadow: "0 0 20px rgba(108,92,231,0.35)" }}
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Oluşturuluyor...</>
                : <><ArrowRight size={15} /> Ücretsiz Başla</>
              }
            </button>
          </form>

          <div className="h-px bg-[#1A1A2E]" />

          <p className="text-center text-sm text-muted-foreground">
            Zaten hesabın var mı?{" "}
            <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Giriş yap →
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground/40 mt-4">
          Kayıt olarak Kullanım Koşulları ve Gizlilik Politikası'nı kabul edersiniz.
        </p>
      </div>
    </div>
  );
}

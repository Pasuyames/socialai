"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

const CATEGORIES = [
  { value: "general",  label: "Genel" },
  { value: "billing",  label: "Fatura / Ödeme" },
  { value: "bug",      label: "Hata Bildirimi" },
  { value: "feature",  label: "Özellik İsteği" },
];

const PRIORITIES = [
  { value: "low",    label: "Düşük" },
  { value: "normal", label: "Normal" },
  { value: "high",   label: "Yüksek" },
  { value: "urgent", label: "Acil" },
];

export default function NewTicketForm() {
  const router = useRouter();
  const [form, setForm] = useState({ subject: "", category: "general", priority: "normal", body: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/support/tickets", {
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

    setForm({ subject: "", category: "general", priority: "normal", body: "" });
    setLoading(false);
    router.refresh();
  }

  const inputCls = "w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}

      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Konu</label>
        <input type="text" placeholder="Sorununuzu kısaca yazın" required value={form.subject} onChange={update("subject")} className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Kategori</label>
          <select value={form.category} onChange={update("category")} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Öncelik</label>
          <select value={form.priority} onChange={update("priority")} className={inputCls}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Mesaj</label>
        <textarea placeholder="Sorununuzu detaylı açıklayın..." required rows={5} value={form.body} onChange={update("body")} className={`${inputCls} resize-none`} />
      </div>

      <button type="submit" disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-black font-semibold py-2.5 rounded-lg text-sm transition-colors">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {loading ? "Gönderiliyor..." : "Bilet Gönder"}
      </button>
    </form>
  );
}

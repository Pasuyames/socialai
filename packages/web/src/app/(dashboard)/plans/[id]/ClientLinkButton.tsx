"use client";

import { useState } from "react";
import { Link2, Copy, Check } from "lucide-react";

export default function ClientLinkButton({ planId }: { planId: number }) {
  const [url, setUrl]       = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied]   = useState(false);

  const generate = async () => {
    setLoading(true);
    const res  = await fetch(`/api/plans/${planId}/client-token`, { method: "POST" });
    const data = await res.json();
    setUrl(data.url);
    setLoading(false);
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (url) {
    return (
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-lg px-3 py-1.5 text-xs text-white/70 w-64 focus:outline-none"
        />
        <button
          onClick={copy}
          className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors"
          title="Kopyala"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={generate}
      disabled={loading}
      className="flex items-center gap-2 bg-[#1A1A2E] border border-[#2A2A3E] hover:border-primary/30 text-white/70 hover:text-primary px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
    >
      <Link2 size={15} />
      {loading ? "Oluşturuluyor..." : "Müşteri Linki"}
    </button>
  );
}

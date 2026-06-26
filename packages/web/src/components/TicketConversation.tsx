"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, ShieldCheck, User } from "lucide-react";

type Message = { id: number; body: string; isAdmin: boolean; authorId: number | null; createdAt: Date | string };

const STATUS_OPTIONS = [
  { value: "open",        label: "Açık" },
  { value: "in_progress", label: "İşlemde" },
  { value: "resolved",    label: "Çözüldü" },
  { value: "closed",      label: "Kapalı" },
];

export default function TicketConversation({
  ticketId, messages, currentStatus, isAdmin,
}: {
  ticketId: number;
  messages: Message[];
  currentStatus: string;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [body, setBody]       = useState("");
  const [status, setStatus]   = useState(currentStatus);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!body.trim()) return;
    setSending(true);

    await fetch(`/api/support/tickets/${ticketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });

    if (isAdmin && status !== currentStatus) {
      await fetch(`/api/admin/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    }

    setSending(false);
    setBody("");
    router.refresh();
  }

  async function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    if (isAdmin) {
      await fetch(`/api/admin/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {/* Mesaj listesi */}
      <div className="space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.isAdmin ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.isAdmin ? "bg-primary/20" : "bg-[#1A1A2E]"}`}>
              {msg.isAdmin
                ? <ShieldCheck size={14} className="text-primary" />
                : <User size={14} className="text-muted-foreground" />}
            </div>
            <div className={`max-w-lg rounded-xl px-4 py-3 text-sm ${msg.isAdmin ? "bg-primary/10 border border-primary/20 text-white" : "bg-[#0E0E1A] border border-[#1E1E2E] text-white"}`}>
              <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
              <p className={`text-[10px] mt-1.5 ${msg.isAdmin ? "text-primary/60" : "text-muted-foreground"}`}>
                {msg.isAdmin ? "Destek Ekibi" : "Siz"} · {new Date(msg.createdAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Durum + Yanıt kutusu */}
      <div className="bg-[#0E0E1A] border border-[#1E1E2E] rounded-xl p-4 space-y-3">
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => handleStatusChange(opt.value)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${status === opt.value ? "border-primary text-primary bg-primary/10" : "border-[#2E2E4E] text-muted-foreground hover:border-[#3E3E5E]"}`}>
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={isAdmin ? "Yanıt yaz..." : "Mesajınızı yazın..."}
          rows={4}
          className="w-full bg-[#050508] border border-[#2E2E4E] rounded-lg px-4 py-3 text-sm text-white placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50 transition-colors"
        />

        <div className="flex justify-end">
          <button onClick={handleSend} disabled={!body.trim() || sending}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-black font-semibold px-5 py-2 rounded-lg text-sm transition-colors">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? "Gönderiliyor..." : "Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}

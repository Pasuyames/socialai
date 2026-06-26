"use client";

import { useState } from "react";
import { CheckCircle, RotateCcw, X, Send, Radio } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface PostActionsProps {
  postId: number;
  status: string;
  onDone?: () => void;
}

export default function PostActions({ postId, status, onDone }: PostActionsProps) {
  const [showModal, setShowModal]   = useState(false);
  const [notes, setNotes]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [localStatus, setLocalStatus] = useState(status);

  const approve = async () => {
    setLoading(true);
    await fetch(`/api/posts/${postId}/approve`, { method: "POST" });
    setLocalStatus("approved");
    setLoading(false);
    onDone?.();
  };

  const publish = async () => {
    setLoading(true);
    await fetch(`/api/posts/${postId}/publish`, { method: "POST" });
    setLocalStatus("published");
    setLoading(false);
    onDone?.();
  };

  const submitRevision = async () => {
    if (!notes.trim()) return;
    setLoading(true);
    await fetch(`/api/posts/${postId}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revisionNotes: notes }),
    });
    setLocalStatus("writing");
    setNotes("");
    setShowModal(false);
    setLoading(false);
    onDone?.();
  };

  if (localStatus === "published") {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <Radio size={13} />
        <span>Yayında</span>
      </div>
    );
  }

  if (localStatus === "approved") {
    return (
      <div className="flex gap-2">
        <button
          onClick={publish}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
        >
          <Radio size={12} />
          Yayınla
        </button>
        <button
          onClick={() => setShowModal(true)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/10 hover:bg-warning/20 border border-warning/20 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
        >
          <RotateCcw size={12} />
          Revizyon
        </button>
      </div>
    );
  }

  if (localStatus === "writing" || localStatus === "ideation") {
    return (
      <div className="text-xs text-muted-foreground animate-pulse">Yeniden yazılıyor...</div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={approve}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 hover:bg-success/20 border border-success/20 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
        >
          <CheckCircle size={12} />
          Onayla
        </button>
        <button
          onClick={() => setShowModal(true)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/10 hover:bg-warning/20 border border-warning/20 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
        >
          <RotateCcw size={12} />
          Revizyon
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0E0E1A] border border-[#1E1E2E] rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#1E1E2E]">
              <h3 className="font-semibold text-white">Revizyon Talebi</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Copywriter'a iletilecek notu yaz. Ne değişmeli, neden, nasıl olmalı?
              </p>
              <textarea
                className="w-full bg-[#1A1A2E] border border-[#2A2A3E] rounded-lg px-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                rows={5}
                placeholder="Örn: Daha kısa olsun, ürünün rahatlık özelliğine odaklan, emojiyi kaldır..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowModal(false)}>İptal</Button>
                <Button
                  onClick={submitRevision}
                  loading={loading}
                  disabled={!notes.trim()}
                >
                  <Send size={14} />
                  Gönder & Yeniden Yaz
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

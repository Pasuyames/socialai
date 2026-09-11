"use client";

import { useState } from "react";
import { CheckCircle, RotateCcw, Download, X, Send, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

interface Post {
  id: number;
  topic: string | null;
  caption: string | null;
  hashtags: string | null;
  imagePath: string | null;
  storyImagePath: string | null;
  platform: string | null;
  scheduledAt: string | null;
  status: string;
}

interface Plan {
  id: number;
  month: number;
  year: number;
  monthName: string;
  reportPath: string | null;
  brand: { name: string; brandColor: string | null; logoPath: string | null };
  posts: Post[];
}

export default function ClientPortalView({ plan, token }: { plan: Plan; token: string }) {
  const brandColor = plan.brand.brandColor ?? "#1a1a2e";

  return (
    <div className="min-h-screen bg-[#07070F] text-white">
      {/* Header */}
      <div className="w-full py-8 px-6" style={{ backgroundColor: brandColor }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white/70 text-sm font-medium uppercase tracking-widest mb-1">Sosyal Medya İçerik Planı</p>
            <h1 className="text-3xl font-bold text-white">{plan.brand.name}</h1>
            <p className="text-white/80 mt-1">{plan.monthName} {plan.year} — {plan.posts.length} İçerik</p>
          </div>
          {plan.reportPath && (
            <a
              href={`/api/client/${token}/report`}
              target="_blank"
              download
              className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 text-white px-4 py-2.5 rounded-xl font-medium transition-all text-sm"
            >
              <Download size={16} />
              PDF İndir
            </a>
          )}
        </div>
      </div>

      {/* Posts */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">
        <p className="text-white/50 text-sm">
          Her içeriği inceleyip onaylayabilir veya revizyon talep edebilirsiniz.
        </p>

        {plan.posts.map((post, idx) => (
          <ClientPostCard
            key={post.id}
            post={post}
            index={idx + 1}
            brandColor={brandColor}
            token={token}
          />
        ))}
      </div>

      <footer className="text-center text-xs text-white/30 py-8">
        Bu link yalnızca size özeldir — SocialAI Platform
      </footer>
    </div>
  );
}

function ClientPostCard({
  post,
  index,
  brandColor,
  token,
}: { post: Post; index: number; brandColor: string; token: string }) {
  const [status, setStatus]       = useState(post.status);
  const [expanded, setExpanded]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [notes, setNotes]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const dateLabel = post.scheduledAt
    ? new Date(post.scheduledAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })
    : "";

  // Sunucudan gelen hata mesajını çıkar; gövde yoksa/JSON değilse genel mesaj ver.
  const errorMessage = async (res: Response) => {
    try {
      const data = await res.json();
      if (typeof data?.error === "string" && data.error) return data.error;
    } catch {
      /* gövde JSON değil — aşağıdaki genel mesaja düş */
    }
    return "İşlem tamamlanamadı, lütfen tekrar deneyin.";
  };

  // NOT: Portal ziyaretçisinin oturumu yok — oturumlu /api/posts/... route'ları
  // login'e yönlendiriyordu. Token ile yetkilendirilen /api/client/... kullanılır.
  const approve = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/${token}/posts/${post.id}/approve`, { method: "POST" });
      // Yanıt kontrol edilmeden iyimser güncelleme YAPILMAZ: aksi halde kayıt
      // olmadığı halde "Onaylandı" gösterilir (sessiz veri kaybı).
      if (!res.ok) {
        setError(await errorMessage(res));
        return;
      }
      setStatus("approved");
    } catch {
      setError("Bağlantı kurulamadı, internet bağlantınızı kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  const submitRevision = async () => {
    if (!notes.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/${token}/posts/${post.id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionNotes: notes }),
      });
      if (!res.ok) {
        setError(await errorMessage(res));
        return;
      }
      setStatus("needs_rewrite");
      setNotes("");
      setShowModal(false);
    } catch {
      setError("Bağlantı kurulamadı, internet bağlantınızı kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  const isApproved  = status === "approved" || status === "published";
  const isRewriting = status === "writing" || status === "ideation" || status === "needs_rewrite";

  return (
    <div className="bg-[#0E0E1A] border border-[#1E1E2E] rounded-2xl overflow-hidden">
      {/* Card Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: brandColor }}
          >
            {index}
          </span>
          <div>
            <p className="font-semibold text-white text-sm">{post.topic}</p>
            {dateLabel && <p className="text-xs text-white/40 mt-0.5">{dateLabel} · {(post.platform ?? "instagram").toUpperCase()}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isApproved && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
              <CheckCircle size={11} /> Onaylandı
            </span>
          )}
          {isRewriting && (
            <span className="text-xs text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full animate-pulse">
              Yeniden yazılıyor...
            </span>
          )}
          {expanded ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-[#1E1E2E] p-5 space-y-4">
          {/* Images */}
          {(post.imagePath || post.storyImagePath) && (
            <div className="flex gap-3">
              {post.imagePath && (
                <div className="flex-1 rounded-xl overflow-hidden max-h-72 relative">
                  <span className="absolute top-2 left-2 bg-black/60 text-[10px] px-2 py-0.5 rounded text-white font-bold">POST</span>
                  <img src={post.imagePath} alt="Post" className="w-full h-full object-cover" />
                </div>
              )}
              {post.storyImagePath && (
                <div className="w-28 shrink-0 rounded-xl overflow-hidden max-h-72 relative">
                  <span className="absolute top-2 left-2 bg-black/60 text-[10px] px-2 py-0.5 rounded text-white font-bold">STORY</span>
                  <img src={post.storyImagePath} alt="Story" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          )}

          {/* Caption */}
          {post.caption && (
            <div className="bg-[#1A1A2E] rounded-xl p-4">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Paylaşım Metni</p>
              <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
            </div>
          )}

          {/* Hashtags */}
          {post.hashtags && (
            <div className="flex flex-wrap gap-1.5">
              {post.hashtags.split(" ").map((tag, i) => (
                <span key={i} className="text-xs px-2 py-1 rounded-lg bg-white/5 text-white/50">{tag}</span>
              ))}
            </div>
          )}

          {/* Hata */}
          {error && !showModal && (
            <div className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          {!isApproved && !isRewriting && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={approve}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ backgroundColor: brandColor }}
              >
                <CheckCircle size={15} />
                Onayla
              </button>
              <button
                onClick={() => setShowModal(true)}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/20 transition-all disabled:opacity-50"
              >
                <RotateCcw size={15} />
                Revizyon İste
              </button>
            </div>
          )}
        </div>
      )}

      {/* Revision Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0E0E1A] border border-[#1E1E2E] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#1E1E2E]">
              <h3 className="font-semibold text-white">Revizyon Talebi</h3>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-white/50">
                Ne değişmesini istiyorsunuz? Ne kadar detaylı yazarsanız, sonuç o kadar iyi olur.
              </p>
              <textarea
                className="w-full bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
                rows={5}
                placeholder="Örn: Ton biraz daha samimi olsun, ürünün rahatlığını vurgula, hashtagleri azalt..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                autoFocus
              />
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
                >
                  İptal
                </button>
                <button
                  onClick={submitRevision}
                  disabled={loading || !notes.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                  style={{ backgroundColor: brandColor }}
                >
                  <Send size={14} />
                  Gönder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

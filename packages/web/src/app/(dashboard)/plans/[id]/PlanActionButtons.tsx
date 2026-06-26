"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Loader2, RefreshCw, Image, ShieldCheck, FileText, AlertTriangle, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props { planId: number; status: string; hasPosts: boolean; }

const PROCESSING = ["generating_ideas", "generating_posts", "generating_images"];
const PROCESSING_LABELS: Record<string, string> = {
  generating_ideas:  "Fikirler üretiliyor...",
  generating_posts:  "Metinler yazılıyor...",
  generating_images: "Görseller üretiliyor...",
};

export default function PlanActionButtons({ planId, status, hasPosts }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const call = async (endpoint: string, key: string) => {
    setLoading(key);
    try {
      const res = await fetch(`/api/plans/${planId}/${endpoint}`, { method: "POST" });
      if (res.ok) { router.refresh(); }
      else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Bir hata oluştu.");
      }
    } catch { alert("Sunucuya ulaşılamadı."); }
    setLoading(null);
  };

  // Arka planda işlem var
  if (PROCESSING.includes(status)) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin text-primary" />
          {PROCESSING_LABELS[status]}
        </div>
        <Button variant="secondary" size="sm" onClick={() => router.refresh()}>
          <RefreshCw size={14} /> Yenile
        </Button>
      </div>
    );
  }

  // Hata durumları — yeniden başlatma imkanı
  if (["post_generation_failed", "image_generation_failed", "posts_partial"].includes(status)) {
    const isImage = status === "image_generation_failed";
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-danger">
          <AlertTriangle size={13} /> İşlem başarısız
        </div>
        <Button
          variant="danger"
          size="sm"
          loading={loading === "retry"}
          onClick={() => call(isImage ? "generate-images" : "generate-posts", "retry")}
        >
          <RefreshCw size={14} /> Yeniden Dene
        </Button>
      </div>
    );
  }

  // Takılı / başlamamış plan
  if (status === "planning" || (!hasPosts && status !== "ideation_ready")) {
    return (
      <Button variant="secondary" size="sm" loading={loading === "ideate"} onClick={() => call("ideate", "ideate")}>
        <RefreshCw size={14} /> {loading === "ideate" ? "Başlatılıyor..." : "Yeniden Başlat"}
      </Button>
    );
  }

  // Fikirler hazır → metin yaz
  if (status === "ideation_ready" && hasPosts) {
    return (
      <Button size="sm" loading={loading === "posts"} onClick={() => call("generate-posts", "posts")}>
        <Edit3 size={14} /> {loading === "posts" ? "Başlatılıyor..." : "Metin Yazarlarını Başlat"}
      </Button>
    );
  }

  // Metinler hazır → görsel üret
  if (status === "image_prompt_ready" || status === "posts_partial") {
    return (
      <Button size="sm" loading={loading === "images"} onClick={() => call("generate-images", "images")}>
        <Image size={14} /> {loading === "images" ? "Başlatılıyor..." : "Görselleri Üret"}
      </Button>
    );
  }

  // QC bekliyor
  if (status === "qc_pending" || status === "qc_review") {
    return (
      <Button variant="warning" size="sm" loading={loading === "qa"} onClick={() => call("run-qa", "qa")}>
        <ShieldCheck size={14} /> {loading === "qa" ? "Denetleniyor..." : "Kalite Kontrolü Başlat"}
      </Button>
    );
  }

  // PDF rapor veya performans takibi
  if (status === "review_ready" || status === "ready") {
    return (
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" loading={loading === "perf"} onClick={() => call("track-performance", "perf")}>
          <BarChart2 size={14} /> {loading === "perf" ? "Çekiliyor..." : "Performans Güncelle"}
        </Button>
        <Button variant="success" size="sm" loading={loading === "report"} onClick={() => call("generate-report", "report")}>
          <FileText size={14} /> {loading === "report" ? "Hazırlanıyor..." : "PDF Rapor Oluştur"}
        </Button>
      </div>
    );
  }

  return null;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, RefreshCw } from "lucide-react";

export default function AnalyzeButton({ brandId, isAnalyzing, hasData }: { brandId: number, isAnalyzing: boolean, hasData: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/analyze`, {
        method: "POST",
      });
      if (res.ok) {
        alert("Marka Stratejisti uyandırıldı! Analiz başladı. Lütfen birkaç saniye sonra sayfayı yenileyin.");
        setTimeout(() => {
          router.refresh();
          setLoading(false);
        }, 8000); // 8 saniyeye çıkardık çünkü Pro model daha derin düşünüyor
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      {hasData && (
        <button 
          onClick={handleAnalyze}
          disabled={loading}
          className="px-4 py-2 rounded-md font-medium text-white transition-all flex items-center gap-2 bg-[#1A1A2E] hover:bg-primary"
          title="Analizi en güncel verilerle ve yeni modelle baştan yap"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          {loading ? "Yeniden Analiz Ediliyor..." : "Yeniden Analiz Et"}
        </button>
      )}
      
      {!hasData && (
        <button 
          onClick={handleAnalyze}
          disabled={loading}
          className="px-4 py-2 rounded-md font-medium text-white transition-all flex items-center gap-2 bg-primary hover:bg-opacity-90"
        >
          <BrainCircuit size={18} />
          {loading ? "Analiz Ediliyor..." : "AI Analizini Başlat"}
        </button>
      )}
    </div>
  );
}

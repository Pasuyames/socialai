"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Bot } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const INDUSTRY_OPTIONS = [
  { value: "general",        label: "Genel" },
  // Tüketici
  { value: "fashion",        label: "Moda / Giyim" },
  { value: "beauty",         label: "Güzellik / Kozmetik / Kuaför" },
  { value: "food",           label: "Yemek / Restoran / Kafe" },
  { value: "retail",         label: "Perakende / Market / Mağaza" },
  { value: "ecommerce",      label: "E-Ticaret" },
  { value: "hospitality",    label: "Otel / Turizm / Seyahat" },
  { value: "events",         label: "Etkinlik / Organizasyon / Düğün" },
  { value: "automotive",     label: "Otomotiv / Araç" },
  // Sağlık & Yaşam
  { value: "healthcare",     label: "Sağlık / Klinik / Eczane" },
  { value: "fitness",        label: "Spor / Fitness / Sağlıklı Yaşam" },
  // Profesyonel
  { value: "tech",           label: "Teknoloji / SaaS / Yazılım" },
  { value: "finance",        label: "Finans / Yatırım" },
  { value: "consulting",     label: "Danışmanlık / Muhasebe" },
  { value: "law",            label: "Hukuk / Avukatlık" },
  { value: "insurance",      label: "Sigorta / Güvence" },
  { value: "logistics",      label: "Lojistik / Kargo / Taşımacılık" },
  { value: "education",      label: "Eğitim / Kurs / Akademi" },
  { value: "media",          label: "Medya / Yayıncılık / Prodüksiyon" },
  // İnşaat & Tasarım
  { value: "real_estate",    label: "Gayrimenkul" },
  { value: "construction",   label: "İnşaat / Yapı" },
  { value: "interior",       label: "Mimarlık / İç Tasarım" },
  // Diğer
  { value: "agriculture",    label: "Tarım / Gıda Üretimi" },
  { value: "ngo",            label: "Sivil Toplum / STK / Vakıf" },
  { value: "personal_brand", label: "Kişisel Marka / Influencer / Koç" },
];

export default function NewBrandPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    websiteUrl: "",
    instagramHandle: "",
    industry: "general",
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        router.push("/brands");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Bir hata oluştu.");
      }
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
          <Building2 size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Yeni Marka Ekle</h1>
          <p className="text-sm text-muted-foreground">Ajanlar temel bilgileri analiz ederek profil oluşturacak.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Marka Adı *"
            placeholder="Örn: Cafe Nero"
            required
            value={formData.name}
            onChange={set("name")}
          />
          <Select
            label="Sektör"
            hint="Ajanlar içerik üretimini bu sektöre göre optimize eder."
            options={INDUSTRY_OPTIONS}
            value={formData.industry}
            onChange={set("industry")}
          />
          <Input
            label="Web Sitesi"
            type="url"
            placeholder="https://..."
            hint="Data Miner ajanı bu siteyi tarayarak marka analizi yapar."
            value={formData.websiteUrl}
            onChange={set("websiteUrl")}
          />
          <Input
            label="Instagram Kullanıcı Adı"
            placeholder="@markaadi"
            value={formData.instagramHandle}
            onChange={set("instagramHandle")}
          />

          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
              {error}
            </div>
          )}

          <div className="p-4 rounded-lg bg-primary/5 border border-primary/15 flex gap-3">
            <Bot size={18} className="text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-white">Kaydettiğinizde ajanlar devreye girer:</p>
              <p>Data Miner → Brand Strategist → Tone Specialist + Visual Researcher</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => router.back()}>İptal</Button>
            <Button type="submit" loading={loading}>
              {loading ? "Ajanlar çalışıyor..." : "Kaydet & Analizi Başlat"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

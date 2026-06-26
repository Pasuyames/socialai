"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Bot } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";

const MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

const selectClass = `
  w-full bg-muted/40 border border-border rounded-lg px-4 py-2.5 text-sm text-white
  focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
  transition-colors disabled:opacity-50
`;

export default function NewPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [brands, setBrands] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    brandId: "",
    month: new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2,
    year: new Date().getFullYear(),
    clientBrief: "",
  });

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((data) => {
        setBrands(data);
        if (data.length > 0) setFormData((f) => ({ ...f, brandId: data[0].id.toString() }));
      });
  }, []);

  const set = (key: string) => (e: React.ChangeEvent<any>) =>
    setFormData((p) => ({ ...p, [key]: key === "month" || key === "year" ? parseInt(e.target.value) : e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        router.push("/plans");
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
        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
          <CalendarDays size={22} className="text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Yeni Aylık Plan</h1>
          <p className="text-sm text-muted-foreground">Hedeflerinizi verin, ajanlar planı oluştursun.</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white/80">Marka *</label>
            <select required className={selectClass} value={formData.brandId} onChange={set("brandId")}>
              {brands.length === 0 && <option value="">Yükleniyor...</option>}
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-white/80">Ay *</label>
              <select required className={selectClass} value={formData.month} onChange={set("month")}>
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-white/80">Yıl *</label>
              <select required className={selectClass} value={formData.year} onChange={set("year")}>
                {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <Textarea
            label="Müşteri Notu (Brief)"
            rows={4}
            placeholder="Örn: Bu ay anneler günü var, o haftaya özel çekiliş postu tasarlansın..."
            hint="İsteğe bağlı. Ajanlar bu notları dikkate alarak içerik üretir."
            value={formData.clientBrief}
            onChange={(e) => setFormData((p) => ({ ...p, clientBrief: e.target.value }))}
          />

          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">{error}</div>
          )}

          <div className="p-4 rounded-lg bg-accent/5 border border-accent/15 flex gap-3">
            <Bot size={18} className="text-accent shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Plan başlatıldığında: <span className="text-white">DataAnalyst → MarketingDirector → IdeationSpecialist → ContentScheduler</span> sırasıyla çalışır.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => router.back()}>İptal</Button>
            <Button type="submit" loading={loading} disabled={brands.length === 0}>
              {loading ? "Ajanlar çalışıyor..." : "Planı Başlat"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { PLAN_LIMITS } from "@/lib/subscription";

const PLANS = Object.entries(PLAN_LIMITS).map(([key, val]) => ({
  key,
  label:    val.label,
  price:    val.priceMonthly,
  maxBrands: val.maxBrands,
}));

export default function AdminPlanSelector({ orgId, currentPlan }: { orgId: number; currentPlan: string }) {
  const [selected, setSelected]   = useState(currentPlan);
  const [loading, setLoading]     = useState(false);
  const [saved, setSaved]         = useState(false);

  async function handleSave() {
    if (selected === currentPlan) return;
    setLoading(true);
    const res = await fetch(`/api/admin/orgs/${orgId}/plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: selected }),
    });
    setLoading(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {PLANS.map(({ key, label, price, maxBrands }) => (
          <label key={key}
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selected === key ? "border-primary bg-primary/10" : "border-[#1E1E2E] hover:border-[#2E2E4E]"}`}>
            <div className="flex items-center gap-3">
              <input type="radio" name="plan" value={key} checked={selected === key}
                onChange={() => setSelected(key)} className="accent-primary" />
              <div>
                <p className="font-medium text-white text-sm">{label}</p>
                <p className="text-xs text-muted-foreground">Max {maxBrands === 999 ? "sınırsız" : maxBrands} marka</p>
              </div>
            </div>
            <span className="text-sm font-bold text-white">₺{price.toLocaleString("tr-TR")}<span className="text-xs text-muted-foreground font-normal">/ay</span></span>
          </label>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={loading || selected === currentPlan}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-black font-semibold py-2 rounded-lg text-sm transition-colors"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : null}
        {saved ? "Kaydedildi!" : loading ? "Kaydediliyor..." : "Planı Güncelle"}
      </button>
    </div>
  );
}

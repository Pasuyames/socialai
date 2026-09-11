"use client";

import { animate, useInView, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

function bicimle(v: number, decimals: number): string {
  return v.toLocaleString("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Görünüme girince 0'dan hedefe yumuşak sayan sayaç.
 *
 * İKİ ÖNEMLİ DAVRANIŞ:
 *
 * 1) Başlangıç değeri "0" DEĞİL, hedefin kendisidir. Eskiden `useState("0")` idi
 *    ve gerçek değer yalnızca `useInView` tetiklenip animasyon çalışınca
 *    yazılıyordu — animasyon hiç çalışmazsa (görünüme hiç girmeyen kart, JS
 *    gecikmesi, hareket azaltma) kullanıcı kalıcı olarak **0** görüyordu.
 *    Artık doğru değer en baştan ekranda; animasyon yalnızca bir süsleme.
 *
 * 2) "Hareketi azalt" açıkken animasyon ÇALIŞMAZ ama JSX ağacı DEĞİŞMEZ.
 *    Render'ı `useReducedMotion()` ile dallandırmak hidrasyon uyuşmazlığına ve
 *    boş görünen bölümlere yol açar; bu yüzden yalnızca efekt atlanır.
 */
export function AnimatedCounter({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const azaltilmisHareket = useReducedMotion();
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(() => bicimle(value, decimals));

  // Değer sonradan değişirse (örn. otomatik yenileme) ekran hep doğru kalsın.
  useEffect(() => {
    setDisplay(bicimle(value, decimals));
  }, [value, decimals]);

  useEffect(() => {
    if (!inView || azaltilmisHareket) return;
    const controls = animate(mv, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(bicimle(v, decimals)),
    });
    return () => controls.stop();
  }, [inView, azaltilmisHareket, value, decimals, mv]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{display}{suffix}
    </span>
  );
}

/**
 * Para birimi için uyarlanabilir ondalık basamak.
 *
 * Sabit 2 ondalıkla LLM maliyetleri işe yaramıyordu: gerçek bir Gemini çağrısı
 * $0,0000101 tutuyor ve kartta **$0,00** görünüyordu — yani maliyet kartı bu
 * ölçekte hiçbir bilgi vermiyordu. Küçük tutarlarda basamak artırılır.
 */
export function paraOndaligi(v: number): number {
  if (!v) return 2;
  const a = Math.abs(v);
  if (a >= 1)    return 2;
  if (a >= 0.01) return 4;
  return 6;
}

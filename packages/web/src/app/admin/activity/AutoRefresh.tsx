"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Pause, Play } from "lucide-react";

/**
 * Aktivite akışı için otomatik yenileme.
 *
 * Sayfa bir server component ve `force-dynamic`; `router.refresh()` sunucu
 * tarafını yeniden çalıştırıp SADECE değişen kısmı günceller — tam sayfa
 * yenilemesi olmadığı için filtreler, kaydırma konumu ve odak korunur.
 *
 * Tasarım kararları:
 *  - Varsayılan KAPALI. Bu ekran bir denetim aracı: kullanıcı bir satırı
 *    okurken listenin altından kayması sinir bozucudur. Açmak bilinçli olmalı.
 *  - Sekme arka plandayken yenileme YAPILMAZ (`visibilitychange`) — açık
 *    bırakılmış bir sekmenin veritabanını boşuna dövmesini engeller.
 *  - Hareket yok: sadece ikon dönüşü, o da `prefers-reduced-motion` ile durur.
 */
const SECENEKLER = [10, 30, 60] as const;

export function AutoRefresh() {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [saniye, setSaniye] = useState<number>(30);
  const [sonGuncelleme, setSonGuncelleme] = useState<Date | null>(null);
  const [bekliyor, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const yenile = () => {
    startTransition(() => {
      router.refresh();
      setSonGuncelleme(new Date());
    });
  };

  useEffect(() => {
    if (!acik) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }

    const tick = () => {
      // Sekme görünmüyorsa sorgu atma.
      if (document.visibilityState !== "visible") return;
      startTransition(() => {
        router.refresh();
        setSonGuncelleme(new Date());
      });
    };

    timer.current = setInterval(tick, saniye * 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [acik, saniye, router]);

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={yenile}
        disabled={bekliyor}
        title="Şimdi yenile"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1E1E2E] bg-[#0C0C14] text-zinc-300 hover:text-white hover:border-zinc-600 disabled:opacity-50"
      >
        <RefreshCw size={13} className={bekliyor ? "animate-spin motion-reduce:animate-none" : ""} />
        Yenile
      </button>

      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
        title={acik ? "Otomatik yenilemeyi durdur" : "Otomatik yenilemeyi başlat"}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
          acik
            ? "border-green-500/30 bg-green-500/10 text-green-400"
            : "border-[#1E1E2E] bg-[#0C0C14] text-zinc-400 hover:text-white"
        }`}
      >
        {acik ? <Pause size={13} /> : <Play size={13} />}
        Otomatik
      </button>

      <select
        value={saniye}
        onChange={(e) => setSaniye(parseInt(e.target.value))}
        disabled={!acik}
        aria-label="Yenileme aralığı"
        className="px-2 py-1.5 rounded-lg border border-[#1E1E2E] bg-[#0C0C14] text-zinc-300 disabled:opacity-40"
      >
        {SECENEKLER.map((s) => (
          <option key={s} value={s}>{s} sn</option>
        ))}
      </select>

      {sonGuncelleme && (
        <span className="text-zinc-500 tabular-nums">
          {sonGuncelleme.toLocaleTimeString("tr-TR")}
        </span>
      )}
    </div>
  );
}

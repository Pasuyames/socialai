# SocialAI

AI destekli sosyal medya ajans otomasyon platformu.

## ⚠️ ÖNCE BUNU OKU: `DURUM.md`

**Her oturumun başında ve her soruda ilk iş `DURUM.md` dosyasını okumaktır.**
Projenin güncel durumu, açık bulgular, canlı veri istatistikleri, mimari harita,
komutlar ve bilinen tuzaklar orada tutulur — tüm kod tabanını veya sohbet
geçmişini yeniden taramaya gerek yoktur.

**Güncelleme sorumluluğu:** Her çalışma günü sonunda / her iş paketi
tamamlandığında `DURUM.md` güncellenir:
- Kapatılan bulgu `[ ]` → `[x]` yapılır (silinmez, iz kalsın).
- Yeni bulgu ilgili önem tablosuna (🔴/🟠/🟡/⚪) eklenir.
- "Değişiklik Günlüğü" tablosuna tarihli bir satır eklenir.
- "Son güncelleme" tarihi yenilenir.

## Konum ve Port

`C:\Users\musta\Projects\SocialAI` (2026-08-14'te `Desktop\SocialAI`'dan taşındı).
Web dev sunucusu sabit port **3001** (`packages/web` → `pnpm dev` → `next dev -p 3001`).
Kardeş projeler: Renza:3000, BekoAI:3002, UpmindClone:3003, Affa:3004, AelineClone:3005
(hepsi `C:\Users\musta\Projects\` altında).

## Diğer Belgeler

- `DURUM.md` — **güncel durum, açık işler, tuzaklar (birincil kaynak)**
- `ARCHITECTURE.md` — ajan mimarisi ve orijinal tasarım notları
- `DEPLOYMENT.md` — PM2 (web+worker) + Docker Compose (Redis) production kurulumu
- `README.md` — genel bakış

# SocialAI — Production Deployment (VDS, 7/24)

Web (Next.js) + Worker (BullMQ) + Redis 7, kalıcı servis olarak. Web ve worker
**PM2** ile (auto-restart, log yönetimi), Redis **Docker Compose** ile çalışır.

> **Mimari notu:** Worker, web'in TypeScript kaynağını (Orchestrator + ajanlar)
> runtime'da import ettiği için `tsx` ile çalışır — ayrı derleme gerekmez. Web,
> worker ve SQLite/uploads aynı dosya sistemini paylaştığından PM2 bu kurguda
> container izolasyonundan daha pratiktir. Redis tek başına container'da yeterlidir.

---

## 1. Ön Koşullar (VDS — Ubuntu/Debian önerilir)

```bash
node -v        # >= 20 (geliştirme 24 ile yapıldı)
corepack enable && corepack prepare pnpm@latest --activate   # pnpm
npm i -g pm2   # süreç yöneticisi
docker --version && docker compose version                   # Redis için
```

Redis 7 **şarttır** (BullMQ Redis 5+ ister). Windows native `redis-server`
(3.0.504) **UYUMSUZDUR** — daima Docker'daki Redis 7 kullanılır.

---

## 2. Tek Komutla Ayağa Kaldırma

```bash
git clone <repo> /var/www/socialai && cd /var/www/socialai

# 1) Ortam değişkenleri
cp .env.production.example packages/web/.env
nano packages/web/.env            # gerçek prod değerlerini doldur (aşağıya bak)

# 2) GCP service-account anahtarını yerleştir (Vertex AI için)
mkdir -p secrets && cp /yol/gcp-sa.json secrets/gcp-sa.json

# 3) Hepsini başlat: bağımlılık + Redis + prisma + build + PM2
pnpm run deploy
```

`pnpm run deploy` sırasıyla şunları yapar:
`pnpm install` → `docker compose up -d` (Redis) → `prisma generate` →
`prisma db push` (SQLite şeması) → `next build` → `pm2 start` → `pm2 save`.

Sunucu yeniden başlasa da otomatik kalkması için **bir kez**:
```bash
pm2 startup            # çıktıdaki komutu çalıştır (systemd kaydı)
pm2 save
```

---

## 3. `.env` İçinde Mutlaka Ayarlanacaklar

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | SQLite mutlak yolu (web+worker aynı dosya), ör. `file:/var/www/socialai/packages/web/prisma/dev.db` |
| `PUBLIC_DIR` | **KRİTİK** — web'in `public/` mutlak yolu; görseller worker'dan da buraya yazılır |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` | Prod domain (HTTPS) |
| `GCP_PROJECT_ID`, `GCP_LOCATION`, `GOOGLE_APPLICATION_CREDENTIALS` | Vertex AI |
| `GEMINI_API_KEY` | AI Studio (görsel üretimi) |
| `REDIS_HOST=127.0.0.1`, `REDIS_PORT=6380` | docker-compose ile uyumlu |
| `LANGFUSE_*` | Token/maliyet izleme (opsiyonel ama önerilir) |

Tam liste ve kategoriler için `.env.production.example`.

---

## 4. Günlük Operasyon

```bash
pnpm pm2:status      # web + worker durumu (online/restart sayısı/bellek)
pnpm pm2:logs        # canlı loglar (logs/*.log dosyalarına da yazılır)
pnpm pm2:restart     # her ikisini yeniden başlat
pnpm pm2:reload      # sıfır-kesinti yeniden yükleme
pnpm pm2:stop        # durdur

docker compose ps              # Redis durumu/healthcheck
docker compose logs -f redis   # Redis logları
```

**Kuyruk paneli (gözlemlenebilirlik):** `https://<domain>/admin/queues`
(Bull-Board) — bekleyen/işlenen/biten/başarısız job'lar canlı izlenir.

**Loglar:** PM2 stdout/stderr → `logs/web-*.log`, `logs/worker-*.log`
(otomatik döndürme için: `pm2 install pm2-logrotate`).

---

## 5. Güncelleme (yeni sürüm deploy)

```bash
cd /var/www/socialai && git pull
pnpm install --frozen-lockfile
pnpm generate && pnpm prisma:push     # şema değiştiyse
pnpm build:web                        # web değiştiyse
pnpm pm2:reload                       # sıfır-kesinti
```

Worker `tsx` ile kaynaktan çalıştığı için kod değişikliğinde sadece
`pm2 restart socialai-worker` yeterlidir (derleme gerekmez).

---

## 6. Sağlık Kontrolü

```bash
curl -I http://127.0.0.1:3000           # web 200/302 dönmeli
docker compose exec redis redis-cli ping # PONG
pm2 status                               # ikisi de "online"
```

İlk işi kuyruğa atıp uçtan uca doğrulama: panelden bir plan üretimi tetikleyin;
worker loglarında `processPost → processImage zincirlendi` görünmeli, görseller
`packages/web/public/uploads/` altına düşmelidir.

---

## 7. Sorun Giderme

| Belirti | Çözüm |
|---|---|
| Worker `Redis version ... >= 5.0.0` hatası | Yanlış Redis. `docker compose up -d` ile Redis 7 çalıştığından ve `REDIS_PORT=6380` olduğundan emin olun |
| Görseller 404 (web göremiyor) | `PUBLIC_DIR` web'in gerçek `public/` mutlak yoluna ayarlı mı? |
| `GCP_PROJECT_ID ayarlanmamış` | `packages/web/.env` worker tarafından yükleniyor; değer dolu mu? |
| Worker job almıyor | `pm2 logs socialai-worker` — Redis bağlantısı ve "Hazır" satırını kontrol edin |
| SQLite "database is locked" | Düşük trafikte normal; yoğun yükte PostgreSQL'e geçiş önerilir |

---

## (İsteğe Bağlı) Tam Container Kurulum

Web ve worker'ı da container'a almak isterseniz: ortak bir `node:20` imajı, pnpm
ile workspace kurulumu, web ve worker servisleri için **paylaşılan volume**
(SQLite `dev.db` + `public/uploads`) gerekir. PM2 kurulumu bu paylaşımı host
dosya sisteminde doğal sağladığı ve worker web kaynağını import ettiği için
çoğu VDS senaryosunda yukarıdaki **PM2 + Redis-compose** yaklaşımı tercih edilir.

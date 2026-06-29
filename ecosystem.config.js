/**
 * PM2 Production Süreç Yöneticisi — SocialAI (web + worker)
 *
 * 7/24 kesintisiz çalışma: auto-restart, bellek sınırı, merkezi log yönetimi.
 * Redis ayrı yönetilir (docker-compose.yml). Ortam değişkenleri her paketin
 * kendi .env dosyasından yüklenir (web: Next.js otomatik; worker: dotenv).
 *
 * Kullanım:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 logs / pm2 status / pm2 restart all / pm2 stop all
 *   pm2 save && pm2 startup   (sunucu yeniden başlasa da otomatik ayağa kalkar)
 *
 * NOT: worker, web'in TS kaynağını (Orchestrator + ajanlar) runtime'da import
 * ettiği için `tsx` ile çalışır (pnpm start = tsx src/index.ts). Bu yüzden worker
 * için ayrı bir derleme adımı GEREKMEZ; web ise `next build` ile derlenir.
 */
module.exports = {
  apps: [
    {
      name: 'socialai-web',
      cwd: './packages/web',
      script: 'pnpm',
      args: 'start',                 // = next start (port: PORT env, vars. 3000)
      interpreter: 'none',           // pnpm'i shell komutu olarak çalıştır
      instances: 1,                  // SQLite + oturum tutarlılığı için tekil
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '700M',
      min_uptime: '15s',             // 15sn'den önce ölürse "kararsız" say
      max_restarts: 10,
      restart_delay: 4000,           // restart'lar arası 4sn (crash-loop fren)
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      // Loglar (logs/ .gitignore'da). PM2 stdout/stderr ayrı dosyalara yazar.
      error_file: '../../logs/web-error.log',
      out_file: '../../logs/web-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'socialai-worker',
      cwd: './packages/worker',
      script: 'pnpm',
      args: 'start',                 // = tsx src/index.ts
      interpreter: 'none',
      instances: 1,                  // Yatay ölçek için artırılabilir (her biri
                                     // concurrency=WORKER_CONCURRENCY ile çalışır)
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '600M',
      min_uptime: '15s',
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        // Kuyruk ayarları (kod varsayılanları: 2 / 8 / 60000). Prod'da buradan
        // veya .env'den ayarlanabilir — VDS kapasitesine ve kotaya göre.
        WORKER_CONCURRENCY: '2',
        WORKER_RATE_MAX: '8',
        WORKER_RATE_DURATION: '60000',
        // Toplu üretimde boş bekleme yapmasın (Firecrawl yoksa zaten atlar)
        VISUAL_INSPIRATION_ENABLED: 'false',
      },
      error_file: '../../logs/worker-error.log',
      out_file: '../../logs/worker-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};

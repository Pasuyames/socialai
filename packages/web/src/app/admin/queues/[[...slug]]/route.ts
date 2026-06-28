import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { allQueues } from "@/lib/queues";
import { authorizeAdmin } from "@/lib/authz";

// ioredis Node runtime gerektirir; her istek dinamik (cache yok)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "/admin/queues";

// Bull-Board + Hono app'i tekil kur (hot-reload'da yeniden kurmamak için globalThis)
const g = globalThis as unknown as { __bullBoardApp?: Hono };

function getApp(): Hono {
  if (g.__bullBoardApp) return g.__bullBoardApp;

  const serverAdapter = new HonoAdapter(serveStatic);
  serverAdapter.setBasePath(BASE);

  createBullBoard({
    queues: allQueues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
  });

  const app = new Hono();
  app.route(BASE, serverAdapter.registerPlugin());

  g.__bullBoardApp = app;
  return app;
}

async function handler(req: Request): Promise<Response> {
  // ── GÜVENLİK ──────────────────────────────────────────────────────────────
  // Route handler'lar admin layout'un auth'unu MİRAS ALMAZ. Bull-Board'un hem
  // HTML'i hem API'si hem statik asset'leri bu handler'dan geçtiği için, her
  // isteği burada superadmin kapısından geçiriyoruz.
  const az = await authorizeAdmin();
  if (!az.ok) return az.error;

  return getApp().fetch(req);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

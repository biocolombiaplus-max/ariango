/* Contenido editable del sitio.
   GET  /api/content            → versión publicada (con caché corta en el CDN)
   GET  /api/content?fresh=1    → versión más reciente sin caché (solo administrador)
   GET  /api/content?version=…  → una versión del historial (solo administrador)
   PUT  /api/content            → guarda una nueva versión (solo administrador) */
import { send, readJson, requireAdmin, isAuthed, storeList, storePut, storeDelete, fetchStoredJson } from "./_lib.js";

const PREFIX = "site/content/";
const KEEP_VERSIONS = 40;

async function versions() {
  const items = await storeList(PREFIX);
  return items.filter((b) => b.pathname.endsWith(".json")).sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const url = new URL(req.url, "http://x");
      const wantsPrivate = url.searchParams.has("fresh") || url.searchParams.has("version");
      if (wantsPrivate && !isAuthed(req)) return send(res, 401, { error: "No autorizado" });

      const list = await versions();
      let item = list[0];
      if (url.searchParams.has("version")) {
        item = list.find((v) => v.pathname === url.searchParams.get("version"));
        if (!item) return send(res, 404, { error: "Versión no encontrada" });
      }
      const content = item ? await fetchStoredJson(item.url) : {};
      const cache = wantsPrivate ? "no-store" : "public, max-age=0, s-maxage=30, stale-while-revalidate=300";
      return send(res, 200, content, { "Cache-Control": cache });
    }

    if (req.method === "PUT") {
      if (!requireAdmin(req, res)) return;
      const body = await readJson(req, 2 * 1024 * 1024);
      if (!body || typeof body !== "object" || Array.isArray(body)) return send(res, 400, { error: "Contenido inválido" });
      body.updatedAt = new Date().toISOString();
      const pathname = PREFIX + Date.now() + ".json";
      await storePut(pathname, Buffer.from(JSON.stringify(body)), "application/json");

      const list = await versions();
      const old = list.slice(KEEP_VERSIONS).map((v) => v.url);
      if (old.length) await storeDelete(old).catch(() => {});
      return send(res, 200, { ok: true, updatedAt: body.updatedAt, version: pathname });
    }

    return send(res, 405, { error: "Método no permitido" });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
}

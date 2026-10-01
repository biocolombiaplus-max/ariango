/* Subida y borrado de imágenes / PDF desde el panel.
   POST   /api/upload?name=foto.jpg   (cuerpo = archivo; Content-Type = tipo del archivo)
   DELETE /api/upload?url=…           */
import { send, readBody, requireAdmin, storePut, storeDelete } from "./_lib.js";

const MAX = 4 * 1024 * 1024; // límite de Vercel para el cuerpo de una función: 4,5 MB
const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf"
};

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "POST") {
      const type = (req.headers["content-type"] || "").split(";")[0].trim();
      const ext = TYPES[type];
      if (!ext) return send(res, 415, { error: "Formato no permitido. Use JPG, PNG, WebP, GIF o PDF." });
      const buf = await readBody(req, MAX);
      if (!buf.length) return send(res, 400, { error: "Archivo vacío" });
      const base = (url.searchParams.get("name") || "archivo")
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "archivo";
      const rand = Math.random().toString(36).slice(2, 8);
      const stored = await storePut(`uploads/${Date.now()}-${rand}-${base}.${ext}`, buf, type);
      return send(res, 200, { ok: true, url: stored.url });
    }

    if (req.method === "DELETE") {
      const target = url.searchParams.get("url") || "";
      if (!/\/uploads\/[^/]+$/.test(target)) return send(res, 400, { error: "Archivo no válido" });
      await storeDelete([target]);
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { error: "Método no permitido" });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
}

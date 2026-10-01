/* Archivos del expediente (solo administrador).
   GET  /api/crmfile?lead=<id>&file=<id>          → ver/descargar
   POST /api/crmfile?lead=<id>&name=<archivo>     → subir soporte de la firma (cuerpo = archivo)
   Devuelve los metadatos; el panel los agrega al expediente y guarda el CRM. */
import { send, readBody, requireUser, storePut, fetchStoredBuffer, encryptBuffer, decryptBuffer, randomId } from "./_lib.js";
import { loadDb, sessionUser } from "./_crm.js";

const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/heic"];

export default async function handler(req, res) {
  const s = requireUser(req, res);
  if (!s) return;
  const url = new URL(req.url, "http://x");
  const leadId = String(url.searchParams.get("lead") || "").replace(/[^\w-]/g, "");
  try {
    const db = await loadDb();
    const user = sessionUser(db, s);
    if (!user) return send(res, 401, { error: "Ingrese de nuevo." });
    const own = db.leads.find((l) => l.id === leadId);
    if (user.rol !== "admin" && own && own.abogadoId !== user.id) return send(res, 403, { error: "Este caso está asignado a otro abogado." });
    if (req.method === "GET") {
      const lead = own;
      const f = lead && (lead.archivos || []).find((x) => x.id === url.searchParams.get("file"));
      if (!f) return send(res, 404, { error: "Archivo no encontrado (si acaba de llegar, recargue el CRM)." });
      const buf = decryptBuffer(await fetchStoredBuffer(f.path));
      res.statusCode = 200;
      res.setHeader("Content-Type", f.tipo || "application/octet-stream");
      res.setHeader("Content-Disposition", 'inline; filename="' + encodeURIComponent(f.nombre) + '"');
      res.setHeader("Cache-Control", "private, no-store");
      return res.end(buf);
    }
    if (req.method === "POST") {
      const type = (req.headers["content-type"] || "").split(";")[0].trim();
      if (!TYPES.includes(type)) return send(res, 415, { error: "Formato no permitido. Use JPG, PNG, WebP o PDF." });
      if (!leadId) return send(res, 400, { error: "Cliente no válido" });
      const buf = await readBody(req, 4 * 1024 * 1024);
      const id = randomId(9);
      const stored = await storePut("crm/files/" + leadId + "/" + id + ".enc", encryptBuffer(buf), "application/octet-stream");
      return send(res, 200, { ok: true, file: { id, nombre: String(url.searchParams.get("name") || "soporte").slice(0, 120), tipo: type, size: buf.length, path: stored.url, subidoEn: new Date().toISOString(), por: "firma", visibleCliente: true } });
    }
    return send(res, 405, { error: "Método no permitido" });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
}

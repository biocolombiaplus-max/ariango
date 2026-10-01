/* Portal del cliente (enlace privado por cliente: ?l=<id>&t=<token>).
   GET  /api/portal?l&t            → expediente visible para el cliente
   GET  /api/portal?l&t&file=<id>  → descarga un archivo del expediente
   POST /api/portal?l&t&action=sign   { docId, nombre, documento, acepto, imagen }
   POST /api/portal?l&t&action=view   { docId }
   POST /api/portal?l&t&action=upload&req=<n>&name=<archivo>  (cuerpo = archivo) */
import { send, readJson, readBody, safeEqual, clientIp, storePut, fetchStoredBuffer, encryptBuffer, decryptBuffer, sha256, randomId } from "./_lib.js";
import { loadDb, readInbox, addToInbox, mergeInbox } from "./_crm.js";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf", "image/heic": "heic" };

async function getLead(l, t) {
  const db = await loadDb();
  const inbox = (await readInbox()).filter((i) => i.data && i.data.leadId === l);
  if (inbox.length) mergeInbox(db, inbox);
  const lead = db.leads.find((x) => x.id === l);
  if (!lead || !lead.portal || !safeEqual(lead.portal, t)) return null;
  return { db, lead };
}

function publicView(db, lead) {
  const cfg = db.config || {};
  const docs = (lead.docs || []).filter((d) => d.estado && d.estado !== "borrador").map(({ token, ...d }) => d);
  const pagado = (lead.pagos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const ids = new Set(docs.flatMap((d) => (d.data && d.data.cuentas) || []));
  const cuentas = (cfg.cuentas || []).filter((c) => !ids.size || ids.has(c.id));
  const abogado = (cfg.usuarios || []).find((a) => a.id === lead.abogadoId) || null;
  return {
    cliente: { nombre: lead.nombre, telefono: lead.telefono, email: lead.email, ciudad: lead.ciudad, cedula: lead.cedula, direccion: lead.direccion },
    servicio: lead.servicio, etapa: lead.etapa, abogado: (abogado && abogado.nombre) || lead.abogado || "", abogadoTel: abogado ? String(abogado.telefono || "").replace(/\D/g, "") : "",
    docs, requisitos: lead.requisitos || [],
    archivos: (lead.archivos || []).filter((f) => f.visibleCliente !== false).map(({ path, ...f }) => f),
    pagos: { total: lead.valor || 0, pagado },
    firma: cfg.firma || {}, cuentas, whatsapp: (cfg.firma && cfg.firma.whatsapp) || ""
  };
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const l = url.searchParams.get("l"), t = url.searchParams.get("t");
  try {
    const found = await getLead(l, t);
    if (!found) return send(res, 404, { error: "Enlace no válido o vencido. Solicite uno nuevo a su abogado." });
    const { db, lead } = found;

    if (req.method === "GET") {
      const fileId = url.searchParams.get("file");
      if (fileId) {
        const f = (lead.archivos || []).find((x) => x.id === fileId && x.visibleCliente !== false);
        if (!f) return send(res, 404, { error: "Archivo no encontrado" });
        const buf = decryptBuffer(await fetchStoredBuffer(f.path));
        res.statusCode = 200;
        res.setHeader("Content-Type", f.tipo || "application/octet-stream");
        res.setHeader("Content-Disposition", 'inline; filename="' + encodeURIComponent(f.nombre) + '"');
        res.setHeader("Cache-Control", "private, no-store");
        return res.end(buf);
      }
      return send(res, 200, publicView(db, lead));
    }

    if (req.method !== "POST") return send(res, 405, { error: "Método no permitido" });
    const action = url.searchParams.get("action");

    if (action === "upload") {
      const type = (req.headers["content-type"] || "").split(";")[0].trim();
      if (!TYPES[type]) return send(res, 415, { error: "Formato no permitido. Use foto (JPG, PNG) o PDF." });
      if ((lead.archivos || []).length >= 80) return send(res, 400, { error: "Límite de archivos alcanzado. Comuníquese con su abogado." });
      const buf = await readBody(req, 4 * 1024 * 1024);
      const id = randomId(9);
      const path = "crm/files/" + lead.id + "/" + id + ".enc";
      const stored = await storePut(path, encryptBuffer(buf), "application/octet-stream");
      const nombre = String(url.searchParams.get("name") || "documento").slice(0, 120);
      const reqIdx = parseInt(url.searchParams.get("req"), 10);
      const file = { id, nombre, tipo: type, size: buf.length, path: stored.url, subidoEn: new Date().toISOString(), por: "cliente", requisito: Number.isInteger(reqIdx) ? reqIdx : null };
      await addToInbox("file", { kind: "file", leadId: lead.id, file });
      return send(res, 200, { ok: true });
    }

    const body = await readJson(req, 600 * 1024);
    const doc = (lead.docs || []).find((d) => d.id === body.docId && d.estado !== "borrador");
    if (!doc) return send(res, 404, { error: "Documento no encontrado" });

    if (action === "view") {
      if (!doc.vistoEn) await addToInbox("view", { kind: "view", leadId: lead.id, docId: doc.id, t: new Date().toISOString() });
      return send(res, 200, { ok: true });
    }
    if (action === "sign") {
      if (doc.tipo === "recibo") return send(res, 400, { error: "Este documento no requiere firma." });
      if (doc.firma) return send(res, 200, { ok: true, firma: doc.firma });
      const nombre = String(body.nombre || "").trim().slice(0, 120);
      const documento = String(body.documento || "").trim().slice(0, 40);
      const imagen = String(body.imagen || "");
      if (!body.acepto || nombre.length < 5 || documento.length < 4) return send(res, 400, { error: "Escriba su nombre completo, su número de documento y marque la casilla." });
      if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(imagen) || imagen.length < 1500) return send(res, 400, { error: "Dibuje su firma en el recuadro." });
      const firma = {
        nombre, documento, imagen, fecha: new Date().toISOString(), ip: clientIp(req),
        agente: String(req.headers["user-agent"] || "").slice(0, 200),
        hash: sha256(JSON.stringify({ numero: doc.numero, tipo: doc.tipo, data: doc.data }))
      };
      await addToInbox("sign", { kind: "sign", leadId: lead.id, docId: doc.id, firma });
      return send(res, 200, { ok: true, firma });
    }
    return send(res, 400, { error: "Acción no válida" });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
}

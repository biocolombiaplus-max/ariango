/* Base de datos del CRM: un archivo cifrado por versión (crm/db/<ts>.enc),
   más una bandeja de entrada para solicitudes y aceptaciones que llegan desde
   el sitio público (crm/inbox/…), que se integran cuando el panel abre el CRM. */
import { storeList, storePut, storeDelete, fetchStoredBuffer, encryptJson, decryptJson } from "./_lib.js";

const DB = "crm/db/";
const INBOX = "crm/inbox/";
const KEEP = 25;

export function emptyDb() {
  return { rev: 0, leads: [], seq: { propuesta: 0, contrato: 0, recibo: 0 }, config: {} };
}

async function latestDbItem() {
  const items = (await storeList(DB)).filter((b) => b.pathname.endsWith(".enc"));
  items.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
  return { latest: items[0], all: items };
}

export async function loadDb() {
  const { latest } = await latestDbItem();
  if (!latest) return emptyDb();
  return Object.assign(emptyDb(), decryptJson(await fetchStoredBuffer(latest.url)));
}

export async function saveDb(db) {
  db.rev = (db.rev || 0) + 1;
  db.savedAt = new Date().toISOString();
  await storePut(DB + Date.now() + ".enc", encryptJson(db), "application/octet-stream");
  const { all } = await latestDbItem();
  const old = all.slice(KEEP).map((b) => b.url);
  if (old.length) await storeDelete(old).catch(() => {});
  return db;
}

export async function addToInbox(kind, payload) {
  const name = INBOX + kind + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".enc";
  await storePut(name, encryptJson(payload), "application/octet-stream");
}

export async function readInbox() {
  const items = (await storeList(INBOX)).filter((b) => b.pathname.endsWith(".enc"));
  const out = [];
  for (const it of items) {
    try { out.push({ url: it.url, pathname: it.pathname, data: decryptJson(await fetchStoredBuffer(it.url)) }); }
    catch { out.push({ url: it.url, pathname: it.pathname, data: null }); }
  }
  const ts = (p) => Number((p.split("/").pop().split("-")[1]) || 0);
  return out.sort((a, b) => ts(a.pathname) - ts(b.pathname));
}

export function findDoc(db, id) {
  for (const lead of db.leads || []) {
    const doc = (lead.docs || []).find((d) => d.id === id);
    if (doc) return { lead, doc };
  }
  return null;
}

export const ETAPAS = ["nuevo", "contactado", "propuesta", "aceptada", "anticipo", "contrato", "documentos", "tramite", "finalizado"];
export function advance(lead, etapa, why) {
  if (lead.etapa === "perdido") return false;
  const cur = ETAPAS.indexOf(lead.etapa), next = ETAPAS.indexOf(etapa);
  if (next <= cur) return false;
  lead.etapa = etapa;
  lead.etapaDesde = new Date().toISOString();
  log(lead, "etapa", "Avanzó automáticamente a «" + etapa + "»" + (why ? ": " + why : "") + ".");
  return true;
}
export function log(lead, tipo, texto, t) {
  lead.actividad = lead.actividad || [];
  lead.actividad.unshift({ t: t || new Date().toISOString(), tipo, texto });
}
const NOMBRE = { propuesta: "la propuesta", contrato: "el contrato", poder: "el poder", acta: "el acta", libre: "el documento", recibo: "el recibo" };

/** Integra la bandeja de entrada en la base de datos. Devuelve true si hubo cambios. */
export function mergeInbox(db, inbox) {
  let changed = false;
  for (const item of inbox) {
    const d = item.data;
    if (!d) continue;
    if (d.kind === "lead") {
      if (db.leads.some((l) => l.id === d.lead.id)) continue;
      autoAssign(db, d.lead);
      db.leads.unshift(d.lead);
      changed = true;
      continue;
    }
    const lead = db.leads.find((l) => l.id === d.leadId);
    if (!lead) continue;
    if (d.kind === "sign") {
      const doc = (lead.docs || []).find((x) => x.id === d.docId);
      if (!doc || doc.firma) continue;
      doc.firma = d.firma;
      doc.estado = "firmado";
      log(lead, "firma", "El cliente firmó " + (NOMBRE[doc.tipo] || "el documento") + " " + doc.numero + " (" + d.firma.nombre + ").", d.firma.fecha);
      if (doc.tipo === "propuesta") advance(lead, "aceptada", "propuesta aceptada");
      if (doc.tipo === "contrato") advance(lead, "contrato", "contrato firmado");
      changed = true;
    } else if (d.kind === "view") {
      const doc = (lead.docs || []).find((x) => x.id === d.docId);
      if (!doc || doc.vistoEn) continue;
      doc.vistoEn = d.t;
      if (doc.estado === "enviado") doc.estado = "visto";
      log(lead, "visto", "El cliente abrió " + (NOMBRE[doc.tipo] || "el documento") + " " + doc.numero + ".", d.t);
      changed = true;
    } else if (d.kind === "file") {
      lead.archivos = lead.archivos || [];
      if (lead.archivos.some((f) => f.id === d.file.id)) continue;
      lead.archivos.unshift(d.file);
      const req = (lead.requisitos || [])[d.file.requisito];
      if (req && req.estado !== "recibido") req.estado = "revision";
      log(lead, "archivo", "El cliente subió «" + d.file.nombre + "»" + (req ? " para: " + req.t : "") + ".", d.file.subidoEn);
      if (lead.etapa === "contrato") advance(lead, "documentos", "el cliente envió documentos");
      changed = true;
    }
  }
  if (changed) db.leads.forEach((l) => { if (l.actividad) l.actividad.sort((a, b) => (a.t < b.t ? 1 : -1)); });
  return changed;
}

/* ---------- Usuarios (abogados) ---------- */
export function usuarios(db) { db.config = db.config || {}; return (db.config.usuarios = db.config.usuarios || []); }
export function publicUser(u) { if (!u) return null; const { salt, hash, ...rest } = u; return rest; }

/** Valida que la sesión siga vigente (usuario activo y contraseña sin cambios). */
export function sessionUser(db, s) {
  if (!s) return null;
  if (s.uid === "owner") return { id: "owner", rol: "admin", nombre: "Administrador principal" };
  const u = usuarios(db).find((x) => x.id === s.uid);
  if (!u || u.activo === false || (u.v || 0) !== (s.v || 0)) return null;
  return u;
}

/** Lo que cada usuario puede ver del CRM. */
export function viewFor(db, user) {
  const config = Object.assign({}, db.config || {}, { usuarios: usuarios(db).map(publicUser) });
  if (user.rol === "admin") return Object.assign({}, db, { config });
  return Object.assign({}, db, { leads: db.leads.filter((l) => l.abogadoId === user.id), config });
}

/** Aplica los cambios de un abogado solo sobre sus propios casos. */
export function mergeFromLawyer(current, submitted, user) {
  const mine = new Map(submitted.leads.map((l) => [l.id, l]));
  const out = [];
  for (const l of current.leads) {
    if (l.abogadoId !== user.id) { out.push(l); continue; }
    if (mine.has(l.id)) { out.push(Object.assign({}, mine.get(l.id), { abogadoId: user.id, abogado: user.nombre })); mine.delete(l.id); }
    // si no viene, el abogado lo eliminó
  }
  for (const l of mine.values()) {
    if (current.leads.some((x) => x.id === l.id)) continue; // caso de otro abogado: no se toca
    out.unshift(Object.assign({}, l, { abogadoId: user.id, abogado: user.nombre }));
  }
  current.leads = out;
  current.seq = current.seq || {};
  for (const [k, v] of Object.entries(submitted.seq || {})) current.seq[k] = Math.max(current.seq[k] || 0, Number(v) || 0);
  return current;
}

/** Asignación automática por turnos de las solicitudes web. */
export function autoAssign(db, lead) {
  const cfg = db.config || {};
  if (cfg.asignacion !== "rotacion" || lead.abogadoId) return;
  const pool = usuarios(db).filter((u) => u.activo !== false && u.recibeCasos !== false && u.rol === "abogado");
  if (!pool.length) return;
  cfg.rotIdx = ((cfg.rotIdx || 0) + 1) % pool.length;
  const u = pool[cfg.rotIdx];
  lead.abogadoId = u.id; lead.abogado = u.nombre;
  log(lead, "asignacion", "Asignado automáticamente a " + u.nombre + ".");
}

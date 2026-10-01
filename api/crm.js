/* CRM (solo administrador).
   GET  /api/crm  → base de datos completa (integra solicitudes nuevas)
   PUT  /api/crm  → { baseRev, db } guarda con control de versión */
import { send, readJson, requireAdmin, storeDelete } from "./_lib.js";
import { loadDb, saveDb, readInbox, mergeInbox } from "./_crm.js";

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === "GET") {
      let db = await loadDb();
      const inbox = await readInbox();
      if (inbox.length) {
        if (mergeInbox(db, inbox)) db = await saveDb(db);
        await storeDelete(inbox.map((i) => i.url)).catch(() => {});
      }
      return send(res, 200, db);
    }
    if (req.method === "PUT") {
      const { baseRev, db } = await readJson(req, 8 * 1024 * 1024);
      if (!db || !Array.isArray(db.leads)) return send(res, 400, { error: "Datos inválidos" });
      const current = await loadDb();
      if ((current.rev || 0) !== (baseRev || 0)) {
        return send(res, 409, { error: "Hubo cambios desde otro dispositivo. Se recargaron los datos.", db: current });
      }
      const saved = await saveDb(db);
      return send(res, 200, { ok: true, rev: saved.rev });
    }
    return send(res, 405, { error: "Método no permitido" });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
}

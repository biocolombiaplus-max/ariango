/* CRM.
   GET  /api/crm  → datos visibles para el usuario (administrador: todo; abogado: sus casos)
   PUT  /api/crm  → { baseRev, db } guarda con control de versión */
import { send, readJson, requireUser, storeDelete } from "./_lib.js";
import { loadDb, saveDb, readInbox, mergeInbox, sessionUser, viewFor, mergeFromLawyer, usuarios } from "./_crm.js";

export default async function handler(req, res) {
  const s = requireUser(req, res);
  if (!s) return;
  try {
    let db = await loadDb();
    const user = sessionUser(db, s);
    if (!user) return send(res, 401, { error: "Su acceso fue desactivado o cambió la contraseña. Ingrese de nuevo." });

    if (req.method === "GET") {
      const inbox = await readInbox();
      if (inbox.length) {
        if (mergeInbox(db, inbox)) db = await saveDb(db);
        await storeDelete(inbox.map((i) => i.url)).catch(() => {});
      }
      return send(res, 200, Object.assign(viewFor(db, user), { me: { id: user.id, rol: user.rol, nombre: user.nombre } }));
    }

    if (req.method === "PUT") {
      const { baseRev, db: sub } = await readJson(req, 8 * 1024 * 1024);
      if (!sub || !Array.isArray(sub.leads)) return send(res, 400, { error: "Datos inválidos" });
      if ((db.rev || 0) !== (baseRev || 0)) {
        return send(res, 409, { error: "Hubo cambios desde otro dispositivo o usuario. Se recargaron los datos.", db: Object.assign(viewFor(db, user), { me: { id: user.id, rol: user.rol, nombre: user.nombre } }) });
      }
      let next;
      if (user.rol === "admin") {
        // Las cuentas de usuario solo se cambian desde /api/users
        const keepUsers = usuarios(db);
        next = Object.assign({}, sub, { config: Object.assign({}, sub.config || {}, { usuarios: keepUsers }), rev: db.rev });
        delete next.me;
      } else {
        next = mergeFromLawyer(db, sub, user);
      }
      const saved = await saveDb(next);
      return send(res, 200, { ok: true, rev: saved.rev });
    }
    return send(res, 405, { error: "Método no permitido" });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
}

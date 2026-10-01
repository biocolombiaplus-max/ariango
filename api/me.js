/* Perfil del usuario actual.
   GET /api/me   → perfil
   PUT /api/me   → actualiza datos propios, firma y contraseña ({ actual, nueva }) */
import { send, readJson, requireUser, hashPassword, verifyPassword, startSession } from "./_lib.js";
import { loadDb, saveDb, sessionUser, publicUser } from "./_crm.js";

const OWN = ["nombre", "cargo", "especialidad", "cedula", "tarjeta", "telefono", "ciudad"];

export default async function handler(req, res) {
  const s = requireUser(req, res);
  if (!s) return;
  try {
    const db = await loadDb();
    const u = sessionUser(db, s);
    if (!u) return send(res, 401, { error: "Ingrese de nuevo." });
    if (req.method === "GET") return send(res, 200, { usuario: publicUser(u) });
    if (req.method !== "PUT") return send(res, 405, { error: "Método no permitido" });
    if (u.id === "owner") return send(res, 400, { error: "El administrador principal se configura en Vercel (ADMIN_PASSWORD)." });
    const b = await readJson(req, 300 * 1024);
    for (const f of OWN) if (b[f] !== undefined) u[f] = String(b[f]).trim().slice(0, 160);
    if (b.firmaImg !== undefined) u.firmaImg = /^data:image\/png;base64,/.test(b.firmaImg) ? String(b.firmaImg).slice(0, 250000) : "";
    if (b.nueva) {
      if (!verifyPassword(b.actual, u.salt, u.hash)) return send(res, 400, { error: "La contraseña actual no es correcta." });
      if (String(b.nueva).length < 8) return send(res, 400, { error: "La nueva contraseña debe tener al menos 8 caracteres." });
      Object.assign(u, hashPassword(b.nueva)); u.v = (u.v || 0) + 1;
      startSession(res, { uid: u.id, rol: u.rol, nombre: u.nombre, v: u.v });
    }
    db.leads.forEach((l) => { if (l.abogadoId === u.id) l.abogado = u.nombre; });
    await saveDb(db);
    return send(res, 200, { ok: true, usuario: publicUser(u) });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
}

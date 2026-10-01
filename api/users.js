/* Gestión de abogados y usuarios (solo administrador).
   GET    /api/users            → lista
   POST   /api/users            → crear { nombre, email, password, rol, ... }
   PUT    /api/users            → actualizar { id, ..., password? }
   DELETE /api/users?id=…       → eliminar (sus casos quedan sin asignar) */
import { send, readJson, requireAdmin, hashPassword, randomId } from "./_lib.js";
import { loadDb, saveDb, usuarios, publicUser, log } from "./_crm.js";

const FIELDS = ["nombre", "email", "rol", "cargo", "especialidad", "cedula", "tarjeta", "telefono", "ciudad", "activo", "recibeCasos", "colorTag"];

function clean(body) {
  const o = {};
  for (const f of FIELDS) if (body[f] !== undefined) o[f] = typeof body[f] === "boolean" ? body[f] : String(body[f]).trim().slice(0, 160);
  if (o.email) o.email = o.email.toLowerCase();
  if (o.rol && !["admin", "abogado"].includes(o.rol)) o.rol = "abogado";
  return o;
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const db = await loadDb();
    const list = usuarios(db);
    if (req.method === "GET") return send(res, 200, { usuarios: list.map(publicUser), asignacion: (db.config || {}).asignacion || "manual" });

    if (req.method === "DELETE") {
      const id = new URL(req.url, "http://x").searchParams.get("id");
      const i = list.findIndex((u) => u.id === id);
      if (i < 0) return send(res, 404, { error: "Usuario no encontrado" });
      const [u] = list.splice(i, 1);
      db.leads.forEach((l) => { if (l.abogadoId === id) { l.abogadoId = ""; log(l, "asignacion", "Quedó sin asignar: se eliminó la cuenta de " + u.nombre + "."); } });
      await saveDb(db);
      return send(res, 200, { ok: true });
    }

    const body = await readJson(req, 300 * 1024);
    if (body.asignacion) { db.config.asignacion = body.asignacion === "rotacion" ? "rotacion" : "manual"; await saveDb(db); return send(res, 200, { ok: true }); }
    const data = clean(body);
    if (body.firmaImg !== undefined) data.firmaImg = /^data:image\/png;base64,/.test(body.firmaImg) ? String(body.firmaImg).slice(0, 250000) : "";

    if (req.method === "POST") {
      if (!data.nombre || !data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return send(res, 400, { error: "Escriba el nombre y un correo válido." });
      if (String(body.password || "").length < 8) return send(res, 400, { error: "La contraseña debe tener al menos 8 caracteres." });
      if (list.some((u) => u.email === data.email)) return send(res, 409, { error: "Ya existe un usuario con ese correo." });
      const u = Object.assign({ id: "U" + randomId(6), rol: "abogado", activo: true, recibeCasos: true, v: 0, creado: new Date().toISOString() }, data, hashPassword(body.password));
      list.push(u);
      await saveDb(db);
      return send(res, 200, { ok: true, usuario: publicUser(u) });
    }
    if (req.method === "PUT") {
      const u = list.find((x) => x.id === body.id);
      if (!u) return send(res, 404, { error: "Usuario no encontrado" });
      if (data.email && list.some((x) => x !== u && x.email === data.email)) return send(res, 409, { error: "Ya existe un usuario con ese correo." });
      const wasActive = u.activo !== false;
      Object.assign(u, data);
      if (body.password) {
        if (String(body.password).length < 8) return send(res, 400, { error: "La contraseña debe tener al menos 8 caracteres." });
        Object.assign(u, hashPassword(body.password)); u.v = (u.v || 0) + 1; // cierra sus sesiones abiertas
      }
      if (wasActive && u.activo === false) u.v = (u.v || 0) + 1;
      if (data.nombre) db.leads.forEach((l) => { if (l.abogadoId === u.id) l.abogado = u.nombre; });
      await saveDb(db);
      return send(res, 200, { ok: true, usuario: publicUser(u) });
    }
    return send(res, 405, { error: "Método no permitido" });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
}

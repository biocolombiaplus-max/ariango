import { send, readJson, passwordMatches, startSession, verifyPassword } from "./_lib.js";
import { loadDb, usuarios } from "./_crm.js";

const wait = () => new Promise((r) => setTimeout(r, 900)); // frena ataques de fuerza bruta

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Método no permitido" });
  if (!process.env.ADMIN_PASSWORD) {
    return send(res, 500, { error: "Falta configurar la variable ADMIN_PASSWORD en Vercel." });
  }
  try {
    const { email, password } = await readJson(req, 4096);
    const mail = String(email || "").trim().toLowerCase();
    // Administrador principal: solo contraseña (o con cualquier correo)
    if (passwordMatches(password)) {
      startSession(res, { uid: "owner", rol: "admin", nombre: "Administrador principal" });
      return send(res, 200, { ok: true, rol: "admin" });
    }
    if (mail) {
      const db = await loadDb();
      const u = usuarios(db).find((x) => (x.email || "").toLowerCase() === mail);
      if (u && u.activo !== false && verifyPassword(password, u.salt, u.hash)) {
        startSession(res, { uid: u.id, rol: u.rol || "abogado", nombre: u.nombre, v: u.v || 0 });
        return send(res, 200, { ok: true, rol: u.rol || "abogado" });
      }
    }
    await wait();
    return send(res, 401, { error: mail ? "Correo o contraseña incorrectos." : "Contraseña incorrecta. Si es abogado, escriba también su correo." });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
}

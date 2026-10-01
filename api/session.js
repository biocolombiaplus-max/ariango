import { send, getSession, storageMode } from "./_lib.js";

export default function handler(req, res) {
  const s = getSession(req);
  return send(res, 200, {
    authed: !!s && s.rol === "admin",
    user: s ? { uid: s.uid, rol: s.rol, nombre: s.nombre } : null,
    configured: Boolean(process.env.ADMIN_PASSWORD),
    storage: storageMode()
  });
}

import { send, readJson, passwordMatches, startSession } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Método no permitido" });
  if (!process.env.ADMIN_PASSWORD) {
    return send(res, 500, { error: "Falta configurar la variable ADMIN_PASSWORD en Vercel." });
  }
  try {
    const { password } = await readJson(req, 4096);
    if (!passwordMatches(password)) {
      await new Promise((r) => setTimeout(r, 900)); // frena ataques de fuerza bruta
      return send(res, 401, { error: "Contraseña incorrecta." });
    }
    startSession(res);
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
}

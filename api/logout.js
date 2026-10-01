import { send, endSession } from "./_lib.js";

export default function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Método no permitido" });
  endSession(res);
  return send(res, 200, { ok: true });
}

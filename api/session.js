import { send, isAuthed, storageMode } from "./_lib.js";

export default function handler(req, res) {
  return send(res, 200, {
    authed: isAuthed(req),
    configured: Boolean(process.env.ADMIN_PASSWORD),
    storage: storageMode()
  });
}

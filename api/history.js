import { send, requireAdmin, storeList } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Método no permitido" });
  if (!requireAdmin(req, res)) return;
  try {
    const items = (await storeList("site/content/"))
      .filter((b) => b.pathname.endsWith(".json"))
      .sort((a, b) => (a.pathname < b.pathname ? 1 : -1))
      .map((b) => ({ version: b.pathname, size: b.size, savedAt: Number(b.pathname.split("/").pop().replace(".json", "")) }));
    return send(res, 200, { items });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}

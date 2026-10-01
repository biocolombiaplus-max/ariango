/* Servidor local para probar el sitio y el panel sin Vercel.
   Uso:  ADMIN_PASSWORD=clave npm run dev   → http://localhost:3000
   Los datos y archivos subidos quedan en la carpeta .data/ */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 3000);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".pdf": "application/pdf",
  ".xml": "application/xml", ".txt": "text/plain"
};

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  try {
    if (pathname.startsWith("/api/")) {
      const name = pathname.slice(5).replace(/[^a-z-]/g, "");
      const mod = await import(pathToFileURL(path.join(ROOT, "api", name + ".js")).href);
      return await mod.default(req, res);
    }
    let file = pathname.startsWith("/__data/")
      ? path.join(ROOT, ".data", decodeURIComponent(pathname.slice(8)))
      : path.join(ROOT, decodeURIComponent(pathname));
    if (!file.startsWith(ROOT)) throw Object.assign(new Error("forbidden"), { code: "ENOENT" });
    const st = await fs.stat(file).catch(() => null);
    if (st && st.isDirectory()) file = path.join(file, "index.html");
    const data = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch (e) {
    res.writeHead(e.code === "ENOENT" || e.code === "ERR_MODULE_NOT_FOUND" ? 404 : 500, { "Content-Type": "text/plain" });
    res.end(e.code === "ENOENT" ? "No encontrado" : String(e.message));
  }
}).listen(PORT, () => console.log(`Ariango local → http://localhost:${PORT}  (panel: /admin/)`));

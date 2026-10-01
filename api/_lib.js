/* Utilidades compartidas por las funciones del panel administrativo.
   Los archivos que empiezan por "_" no se publican como endpoints en Vercel. */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const COOKIE = "ac_admin";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 días

/* ---------- Respuestas ---------- */
export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!headers["Cache-Control"]) res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Archivo demasiado grande"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req, limit = 1024 * 1024) {
  const buf = await readBody(req, limit);
  try { return JSON.parse(buf.toString("utf8") || "{}"); }
  catch { throw Object.assign(new Error("JSON inválido"), { status: 400 }); }
}

/* ---------- Sesión (cookie firmada con HMAC) ---------- */
function secret() {
  return process.env.SESSION_SECRET || "ac-session:" + (process.env.ADMIN_PASSWORD || "");
}
function hmac(data) {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}
function getCookie(req, name) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
function cookieFlags() {
  return "; Path=/; HttpOnly; SameSite=Strict" + (process.env.VERCEL ? "; Secure" : "");
}

export function isAuthed(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const token = getCookie(req, COOKIE);
  if (!token) return false;
  const [data, sig] = token.split(".");
  if (!data || !sig) return false;
  const a = Buffer.from(sig), b = Buffer.from(hmac(data));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch { return false; }
}

export function startSession(res) {
  const data = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  res.setHeader("Set-Cookie", `${COOKIE}=${data}.${hmac(data)}; Max-Age=${MAX_AGE}${cookieFlags()}`);
}

export function endSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Max-Age=0${cookieFlags()}`);
}

export function passwordMatches(input) {
  const expected = process.env.ADMIN_PASSWORD || "";
  const a = crypto.createHash("sha256").update(String(input || "")).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return expected.length > 0 && crypto.timingSafeEqual(a, b);
}

/** Exige sesión; en escrituras exige además la cabecera propia del panel (protección CSRF). */
export function requireAdmin(req, res) {
  if (!isAuthed(req)) { send(res, 401, { error: "Sesión expirada. Inicie sesión de nuevo." }); return false; }
  if (req.method !== "GET" && req.headers["x-ac-admin"] !== "1") {
    send(res, 403, { error: "Solicitud no permitida." });
    return false;
  }
  return true;
}

/* ---------- Almacenamiento ----------
   En Vercel usa Vercel Blob (variable BLOB_READ_WRITE_TOKEN).
   En local (sin token) guarda en la carpeta .data/ para poder probar. */
export const storageMode = () => (process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local");
const LOCAL_DIR = path.join(process.cwd(), ".data");

export async function storePut(pathname, buffer, contentType) {
  if (storageMode() === "blob") {
    const { put } = await import("@vercel/blob");
    const r = await put(pathname, buffer, { access: "public", contentType, addRandomSuffix: false });
    return { url: r.url, pathname: r.pathname };
  }
  if (process.env.VERCEL) {
    throw Object.assign(new Error("Falta conectar Vercel Blob al proyecto (Storage → Blob)."), { status: 500 });
  }
  const file = path.join(LOCAL_DIR, pathname);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buffer);
  return { url: "/__data/" + pathname, pathname };
}

export async function storeList(prefix) {
  if (storageMode() === "blob") {
    const { list } = await import("@vercel/blob");
    const out = [];
    let cursor;
    do {
      const r = await list({ prefix, limit: 1000, cursor });
      out.push(...r.blobs.map((b) => ({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt })));
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return out;
  }
  const dir = path.join(LOCAL_DIR, prefix);
  try {
    const names = await fs.readdir(dir);
    return Promise.all(names.map(async (n) => {
      const st = await fs.stat(path.join(dir, n));
      return { url: "/__data/" + prefix + n, pathname: prefix + n, size: st.size, uploadedAt: st.mtime };
    }));
  } catch { return []; }
}

export async function storeDelete(urls) {
  if (!urls.length) return;
  if (storageMode() === "blob") {
    const { del } = await import("@vercel/blob");
    await del(urls);
    return;
  }
  await Promise.all(urls.map((u) => fs.rm(path.join(LOCAL_DIR, u.replace(/^\/__data\//, "")), { force: true })));
}

export async function fetchStoredJson(url) {
  if (url.startsWith("/__data/")) {
    return JSON.parse(await fs.readFile(path.join(LOCAL_DIR, url.slice(8)), "utf8"));
  }
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("No se pudo leer el contenido guardado");
  return r.json();
}

/* ---------- Cifrado de datos de clientes (AES-256-GCM) ----------
   Los datos del CRM se guardan cifrados: aunque alguien obtuviera la URL del
   archivo, no podría leerlo. La clave sale de DATA_KEY (o SESSION_SECRET).
   IMPORTANTE: si cambia esa variable, los datos anteriores no se podrán leer. */
function dataKey() {
  const base = process.env.DATA_KEY || process.env.SESSION_SECRET || "ac-data:" + (process.env.ADMIN_PASSWORD || "");
  return crypto.createHash("sha256").update("ariango-crm|" + base).digest();
}
export function encryptJson(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", dataKey(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]);
}
export function decryptJson(buf) {
  const d = crypto.createDecipheriv("aes-256-gcm", dataKey(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8"));
}
export async function fetchStoredBuffer(url) {
  if (url.startsWith("/__data/")) return fs.readFile(path.join(LOCAL_DIR, url.slice(8)));
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("No se pudo leer el archivo guardado");
  return Buffer.from(await r.arrayBuffer());
}
export function safeEqual(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
export function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
}
export function encryptBuffer(buf) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", dataKey(), iv);
  const enc = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]);
}
export function decryptBuffer(buf) {
  const d = crypto.createDecipheriv("aes-256-gcm", dataKey(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]);
}
export function sha256(s) { return crypto.createHash("sha256").update(s).digest("hex"); }
export function randomId(n = 10) { return crypto.randomBytes(n).toString("base64url"); }

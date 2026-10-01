/* Recibe las solicitudes del formulario público y las deja en la bandeja del CRM. */
import { send, readJson } from "./_lib.js";
import { addToInbox } from "./_crm.js";

const FIELDS = ["nombre", "telefono", "email", "ciudad", "servicio", "mensaje", "resultado_test", "formulario", "pagina",
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "referrer"];

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Método no permitido" });
  try {
    const body = await readJson(req, 16 * 1024);
    if (body._honey) return send(res, 200, { ok: true });
    const clean = {};
    for (const f of FIELDS) clean[f] = String(body[f] || "").trim().slice(0, f === "mensaje" ? 1500 : 300);
    if (!clean.nombre || clean.telefono.replace(/\D/g, "").length < 7) return send(res, 400, { error: "Datos incompletos" });
    const now = new Date().toISOString();
    const lead = {
      id: "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: now,
      nombre: clean.nombre, telefono: clean.telefono, email: clean.email, ciudad: clean.ciudad,
      servicio: clean.servicio, mensaje: clean.mensaje, resultado_test: clean.resultado_test,
      etapa: "nuevo", abogado: "", valor: 0, etiquetas: ["Web"],
      origen: { formulario: clean.formulario, pagina: clean.pagina, utm_source: clean.utm_source, utm_medium: clean.utm_medium, utm_campaign: clean.utm_campaign, utm_term: clean.utm_term, utm_content: clean.utm_content, gclid: clean.gclid, fbclid: clean.fbclid, referrer: clean.referrer },
      consentimiento: { fecha: now, texto: "Autorizó el tratamiento de datos (Ley 1581 de 2012) en el formulario web." },
      actividad: [{ t: now, tipo: "creado", texto: "Solicitud recibida desde la página web (" + (clean.formulario || "web") + ")." }],
      notas: [], docs: [], pagos: []
    };
    await addToInbox("lead", { kind: "lead", lead });
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
}

/* ==========================================================================
   Ariango Consultores — Generador de documentos (propuesta, contrato, recibo)
   Lo usan el panel (vista previa) y la página pública /documento/.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- Formatos ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return "$ " + Math.round(Number(n) || 0).toLocaleString("es-CO"); }
  function fecha(d) {
    if (!d) return "";
    var x = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T12:00:00") : new Date(d);
    return x.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  }
  function addDays(d, n) { var x = new Date(d || Date.now()); x.setDate(x.getDate() + (Number(n) || 0)); return x.toISOString(); }
  function para(t) { return esc(t).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>"); }

  /* ---------- Número en letras (pesos colombianos) ---------- */
  var U = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
  var D = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  var C = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
  function cientos(n) {
    if (n === 100) return "CIEN";
    var c = Math.floor(n / 100), r = n % 100, out = C[c];
    var dec = r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " Y " + U[r % 10] : "");
    return (out + (out && dec ? " " : "") + dec).trim();
  }
  function apocope(s) { return s.replace(/VEINTIUNO$/, "VEINTIÚN").replace(/UNO$/, "UN"); }
  function miles(n) {
    var m = Math.floor(n / 1000), r = n % 1000;
    var a = m === 0 ? "" : m === 1 ? "MIL" : apocope(cientos(m)) + " MIL";
    return (a + (a && r ? " " : "") + (r ? cientos(r) : "")).trim();
  }
  function letras(n) {
    n = Math.round(Math.abs(Number(n) || 0));
    if (n === 0) return "CERO PESOS M/CTE";
    var mm = Math.floor(n / 1e6), r = n % 1e6, out;
    if (mm === 0) out = miles(r) + " PESOS";
    else {
      out = (mm === 1 ? "UN MILLÓN" : apocope(miles(mm)) + " MILLONES");
      out += r ? " " + miles(r) + " PESOS" : " DE PESOS";
    }
    return out.replace(/\s+/g, " ") + " M/CTE";
  }

  /* ---------- Plantillas por defecto ---------- */
  var GASTOS = [
    "Derechos notariales y registrales",
    "Tasas y certificados de entidades públicas",
    "Apostillas y legalizaciones",
    "Traducciones oficiales",
    "Copias auténticas y envíos",
    "Desplazamientos fuera de Cúcuta",
    "Impuestos del trámite (p. ej., ganancia ocasional en sucesiones)"
  ];
  var MOMENTOS = ["A la aceptación de la propuesta", "A la firma del contrato", "Al radicar la solicitud o demanda", "Al obtener la decisión", "Al finalizar el trámite", "Mensualmente", "En la fecha acordada"];
  var PLANES = {
    "50 / 50": [[50, "Anticipo para iniciar el análisis y el trámite", MOMENTOS[0]], [50, "Saldo", MOMENTOS[2]]],
    "40 / 30 / 30": [[40, "Anticipo para iniciar el análisis y el trámite", MOMENTOS[0]], [30, "Segundo pago", MOMENTOS[2]], [30, "Saldo final", MOMENTOS[4]]],
    "30 / 70": [[30, "Anticipo para iniciar el análisis", MOMENTOS[0]], [70, "Saldo", MOMENTOS[2]]],
    "60 / 40": [[60, "Anticipo para iniciar el análisis y el trámite", MOMENTOS[0]], [40, "Saldo", MOMENTOS[4]]],
    "100%": [[100, "Pago único", MOMENTOS[0]]]
  };
  var REQ_REG = ["Copia del registro civil de nacimiento colombiano", "Copia del acta (partida) de nacimiento venezolana", "Cédula de ciudadanía colombiana", "Cédula de identidad venezolana", "Pasaporte (si lo tiene)", "Registros civiles o cédulas de los padres", "Certificado de nacido vivo u otra prueba del lugar real de nacimiento", "Registros civiles de los hijos (si aplica)", "Poder especial (lo preparamos nosotros)"];
  var REQ_SUC = ["Registro civil de defunción del causante", "Registros civiles de nacimiento de los herederos", "Cédulas de los herederos", "Registro civil de matrimonio o prueba de unión marital", "Certificados de tradición y libertad de los inmuebles", "Avalúo catastral / recibo de impuesto predial", "Tarjetas de propiedad de vehículos", "Extractos bancarios y relación de deudas", "Testamento (si existe)", "Poderes de los herederos (los preparamos nosotros)"];

  var PLANTILLAS = [
    {
      id: "nul-co", nombre: "Nulidad de Registro Civil en Colombia",
      alcance: ["Estudio de los registros civiles, cédulas y antecedentes del caso.", "Definición de la estrategia: vía administrativa ante la Registraduría o vía judicial.", "Elaboración y radicación de la solicitud o demanda, con sus pruebas.", "Seguimiento permanente e información de cada avance.", "Acompañamiento en el nuevo registro con los datos reales y en el trámite de la cédula, cuando aplique."],
      baseLegal: "En Colombia el registro civil de nacimiento prueba el estado civil de la persona. Cuando contiene datos que no corresponden a la realidad (por ejemplo, el lugar de nacimiento) o existe más de un registro, puede anularse o cancelarse. Si el padre o la madre es colombiano, la persona puede conservar la nacionalidad colombiana por nacimiento mediante un nuevo registro con sus datos reales.",
      normas: ["Constitución Política, arts. 14 y 96", "Decreto Ley 1260 de 1970 (arts. 1 y 104)", "Decreto 1069 de 2015", "Ley 1564 de 2012 (Código General del Proceso)", "Ley 1437 de 2011 (CPACA)", "Ley 43 de 1993, modificada por la Ley 1997 de 2019"],
      requisitos: REQ_REG, tiempo: "", respuesta: "48 horas hábiles", honorarios: 0, plan: "50 / 50"
    },
    {
      id: "nul-ve", nombre: "Nulidad de Partida de Nacimiento en Venezuela",
      alcance: ["Estudio del acta de nacimiento venezolana y de los documentos colombianos.", "Definición de la vía procedente ante la autoridad competente en Venezuela.", "Preparación de poderes, pruebas y documentos apostillados.", "Radicación y seguimiento del trámite, con información de cada avance.", "Orientación sobre los efectos en la cédula y el pasaporte venezolanos."],
      baseLegal: "Cuando una persona nació en Colombia pero también fue presentada en un Registro Civil de Venezuela, el acta venezolana contiene un dato que no es real (el lugar de nacimiento) y debe anularse. La Constitución venezolana establece que la nacionalidad venezolana no se pierde por tener otra; si existe derecho a ella, puede conservarse por la vía correcta.",
      normas: ["Constitución de la República Bolivariana de Venezuela, arts. 32 y 34", "Ley Orgánica de Registro Civil (G.O. 39.264 de 2009)", "Código Civil y Código de Procedimiento Civil venezolanos", "Convención de La Haya de 1961 (Apostilla)"],
      requisitos: REQ_REG, tiempo: "", respuesta: "48 horas hábiles", honorarios: 0, plan: "50 / 50"
    },
    {
      id: "diag", nombre: "Diagnóstico de doble registro",
      alcance: ["Revisión de los registros de Colombia y Venezuela y de la historia del caso.", "Concepto escrito en lenguaje claro: qué registro anular, por qué vía y con qué riesgos.", "Plan de acción con documentos, tiempos estimados y costos."],
      baseLegal: "Antes de iniciar cualquier trámite es indispensable determinar cuál de los registros corresponde a la realidad y cómo proteger la nacionalidad y los derechos de la persona en ambos países.",
      normas: ["Decreto Ley 1260 de 1970", "Constitución Política, art. 96", "Constitución venezolana, arts. 32 y 34"],
      requisitos: REQ_REG.slice(0, 7), tiempo: "", respuesta: "24 horas hábiles", honorarios: 0, plan: "100%"
    },
    {
      id: "suc-not", nombre: "Sucesión notarial",
      alcance: ["Estudio de los bienes, deudas y herederos.", "Elaboración del inventario, avalúo y trabajo de partición.", "Radicación ante notaría y atención de requerimientos, incluida la DIAN.", "Firma de la escritura pública y registro de los bienes a nombre de los herederos.", "Orientación sobre el impuesto de ganancia ocasional."],
      baseLegal: "Cuando todos los herederos están de acuerdo y son representados por abogado, la sucesión puede tramitarse ante notario, que suele ser la vía más ágil. La ley define el orden de quienes heredan y la porción de cada uno.",
      normas: ["Código Civil, Libro III (arts. 1008 y ss.)", "Decreto 902 de 1988, modificado por el Decreto 1729 de 1989", "Estatuto Tributario, arts. 302 y ss. (Ley 2277 de 2022)", "Sentencia C-238 de 2012"],
      requisitos: REQ_SUC, tiempo: "", respuesta: "48 horas hábiles", honorarios: 0, plan: "40 / 30 / 30"
    },
    {
      id: "suc-jud", nombre: "Sucesión judicial",
      alcance: ["Estudio de los bienes, deudas, herederos y del conflicto existente.", "Presentación de la demanda de sucesión ante el juez competente.", "Representación en inventarios, avalúos, objeciones y partición.", "Seguimiento hasta la sentencia aprobatoria y su registro."],
      baseLegal: "Si los herederos no están de acuerdo, hay herederos ausentes o existen conflictos, la sucesión se tramita ante un juez, que garantiza la parte que corresponde a cada heredero según la ley.",
      normas: ["Código Civil, Libro III (arts. 1008 y ss.)", "Ley 1564 de 2012, arts. 487 y ss.", "Estatuto Tributario, arts. 302 y ss.", "Sentencia C-238 de 2012"],
      requisitos: REQ_SUC, tiempo: "", respuesta: "48 horas hábiles", honorarios: 0, plan: "40 / 30 / 30"
    },
    {
      id: "suc-bin", nombre: "Sucesión binacional (Colombia – Venezuela)",
      alcance: ["Determinación de la ley aplicable y de los trámites en cada país.", "Sucesión en Colombia por la vía notarial o judicial.", "Coordinación de los trámites para los bienes o herederos en Venezuela.", "Apostillas, poderes y documentos para ambos países."],
      baseLegal: "Cuando hay bienes o herederos en Colombia y en Venezuela, se analiza qué ley rige la sucesión —en principio, la del último domicilio del fallecido— y se coordinan los trámites en cada país según la ubicación de los bienes.",
      normas: ["Código Civil colombiano, art. 1012 y Libro III", "Ley de Derecho Internacional Privado de Venezuela", "Convención de La Haya de 1961 (Apostilla)"],
      requisitos: REQ_SUC, tiempo: "", respuesta: "48 horas hábiles", honorarios: 0, plan: "40 / 30 / 30"
    }
  ];

  var CLAUSULAS = [
    ["OBJETO", "LA FIRMA se obliga a prestar al CLIENTE sus servicios profesionales de abogado para: {SERVICIO}. El alcance comprende: {ALCANCE}"],
    ["NATURALEZA DE LA OBLIGACIÓN", "Las obligaciones de LA FIRMA son de medio y no de resultado. LA FIRMA actuará con diligencia, lealtad y conocimiento, conforme al Código Disciplinario del Abogado (Ley 1123 de 2007), pero no garantiza un resultado determinado, pues este depende de las autoridades competentes y de las pruebas disponibles."],
    ["OBLIGACIONES DE LA FIRMA", "a) Estudiar el caso y adelantar las actuaciones necesarias con diligencia; b) informar al CLIENTE sobre el estado del trámite cuando este lo solicite y ante cada avance relevante; c) guardar el secreto profesional y la reserva de la información; d) custodiar los documentos recibidos y devolverlos al terminar el encargo."],
    ["OBLIGACIONES DEL CLIENTE", "a) Suministrar información veraz, completa y oportuna, y los documentos requeridos; b) otorgar los poderes necesarios; c) pagar los honorarios y gastos en la forma pactada; d) informar cualquier cambio en sus datos de contacto o en su situación."],
    ["HONORARIOS Y FORMA DE PAGO", "Como honorarios el CLIENTE pagará la suma de {HONORARIOS} ({HONORARIOS_LETRAS}), en la siguiente forma: {PLAN}. Los pagos se realizarán por transferencia o consignación a las cuentas indicadas por LA FIRMA."],
    ["GASTOS", "Los honorarios no incluyen los gastos del trámite, que serán asumidos por el CLIENTE previa información y soporte, tales como: {GASTOS}."],
    ["DURACIÓN", "El presente contrato rige desde su aceptación hasta la terminación del trámite encomendado. El tiempo estimado es de {TIEMPO}, sujeto a los tiempos de las autoridades y entidades que intervienen, que no dependen de LA FIRMA."],
    ["TERMINACIÓN", "El contrato podrá terminarse por mutuo acuerdo o por incumplimiento de cualquiera de las partes. Si el CLIENTE da por terminado el contrato sin justa causa, deberá pagar los honorarios causados según el avance de la gestión."],
    ["CONFIDENCIALIDAD Y DATOS PERSONALES", "LA FIRMA tratará los datos personales del CLIENTE conforme a la Ley 1581 de 2012 y sus decretos reglamentarios, únicamente para la ejecución de este contrato, y guardará reserva sobre toda la información del caso."],
    ["MÉRITO EJECUTIVO", "El presente contrato presta mérito ejecutivo para el cobro de las obligaciones dinerarias en él contenidas, de conformidad con el artículo 422 del Código General del Proceso."],
    ["SOLUCIÓN DE CONTROVERSIAS", "Las diferencias que surjan se resolverán en primer lugar por arreglo directo y, de no lograrse, mediante conciliación conforme a la Ley 2220 de 2022, antes de acudir a la jurisdicción ordinaria."],
    ["NOTIFICACIONES Y ACEPTACIÓN ELECTRÓNICA", "Las partes aceptan como medios de comunicación los correos electrónicos y números de WhatsApp aquí registrados. La aceptación de este contrato por medios electrónicos tiene plena validez conforme a la Ley 527 de 1999."]
  ];

  var DEFAULTS = {
    gastos: GASTOS, momentos: MOMENTOS, planes: PLANES, plantillas: PLANTILLAS,
    clausulas: CLAUSULAS.map(function (c) { return { titulo: c[0], texto: c[1], on: true }; }),
    tiempos: ["15 a 30 días", "1 a 2 meses", "2 a 4 meses", "4 a 6 meses", "6 a 12 meses", "Más de 12 meses"],
    respuestas: ["24 horas hábiles", "48 horas hábiles", "3 días hábiles", "5 días hábiles"],
    vigencias: [8, 15, 30],
    metodos: ["Transferencia bancaria", "Consignación", "Efectivo", "Nequi", "Daviplata", "Tarjeta", "Otro"]
  };
  var ORD = ["PRIMERA", "SEGUNDA", "TERCERA", "CUARTA", "QUINTA", "SEXTA", "SÉPTIMA", "OCTAVA", "NOVENA", "DÉCIMA", "UNDÉCIMA", "DUODÉCIMA", "DECIMOTERCERA", "DECIMOCUARTA", "DECIMOQUINTA", "DECIMOSEXTA", "DECIMOSÉPTIMA", "DECIMOCTAVA", "DECIMONOVENA", "VIGÉSIMA"];

  /* ---------- Cálculos ---------- */
  function totals(d) {
    var base = Number(d.honorarios) || 0;
    var iva = d.iva ? Math.round(base * 0.19) : 0;
    return { base: base, iva: iva, total: base + iva };
  }
  function planRows(d) {
    var t = totals(d).total;
    return (d.plan || []).map(function (p) { return { concepto: p.concepto, pct: Number(p.pct) || 0, momento: p.momento, valor: Math.round(t * (Number(p.pct) || 0) / 100) }; });
  }

  /* ---------- Piezas comunes ---------- */
  function head(ctx, tipo, numero, extra) {
    var f = ctx.firma || {};
    var logo = ctx.logo || "/assets/img/logo-ac.png";
    return '<header class="acd-head"><div class="acd-brand"><img src="' + esc(logo) + '" alt="">' +
      '<div><b>' + esc(f.nombre || "ARIANGO CONSULTORES") + "</b><span>Abogados · " + esc(f.ciudad || "Cúcuta") + "</span></div></div>" +
      '<div class="acd-headr"><span class="acd-type">' + tipo + '</span><span class="acd-num">N.º ' + esc(numero || "—") + "</span>" + (extra || "") + "</div></header>";
  }
  function foot(ctx) {
    var f = ctx.firma || {};
    var parts = [f.razon || f.nombre || "Ariango Consultores", f.nit ? "NIT " + f.nit : "", f.direccion, f.telefono, f.email, f.web].filter(Boolean);
    return '<footer class="acd-foot"><span>' + parts.map(esc).join("  ·  ") + "</span></footer>";
  }
  function accountsHtml(cuentas) {
    if (!cuentas || !cuentas.length) return "";
    return '<div class="acd-accounts">' + cuentas.map(function (c) {
      return '<div class="acd-account"><span class="acd-bank">' + esc(c.banco) + '</span><b>' + esc(c.tipo) + " N.º " + esc(c.numero) + "</b>" +
        "<span>Titular: " + esc(c.titular) + (c.documento ? " · " + esc(c.documento) : "") + "</span>" +
        (c.nota ? "<small>" + esc(c.nota) + "</small>" : "") + (c.qr ? '<img src="' + esc(c.qr) + '" alt="QR de pago">' : "") + "</div>";
    }).join("") + "</div>";
  }
  function stamp(doc) {
    if (doc.estado === "borrador") return '<div class="acd-watermark">BORRADOR</div>';
    return "";
  }
  function sigBlock(nombre, cargo, extra, img) {
    return '<div class="acd-sig">' + (img ? '<img class="acd-sigimg" src="' + esc(img) + '" alt="Firma">' : '<div class="acd-sigspace"></div>') +
      '<div class="acd-sigline"></div><b>' + esc(nombre) + "</b><span>" + esc(cargo) + "</span>" + (extra ? "<span>" + esc(extra) + "</span>" : "") + "</div>";
  }
  function firmImg(ctx) { var f = ctx.firma || {}; return f.firmaImg || ""; }
  function clientSig(doc) { return doc.firma && doc.firma.imagen ? doc.firma.imagen : ""; }
  function certificate(doc) {
    var a = doc.firma;
    if (!a) return "";
    return '<section class="acd-cert"><div class="acd-cert__seal">✓</div><div><b>Certificado de firma electrónica</b>' +
      '<dl><dt>Firmante</dt><dd>' + esc(a.nombre) + "</dd><dt>Documento de identidad</dt><dd>" + esc(a.documento) + "</dd>" +
      "<dt>Fecha y hora</dt><dd>" + new Date(a.fecha).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "medium", timeZone: "America/Bogota" }) + " (hora de Colombia)</dd>" +
      (a.ip ? "<dt>Dirección IP</dt><dd>" + esc(a.ip) + "</dd>" : "") + (a.agente ? "<dt>Dispositivo</dt><dd>" + esc(a.agente.slice(0, 90)) + "</dd>" : "") +
      (a.hash ? "<dt>Huella del documento (SHA-256)</dt><dd class=\"acd-hash\">" + esc(a.hash) + "</dd>" : "") +
      "</dl><small>Firmado mediante mensaje de datos con firma electrónica, válida conforme a la Ley 527 de 1999 y el Decreto 2364 de 2012 (compilado en el Decreto 1074 de 2015). El firmante declaró haber leído y aceptado el contenido.</small></div></section>";
  }

  /* ---------- Propuesta ---------- */
  function proposal(doc, ctx) {
    var d = doc.data || {}, cli = ctx.cliente || {}, t = totals(d), rows = planRows(d);
    var ab = d.abogado || {};
    var venc = addDays(d.fecha || doc.creado, d.vigencia || 15);
    var sec = 0;
    function h(title) { sec++; return '<h2 class="acd-h2"><span>' + (sec < 10 ? "0" : "") + sec + "</span>" + title + "</h2>"; }
    var reqs = (d.requisitos || []).filter(function (r) { return r.estado !== "na"; });
    return '<article class="acd acd--proposal">' + stamp(doc) +
      head(ctx, "Propuesta de servicios profesionales", doc.numero, '<span class="acd-date">' + fecha(d.fecha || doc.creado) + "</span>") +
      '<section class="acd-hero"><div><span class="acd-kicker">Preparada para</span><h1>' + esc(cli.nombre) + '</h1><p>' + esc([cli.ciudad, cli.telefono, cli.email].filter(Boolean).join(" · ")) + "</p></div>" +
      '<div class="acd-hero__svc"><span class="acd-kicker">Servicio</span><b>' + esc(d.servicio) + "</b>" +
      '<span class="acd-valid">Válida hasta el ' + fecha(venc) + "</span></div></section>" +
      (d.situacion ? h("Su situación") + '<div class="acd-box"><p>' + para(d.situacion) + "</p></div>" : "") +
      ((d.alcance || []).length ? h("Lo que haremos por usted") + '<ol class="acd-steps">' + d.alcance.map(function (a) { return "<li><span></span>" + esc(a) + "</li>"; }).join("") + "</ol>" : "") +
      (d.baseLegal || (d.normas || []).length ? h("Fundamento legal") + (d.baseLegal ? "<p>" + para(d.baseLegal) + "</p>" : "") +
        ((d.normas || []).length ? '<ul class="acd-laws">' + d.normas.map(function (n) { return "<li>§ " + esc(n) + "</li>"; }).join("") + "</ul>" : "") : "") +
      (reqs.length ? h("Documentos requeridos") + '<ul class="acd-checklist">' + reqs.map(function (r) {
        return '<li class="is-' + (r.estado === "recibido" ? "ok" : "pend") + '"><span class="acd-cb">' + (r.estado === "recibido" ? "✓" : "") + "</span>" + esc(r.t) + "<em>" + (r.estado === "recibido" ? "Recibido" : "Pendiente") + "</em></li>";
      }).join("") + "</ul>" : "") +
      h("Tiempos") + '<div class="acd-kpis"><div><span>Tiempo estimado del trámite</span><b>' + esc(d.tiempo || "Por definir") + "</b></div>" +
      "<div><span>Tiempo de respuesta a sus consultas</span><b>" + esc(d.respuesta || "48 horas hábiles") + "</b></div></div>" +
      '<p class="acd-small">Los tiempos son estimados y dependen de las entidades y despachos que intervienen.</p>' +
      h("Inversión") + '<div class="acd-invest"><div class="acd-invest__total"><span>Honorarios profesionales</span><b>' + money(t.total) + "</b><small>" + letras(t.total) + (d.iva ? " · IVA incluido" : "") + "</small></div>" +
      '<table class="acd-table"><tbody><tr><td>Honorarios</td><td>' + money(t.base) + "</td></tr>" + (d.iva ? "<tr><td>IVA (19%)</td><td>" + money(t.iva) + "</td></tr>" : "") +
      '<tr class="is-total"><td>Total</td><td>' + money(t.total) + "</td></tr></tbody></table></div>" +
      (rows.length ? '<h3 class="acd-h3">Forma de pago</h3><table class="acd-table acd-plan"><thead><tr><th>Pago</th><th>Momento</th><th>%</th><th>Valor</th></tr></thead><tbody>' +
        rows.map(function (r) { return "<tr><td>" + esc(r.concepto) + "</td><td>" + esc(r.momento) + "</td><td>" + r.pct + "%</td><td><b>" + money(r.valor) + "</b></td></tr>"; }).join("") + "</tbody></table>" : "") +
      ((d.gastos || []).length ? '<h3 class="acd-h3">No incluye (gastos a cargo del cliente)</h3><ul class="acd-tags">' + d.gastos.map(function (g) { return "<li>" + esc(g) + "</li>"; }).join("") + "</ul>" : "") +
      ((ctx.cuentas || []).length ? h("Cómo realizar el pago") + accountsHtml(ctx.cuentas) + '<p class="acd-small">Envíe el comprobante por WhatsApp para emitir su recibo de pago.</p>' : "") +
      h("Próximos pasos") + '<div class="acd-next"><div><b>1</b><span>Acepte esta propuesta desde el enlace o por WhatsApp.</span></div><div><b>2</b><span>Realice el pago inicial y envíe el comprobante.</span></div><div><b>3</b><span>Firmamos el contrato e iniciamos de inmediato su caso.</span></div></div>' +
      (d.notas ? '<div class="acd-box acd-box--note"><p>' + para(d.notas) + "</p></div>" : "") +
      '<div class="acd-terms"><b>Condiciones</b><p>Propuesta válida por ' + esc(d.vigencia || 15) + " días calendario. Las obligaciones del abogado son de medio y no de resultado (Ley 1123 de 2007). La información del caso está protegida por el secreto profesional y se trata conforme a la Ley 1581 de 2012.</p></div>" +
      '<div class="acd-sigs acd-sigs--two">' + sigBlock(ab.nombre || "Dr. Walter Enrique Arias Moreno", ab.cargo || "Abogado responsable", ab.tarjeta ? "T.P. " + ab.tarjeta : "", ab.firmaImg || firmImg(ctx)) +
      (doc.firma ? sigBlock(doc.firma.nombre, "Aceptado por el cliente", "Doc. " + doc.firma.documento, clientSig(doc)) : "") + "</div>" +
      certificate(doc) + foot(ctx) + "</article>";
  }

  /* ---------- Contrato ---------- */
  function fill(text, d, ctx) {
    var t = totals(d), cli = d.cliente || {};
    var plan = planRows(d).map(function (r) { return r.pct + "% (" + money(r.valor) + ") " + r.momento.toLowerCase(); }).join("; ");
    var map = {
      "{SERVICIO}": d.servicio || "", "{ALCANCE}": (d.alcance || []).map(function (a, i) { return String.fromCharCode(97 + i) + ") " + a.replace(/\.$/, ""); }).join("; ") + ".",
      "{HONORARIOS}": money(t.total) + (d.iva ? " IVA incluido" : ""), "{HONORARIOS_LETRAS}": letras(t.total), "{PLAN}": plan || "según lo acordado",
      "{GASTOS}": (d.gastos || []).join(", ").toLowerCase() || "los que se causen", "{TIEMPO}": d.tiempo || "lo que demande el trámite",
      "{CLIENTE}": cli.nombre || "", "{CEDULA}": cli.cedula || ""
    };
    return Object.keys(map).reduce(function (s, k) { return s.split(k).join(map[k]); }, text);
  }
  function contract(doc, ctx) {
    var d = doc.data || {}, f = ctx.firma || {}, cli = d.cliente || {}, ab = d.abogado || {};
    var cl = (d.clausulas || DEFAULTS.clausulas).filter(function (c) { return c.on !== false; });
    var rep = f.representante || ab.nombre || "Walter Enrique Arias Moreno";
    return '<article class="acd acd--contract">' + stamp(doc) +
      head(ctx, "Contrato de prestación de servicios", doc.numero, '<span class="acd-date">' + fecha(d.fecha || doc.creado) + "</span>") +
      '<h1 class="acd-ctitle">Contrato de prestación de servicios profesionales de abogado</h1>' +
      '<div class="acd-parties"><div><span class="acd-kicker">La firma</span><b>' + esc(f.razon || f.nombre || "Ariango Consultores") + "</b><p>" +
      esc([f.nit ? "NIT " + f.nit : "", "Representada por " + rep + (f.cedulaRep ? ", C.C. " + f.cedulaRep : ""), f.tarjeta ? "T.P. " + f.tarjeta : "", f.direccion].filter(Boolean).join(" · ")) + "</p></div>" +
      '<div><span class="acd-kicker">El cliente</span><b>' + esc(cli.nombre) + "</b><p>" +
      esc([cli.cedula ? "Documento " + cli.cedula + (cli.expedida ? " de " + cli.expedida : "") : "", cli.direccion, cli.ciudad, cli.telefono, cli.email].filter(Boolean).join(" · ")) + "</p></div></div>" +
      '<p class="acd-intro">Entre los suscritos, identificados como aparece arriba, quienes en adelante se denominarán <b>LA FIRMA</b> y <b>EL CLIENTE</b>, se celebra el presente contrato de prestación de servicios profesionales, que se regirá por las siguientes cláusulas:</p>' +
      '<div class="acd-clauses">' + cl.map(function (c, i) { return '<p class="acd-clause"><b>' + (ORD[i] || i + 1) + ". " + esc(c.titulo) + ".</b> " + para(fill(c.texto, d, ctx)) + "</p>"; }).join("") + "</div>" +
      ((ctx.cuentas || []).length ? '<h3 class="acd-h3">Cuentas autorizadas para pagos</h3>' + accountsHtml(ctx.cuentas) : "") +
      '<p class="acd-intro">Para constancia se firma en ' + esc(d.ciudadFirma || f.ciudad || "Cúcuta") + ", el " + fecha(d.fecha || doc.creado) + ".</p>" +
      '<div class="acd-sigs acd-sigs--two">' + sigBlock(rep, "Por LA FIRMA" + (f.tarjeta ? " · T.P. " + f.tarjeta : ""), "", firmImg(ctx)) + sigBlock(doc.firma ? doc.firma.nombre : cli.nombre || "EL CLIENTE", "EL CLIENTE", doc.firma ? "Doc. " + doc.firma.documento : cli.cedula ? "Doc. " + cli.cedula : "", clientSig(doc)) + "</div>" +
      certificate(doc) + foot(ctx) + "</article>";
  }

  /* ---------- Recibo ---------- */
  function receipt(doc, ctx) {
    var d = doc.data || {}, cli = ctx.cliente || {}, f = ctx.firma || {};
    var cuenta = (ctx.cuentas || [])[0];
    return '<article class="acd acd--receipt">' + stamp(doc) +
      head(ctx, "Recibo de pago", doc.numero, '<span class="acd-date">' + fecha(d.fecha || doc.creado) + "</span>") +
      '<section class="acd-rhero"><div><span class="acd-kicker">Recibimos de</span><h1>' + esc(cli.nombre) + "</h1><p>" + esc([cli.cedula ? "Doc. " + cli.cedula : "", cli.ciudad, cli.telefono].filter(Boolean).join(" · ")) + "</p></div>" +
      '<div class="acd-amount"><span>La suma de</span><b>' + money(d.valor) + "</b><small>" + letras(d.valor) + "</small></div></section>" +
      '<table class="acd-table acd-rtable"><tbody>' +
      "<tr><td>Concepto</td><td>" + esc(d.concepto) + "</td></tr>" +
      "<tr><td>Servicio</td><td>" + esc(d.servicio) + "</td></tr>" +
      "<tr><td>Medio de pago</td><td>" + esc(d.metodo) + (cuenta ? " · " + esc(cuenta.banco) + " " + esc(cuenta.tipo) + " N.º " + esc(cuenta.numero) : "") + "</td></tr>" +
      (d.referencia ? "<tr><td>Referencia / comprobante</td><td>" + esc(d.referencia) + "</td></tr>" : "") +
      "</tbody></table>" +
      (d.totalServicio ? '<div class="acd-balance"><div><span>Valor total del servicio</span><b>' + money(d.totalServicio) + "</b></div><div><span>Total pagado a la fecha</span><b>" + money((Number(d.pagadoAntes) || 0) + (Number(d.valor) || 0)) + '</b></div><div class="is-due"><span>Saldo pendiente</span><b>' + money(d.saldo) + "</b></div></div>" : "") +
      '<div class="acd-sigs"><div class="acd-sig"><div class="acd-paid">PAGADO</div>' + (firmImg(ctx) ? '<img class="acd-sigimg" src="' + esc(firmImg(ctx)) + '" alt="Firma">' : '<div class="acd-sigspace"></div>') + '<div class="acd-sigline"></div><b>' + esc(d.recibidoPor || f.representante || "Ariango Consultores") + "</b><span>Recibido por</span></div></div>" +
      '<p class="acd-small acd-center">' + esc(f.notaRecibo || "Este recibo es soporte del pago de honorarios profesionales. No reemplaza la factura electrónica cuando esta sea exigible.") + "</p>" +
      foot(ctx) + "</article>";
  }

  /* ---------- Poder especial ---------- */
  function poder(doc, ctx) {
    var d = doc.data || {}, f = ctx.firma || {}, cli = d.cliente || {}, ab = d.abogado || {};
    var apod = ab.nombre || f.representante || "Walter Enrique Arias Moreno";
    var fac = (d.facultades || []).join(", ");
    return '<article class="acd acd--contract">' + stamp(doc) +
      head(ctx, "Poder especial", doc.numero, '<span class="acd-date">' + fecha(d.fecha || doc.creado) + "</span>") +
      '<p class="acd-to">Señores<br><b>' + esc(d.destinatario || "AUTORIDAD COMPETENTE") + "</b><br>" + esc(d.ciudadDest || "") + "</p>" +
      '<p class="acd-ref"><b>Referencia:</b> ' + esc(d.referencia || "Otorgamiento de poder especial") + "</p>" +
      '<p class="acd-intro"><b>' + esc(cli.nombre || "") + "</b>, mayor de edad, identificado(a) con documento N.º <b>" + esc(cli.cedula || "") + "</b>" + (cli.expedida ? " expedido en " + esc(cli.expedida) : "") +
      ", domiciliado(a) en " + esc(cli.ciudad || "") + ", por medio del presente escrito confiero <b>poder especial, amplio y suficiente</b> al abogado <b>" + esc(apod) + "</b>" +
      (ab.cedula || f.cedulaRep ? ", identificado con C.C. " + esc(ab.cedula || f.cedulaRep) : "") + (ab.tarjeta || f.tarjeta ? ", portador de la Tarjeta Profesional N.º " + esc(ab.tarjeta || f.tarjeta) + " del Consejo Superior de la Judicatura" : "") +
      ", para que en mi nombre y representación " + para(d.objeto || "") + "</p>" +
      '<p class="acd-intro">Mi apoderado queda facultado para ' + esc(fac || "realizar todas las actuaciones necesarias para el cumplimiento de este mandato") + ", y en general para todo lo que considere necesario en defensa de mis intereses, en los términos del artículo 77 del Código General del Proceso.</p>" +
      (d.notas ? '<p class="acd-intro">' + para(d.notas) + "</p>" : "") +
      '<p class="acd-intro">Atentamente,</p>' +
      '<div class="acd-sigs acd-sigs--two">' + sigBlock(doc.firma ? doc.firma.nombre : cli.nombre || "PODERDANTE", "Poderdante", doc.firma ? "Doc. " + doc.firma.documento : cli.cedula ? "Doc. " + cli.cedula : "", clientSig(doc)) +
      sigBlock(apod, "Acepto el poder", ab.tarjeta || f.tarjeta ? "T.P. " + (ab.tarjeta || f.tarjeta) : "", ab.firmaImg || firmImg(ctx)) + "</div>" +
      '<p class="acd-small">' + esc(d.nota || "Poder conferido mediante mensaje de datos, conforme al artículo 5 de la Ley 2213 de 2022. Para trámites en el exterior puede requerir reconocimiento ante notario y apostilla.") + "</p>" +
      certificate(doc) + foot(ctx) + "</article>";
  }

  /* ---------- Acta de recepción de documentos ---------- */
  function acta(doc, ctx) {
    var d = doc.data || {}, cli = ctx.cliente || {}, f = ctx.firma || {}, ab = d.abogado || {};
    var items = (d.requisitos || []).filter(function (r) { return r.estado !== "na"; });
    return '<article class="acd acd--receipt">' + stamp(doc) +
      head(ctx, "Acta de recepción de documentos", doc.numero, '<span class="acd-date">' + fecha(d.fecha || doc.creado) + "</span>") +
      '<p class="acd-intro">En ' + esc(f.ciudad || "Cúcuta") + ", el " + fecha(d.fecha || doc.creado) + ", <b>" + esc(f.nombre || "Ariango Consultores") + "</b> deja constancia de la recepción de los siguientes documentos entregados por <b>" + esc(cli.nombre || "") + "</b>" + (cli.cedula ? ", documento N.º " + esc(cli.cedula) : "") + ", para el trámite de <b>" + esc(d.servicio || "") + "</b>:</p>" +
      '<ul class="acd-checklist">' + items.map(function (r) {
        return '<li class="is-' + (r.estado === "recibido" ? "ok" : "pend") + '"><span class="acd-cb">' + (r.estado === "recibido" ? "✓" : "") + "</span>" + esc(r.t) + "<em>" + (r.estado === "recibido" ? (r.forma || "Recibido") : "Pendiente") + "</em></li>";
      }).join("") + "</ul>" +
      (d.notas ? '<div class="acd-box"><p>' + para(d.notas) + "</p></div>" : "") +
      '<p class="acd-small">Los documentos se custodian con reserva y se tratan conforme a la Ley 1581 de 2012. Serán devueltos al terminar el encargo, salvo los que deban radicarse ante las autoridades.</p>' +
      '<div class="acd-sigs acd-sigs--two">' + sigBlock(ab.nombre || f.representante || "Ariango Consultores", "Recibe", "", ab.firmaImg || firmImg(ctx)) +
      sigBlock(doc.firma ? doc.firma.nombre : cli.nombre || "EL CLIENTE", "Entrega", doc.firma ? "Doc. " + doc.firma.documento : "", clientSig(doc)) + "</div>" +
      certificate(doc) + foot(ctx) + "</article>";
  }

  /* ---------- Documento libre (autorizaciones, actas, constancias) ---------- */
  function libre(doc, ctx) {
    var d = doc.data || {}, cli = ctx.cliente || {}, f = ctx.firma || {}, ab = d.abogado || {};
    return '<article class="acd acd--contract">' + stamp(doc) +
      head(ctx, d.titulo || "Documento", doc.numero, '<span class="acd-date">' + fecha(d.fecha || doc.creado) + "</span>") +
      '<h1 class="acd-ctitle">' + esc(d.titulo || "Documento") + "</h1>" +
      '<div class="acd-free"><p>' + para(d.cuerpo || "") + "</p></div>" +
      '<div class="acd-sigs acd-sigs--two">' + (d.firmaFirma !== false ? sigBlock(ab.nombre || f.representante || "Ariango Consultores", "Por LA FIRMA", "", ab.firmaImg || firmImg(ctx)) : "") +
      sigBlock(doc.firma ? doc.firma.nombre : cli.nombre || "EL CLIENTE", "EL CLIENTE", doc.firma ? "Doc. " + doc.firma.documento : "", clientSig(doc)) + "</div>" +
      certificate(doc) + foot(ctx) + "</article>";
  }

  /* ---------- PDF ---------- */
  function loadPdfLib() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js";
      s.onload = function () { res(window.html2pdf); }; s.onerror = function () { rej(new Error("No se pudo cargar el generador de PDF")); };
      document.head.appendChild(s);
    });
  }
  function pdf(el, filename) {
    return loadPdfLib().then(function (h2p) {
      return h2p().set({
        margin: [0, 0, 0, 0], filename: filename || "documento.pdf",
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 820 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "avoid-all"], avoid: [".acd-h2", "tr", ".acd-account", ".acd-sig", ".acd-clause", ".acd-cert", ".acd-kpis", ".acd-next", "li"] }
      }).from(el).save();
    }).catch(function () { window.print(); });
  }

  var ETAPAS = [
    ["nuevo", "Nuevo", "Contactar por WhatsApp"],
    ["contactado", "Contactado", "Enviar propuesta"],
    ["propuesta", "Propuesta enviada", "Hacer seguimiento a la propuesta"],
    ["aceptada", "Propuesta aceptada", "Solicitar el pago inicial"],
    ["anticipo", "Anticipo pagado", "Enviar el contrato para firma"],
    ["contrato", "Contrato firmado", "Solicitar los documentos"],
    ["documentos", "Documentación", "Revisar documentos y radicar"],
    ["tramite", "En trámite", "Informar avances al cliente"],
    ["finalizado", "Finalizado", "Pedir testimonio y referidos"],
    ["perdido", "Perdido", "Registrar el motivo"]
  ];
  var TIPOS = { propuesta: "Propuesta", contrato: "Contrato", recibo: "Recibo de pago", poder: "Poder especial", acta: "Acta de recepción", libre: "Documento" };
  var PREFIJO = { propuesta: "PRO", contrato: "CON", recibo: "REC", poder: "POD", acta: "ACT", libre: "DOC" };

  function render(doc, ctx) {
    ctx = ctx || {};
    if (doc.tipo === "contrato") return contract(doc, ctx);
    if (doc.tipo === "recibo") return receipt(doc, ctx);
    if (doc.tipo === "poder") return poder(doc, ctx);
    if (doc.tipo === "acta") return acta(doc, ctx);
    if (doc.tipo === "libre") return libre(doc, ctx);
    return proposal(doc, ctx);
  }

  DEFAULTS.facultades = ["recibir", "desistir", "sustituir", "reasumir", "renunciar", "conciliar", "transigir", "solicitar y aportar pruebas", "interponer recursos", "notificarse", "radicar y retirar documentos", "solicitar copias y certificados"];
  DEFAULTS.libres = [
    ["Autorización de tratamiento de datos personales", "Yo, {CLIENTE}, identificado(a) con documento N.º {CEDULA}, autorizo de manera previa, expresa e informada a Ariango Consultores para recolectar, almacenar, usar y tratar mis datos personales, incluidos los datos sensibles que sean necesarios, con la finalidad exclusiva de prestar los servicios jurídicos contratados, conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013.\n\nConozco mis derechos a conocer, actualizar, rectificar y suprimir mis datos y a revocar esta autorización, que puedo ejercer escribiendo al correo de la firma."],
    ["Declaración juramentada de hechos", "Yo, {CLIENTE}, identificado(a) con documento N.º {CEDULA}, declaro bajo la gravedad del juramento que:\n\n1. \n2. \n\nLo anterior para que obre como prueba dentro del trámite de {SERVICIO}."],
    ["Constancia de entrega de documentos al cliente", "Ariango Consultores hace entrega a {CLIENTE}, identificado(a) con documento N.º {CEDULA}, de los siguientes documentos relacionados con el trámite de {SERVICIO}:\n\n• \n• \n\nEl cliente declara recibirlos a satisfacción."],
    ["Paz y salvo", "Ariango Consultores certifica que {CLIENTE}, identificado(a) con documento N.º {CEDULA}, se encuentra a paz y salvo por concepto de honorarios del servicio de {SERVICIO}."]
  ];
  window.ACDocs = { render: render, pdf: pdf, ETAPAS: ETAPAS, TIPOS: TIPOS, PREFIJO: PREFIJO, money: money, letras: letras, fecha: fecha, totals: totals, planRows: planRows, DEFAULTS: DEFAULTS, esc: esc };
})();

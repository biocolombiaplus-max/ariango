/* ==========================================================================
   CRM y documentos — Ariango Consultores
   Embudo de clientes, ficha del cliente, propuestas, contratos, poderes,
   actas, recibos, pagos, requisitos y portal del cliente.
   ========================================================================== */
(function () {
  "use strict";
  var A = window.ACAdmin, D = window.ACDocs;
  if (!A || !D) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = A.esc, money = D.money, DEF = D.DEFAULTS;
  var ETAPAS = D.ETAPAS, ORDER = ETAPAS.map(function (e) { return e[0]; });
  var crm = { db: null, loading: null, mode: window.innerWidth < 860 ? "lista" : "tablero", filtro: "", etapa: "todas", abogadoF: "todos" };

  A.TITLES.clientes = "Clientes";
  A.TITLES.documentos = "Firmas, cuentas y plantillas";

  /* ==========================================================================
     Datos
     ========================================================================== */
  function rid(n) {
    var a = new Uint8Array(n || 18); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (x) { return "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 56]; }).join("");
  }
  function now() { return new Date().toISOString(); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function cfg() {
    var c = crm.db.config = crm.db.config || {};
    c.firma = c.firma || {};
    c.cuentas = c.cuentas || [];
    c.firmas = c.firmas || {};
    return c;
  }
  function plantillas() { return cfg().plantillas || DEF.plantillas; }
  var saving = Promise.resolve();
  function me() { return (crm.db && crm.db.me) || { id: "owner", rol: "admin", nombre: "Administrador" }; }
  function isAdmin() { return me().rol === "admin"; }
  function users() { return ((crm.db && crm.db.config && crm.db.config.usuarios) || []); }
  function lawyers() {
    var u = users().filter(function (x) { return x.activo !== false; });
    if (u.length) return u;
    var t = (A.team() || []).filter(function (p) { return p.visible !== false; })[0];
    return [{ id: "owner", nombre: (cfg().firma.representante ? "Dr. " + cfg().firma.representante : (t && t.nombre) || "Dr. Walter Enrique Arias Moreno"), cargo: (t && t.cargo) || "Asesor jurídico principal", tarjeta: cfg().firma.tarjeta || "" }];
  }
  function lawyerById(id) { return users().find(function (x) { return x.id === id; }) || lawyers().find(function (x) { return x.id === id; }); }
  function lawyerData(id) {
    var p = lawyerById(id) || lawyers()[0];
    return { id: p.id, nombre: p.nombre, cargo: p.cargo || "Abogado", tarjeta: p.tarjeta || "", cedula: p.cedula || "", telefono: p.telefono || "", firmaImg: p.firmaImg || cfg().firmas[p.nombre] || "" };
  }
  function lawyerName(l) { var p = lawyerById(l.abogadoId); return p ? p.nombre : l.abogado || ""; }
  async function load(force) {
    if (crm.db && !force) return crm.db;
    if (force) await saving; // no recargar mientras hay cambios guardándose
    if (crm.loading) return crm.loading;
    crm.loading = A.api("/api/crm").then(function (db) { crm.db = db; crm.loading = null; return db; }, function (e) { crm.loading = null; throw e; });
    return crm.loading;
  }
  function save(msg) {
    saving = saving.then(async function () {
      try {
        var r = await fetch("/api/crm", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-ac-admin": "1" }, body: JSON.stringify({ baseRev: crm.db.rev, db: crm.db }) });
        var j = await r.json().catch(function () { return {}; });
        if (r.status === 409) { crm.db = j.db; A.toast(j.error, true); refresh(); return; }
        if (!r.ok) throw new Error(j.error || "No se pudo guardar");
        crm.db.rev = j.rev;
        if (msg) A.toast(msg);
      } catch (e) { A.toast(e.message, true); }
    });
    return saving;
  }
  function lead(id) { return crm.db.leads.find(function (l) { return l.id === id; }); }
  function log(l, tipo, texto) { l.actividad = l.actividad || []; l.actividad.unshift({ t: now(), tipo: tipo, texto: texto }); }
  function advance(l, etapa, why) {
    if (l.etapa === "perdido") return;
    if (ORDER.indexOf(etapa) > ORDER.indexOf(l.etapa)) { l.etapa = etapa; l.etapaDesde = now(); log(l, "etapa", "Pasó a «" + etapaName(etapa) + "»" + (why ? ": " + why : "") + "."); }
  }
  function etapaName(k) { var e = ETAPAS.find(function (x) { return x[0] === k; }); return e ? e[1] : k; }
  function nextAction(k) { var e = ETAPAS.find(function (x) { return x[0] === k; }); return e ? e[2] : ""; }
  function daysIn(l) { return Math.floor((Date.now() - new Date(l.etapaDesde || l.createdAt).getTime()) / 864e5); }
  function pagado(l) { return (l.pagos || []).reduce(function (s, p) { return s + (Number(p.valor) || 0); }, 0); }
  function valor(l) {
    if (Number(l.valor)) return Number(l.valor);
    var p = (l.docs || []).filter(function (d) { return d.tipo === "propuesta"; })[0];
    return p ? D.totals(p.data).total : 0;
  }
  function phoneOf(l) { return PP.phoneDigits(l.indicativo, l.telefono); }
  function phoneDigits(t) {
    var d = String(t || "").replace(/\D/g, "");
    if (d.length === 10 && d[0] === "3") d = "57" + d;
    return d;
  }
  /* ---------- Datos de la persona ---------- */
  var PP = D.P;
  function v2(a) { return a.filter(Boolean).join(", "); }
  /** Datos del cliente listos para los documentos. */
  function personaOf(l) {
    initPersona(l);
    return {
      nombre: l.nombre, tipoDoc: PP.docTexto(l.tipoDoc || "CC"), cedula: l.cedula, expedida: l.expedida, fechaExp: l.fechaExp,
      direccion: v2([l.direccion, l.barrio]), ciudad: v2([l.ciudad, l.depto, l.pais && l.pais !== "Colombia" ? l.pais : ""]),
      telefono: l.telefono ? PP.phoneText(l.indicativo, l.telefono) : "", email: l.email, genero: l.genero, nacionalidad: l.nacionalidad,
      estadoCivil: l.estadoCivil, ocupacion: l.ocupacion, fechaNac: l.fechaNac, lugarNac: v2([l.lugarNac, l.deptoNac, l.paisNac])
    };
  }
  /** Datos del asunto del poder tomados de la ficha. */
  function asuntoDe(l) {
    var r = l.reg || {}, v = l.ven || {}, su = l.suc || {}, a = {};
    if (r.serial || r.nuip) a.SERIAL = [r.serial, r.nuip ? "NUIP " + r.nuip : ""].filter(Boolean).join(" / ");
    if (v.acta) a.ACTA = v.acta + (v.folio ? ", folio " + v.folio : "") + (v.tomo ? ", tomo " + v.tomo : "") + (v.anio ? ", del año " + v.anio : "");
    if (v.oficina || v.municipio || v.estado) a.LUGAR = v2([v.oficina, v.municipio ? "municipio " + v.municipio : "", v.estado ? "estado " + v.estado : ""]);
    if (su.causante) a.CAUSANTE = su.causante;
    if (su.fechaFall) a.FECHA_FALLECIMIENTO = PP.fechaLarga(su.fechaFall);
    if (su.calidad) a.CALIDAD = su.calidad;
    return a;
  }
  /** Completa la ficha a partir de los datos antiguos (nombre completo y teléfono con indicativo). */
  function initPersona(l) {
    if (!l.nombres && !l.apellidos && l.nombre) {
      var w = String(l.nombre).trim().split(/\s+/), k = w.length >= 4 ? 2 : 1;
      if (w.length > 1) { l.nombres = w.slice(0, k).join(" "); l.apellidos = w.slice(k).join(" "); } else l.nombres = l.nombre;
    }
    if (!l.indicativo) { var sp = PP.splitPhone(l.telefono); l.indicativo = sp.ind || (sp.num.length === 10 && sp.num[0] === "3" ? "57" : sp.num.length === 11 && sp.num[0] === "0" ? "58" : "57"); if (sp.ind) l.telefono = sp.num; }
    if (l.consentimiento && !l.datos1581) l.datos1581 = { si: true, fecha: String(l.consentimiento.fecha || l.createdAt || "").slice(0, 10), via: "Formulario web" };
    if (!l.bloques) l.bloques = /suces|heren/i.test(l.servicio || "") ? ["suc"] : /registro|partida|nulidad|doble/i.test(l.servicio || "") ? ["reg", "ven", "padres"] : [];
  }
  function portalUrl(l, docId) {
    if (!l.portal) l.portal = rid(24);
    return location.origin + "/cliente/?l=" + encodeURIComponent(l.id) + "&t=" + encodeURIComponent(l.portal) + (docId ? "&doc=" + encodeURIComponent(docId) : "");
  }
  function waOpen(l, text) {
    var n = phoneOf(l);
    window.open("https://wa.me/" + n + "?text=" + encodeURIComponent(text), "_blank", "noopener");
  }
  function nextNumber(tipo) {
    crm.db.seq = crm.db.seq || {};
    crm.db.seq[tipo] = (crm.db.seq[tipo] || 0) + 1;
    return D.PREFIJO[tipo] + "-" + new Date().getFullYear() + "-" + String(crm.db.seq[tipo]).padStart(4, "0");
  }
  function ctxFor(l, doc) {
    var ids = (doc.data && doc.data.cuentas) || [];
    return {
      firma: cfg().firma,
      cuentas: cfg().cuentas.filter(function (c) { return ids.indexOf(c.id) > -1; }),
      cliente: personaOf(l)
    };
  }
  function firstName(n) { return String(n || "").split(" ")[0]; }

  /* ==========================================================================
     Vista: Clientes (embudo)
     ========================================================================== */
  A.VIEWS.clientes = async function (v) {
    v.innerHTML = '<div class="empty">Cargando clientes…</div>';
    try { await load(); } catch (e) { v.innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; return; }
    renderClientes(v);
  };
  function refresh() {
    var v = $("#view");
    if (v && v.classList.contains("view--clientes")) renderClientes(v);
    if (panel.open) renderPanel();
  }
  function renderClientes(v) {
    var leads = crm.db.leads.filter(function (l) {
      var f = crm.filtro.toLowerCase();
      var okText = !f || [l.nombre, l.telefono, l.email, l.servicio, l.ciudad, l.cedula].join(" ").toLowerCase().indexOf(f) > -1;
      var okLaw = crm.abogadoF === "todos" || (crm.abogadoF === "sin" ? !l.abogadoId : l.abogadoId === crm.abogadoF);
      return okText && okLaw;
    });
    var mes = new Date().toISOString().slice(0, 7);
    var stats = {
      nuevos: crm.db.leads.filter(function (l) { return l.etapa === "nuevo"; }).length,
      propuesta: crm.db.leads.filter(function (l) { return l.etapa === "propuesta" || l.etapa === "aceptada"; }).length,
      cobrado: crm.db.leads.reduce(function (s, l) { return s + (l.pagos || []).filter(function (p) { return String(p.fecha).slice(0, 7) === mes; }).reduce(function (a, p) { return a + (Number(p.valor) || 0); }, 0); }, 0),
      porCobrar: crm.db.leads.filter(function (l) { return ["perdido", "nuevo", "contactado", "propuesta"].indexOf(l.etapa) < 0; }).reduce(function (s, l) { return s + Math.max(0, valor(l) - pagado(l)); }, 0)
    };
    v.innerHTML =
      '<div class="crm-stats"><div><b>' + stats.nuevos + "</b><span>Nuevos por contactar</span></div><div><b>" + stats.propuesta + "</b><span>En propuesta</span></div>" +
      "<div><b>" + money(stats.cobrado) + "</b><span>Cobrado este mes</span></div><div><b>" + money(stats.porCobrar) + "</b><span>Por cobrar</span></div></div>" +
      '<div class="crm-bar"><input type="search" id="crm-q" placeholder="🔎 Buscar por nombre, teléfono, cédula…" value="' + esc(crm.filtro) + '">' +
      (isAdmin() ? '<select id="crm-law" class="crm-lawsel"><option value="todos">Todos los abogados</option><option value="sin"' + (crm.abogadoF === "sin" ? " selected" : "") + '>Sin asignar (' + crm.db.leads.filter(function (l) { return !l.abogadoId && l.etapa !== "perdido"; }).length + ')</option>' + lawyers().map(function (p) { return '<option value="' + esc(p.id) + '"' + (crm.abogadoF === p.id ? " selected" : "") + ">" + esc(p.nombre) + "</option>"; }).join("") + "</select>" : "") +
      '<div class="crm-toggle"><button type="button" data-mode="tablero" class="' + (crm.mode === "tablero" ? "is-on" : "") + '">Tablero</button><button type="button" data-mode="lista" class="' + (crm.mode === "lista" ? "is-on" : "") + '">Lista</button></div>' +
      '<button type="button" class="btn btn--gold" id="crm-new">＋ Nuevo cliente</button><button type="button" class="btn btn--line" id="crm-reload" title="Traer solicitudes nuevas">⟳</button></div>' +
      (crm.mode === "tablero" ? board(leads) : list(leads));
    $("#crm-q", v).addEventListener("input", function (e) { crm.filtro = e.target.value; var pos = e.target.selectionStart; renderClientes(v); var q = $("#crm-q", v); q.focus(); q.setSelectionRange(pos, pos); });
    if ($("#crm-law", v)) $("#crm-law", v).onchange = function (e) { crm.abogadoF = e.target.value; renderClientes(v); };
    $$("[data-mode]", v).forEach(function (b) { b.addEventListener("click", function () { crm.mode = b.getAttribute("data-mode"); renderClientes(v); }); });
    $("#crm-new", v).addEventListener("click", newLead);
    $("#crm-reload", v).addEventListener("click", async function () { await load(true); renderClientes(v); A.toast("Actualizado"); });
    $$("[data-etapa-f]", v).forEach(function (b) { b.addEventListener("click", function () { crm.etapa = b.getAttribute("data-etapa-f"); renderClientes(v); }); });
    $$("[data-lead]", v).forEach(function (c) { c.addEventListener("click", function () { openPanel(c.getAttribute("data-lead")); }); });
    // Arrastrar y soltar en el tablero
    $$(".crm-card[draggable]", v).forEach(function (c) { c.addEventListener("dragstart", function (e) { e.dataTransfer.setData("text/plain", c.getAttribute("data-lead")); c.classList.add("is-drag"); }); c.addEventListener("dragend", function () { c.classList.remove("is-drag"); }); });
    $$(".crm-col", v).forEach(function (col) {
      col.addEventListener("dragover", function (e) { e.preventDefault(); col.classList.add("is-over"); });
      col.addEventListener("dragleave", function () { col.classList.remove("is-over"); });
      col.addEventListener("drop", function (e) {
        e.preventDefault(); col.classList.remove("is-over");
        var l = lead(e.dataTransfer.getData("text/plain")), et = col.getAttribute("data-col");
        if (!l || l.etapa === et) return;
        l.etapa = et; l.etapaDesde = now(); log(l, "etapa", "Movido a «" + etapaName(et) + "»."); save(); renderClientes(v);
      });
    });
  }
  function card(l) {
    var docsPend = (l.docs || []).filter(function (d) { return d.estado !== "borrador" && d.tipo !== "recibo" && !d.firma; }).length;
    var nuevos = (l.archivos || []).filter(function (f) { return f.por === "cliente" && !f.revisado; }).length;
    var dias = daysIn(l), val = valor(l);
    return '<button type="button" class="crm-card" draggable="true" data-lead="' + l.id + '">' +
      '<span class="crm-card__top"><b>' + esc(l.nombre || "(sin nombre)") + '</b><span class="crm-days' + (dias > 3 && ["nuevo", "contactado", "propuesta"].indexOf(l.etapa) > -1 ? " is-late" : "") + '">' + (dias ? dias + " d" : "hoy") + "</span></span>" +
      '<span class="crm-card__svc">' + esc(l.servicio || "Sin servicio") + "</span>" +
      '<span class="crm-card__meta">' + (val ? "<em>" + money(val) + "</em>" : "") + (docsPend ? '<i title="Documentos por firmar">✍️ ' + docsPend + "</i>" : "") + (nuevos ? '<i class="is-new" title="Archivos nuevos del cliente">📎 ' + nuevos + "</i>" : "") + (isAdmin() ? (lawyerName(l) ? "<i>⚖️ " + esc(firstName(lawyerName(l).replace(/^Dr[a]?\.\s*/, ""))) + "</i>" : '<i class="is-un">Sin asignar</i>') : "") + "</span>" +
      '<span class="crm-card__next">→ ' + esc(nextAction(l.etapa)) + "</span></button>";
  }
  function board(leads) {
    return '<div class="crm-board">' + ETAPAS.map(function (e) {
      var items = leads.filter(function (l) { return (l.etapa || "nuevo") === e[0]; });
      var sum = items.reduce(function (s, l) { return s + valor(l); }, 0);
      return '<section class="crm-col" data-col="' + e[0] + '"><header><b>' + e[1] + "</b><span>" + items.length + (sum ? " · " + money(sum) : "") + "</span></header>" +
        '<div class="crm-col__body">' + (items.map(card).join("") || '<p class="crm-col__empty">Arrastre aquí</p>') + "</div></section>";
    }).join("") + "</div>";
  }
  function list(leads) {
    var chips = [["todas", "Todas"]].concat(ETAPAS.map(function (e) { return [e[0], e[1]]; }));
    var filtered = crm.etapa === "todas" ? leads : leads.filter(function (l) { return l.etapa === crm.etapa; });
    return '<div class="crm-chips">' + chips.map(function (c) {
      var n = c[0] === "todas" ? leads.length : leads.filter(function (l) { return l.etapa === c[0]; }).length;
      return '<button type="button" data-etapa-f="' + c[0] + '" class="' + (crm.etapa === c[0] ? "is-on" : "") + '">' + c[1] + " <b>" + n + "</b></button>";
    }).join("") + "</div>" +
      '<div class="crm-list">' + (filtered.map(function (l) { return card(l).replace("crm-card", "crm-card crm-card--row").replace(' draggable="true"', "").replace('<span class="crm-card__svc">', '<span class="crm-stage">' + esc(etapaName(l.etapa)) + '</span><span class="crm-card__svc">'); }).join("") || '<div class="empty">No hay clientes en esta etapa.</div>') + "</div>";
  }
  function newLead() {
    var l = { id: "L" + Date.now().toString(36) + rid(4), createdAt: now(), etapaDesde: now(), nombre: "", telefono: "", email: "", ciudad: "", servicio: "", etapa: "nuevo", abogadoId: isAdmin() ? "" : me().id, abogado: isAdmin() ? "" : me().nombre, valor: 0, etiquetas: ["Manual"], actividad: [], notas: [], docs: [], pagos: [], requisitos: [], archivos: [] };
    log(l, "creado", "Cliente creado manualmente.");
    crm.db.leads.unshift(l);
    openPanel(l.id, "resumen");
  }

  /* ==========================================================================
     Ficha del cliente (panel)
     ========================================================================== */
  var panel = { open: false, id: null, tab: "resumen" };
  var host = document.createElement("div");
  host.className = "crm-panel"; host.hidden = true;
  document.body.appendChild(host);
  function openPanel(id, tab) { panel.open = true; panel.id = id; panel.tab = tab || "resumen"; host.hidden = false; document.body.style.overflow = "hidden"; renderPanel(); }
  function closePanel() { panel.open = false; host.hidden = true; document.body.style.overflow = ""; refresh(); }

  function renderPanel() {
    var l = lead(panel.id);
    if (!l) return closePanel();
    var tabs = [["resumen", "Resumen"], ["docs", "Documentos"], ["req", "Requisitos y archivos"], ["pagos", "Pagos"], ["act", "Actividad"]];
    var tel = phoneOf(l);
    host.innerHTML =
      '<div class="crm-panel__bg" data-x></div><div class="crm-panel__box">' +
      '<header class="crm-ph"><button type="button" class="crm-x" data-x aria-label="Cerrar">←</button><div class="crm-ph__t"><b>' + esc(l.nombre || "Nuevo cliente") + "</b><span>" + esc(l.servicio || "Sin servicio") + "</span></div>" +
      '<select class="crm-stage-sel" id="p-etapa">' + ETAPAS.map(function (e) { return '<option value="' + e[0] + '"' + (l.etapa === e[0] ? " selected" : "") + ">" + e[1] + "</option>"; }).join("") + "</select></header>" +
      '<div class="crm-quick">' + (tel ? '<a class="crm-qb crm-qb--wa" href="https://wa.me/' + tel + '" target="_blank" rel="noopener">💬 WhatsApp</a><a class="crm-qb" href="tel:+' + tel + '">📞 Llamar</a>' : "") + (l.email ? '<a class="crm-qb" href="mailto:' + esc(l.email) + '">✉️ Correo</a>' : "") +
      '<button type="button" class="crm-qb" data-act="portal">🔗 Portal del cliente</button></div>' +
      '<nav class="crm-tabs">' + tabs.map(function (t) { return '<button type="button" data-tab="' + t[0] + '" class="' + (panel.tab === t[0] ? "is-on" : "") + '">' + t[1] + "</button>"; }).join("") + "</nav>" +
      '<div class="crm-pb" id="pb"></div></div>';
    $$("[data-x]", host).forEach(function (b) { b.addEventListener("click", closePanel); });
    $$("[data-tab]", host).forEach(function (b) { b.addEventListener("click", function () { panel.tab = b.getAttribute("data-tab"); renderPanel(); }); });
    $("#p-etapa", host).addEventListener("change", function (e) { l.etapa = e.target.value; l.etapaDesde = now(); log(l, "etapa", "Movido a «" + etapaName(l.etapa) + "»."); save(); renderPanel(); });
    $('[data-act="portal"]', host).addEventListener("click", function () { portalMenu(l); });
    TABS[panel.tab]($("#pb", host), l);
  }

  function portalMenu(l) {
    var url = portalUrl(l); save();
    sheet("Portal del cliente", '<p class="muted">Enlace privado donde el cliente ve su avance, firma documentos, sube sus documentos y ve cómo pagar.</p><div class="crm-link">' + esc(url) + '</div>' +
      '<div class="crm-grid2"><button type="button" class="btn btn--line" data-s="copy">Copiar enlace</button><button type="button" class="btn btn--wa" data-s="wa">Enviar por WhatsApp</button></div>' +
      '<button type="button" class="btn btn--line btn--block" data-s="open">Abrir como lo ve el cliente ↗</button>', function (box) {
        $('[data-s="copy"]', box).onclick = function () { navigator.clipboard.writeText(url); A.toast("Enlace copiado"); };
        $('[data-s="wa"]', box).onclick = function () { waOpen(l, "Hola " + firstName(l.nombre) + " 👋, le saluda el equipo de Ariango Consultores. Este es su portal privado, donde podrá ver el avance de su caso, firmar documentos y enviarnos sus documentos desde el celular:\n" + url); log(l, "envio", "Se envió el enlace del portal por WhatsApp."); save(); };
        $('[data-s="open"]', box).onclick = function () { window.open(url, "_blank", "noopener"); };
      });
  }

  /* ---------- Pestañas ---------- */
  var TABS = {};

  TABS.resumen = function (b, l) {
    initPersona(l);
    var svcs = plantillas().map(function (p) { return p.nombre; });
    if (l.servicio && svcs.indexOf(l.servicio) < 0) svcs.unshift(l.servicio);
    b.innerHTML =
      '<div class="crm-next"><span>Siguiente paso sugerido</span><b>' + esc(nextAction(l.etapa)) + "</b>" + nextButtons(l) + "</div>" +
      (l.mensaje || l.resultado_test ? '<div class="crm-msg"><span>Mensaje del cliente</span>' + (l.mensaje ? "<p>" + esc(l.mensaje) + "</p>" : "") + (l.resultado_test ? "<p><b>" + esc(l.resultado_test) + "</b></p>" : "") + "</div>" : "") +
      '<div class="crm-complete" id="p-complete"></div>' +
      '<div class="form crm-pform" id="f-lead">' + personaForm(l) +
      sec("⚖️ Servicio y gestión",
        '<div class="grid2"><div class="f"><label>Servicio</label><select data-p="servicio">' + ['<option value="">Seleccione…</option>'].concat(svcs.map(function (s) { return "<option" + (s === l.servicio ? " selected" : "") + ">" + esc(s) + "</option>"; })).join("") + "</select></div>" +
        '<div class="f"><label>Abogado a cargo</label><select name="abogadoId"' + (isAdmin() ? "" : " disabled") + '><option value="">— Sin asignar —</option>' + lawyers().map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === l.abogadoId ? " selected" : "") + ">" + esc(p.nombre) + "</option>"; }).join("") + "</select></div></div>" +
        '<div class="grid2">' + inp("valor", "Honorarios acordados (COP)", l.valor ? Number(l.valor).toLocaleString("es-CO") : "", "text", "money") + inp("etiquetas", "Etiquetas (separadas por coma)", (l.etiquetas || []).join(", ")) + "</div>") +
      "</div>" +
      '<div class="crm-origin"><span>Origen</span>' + esc([l.origen && l.origen.formulario ? "Formulario: " + l.origen.formulario : "", l.origen && l.origen.utm_source ? "Campaña: " + [l.origen.utm_source, l.origen.utm_medium, l.origen.utm_campaign].filter(Boolean).join(" / ") : "", "Creado: " + A.fmtDate(l.createdAt)].filter(Boolean).join(" · ")) + "</div>" +
      '<div class="crm-danger"><button type="button" class="btn btn--line btn--sm" data-act="lost">Marcar como perdido</button><button type="button" class="btn btn--danger btn--sm" data-act="del">Eliminar cliente</button></div>';
    var t;
    function later() { clearTimeout(t); t = setTimeout(function () { save(); }, 700); }
    bindPersona(b, l, later, function () {
      // Vuelve a dibujar sin perder las secciones abiertas ni la posición
      var open = $$("details", b).map(function (d) { return d.open; }), sc = b.closest(".crm-pb") || b.parentElement, top = sc ? sc.scrollTop : 0;
      TABS.resumen(b, l);
      $$("details", b).forEach(function (d, i) { if (i < open.length) d.open = open[i]; });
      if (sc) sc.scrollTop = top;
    });
    $$('#f-lead [name="valor"], #f-lead [name="etiquetas"], #f-lead [name="abogadoId"]', b).forEach(function (el) {
      el.addEventListener(el.tagName === "SELECT" ? "change" : "input", function () {
        if (el.getAttribute("data-money") !== null) { var n = el.value.replace(/\D/g, ""); el.value = n ? Number(n).toLocaleString("es-CO") : ""; l.valor = Number(n) || 0; }
        else if (el.name === "etiquetas") l.etiquetas = el.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
        else if (el.name === "abogadoId") { assignLead(l, el.value); return; }
        later();
      });
    });
    bindNext(b, l);
    $('[data-act="lost"]', b).addEventListener("click", function () {
      var why = prompt("Motivo (opcional): precio, no respondió, eligió otra firma…") || "";
      l.etapa = "perdido"; l.etapaDesde = now(); log(l, "etapa", "Marcado como perdido" + (why ? ": " + why : "") + "."); save(); renderPanel();
    });
    $('[data-act="del"]', b).addEventListener("click", function () {
      if (!confirm("¿Eliminar definitivamente a " + (l.nombre || "este cliente") + " y todo su expediente?")) return;
      crm.db.leads = crm.db.leads.filter(function (x) { return x !== l; }); save("Cliente eliminado"); closePanel();
    });
  };

  /* ---------- Formulario completo de datos del cliente ---------- */
  var BLOQUES = [["reg", "🇨🇴 Registro civil colombiano"], ["ven", "🇻🇪 Partida venezolana"], ["padres", "👪 Padres"], ["suc", "🕊 Sucesión (causante)"], ["menor", "🧒 Menor representado"]];
  function pv(l, path) { return path.split(".").reduce(function (o, k) { return o ? o[k] : undefined; }, l); }
  function pf(l, path, label, o) {
    o = o || {};
    var val = pv(l, path) || "", req = o.req ? ' <i class="req">*</i>' : "";
    var input = o.area ? '<textarea data-p="' + path + '" rows="' + (o.rows || 2) + '" placeholder="' + esc(o.ph || "") + '">' + esc(val) + "</textarea>"
      : '<input type="' + (o.type || "text") + '" data-p="' + path + '" value="' + esc(val) + '" placeholder="' + esc(o.ph || "") + '"' + (o.im ? ' inputmode="' + o.im + '"' : "") + (o.ac ? ' autocomplete="' + o.ac + '"' : "") + (o.list ? ' list="' + o.list + '"' : "") + ">";
    return '<div class="f" data-f="' + path + '"><label>' + label + req + "</label>" + input + (o.help ? "<small>" + o.help + "</small>" : "") + "</div>";
  }
  function docSelect(l, path, req) {
    var cur = pv(l, path) || "CC", grp = { CO: "🇨🇴 Colombia", VE: "🇻🇪 Venezuela", XX: "🌎 Otros países" };
    return '<div class="f" data-f="' + path + '"><label>Tipo de documento' + (req ? ' <i class="req">*</i>' : "") + '</label><select data-p="' + path + '">' + Object.keys(grp).map(function (g) {
      return '<optgroup label="' + grp[g] + '">' + PP.TIPOS_DOC.filter(function (t) { return t[2] === g; }).map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === cur ? " selected" : "") + ">" + esc(t[1]) + "</option>"; }).join("") + "</optgroup>";
    }).join("") + "</select></div>";
  }
  function seg(l, path, label, opts, req) {
    var cur = pv(l, path) || "";
    return '<div class="f" data-f="' + path + '"><label>' + label + (req ? ' <i class="req">*</i>' : "") + '</label><div class="crm-seg" data-seg="' + path + '">' + opts.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
      return '<button type="button" data-v="' + esc(v) + '" class="' + (v === cur ? "is-on" : "") + '">' + esc(t.charAt(0).toUpperCase() + t.slice(1)) + "</button>";
    }).join("") + "</div></div>";
  }
  function paisSelect(l, path, label) {
    var cur = pv(l, path) || "Colombia";
    var names = PP.PAISES.map(function (p) { return p[2].split(",")[0].replace("EE. UU.", "Estados Unidos"); });
    if (names.indexOf(cur) < 0) names.push(cur);
    return '<div class="f" data-f="' + path + '"><label>' + label + '</label><select data-p="' + path + '">' + names.map(function (n) { return "<option" + (n === cur ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("") + "<option>Otro</option></select></div>";
  }
  function phoneField(l, label) {
    return '<div class="f" data-f="telefono"><label>' + label + ' <i class="req">*</i></label><div class="crm-phone"><select data-p="indicativo" aria-label="Indicativo del país">' +
      PP.PAISES.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === l.indicativo ? " selected" : "") + ">" + p[1] + " +" + p[0] + "</option>"; }).join("") +
      '</select><input type="tel" inputmode="tel" data-p="telefono" value="' + esc(l.telefono || "") + '" placeholder="' + (l.indicativo === "58" ? "414 123 4567" : "315 000 0000") + '"></div>' +
      '<small class="crm-wa" id="p-wa"></small></div>';
  }
  function personaForm(l) {
    var ec = PP.ESTADOS_CIVILES.map(function (e) { return [e, PP.estadoCivil({ genero: l.genero, estadoCivil: e })]; });
    var bl = l.bloques || [];
    function blk(id, title, html) { return bl.indexOf(id) > -1 ? '<div class="crm-blk"><div class="crm-blk__h"><b>' + title + '</b><button type="button" data-blkoff="' + id + '">Quitar</button></div>' + html + "</div>" : ""; }
    return '<datalist id="dl-deptos">' + ["Norte de Santander", "Santander", "Cesar", "Bogotá D. C.", "Antioquia", "Atlántico", "Bolívar", "Valle del Cauca", "Cundinamarca", "Arauca", "La Guajira", "Magdalena", "Táchira", "Zulia", "Mérida", "Apure", "Barinas", "Lara", "Carabobo", "Distrito Capital", "Miranda", "Trujillo"].map(function (d) { return "<option>" + d + "</option>"; }).join("") + "</datalist>" +
      sec("👤 Identificación",
        '<div class="grid2">' + pf(l, "nombres", "Nombres", { req: 1, ac: "given-name", ph: "Ej. María José" }) + pf(l, "apellidos", "Apellidos", { req: 1, ac: "family-name", ph: "Ej. Pérez Contreras" }) + "</div>" +
        '<div class="grid2">' + docSelect(l, "tipoDoc", 1) + pf(l, "cedula", "Número de documento", { req: 1, im: "numeric", help: '<span id="p-dochelp">' + docHelp(l.tipoDoc) + "</span>" }) + "</div>" +
        '<div class="grid2">' + pf(l, "expedida", "Lugar de expedición", { req: 1, ph: "Ej. Cúcuta, Norte de Santander" }) + pf(l, "fechaExp", "Fecha de expedición", { type: "date" }) + "</div>" +
        seg(l, "genero", "Género", PP.GENEROS, 1) +
        seg(l, "nacionalidad", "Nacionalidad", PP.NACIONALIDADES)) +
      sec("📞 Contacto y residencia",
        '<div class="grid2">' + phoneField(l, "WhatsApp / celular") + pf(l, "telefono2", "Teléfono alterno (opcional)", { type: "tel", im: "tel" }) + "</div>" +
        pf(l, "email", "Correo electrónico", { req: 1, type: "email", ac: "email", ph: "nombre@correo.com", help: "Se usa para notificaciones judiciales y para el poder por mensaje de datos (Ley 2213 de 2022)." }) +
        pf(l, "direccion", "Dirección de residencia", { req: 1, ac: "street-address", ph: "Ej. Calle 10 # 4-25, apto 301" }) +
        '<div class="grid2">' + pf(l, "barrio", "Barrio / sector") + pf(l, "ciudad", "Ciudad o municipio", { req: 1, ph: "Cúcuta" }) + "</div>" +
        '<div class="grid2">' + pf(l, "depto", "Departamento / estado", { list: "dl-deptos", ph: "Norte de Santander" }) + paisSelect(l, "pais", "País de residencia") + "</div>") +
      sec("🎂 Nacimiento y datos civiles",
        '<div class="grid2">' + pf(l, "fechaNac", "Fecha de nacimiento", { req: 1, type: "date", help: '<span id="p-age"></span>' }) + pf(l, "lugarNac", "Lugar de nacimiento (ciudad o municipio)", { req: 1, ph: "Ej. San Cristóbal" }) + "</div>" +
        '<div class="grid2">' + pf(l, "deptoNac", "Departamento / estado de nacimiento", { list: "dl-deptos", ph: "Ej. Táchira" }) + paisSelect(l, "paisNac", "País de nacimiento") + "</div>" +
        '<div class="grid2"><div class="f" data-f="estadoCivil"><label>Estado civil</label><select data-p="estadoCivil"><option value="">Seleccione…</option>' + ec.map(function (e) { return '<option value="' + e[0] + '"' + (e[0] === l.estadoCivil ? " selected" : "") + ">" + esc(e[1].charAt(0).toUpperCase() + e[1].slice(1)) + "</option>"; }).join("") + "</select></div>" +
        pf(l, "ocupacion", "Profesión u oficio") + "</div>", false) +
      sec("📁 Datos del caso",
        '<p class="muted">Active los datos que necesita este caso. Se usan para llenar el poder y los demás documentos.</p>' +
        '<div class="crm-blkchips">' + BLOQUES.map(function (x) { return '<button type="button" data-blk="' + x[0] + '" class="' + (bl.indexOf(x[0]) > -1 ? "is-on" : "") + '">' + x[1] + "</button>"; }).join("") + "</div>" +
        blk("reg", "🇨🇴 Registro civil de nacimiento colombiano",
          '<div class="grid2">' + pf(l, "reg.nuip", "NUIP") + pf(l, "reg.serial", "Indicativo serial") + "</div>" +
          '<div class="grid2">' + pf(l, "reg.oficina", "Oficina de registro", { ph: "Registraduría / Notaría 2.ª de Cúcuta" }) + pf(l, "reg.fechaInsc", "Fecha de inscripción", { type: "date" }) + "</div>" +
          pf(l, "reg.lugarInscrito", "Lugar de nacimiento que aparece en el registro", { ph: "Ej. Cúcuta, Norte de Santander" })) +
        blk("ven", "🇻🇪 Partida (acta) de nacimiento venezolana",
          '<div class="grid2">' + pf(l, "ven.acta", "Número de acta") + pf(l, "ven.anio", "Año", { im: "numeric" }) + "</div>" +
          '<div class="grid2">' + pf(l, "ven.folio", "Folio") + pf(l, "ven.tomo", "Tomo") + "</div>" +
          pf(l, "ven.oficina", "Oficina o Unidad de Registro Civil", { ph: "Ej. Registro Civil de la parroquia La Concordia" }) +
          '<div class="grid2">' + pf(l, "ven.municipio", "Municipio") + pf(l, "ven.estado", "Estado", { list: "dl-deptos", ph: "Táchira" }) + "</div>") +
        blk("padres", "👪 Datos de los padres",
          '<div class="grid2">' + pf(l, "padres.madre", "Nombre completo de la madre") + pf(l, "padres.madreDoc", "Documento de la madre") + "</div>" +
          '<div class="grid2">' + pf(l, "padres.padre", "Nombre completo del padre") + pf(l, "padres.padreDoc", "Documento del padre") + "</div>") +
        blk("suc", "🕊 Sucesión: datos del causante (persona fallecida)",
          '<div class="grid2">' + pf(l, "suc.causante", "Nombre completo del causante") + pf(l, "suc.causanteDoc", "Documento del causante") + "</div>" +
          '<div class="grid2">' + pf(l, "suc.fechaFall", "Fecha de fallecimiento", { type: "date" }) + pf(l, "suc.lugarFall", "Lugar de fallecimiento") + "</div>" +
          '<div class="grid2">' + pf(l, "suc.domicilio", "Último domicilio del causante", { help: "Define la notaría o el juez competente." }) + pf(l, "suc.estadoCivil", "Estado civil del causante al morir", { ph: "Casado(a), viudo(a)…" }) + "</div>" +
          '<div class="f" data-f="suc.calidad"><label>El cliente actúa como</label><select data-p="suc.calidad"><option value="">Seleccione…</option>' + DEF.calidades.map(function (c) { return "<option" + (c === (l.suc || {}).calidad ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select></div>" +
          '<div class="grid2">' + pf(l, "suc.herederos", "Número de herederos", { im: "numeric" }) + seg(l, "suc.testamento", "¿Dejó testamento?", ["sí", "no", "no sabe"]) + "</div>" +
          pf(l, "suc.bienes", "Bienes y deudas conocidos", { area: 1, ph: "Casa en Cúcuta (matrícula …), vehículo, cuentas, deudas…" })) +
        blk("menor", "🧒 Menor de edad representado por el cliente",
          '<div class="grid2">' + pf(l, "menor.nombre", "Nombre completo del menor") + pf(l, "menor.parentesco", "El cliente es su", { ph: "Madre, padre, tutor(a)" }) + "</div>" +
          '<div class="grid2">' + docSelect(l, "menor.tipoDoc") + pf(l, "menor.doc", "Número de documento del menor") + "</div>" +
          '<div class="grid2">' + pf(l, "menor.fechaNac", "Fecha de nacimiento del menor", { type: "date" }) + pf(l, "menor.lugarNac", "Lugar de nacimiento del menor") + "</div>"), false) +
      sec("🔒 Autorización de datos personales",
        '<label class="check"><input type="checkbox" data-p="datos1581.si"' + ((l.datos1581 || {}).si ? " checked" : "") + '><span>El cliente autorizó el tratamiento de sus datos personales (Ley 1581 de 2012)' +
        ((l.datos1581 || {}).si ? "<small>Autorizado el " + esc((l.datos1581 || {}).fecha || "") + ((l.datos1581 || {}).via ? " · " + esc(l.datos1581.via) : "") + "</small>" : "<small>Puede generar la autorización desde Documentos → Otro documento.</small>") + "</span></label>", false);
  }
  function docHelp(code) {
    return { CC: "Sin puntos ni espacios.", TI: "Para menores entre 7 y 17 años.", RC: "Para menores de 7 años: use el NUIP del registro civil.", CIV: "Solo el número, sin la V.", CIE: "Solo el número, sin la E.", PPT: "Número del Permiso por Protección Temporal.", PNV: "Use el número del acta." }[code || "CC"] || "";
  }
  /** Lista de datos obligatorios que faltan. */
  function faltantes(l) {
    var req = [["nombres", "Nombres"], ["apellidos", "Apellidos"], ["cedula", "Número de documento"], ["expedida", "Lugar de expedición"], ["genero", "Género"], ["telefono", "WhatsApp"], ["email", "Correo"], ["direccion", "Dirección"], ["ciudad", "Ciudad"], ["fechaNac", "Fecha de nacimiento"], ["lugarNac", "Lugar de nacimiento"]];
    var bl = l.bloques || [];
    if (bl.indexOf("reg") > -1) req.push(["reg.nuip", "NUIP o serial del registro"]);
    if (bl.indexOf("ven") > -1) req.push(["ven.acta", "Número de acta venezolana"]);
    if (bl.indexOf("suc") > -1) req.push(["suc.causante", "Nombre del causante"], ["suc.fechaFall", "Fecha de fallecimiento"]);
    if (bl.indexOf("menor") > -1) req.push(["menor.nombre", "Nombre del menor"]);
    return { total: req.length, falta: req.filter(function (r) { return r[0] === "reg.nuip" ? !pv(l, "reg.nuip") && !pv(l, "reg.serial") : !String(pv(l, r[0]) || "").trim(); }) };
  }
  function bindPersona(b, l, later, redraw) {
    function status() {
      var f = faltantes(l), ok = f.total - f.falta.length, pct = Math.round(ok / f.total * 100);
      $("#p-complete", b).innerHTML = '<div class="crm-complete__h"><b>' + (pct === 100 ? "✅ Datos completos" : "Datos del cliente: " + pct + "%") + "</b><span>" + ok + " de " + f.total + "</span></div>" +
        '<div class="crm-complete__bar"><i style="width:' + pct + '%"></i></div>' +
        (f.falta.length ? '<div class="crm-complete__miss"><span>Faltan:</span>' + f.falta.map(function (x) { return '<button type="button" data-goto="' + x[0] + '">' + esc(x[1]) + "</button>"; }).join("") + "</div>" : "");
      $$("[data-goto]", b).forEach(function (g) {
        g.onclick = function () {
          var fld = $('[data-f="' + g.getAttribute("data-goto") + '"]', b) || $('[data-f="' + g.getAttribute("data-goto").split(".")[0] + '"]', b);
          if (!fld) return;
          var d = fld.closest("details"); if (d) d.open = true;
          fld.scrollIntoView({ behavior: "smooth", block: "center" });
          var x = $("input, select, textarea, button", fld); if (x) setTimeout(function () { x.focus({ preventScroll: true }); }, 300);
        };
      });
      var age = PP.edad(l.fechaNac), ag = $("#p-age", b);
      if (ag) ag.innerHTML = age == null ? "" : age < 18 ? '<b class="crm-warn">⚠️ ' + age + " años: es menor de edad. Debe actuar por medio de su representante legal.</b>" : age + " años";
      var wa = $("#p-wa", b);
      if (wa) wa.innerHTML = l.telefono ? 'WhatsApp: <a href="https://wa.me/' + phoneOf(l) + '" target="_blank" rel="noopener">' + esc(PP.phoneText(l.indicativo, l.telefono)) + "</a>" : "";
      $(".crm-ph__t b", host).textContent = l.nombre || "Nuevo cliente";
    }
    function setv(path, val) {
      var p = path.split("."), o = l;
      for (var i = 0; i < p.length - 1; i++) { o[p[i]] = o[p[i]] || {}; o = o[p[i]]; }
      o[p[p.length - 1]] = val;
      if (path === "nombres" || path === "apellidos") l.nombre = [l.nombres, l.apellidos].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      if (path === "datos1581.si") l.datos1581.fecha = val ? today() : "";
      if (path === "suc.causante" || path === "suc.fechaFall") { /* se usan al crear el poder */ }
    }
    $$("[data-p]", b).forEach(function (el) {
      var path = el.getAttribute("data-p");
      el.addEventListener(el.tagName === "SELECT" || el.type === "checkbox" || el.type === "date" ? "change" : "input", function () {
        var val = el.type === "checkbox" ? el.checked : el.value;
        if (el.type !== "checkbox" && el.tagName !== "SELECT") {
          if (path === "nombres" || path === "apellidos" || path === "suc.causante" || path === "padres.madre" || path === "padres.padre" || path === "menor.nombre") {
            // Mayúscula inicial en cada nombre, sin cambiar lo que escribe a mitad de palabra
            var pos = el.selectionStart; val = val.replace(/(^|\s)([a-záéíóúñ])/g, function (m, a, c) { return a + c.toUpperCase(); }); if (val !== el.value) { el.value = val; el.setSelectionRange(pos, pos); }
          }
          if (path === "cedula" && /^(CC|TI|CE|CIV|CIE|RC)$/.test(l.tipoDoc || "CC")) { val = val.replace(/[^\d]/g, ""); if (val !== el.value) el.value = val; }
          if (path === "telefono") { val = val.replace(/[^\d ]/g, ""); if (val !== el.value) el.value = val; }
        }
        if (path === "email") { el.classList.toggle("is-bad", !!val && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val.trim())); }
        setv(path, typeof val === "string" ? val.replace(/^\s+/, "") : val);
        if (path === "tipoDoc") { var h = $("#p-dochelp", b); if (h) h.textContent = docHelp(val); }
        if (path === "genero" || path === "servicio") { later(); return redraw(); }
        status(); later();
      });
    });
    $$("[data-seg]", b).forEach(function (g) {
      g.addEventListener("click", function (e) {
        var bt = e.target.closest("button"); if (!bt) return;
        var path = g.getAttribute("data-seg"), v = bt.getAttribute("data-v"), cur = pv(l, path);
        setv(path, cur === v ? "" : v);
        $$("button", g).forEach(function (x) { x.classList.toggle("is-on", x === bt && cur !== v); });
        if (path === "genero") { later(); return redraw(); }
        status(); later();
      });
    });
    $$("[data-blk]", b).forEach(function (bt) {
      bt.onclick = function () {
        var id = bt.getAttribute("data-blk"); l.bloques = l.bloques || [];
        var i = l.bloques.indexOf(id); if (i > -1) l.bloques.splice(i, 1); else l.bloques.push(id);
        later(); redraw();
        var d = $$("details", b).find(function (x) { return /Datos del caso/.test(x.textContent.slice(0, 40)); }); if (d) d.open = true;
      };
    });
    $$("[data-blkoff]", b).forEach(function (bt) { bt.onclick = function () { l.bloques = (l.bloques || []).filter(function (x) { return x !== bt.getAttribute("data-blkoff"); }); later(); redraw(); }; });
    status();
  }
  function inp(name, label, val, type, kind) {
    return '<div class="f"><label>' + label + '</label><input type="' + (type || "text") + '" name="' + name + '" value="' + esc(val || "") + '"' + (kind === "money" ? ' data-money inputmode="numeric"' : "") + "></div>";
  }
  function nextButtons(l) {
    var map = {
      nuevo: '<button type="button" class="btn btn--wa btn--sm" data-next="saludo">💬 Saludar por WhatsApp</button>',
      contactado: '<button type="button" class="btn btn--gold btn--sm" data-next="propuesta">📄 Crear propuesta</button>',
      propuesta: '<button type="button" class="btn btn--wa btn--sm" data-next="seguimiento">💬 Hacer seguimiento</button>',
      aceptada: '<button type="button" class="btn btn--wa btn--sm" data-next="cobro">💳 Solicitar pago inicial</button><button type="button" class="btn btn--line btn--sm" data-next="pago">Registrar pago</button>',
      anticipo: '<button type="button" class="btn btn--gold btn--sm" data-next="contrato">📑 Crear contrato</button>',
      contrato: '<button type="button" class="btn btn--wa btn--sm" data-next="docs">📎 Solicitar documentos</button><button type="button" class="btn btn--line btn--sm" data-next="poder">Crear poder</button>',
      documentos: '<button type="button" class="btn btn--line btn--sm" data-next="acta">Acta de recepción</button><button type="button" class="btn btn--gold btn--sm" data-next="tramite">Pasar a «En trámite»</button>',
      tramite: '<button type="button" class="btn btn--wa btn--sm" data-next="avance">💬 Informar avance</button><button type="button" class="btn btn--line btn--sm" data-next="fin">Finalizar caso</button>',
      finalizado: '<button type="button" class="btn btn--wa btn--sm" data-next="testimonio">⭐ Pedir testimonio</button>'
    };
    return '<div class="crm-next__btns">' + (map[l.etapa] || "") + "</div>";
  }
  function bindNext(b, l) {
    $$("[data-next]", b).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var k = btn.getAttribute("data-next"), n = firstName(l.nombre), ab = lawyerName(l) || "el equipo";
        var url = portalUrl(l);
        if (k === "saludo") { waOpen(l, "Hola " + n + " 👋, le saluda " + ab + " de Ariango Consultores. Recibimos su solicitud sobre *" + (l.servicio || "su caso") + "*. ¿Tiene unos minutos para contarme su situación y orientarle sobre la mejor solución?"); advance(l, "contactado", "primer contacto"); save(); renderPanel(); }
        if (k === "propuesta") editDoc(l, newDoc(l, "propuesta"));
        if (k === "seguimiento") { waOpen(l, "Hola " + n + ", ¿pudo revisar la propuesta que le enviamos? Con gusto le resuelvo cualquier duda. Puede aceptarla y firmarla desde su celular aquí: " + url); log(l, "envio", "Seguimiento de propuesta por WhatsApp."); save(); }
        if (k === "cobro") { var pr = lastDoc(l, "propuesta"), r = pr ? D.planRows(pr.data)[0] : null; waOpen(l, "Hola " + n + ", ¡gracias por confiar en nosotros! 🙌 Para iniciar su caso, el pago inicial es de *" + (r ? money(r.valor) : "lo acordado") + "*. En su portal encuentra las cuentas autorizadas: " + url + "\nApenas nos envíe el comprobante, le emitimos su recibo y le compartimos el contrato para firmar."); log(l, "envio", "Solicitud de pago inicial por WhatsApp."); save(); }
        if (k === "pago") { panel.tab = "pagos"; renderPanel(); setTimeout(function () { registerPayment(l); }, 50); }
        if (k === "contrato") editDoc(l, newDoc(l, "contrato"));
        if (k === "poder") editDoc(l, newDoc(l, "poder"));
        if (k === "acta") editDoc(l, newDoc(l, "acta"));
        if (k === "docs") { var pend = (l.requisitos || []).filter(function (r) { return r.estado === "pendiente" || !r.estado; }); waOpen(l, "Hola " + n + ", para avanzar con su trámite necesitamos estos documentos:\n" + (pend.map(function (r) { return "• " + r.t; }).join("\n") || "• Los indicados en su portal") + "\n\nPuede enviarlos con una foto desde su celular aquí: " + url); log(l, "envio", "Solicitud de documentos por WhatsApp."); save(); }
        if (k === "tramite") { l.etapa = "tramite"; l.etapaDesde = now(); log(l, "etapa", "Pasó a «En trámite»."); save(); renderPanel(); }
        if (k === "avance") { var txt = prompt("Avance para informar al cliente:"); if (!txt) return; waOpen(l, "Hola " + n + ", le informamos el avance de su caso: " + txt + "\nPuede ver su expediente aquí: " + url); log(l, "avance", "Avance informado: " + txt); save(); renderPanel(); }
        if (k === "fin") { l.etapa = "finalizado"; l.etapaDesde = now(); log(l, "etapa", "Caso finalizado."); save(); renderPanel(); }
        if (k === "testimonio") { waOpen(l, "Hola " + n + ", fue un gusto acompañarle en su caso. 🙏 ¿Nos regalaría unas palabras sobre su experiencia con Ariango Consultores? Con su autorización, nos ayudaría a que más familias encuentren solución."); log(l, "envio", "Solicitud de testimonio."); save(); }
      });
    });
  }
  function lastDoc(l, tipo) { return (l.docs || []).filter(function (d) { return d.tipo === tipo; })[0]; }

  /* ---------- Documentos ---------- */
  var ESTADO = { borrador: ["Borrador", ""], enviado: ["Enviado", "warn"], visto: ["Visto por el cliente", "info"], firmado: ["✓ Firmado", "ok"] };
  TABS.docs = function (b, l) {
    var docs = l.docs || [];
    b.innerHTML =
      '<div class="crm-newdocs">' + [["propuesta", "📄", "Propuesta"], ["contrato", "📑", "Contrato"], ["poder", "🖋", "Poder"], ["acta", "🗂", "Acta de recepción"], ["libre", "📝", "Otro documento"]].map(function (x) {
        return '<button type="button" data-new="' + x[0] + '"><span>' + x[1] + "</span>" + x[2] + "</button>";
      }).join("") + "</div>" +
      (docs.length ? '<div class="crm-docs">' + docs.map(function (d, i) {
        var st = d.tipo === "recibo" ? ["Recibo", "ok"] : ESTADO[d.estado] || ["", ""];
        return '<div class="crm-doc"><span class="crm-doc__ic">' + esc(D.PREFIJO[d.tipo]) + '</span><div class="crm-doc__m"><b>' + esc(d.tipo === "libre" ? d.data.titulo : D.TIPOS[d.tipo]) + "</b><small>" + esc(d.numero) + " · " + A.fmtDate(d.creado) + (d.tipo === "propuesta" || d.tipo === "contrato" ? " · " + money(D.totals(d.data).total) : d.tipo === "recibo" ? " · " + money(d.data.valor) : "") + "</small></div>" +
          '<span class="tag ' + (st[1] ? "tag--" + st[1] : "") + '">' + st[0] + "</span>" +
          '<div class="crm-doc__a">' + (!d.firma ? '<button type="button" class="icon" data-d="edit" data-i="' + i + '" title="Editar">✏️</button>' : "") +
          '<button type="button" class="icon" data-d="pdf" data-i="' + i + '" title="Descargar PDF">⬇</button>' +
          '<button type="button" class="icon" data-d="view" data-i="' + i + '" title="Ver como el cliente">👁</button>' +
          '<button type="button" class="btn btn--wa btn--sm" data-d="send" data-i="' + i + '">Enviar</button>' +
          '<button type="button" class="icon" data-d="more" data-i="' + i + '" title="Más">⋯</button></div></div>';
      }).join("") + "</div>" : '<div class="empty">Aún no hay documentos. Empiece con una propuesta.</div>');
    $$("[data-new]", b).forEach(function (x) { x.addEventListener("click", function () { editDoc(l, newDoc(l, x.getAttribute("data-new"))); }); });
    $$("[data-d]", b).forEach(function (x) {
      x.addEventListener("click", function () {
        var d = docs[+x.getAttribute("data-i")], a = x.getAttribute("data-d");
        if (a === "edit") editDoc(l, d);
        if (a === "pdf") downloadPdf(l, d);
        if (a === "view") { if (d.estado === "borrador") { A.toast("Es un borrador: envíelo o márquelo como listo para que el cliente lo vea.", true); return; } window.open(portalUrl(l, d.id), "_blank", "noopener"); save(); }
        if (a === "send") sendDoc(l, d);
        if (a === "more") docMenu(l, d);
      });
    });
  };
  function docMenu(l, d) {
    sheet(d.numero, '<div class="crm-menu">' +
      '<button type="button" data-m="copy">🔗 Copiar enlace para el cliente</button>' +
      '<button type="button" data-m="mail">✉️ Enviar por correo</button>' +
      '<button type="button" data-m="dup">📄 Duplicar</button>' +
      (d.firma ? "" : '<button type="button" data-m="del" class="is-danger">🗑 Eliminar</button>') + "</div>", function (box) {
        $('[data-m="copy"]', box).onclick = function () { markSent(l, d, "enlace"); navigator.clipboard.writeText(portalUrl(l, d.id)); save(); A.toast("Enlace copiado"); closeSheet(); };
        $('[data-m="mail"]', box).onclick = function () { markSent(l, d, "correo"); save(); location.href = "mailto:" + (l.email || "") + "?subject=" + encodeURIComponent((D.TIPOS[d.tipo] || "Documento") + " " + d.numero + " — Ariango Consultores") + "&body=" + encodeURIComponent(sendText(l, d)); closeSheet(); };
        $('[data-m="dup"]', box).onclick = function () { var c = JSON.parse(JSON.stringify(d)); c.id = "D" + rid(10); c.numero = nextNumber(d.tipo); c.estado = "borrador"; c.creado = now(); delete c.firma; delete c.vistoEn; l.docs.unshift(c); save("Duplicado"); closeSheet(); renderPanel(); };
        var del = $('[data-m="del"]', box); if (del) del.onclick = function () { if (!confirm("¿Eliminar " + d.numero + "?")) return; l.docs = l.docs.filter(function (x) { return x !== d; }); save("Eliminado"); closeSheet(); renderPanel(); };
      });
  }
  function sendText(l, d) {
    var n = firstName(l.nombre), url = portalUrl(l, d.id), ab = (d.data.abogado && d.data.abogado.nombre) || l.abogado || "el equipo";
    if (d.tipo === "propuesta") return "Hola " + n + " 👋, le saluda " + ab + " de Ariango Consultores.\n\nPreparamos su *propuesta de servicios* para " + (d.data.servicio || "su caso") + ". Allí encontrará lo que haremos por usted, los documentos necesarios, la inversión y las opciones de pago.\n\nPuede revisarla, descargarla en PDF y *aceptarla con su firma desde el celular* aquí:\n" + url;
    if (d.tipo === "contrato") return "Hola " + n + ", le compartimos su *contrato de prestación de servicios*. Puede leerlo y *firmarlo desde el celular* en menos de un minuto:\n" + url;
    if (d.tipo === "recibo") return "Hola " + n + ", confirmamos su pago de *" + money(d.data.valor) + "*. ✅ Este es su recibo:\n" + url + "\n\n¡Gracias por su confianza!";
    return "Hola " + n + ", le compartimos el documento *" + (d.tipo === "libre" ? d.data.titulo : D.TIPOS[d.tipo]) + "* para su revisión y firma desde el celular:\n" + url;
  }
  function markSent(l, d, via) {
    if (d.estado === "borrador") d.estado = "enviado";
    d.enviadoEn = d.enviadoEn || now();
    log(l, "envio", (D.TIPOS[d.tipo] || "Documento") + " " + d.numero + " enviado por " + via + ".");
    if (d.tipo === "propuesta") advance(l, "propuesta", "propuesta enviada");
  }
  function sendDoc(l, d) {
    markSent(l, d, "WhatsApp");
    waOpen(l, sendText(l, d));
    save(); renderPanel();
  }
  function downloadPdf(l, d) {
    var holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff";
    holder.innerHTML = D.render(d, ctxFor(l, d));
    document.body.appendChild(holder);
    A.toast("Generando PDF…");
    D.pdf(holder.firstChild, d.numero + " " + (l.nombre || "") + ".pdf").then(function () { holder.remove(); }, function () { holder.remove(); });
  }

  /* ---------- Nuevo documento ---------- */
  function defaultAccounts() { var c = cfg().cuentas; var pre = c.filter(function (x) { return x.predeterminada; }); return (pre.length ? pre : c).map(function (x) { return x.id; }); }
  function findTemplate(name) { return plantillas().find(function (p) { return p.nombre === name; }); }
  function planFrom(name) { return (DEF.planes[name] || DEF.planes["50 / 50"]).map(function (r) { return { pct: r[0], concepto: r[1], momento: r[2] }; }); }
  function newDoc(l, tipo) {
    var d = { id: "D" + rid(10), tipo: tipo, numero: "(se asigna al guardar)", creado: now(), estado: "borrador", data: { fecha: today(), abogado: lawyerData(l.abogadoId), cuentas: defaultAccounts() } };
    var cli = personaOf(l);
    var prop = lastDoc(l, "propuesta");
    if (tipo === "propuesta") applyTemplate(d.data, findTemplate(l.servicio) || plantillas()[0], l);
    if (tipo === "contrato") {
      var src = prop ? prop.data : {};
      Object.assign(d.data, { cliente: cli, servicio: src.servicio || l.servicio, alcance: (src.alcance || []).slice(), honorarios: src.honorarios || l.valor || 0, iva: !!src.iva, plan: JSON.parse(JSON.stringify(src.plan || planFrom("50 / 50"))), gastos: (src.gastos || DEF.gastos.slice(0, 4)).slice(), tiempo: src.tiempo || "", cuentas: src.cuentas || defaultAccounts(), clausulas: JSON.parse(JSON.stringify(cfg().clausulas || DEF.clausulas)), ciudadFirma: cfg().firma.ciudad || "Cúcuta", propuestaRef: prop ? prop.numero : "" });
      if (!d.data.alcance.length) { var tp = findTemplate(l.servicio); if (tp) d.data.alcance = tp.alcance.slice(); }
    }
    if (tipo === "poder") {
      var tp0 = DEF.tiposPoder.find(function (t) { return /venezuela/i.test(l.servicio || "") ? t.id === "ven" : /suces/i.test(l.servicio || "") ? t.id === "suc-not" : t.id === "reg-admin"; }) || DEF.tiposPoder[0];
      var ab0 = lawyerData(l.abogadoId), u0 = lawyerById(l.abogadoId) || {};
      Object.assign(d.data, { poderdantes: [Object.assign(personaOf(l), { calidad: (l.suc && l.suc.calidad) || (/suces/i.test(l.servicio || "") ? "hijo(a) y heredero(a) del causante" : "en nombre propio") })], emailApoderado: u0.email || cfg().firma.email || "", direccionApoderado: cfg().firma.direccion || "", ciudadFirma: cfg().firma.ciudad || "Cúcuta", asunto: {}, tratamiento: "Señor(a)" });
      applyPoderType(d.data, tp0);
      d.data.asunto = asuntoDe(l);
      d.data.abogado = ab0;
    }
    if (tipo === "acta") Object.assign(d.data, { servicio: l.servicio, requisitos: JSON.parse(JSON.stringify((l.requisitos || []).length ? l.requisitos : [])) });
    if (tipo === "libre") Object.assign(d.data, { titulo: DEF.libres[0][0], cuerpo: fillLead(DEF.libres[0][1], l), firmaFirma: true });
    useTemplate(d);
    return d;
  }
  function fillLead(t, l) { return String(t).split("{CLIENTE}").join(l.nombre || "________").split("{CEDULA}").join(l.cedula || "________").split("{SERVICIO}").join((l.servicio || "________").toLowerCase()); }
  function applyTemplate(data, tp, l) {
    if (!tp) return;
    Object.assign(data, {
      plantilla: tp.nombre, servicio: tp.nombre, situacion: data.situacion || (l && l.mensaje) || "",
      alcance: tp.alcance.slice(), baseLegal: tp.baseLegal, normas: tp.normas.slice(),
      requisitos: tp.requisitos.map(function (r) { var ex = l && (l.requisitos || []).find(function (x) { return x.t === r; }); return { t: r, estado: ex ? ex.estado : "pendiente" }; }),
      tiempo: tp.tiempo || "", respuesta: tp.respuesta || "48 horas hábiles", honorarios: Number(tp.honorarios) || (l && Number(l.valor)) || 0, iva: !!cfg().firma.ivaResponsable,
      plan: planFrom(tp.plan), planNombre: tp.plan, gastos: DEF.gastos.slice(0, 5), vigencia: 15
    });
  }

  /* ==========================================================================
     Editor de documentos (con vista previa en vivo)
     ========================================================================== */
  var ed = document.createElement("div");
  ed.className = "crm-editor"; ed.hidden = true;
  document.body.appendChild(ed);
  var E = { l: null, d: null, isNew: false, t: null };

  function editDoc(l, d) {
    E.l = l; E.isNew = !(l.docs || []).some(function (x) { return x.id === d.id; });
    E.d = JSON.parse(JSON.stringify(d));
    ed.hidden = false; document.body.style.overflow = "hidden";
    ed.innerHTML =
      '<header class="crm-eh"><button type="button" class="crm-x" data-ex aria-label="Cerrar">✕</button><div><b>' + (E.isNew ? "Nuevo: " : "Editar: ") + esc(E.d.tipo === "libre" ? "Documento" : D.TIPOS[E.d.tipo]) + "</b><span>" + esc(l.nombre) + "</span></div>" +
      '<div class="crm-eh__tabs"><button type="button" data-et="form" class="is-on">Editar</button><button type="button" data-et="prev">Vista previa</button></div></header>' +
      '<div class="crm-eb"><div class="crm-ef"><div id="efnote"></div><div class="crm-ef__form" id="ef"></div><div class="crm-free" id="efree"></div></div>' +
      '<div class="crm-ep" id="ep">' + toolsHtml() + '<div class="crm-ep__fit" id="epfit"></div></div></div>' +
      '<footer class="crm-ef__foot"><span class="crm-total" id="etotal"></span>' +
      '<button type="button" class="btn btn--line" data-save="draft" data-norm>Guardar borrador</button><button type="button" class="btn btn--wa" data-save="send" data-norm>Guardar y enviar por WhatsApp</button>' +
      '<button type="button" class="btn btn--line" data-free="cancel">Cancelar</button>' + (isAdmin() ? '<button type="button" class="btn btn--line" data-free="tpl">⭐ Guardar como plantilla</button>' : "") + '<button type="button" class="btn btn--gold" data-free="ok">✓ Aplicar cambios</button></footer>';
    $("[data-ex]", ed).onclick = function () { if (confirm("¿Cerrar sin guardar los cambios?")) closeEditor(); };
    $$("[data-et]", ed).forEach(function (b) { b.onclick = function () { $$("[data-et]", ed).forEach(function (x) { x.classList.toggle("is-on", x === b); }); ed.classList.toggle("show-prev", b.getAttribute("data-et") === "prev"); fitPreview(); }; });
    $$("[data-save]", ed).forEach(function (b) { b.onclick = function () { commit(b.getAttribute("data-save") === "send"); }; });
    $('[data-free="ok"]', ed).onclick = function () { applyFree(); A.toast("Cambios aplicados al documento"); };
    $('[data-free="cancel"]', ed).onclick = function () { exitFree(); };
    if ($('[data-free="tpl"]', ed)) $('[data-free="tpl"]', ed).onclick = saveAsTemplate;
    bindTools();
    ed.addEventListener("click", function (e) {
      var b = e.target.closest("[data-fx]");
      if (!b) return;
      var a = b.getAttribute("data-fx");
      if (a === "edit") enterFree();
      if (a === "reset") resetZones();
    });
    FORMS[E.d.tipo]($("#ef", ed));
    drawNote();
    preview();
  }
  function closeEditor() { ed.hidden = true; ed.classList.remove("show-prev", "is-free"); E.free = false; document.body.style.overflow = panel.open ? "hidden" : ""; }
  function preview() {
    if (E.free) return;
    clearTimeout(E.t);
    E.t = setTimeout(function () {
      $("#epfit", ed).innerHTML = D.render(E.d, ctxFor(E.l, E.d));
      var tt = (E.d.tipo === "propuesta" || E.d.tipo === "contrato") ? D.totals(E.d.data).total : E.d.tipo === "recibo" ? E.d.data.valor : 0;
      $("#etotal", ed).textContent = tt ? "Total: " + money(tt) : "";
      fitPreview();
    }, 120);
  }
  function fitPreview() {
    var box = $("#ep", ed), fit = $("#epfit", ed), doc = fit && fit.firstChild;
    if (!doc || !box.clientWidth) return;
    var s = Math.min(1, (box.clientWidth - 24) / doc.offsetWidth);
    fit.style.transform = "scale(" + s + ")"; fit.style.width = doc.offsetWidth + "px"; fit.style.height = doc.offsetHeight * s + "px";
  }
  window.addEventListener("resize", function () { if (!ed.hidden) fitPreview(); });

  /* ---------- Edición libre sobre el documento (como en Word) ---------- */
  function tplKey(d) { return d.tipo === "poder" ? "poder:" + (d.data.tipoPoder || "") : d.tipo === "libre" ? "libre:" + (d.data.titulo || "") : d.tipo; }
  function tplName(d) {
    if (d.tipo === "poder") { var t = DEF.tiposPoder.find(function (x) { return x.id === d.data.tipoPoder; }); return "Poder especial · " + (t ? t.nombre : "Personalizado"); }
    if (d.tipo === "libre") return d.data.titulo || "Documento";
    return D.TIPOS[d.tipo] || "Documento";
  }
  function docTemplates() { var c = cfg(); c.docPlantillas = c.docPlantillas || {}; return c.docPlantillas; }
  function useTemplate(d) {
    var t = docTemplates()[tplKey(d)];
    if (t && t.zonas) { d.data.zonas = JSON.parse(JSON.stringify(t.zonas)); d.data.zonasDe = tplKey(d); }
    else { delete d.data.zonas; delete d.data.zonasDe; }
  }
  /** Al cambiar de modelo: si había texto ajustado a mano, pide confirmación. */
  function switchModel(d, fn) {
    var hand = d.data.zonas && d.data.zonasDe !== tplKey(d);
    if (hand && !confirm("Este documento tiene texto ajustado a mano. Al cambiar de modelo, ese texto se reemplaza. ¿Continuar?")) return false;
    fn(); useTemplate(d); drawNote(); return true;
  }
  function drawNote() {
    var n = $("#efnote", ed); if (!n) return;
    var z = E.d.data.zonas, tpl = docTemplates()[tplKey(E.d)];
    n.innerHTML = '<div class="crm-freecta' + (z ? " is-on" : "") + '">' +
      (z ? "<b>✍️ Texto ajustado " + (E.d.data.zonasDe === tplKey(E.d) ? "con la plantilla del bufete" : "a mano") + "</b><p>Los datos automáticos (cliente, cédula, fecha, número, abogado, valores…) se siguen actualizando solos. Para cambiar el resto del texto, edítelo sobre el documento.</p>"
        : "<b>¿Necesita cambiar el texto?</b><p>Escriba directamente sobre el documento, como en Word: encabezado, párrafos, cláusulas, firmas y pie de página.</p>") +
      '<div class="crm-freecta__a"><button type="button" class="btn btn--gold btn--sm" data-fx="edit">✍️ ' + (z ? "Seguir editando el texto" : "Editar sobre el documento") + "</button>" +
      (z ? '<button type="button" class="btn btn--line btn--sm" data-fx="reset">↩ Volver al texto automático</button>' : "") + "</div>" +
      (tpl && !z ? '<small class="muted">Hay una plantilla del bufete para este documento.</small>' : "") + "</div>";
  }
  function resetZones() {
    var tpl = docTemplates()[tplKey(E.d)];
    var msg = tpl && E.d.data.zonasDe !== tplKey(E.d) ? "¿Quitar los cambios hechos a mano y volver a la plantilla del bufete?" : "¿Quitar los cambios hechos a mano y volver al texto automático del modelo?";
    if (!confirm(msg)) return;
    if (tpl && E.d.data.zonasDe !== tplKey(E.d)) useTemplate(E.d); else { delete E.d.data.zonas; delete E.d.data.zonasDe; }
    if (E.free) exitFree(); else { drawNote(); preview(); }
  }
  var VAR_OPTS = function () {
    var v = D.vars(E.d, ctxFor(E.l, E.d));
    return Object.keys(v).filter(function (k) { return D.VARS[k] || /^(PODERDANTE|CEDULA)_\d+$/.test(k) || DEF.camposPoder[k]; }).map(function (k) {
      return [k, (D.VARS[k] || DEF.camposPoder[k] || k.replace(/_/g, " ").toLowerCase()), v[k]];
    });
  };
  function toolsHtml() {
    var B = [["undo", "↶", "Deshacer"], ["redo", "↷", "Rehacer"], ["|"], ["bold", "<b>B</b>", "Negrita"], ["italic", "<i>I</i>", "Cursiva"], ["underline", "<u>S</u>", "Subrayado"], ["|"],
      ["h", "Título", "Convertir en título"], ["p", "Párrafo", "Convertir en párrafo normal"], ["insertUnorderedList", "• Lista", "Lista con viñetas"], ["insertOrderedList", "1. Lista", "Lista numerada"], ["|"],
      ["justifyLeft", "⇤", "Alinear a la izquierda"], ["justifyCenter", "≡", "Centrar"], ["justifyFull", "☰", "Justificar"], ["|"],
      ["addp", "＋ Párrafo", "Agregar un párrafo debajo"], ["del", "🗑 Quitar", "Quitar el párrafo o línea donde está el cursor"], ["removeFormat", "⌫ Formato", "Quitar negrita, colores y estilos"]];
    return '<div class="crm-tools" id="etools">' + B.map(function (b) {
      return b[0] === "|" ? "<i></i>" : '<button type="button" data-cmd="' + b[0] + '" title="' + b[2] + '" aria-label="' + b[2] + '">' + b[1] + "</button>";
    }).join("") + '<select id="evar" title="Insertar un dato del cliente o del caso"><option value="">＋ Insertar dato…</option></select></div>';
  }
  var savedRange = null;
  function zoneOf(node) { var el = node && (node.nodeType === 1 ? node : node.parentElement); return el && el.closest(".acd-ed"); }
  function keepRange() {
    var sel = window.getSelection();
    if (sel.rangeCount && zoneOf(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
  }
  function restoreRange() {
    if (!savedRange) return false;
    var z = zoneOf(savedRange.startContainer); if (!z) return false;
    z.focus({ preventScroll: true });
    var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange);
    return true;
  }
  function curBlock() {
    var sel = window.getSelection(); if (!sel.rangeCount) return null;
    var el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    var z = zoneOf(el); if (!z || el === z) return null;
    var li = el.closest("li, tr, dt, dd"); if (li && z.contains(li)) return li;
    while (el.parentElement && el.parentElement !== z) el = el.parentElement;
    return el;
  }
  function fillVarSel() {
    $("#evar", ed).innerHTML = '<option value="">＋ Insertar dato…</option>' + VAR_OPTS().map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + (o[2] ? " — " + esc(String(o[2]).slice(0, 40)) : " (vacío)") + "</option>"; }).join("");
  }
  function bindTools() {
    document.addEventListener("selectionchange", function () { if (E.free) keepRange(); });
    $$("#etools [data-cmd]", ed).forEach(function (b) {
      b.addEventListener("mousedown", function (e) { e.preventDefault(); });
      b.addEventListener("click", function () {
        if (!restoreRange()) { A.toast("Primero toque el texto que quiere cambiar", true); return; }
        var c = b.getAttribute("data-cmd"), blk;
        if (c === "h") { document.execCommand("formatBlock", false, "h3"); blk = curBlock(); if (blk && blk.tagName === "H3") blk.className = "acd-h3"; }
        else if (c === "p") { document.execCommand("formatBlock", false, "p"); }
        else if (c === "addp") {
          blk = curBlock();
          var np = document.createElement(blk && blk.tagName === "LI" ? "li" : "p");
          np.textContent = "Escriba aquí el nuevo texto.";
          if (blk) blk.after(np); else zoneOf(savedRange.startContainer).appendChild(np);
          var r = document.createRange(); r.selectNodeContents(np); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        } else if (c === "del") {
          blk = curBlock();
          if (!blk) { A.toast("Toque dentro del párrafo que quiere quitar", true); return; }
          if (blk.querySelector(".acd-sigimg") && !confirm("Esto quita un bloque de firma. ¿Continuar?")) return;
          blk.remove(); savedRange = null;
        } else document.execCommand(c, false, null);
        keepRange();
      });
    });
    var sel = $("#evar", ed);
    sel.addEventListener("pointerdown", keepRange);
    sel.addEventListener("focus", fillVarSel);
    ["keyup", "mouseup", "input", "touchend"].forEach(function (ev) { $("#epfit", ed).addEventListener(ev, function () { if (E.free) keepRange(); }); });
    sel.addEventListener("change", function () {
      var k = sel.value; sel.value = ""; if (!k) return;
      if (!restoreRange()) { A.toast("Primero toque el lugar del documento donde va el dato", true); return; }
      var v = D.vars(E.d, ctxFor(E.l, E.d))[k];
      document.execCommand("insertText", false, v ? String(v) : "{" + k + "}");
      keepRange();
    });
  }
  function freeGuide() {
    return '<div class="crm-free__in"><h3>✍️ Edición sobre el documento</h3>' +
      '<ol class="crm-free__steps"><li><b>Toque cualquier texto</b> del documento y escriba, borre o corrija. Funciona en el encabezado, el cuerpo, las firmas y el pie de página.</li>' +
      "<li>Use la barra de arriba para <b>negrita</b>, títulos, listas, alinear, <b>＋ Párrafo</b> para agregar texto y <b>🗑 Quitar</b> para eliminar el párrafo donde está el cursor.</li>" +
      "<li>Con <b>＋ Insertar dato</b> se agrega el nombre, la cédula, la fecha, el número u otro dato del caso. Esos datos se actualizan solos.</li>" +
      "<li>Toque <b>✓ Aplicar cambios</b>. Luego guarde el documento.</li>" +
      (isAdmin() ? "<li><b>⭐ Guardar como plantilla</b>: los próximos documentos de este tipo empezarán con este mismo texto, ya ajustado por usted.</li>" : "") + "</ol>" +
      '<h4>Datos de este documento</h4><div class="crm-free__vars">' + VAR_OPTS().map(function (o) { return '<button type="button" data-ins="' + o[0] + '"><small>' + esc(o[1]) + "</small><b>" + esc(o[2] || "(vacío)") + "</b></button>"; }).join("") + "</div>" +
      '<p class="muted">Las firmas dibujadas y el certificado de firma electrónica se agregan solos; no se pueden borrar ni alterar.</p></div>';
  }
  function enterFree() {
    if (E.d.firma) { A.toast("Este documento ya fue firmado. Duplíquelo para hacer cambios.", true); return; }
    E.free = true; clearTimeout(E.t);
    ed.classList.add("is-free", "show-prev");
    var fit = $("#epfit", ed);
    fit.style.transform = ""; fit.style.width = ""; fit.style.height = "";
    fit.innerHTML = D.render(E.d, ctxFor(E.l, E.d));
    D.editable(fit.firstElementChild);
    $("#efree", ed).innerHTML = freeGuide();
    fillVarSel();
    $$("[data-ins]", ed).forEach(function (b) {
      b.addEventListener("mousedown", function (e) { e.preventDefault(); });
      b.onclick = function () {
        if (!restoreRange()) { A.toast("Primero toque el lugar del documento donde va el dato", true); return; }
        var v = D.vars(E.d, ctxFor(E.l, E.d))[b.getAttribute("data-ins")];
        document.execCommand("insertText", false, v ? String(v) : "{" + b.getAttribute("data-ins") + "}");
      };
    });
    savedRange = null;
  }
  function applyFree() {
    var art = $("#epfit", ed).firstElementChild;
    if (art) { E.d.data.zonas = D.readZones(art, E.d, ctxFor(E.l, E.d)); E.d.data.zonasDe = "mano"; }
    exitFree();
  }
  function exitFree() {
    E.free = false; savedRange = null;
    ed.classList.remove("is-free");
    if (window.innerWidth <= 900) ed.classList.remove("show-prev");
    $$("[data-et]", ed).forEach(function (x) { x.classList.toggle("is-on", x.getAttribute("data-et") === (ed.classList.contains("show-prev") ? "prev" : "form")); });
    $("#efree", ed).innerHTML = "";
    drawNote(); preview();
  }
  function saveAsTemplate() {
    var art = $("#epfit", ed).firstElementChild;
    if (!art) return;
    var z = D.readZones(art, E.d, ctxFor(E.l, E.d));
    var key = tplKey(E.d), name = tplName(E.d), exists = docTemplates()[key];
    var used = (JSON.stringify(z).match(/\{[A-Z][A-Z0-9_]*\}/g) || []).filter(function (x, i, a) { return a.indexOf(x) === i; });
    sheet("⭐ Guardar como plantilla del bufete",
      '<div class="form"><p>Los próximos documentos de <b>' + esc(name) + "</b> empezarán con este texto." + (exists ? " <b>Reemplaza la plantilla anterior.</b>" : "") + "</p>" +
      (used.length ? '<p class="muted">Estos datos se llenarán solos con la información de cada cliente:</p><div class="crm-free__chips">' + used.map(function (u) { var k = u.slice(1, -1); return "<span>" + esc(D.VARS[k] || DEF.camposPoder[k] || k) + "</span>"; }).join("") + "</div>" : "") +
      '<p class="muted">Revise que no queden nombres o números propios de este cliente escritos a mano. Si los hay, cámbielos con «＋ Insertar dato».</p></div>',
      function () {
        return function () {
          docTemplates()[key] = { nombre: name, tipo: E.d.tipo, zonas: z, at: now(), por: me().nombre || "Administrador" };
          E.d.data.zonas = JSON.parse(JSON.stringify(z)); E.d.data.zonasDe = key;
          save("Plantilla guardada"); exitFree();
        };
      }, "Guardar plantilla");
  }

  function commit(send) {
    if (E.free) applyFree();
    var l = E.l, d = E.d;
    if (d.tipo === "propuesta" || d.tipo === "contrato") {
      var sum = (d.data.plan || []).reduce(function (s, r) { return s + (Number(r.pct) || 0); }, 0);
      if ((d.data.plan || []).length && sum !== 100 && !confirm("Los porcentajes del plan de pagos suman " + sum + "%, no 100%. ¿Guardar de todos modos?")) return;
      if (!Number(d.data.honorarios) && !confirm("Los honorarios están en $0. ¿Guardar de todos modos?")) return;
    }
    if (/^\(/.test(d.numero)) d.numero = nextNumber(d.tipo);
    l.docs = l.docs || [];
    var i = l.docs.findIndex(function (x) { return x.id === d.id; });
    if (i > -1) l.docs[i] = d; else { l.docs.unshift(d); log(l, "doc", (D.TIPOS[d.tipo] || "Documento") + " " + d.numero + " creado."); }
    // Sincroniza datos útiles con la ficha del cliente
    if (d.tipo === "propuesta") {
      if (!Number(l.valor)) l.valor = D.totals(d.data).total;
      if (!l.servicio) l.servicio = d.data.servicio;
      l.requisitos = (d.data.requisitos || []).map(function (r) { var ex = (l.requisitos || []).find(function (x) { return x.t === r.t; }); return { t: r.t, estado: ex && ex.estado !== "pendiente" ? ex.estado : r.estado }; });
    }
    if (d.tipo === "poder" && d.data.poderdantes && d.data.poderdantes[0]) { var p0 = d.data.poderdantes[0]; ["nombre", "cedula", "expedida", "ciudad", "email"].forEach(function (k) { if (p0[k] && !l[k]) l[k] = p0[k]; }); }
    if (d.data.cliente) ["nombre", "cedula", "expedida", "direccion", "ciudad", "email"].forEach(function (k) { if (d.data.cliente[k] && !l[k]) l[k] = d.data.cliente[k]; });
    if (d.tipo === "contrato") l.valor = D.totals(d.data).total;
    if (send) { markSent(l, d, "WhatsApp"); waOpen(l, sendText(l, d)); }
    save(send ? "Guardado y enviado" : "Borrador guardado");
    closeEditor();
    if (E.from === "hub") { E.from = null; A.route(); return; }
    if (panel.open) { panel.tab = "docs"; renderPanel(); } else openPanel(l.id, "docs");
  }

  /* ---------- Controles reutilizables ---------- */
  function sec(title, inner, open) { return '<details class="crm-sec"' + (open === false ? "" : " open") + "><summary>" + title + '</summary><div class="crm-sec__b">' + inner + "</div></details>"; }
  function chips(name, options, value, multi) {
    return '<div class="crm-chipset" data-chips="' + name + '"' + (multi ? " data-multi" : "") + ">" + options.map(function (o) {
      var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o;
      var on = multi ? (value || []).indexOf(val) > -1 : String(value) === String(val);
      return '<button type="button" data-v="' + esc(val) + '" class="' + (on ? "is-on" : "") + '">' + esc(lab) + "</button>";
    }).join("") + "</div>";
  }
  function text(name, label, val, ph) { return '<div class="f"><label>' + label + '</label><input type="text" data-k="' + name + '" value="' + esc(val || "") + '" placeholder="' + esc(ph || "") + '"></div>'; }
  function area(name, label, val, rows, ph) { return '<div class="f"><label>' + label + '</label><textarea data-k="' + name + '" rows="' + (rows || 3) + '" placeholder="' + esc(ph || "") + '">' + esc(val || "") + "</textarea></div>"; }
  function moneyIn(name, label, val) { return '<div class="f"><label>' + label + '</label><div class="crm-money"><span>$</span><input type="text" inputmode="numeric" data-k="' + name + '" data-money value="' + (Number(val) ? Number(val).toLocaleString("es-CO") : "") + '" placeholder="0"></div></div>'; }
  function listEd(name, items, ph) {
    return '<div class="crm-list-ed" data-list="' + name + '">' + (items || []).map(function (t, i) {
      return '<div class="crm-li"><span>' + (i + 1) + '</span><input type="text" value="' + esc(t) + '" data-li="' + i + '"><button type="button" data-rm="' + i + '">✕</button></div>';
    }).join("") + '<button type="button" class="crm-add" data-addli>＋ ' + esc(ph || "Agregar") + "</button></div>";
  }
  function reqEd(items) {
    var L = { pendiente: "Pendiente", recibido: "✓ Recibido", revision: "En revisión", na: "No aplica" };
    return '<div class="crm-reqs" data-reqs><p class="muted">Toque cada documento para cambiar su estado.</p>' + (items || []).map(function (r, i) {
      return '<div class="crm-req is-' + (r.estado || "pendiente") + '"><button type="button" data-req="' + i + '"><span class="crm-req__s">' + L[r.estado || "pendiente"] + "</span>" + esc(r.t) + '</button><button type="button" class="crm-req__x" data-reqrm="' + i + '">✕</button></div>';
    }).join("") + '<div class="crm-req-add"><input type="text" placeholder="Agregar otro documento…" data-reqnew><button type="button" class="btn btn--line btn--sm" data-reqadd>Agregar</button></div></div>';
  }
  function planEd(plan) {
    var sum = (plan || []).reduce(function (s, r) { return s + (Number(r.pct) || 0); }, 0);
    var t = D.totals(E.d.data).total;
    return '<div class="crm-plan" data-plan>' + chips("planNombre", Object.keys(DEF.planes), E.d.data.planNombre) +
      (plan || []).map(function (r, i) {
        return '<div class="crm-plan__row"><input type="text" value="' + esc(r.concepto) + '" data-pl="concepto" data-i="' + i + '" placeholder="Concepto">' +
          '<div class="crm-pct"><input type="number" min="0" max="100" value="' + esc(r.pct) + '" data-pl="pct" data-i="' + i + '"><span>%</span></div>' +
          '<select data-pl="momento" data-i="' + i + '">' + DEF.momentos.concat(DEF.momentos.indexOf(r.momento) < 0 && r.momento ? [r.momento] : []).map(function (m) { return "<option" + (m === r.momento ? " selected" : "") + ">" + esc(m) + "</option>"; }).join("") + "</select>" +
          '<b class="crm-plan__v">' + money(t * (Number(r.pct) || 0) / 100) + '</b><button type="button" data-plrm="' + i + '">✕</button></div>';
      }).join("") +
      '<div class="crm-plan__foot"><button type="button" class="crm-add" data-pladd>＋ Agregar pago</button><span class="' + (sum === 100 ? "is-ok" : "is-bad") + '">Suma: ' + sum + "%</span></div></div>";
  }
  function accountsPick(sel) {
    var c = cfg().cuentas;
    if (!c.length) return '<p class="warn">Aún no hay cuentas bancarias. Agréguelas en <a href="#documentos" data-ex2>Documentos y cuentas</a>.</p>';
    return chips("cuentas", c.map(function (x) { return [x.id, x.banco + " · " + x.tipo + " " + String(x.numero).slice(-4)]; }), sel, true);
  }
  function lawyerPick(cur) { return '<div class="f"><label>Abogado responsable</label><select data-lawyer>' + lawyers().map(function (p) { return '<option value="' + esc(p.id) + '"' + (cur && (p.id === cur.id || p.nombre === cur.nombre) ? " selected" : "") + ">" + esc(p.nombre) + "</option>"; }).join("") + "</select></div>"; }
  function clientFields(c) {
    return '<p class="muted">Se llenan con la ficha del cliente. Para completar o corregir datos, use la pestaña Resumen del cliente.</p>' +
      '<div class="grid2">' + text("cliente.nombre", "Nombre completo", c.nombre) + '<div class="f"><label>Tipo de documento</label><select data-k="cliente.tipoDoc">' + PP.TIPOS_DOC.map(function (t) { return "<option" + (t[4] === c.tipoDoc ? " selected" : "") + ' value="' + esc(t[4]) + '">' + esc(t[1]) + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="grid2">' + text("cliente.cedula", "Número de documento", c.cedula) + "</div>" +
      '<div class="grid2">' + text("cliente.expedida", "Expedido en", c.expedida) + text("cliente.ciudad", "Ciudad de domicilio", c.ciudad) + "</div>" +
      text("cliente.direccion", "Dirección", c.direccion) +
      '<div class="grid2">' + text("cliente.telefono", "Teléfono", c.telefono) + text("cliente.email", "Correo", c.email) + "</div>";
  }

  /* Enlaza todos los controles del formulario con E.d.data */
  function setPath(obj, path, val) { var p = path.split("."), o = obj; for (var i = 0; i < p.length - 1; i++) { o[p[i]] = o[p[i]] || {}; o = o[p[i]]; } o[p[p.length - 1]] = val; }
  function getPath(obj, path) { return path.split(".").reduce(function (o, k) { return o ? o[k] : undefined; }, obj); }
  function bindForm(root, rerender) {
    var data = E.d.data;
    root.addEventListener("input", function (e) {
      var el = e.target, k = el.getAttribute("data-k");
      if (k) {
        if (el.hasAttribute("data-money")) { var n = el.value.replace(/\D/g, ""); el.value = n ? Number(n).toLocaleString("es-CO") : ""; setPath(data, k, Number(n) || 0); if (k === "honorarios") refreshPlan(root); }
        else setPath(data, k, el.value);
        if (k === "fecha" && E.d.tipo === "recibo") data.fecha = el.value;
      }
      if (el.hasAttribute("data-li")) { var list = el.closest("[data-list]").getAttribute("data-list"); data[list][+el.getAttribute("data-li")] = el.value; }
      if (el.hasAttribute("data-pl")) { data.plan[+el.getAttribute("data-i")][el.getAttribute("data-pl")] = el.getAttribute("data-pl") === "pct" ? Number(el.value) : el.value; if (el.getAttribute("data-pl") === "pct") { data.planNombre = ""; refreshPlan(root, true); } }
      if (el.hasAttribute("data-cl")) { var c = data.clausulas[+el.getAttribute("data-i")]; c[el.getAttribute("data-cl")] = el.value; }
      preview();
    });
    root.addEventListener("change", function (e) {
      var el = e.target;
      if (el.hasAttribute("data-lawyer")) data.abogado = lawyerData(el.value);
      if (el.hasAttribute("data-pl")) data.plan[+el.getAttribute("data-i")][el.getAttribute("data-pl")] = el.value;
      if (el.hasAttribute("data-clon")) data.clausulas[+el.getAttribute("data-i")].on = el.checked;
      if (el.hasAttribute("data-bool")) data[el.getAttribute("data-bool")] = el.checked;
      if (el.getAttribute("data-bool") === "iva") refreshPlan(root);
      preview();
    });
    root.addEventListener("click", function (e) {
      var b = e.target.closest("button, a");
      if (!b) return;
      if (b.hasAttribute("data-ex2")) { closeEditor(); closePanel(); return; }
      var cs = b.closest("[data-chips]");
      if (cs && b.hasAttribute("data-v")) {
        var name = cs.getAttribute("data-chips"), v = b.getAttribute("data-v");
        if (cs.hasAttribute("data-multi")) { var arr = data[name] = data[name] || []; var ix = arr.indexOf(v); if (ix > -1) arr.splice(ix, 1); else arr.push(v); b.classList.toggle("is-on"); }
        else {
          $$("button", cs).forEach(function (x) { x.classList.toggle("is-on", x === b); });
          if (name === "planNombre") { data.planNombre = v; data.plan = planFrom(v); refreshPlan(root); }
          else if (name === "vigencia") data.vigencia = Number(v);
          else { setPath(data, name, v); var inpEl = root.querySelector('[data-k="' + name + '"]'); if (inpEl) inpEl.value = v; }
        }
        preview(); return;
      }
      if (b.hasAttribute("data-addli")) { var ln = b.closest("[data-list]").getAttribute("data-list"); data[ln] = data[ln] || []; data[ln].push(""); rerender(); setTimeout(function () { var all = $$('[data-list="' + ln + '"] input', root); all[all.length - 1].focus(); }, 30); return; }
      if (b.hasAttribute("data-rm")) { var ln2 = b.closest("[data-list]").getAttribute("data-list"); data[ln2].splice(+b.getAttribute("data-rm"), 1); rerender(); preview(); return; }
      if (b.hasAttribute("data-req")) { var r = data.requisitos[+b.getAttribute("data-req")]; var cyc = ["pendiente", "recibido", "na"]; r.estado = cyc[(cyc.indexOf(r.estado) + 1) % cyc.length] || "pendiente"; rerender(); preview(); return; }
      if (b.hasAttribute("data-reqrm")) { data.requisitos.splice(+b.getAttribute("data-reqrm"), 1); rerender(); preview(); return; }
      if (b.hasAttribute("data-reqadd")) { var ni = root.querySelector("[data-reqnew]"); if (ni.value.trim()) { data.requisitos = data.requisitos || []; data.requisitos.push({ t: ni.value.trim(), estado: "pendiente" }); rerender(); preview(); } return; }
      if (b.hasAttribute("data-pladd")) { data.plan = data.plan || []; data.plan.push({ concepto: "Pago adicional", pct: 0, momento: DEF.momentos[4] }); data.planNombre = ""; refreshPlan(root); preview(); return; }
      if (b.hasAttribute("data-plrm")) { data.plan.splice(+b.getAttribute("data-plrm"), 1); data.planNombre = ""; refreshPlan(root); preview(); return; }
      if (b.hasAttribute("data-situ")) { data.situacion = E.l.mensaje || ""; var ta = root.querySelector('[data-k="situacion"]'); if (ta) ta.value = data.situacion; preview(); return; }
      if (b.hasAttribute("data-clreset")) { data.clausulas = JSON.parse(JSON.stringify(cfg().clausulas || DEF.clausulas)); rerender(); preview(); return; }
      if (b.hasAttribute("data-cladd")) { data.clausulas.push({ titulo: "NUEVA CLÁUSULA", texto: "", on: true }); rerender(); preview(); return; }
    });
    function refreshPlan(r, keepFocus) {
      var box = r.querySelector("[data-plan]");
      if (!box) return;
      if (keepFocus) { var sum = data.plan.reduce(function (s, x) { return s + (Number(x.pct) || 0); }, 0); var sp = box.querySelector(".crm-plan__foot span"); sp.textContent = "Suma: " + sum + "%"; sp.className = sum === 100 ? "is-ok" : "is-bad"; var t = D.totals(data).total; $$(".crm-plan__v", box).forEach(function (v, i) { v.textContent = money(t * (Number(data.plan[i].pct) || 0) / 100); }); return; }
      box.outerHTML = planEd(data.plan);
    }
  }

  function applyPoderType(data, t) {
    Object.assign(data, { tipoPoder: t.id, forma: t.forma, destinatario: t.destinatario, ciudadDest: t.ciudadDest, referencia: t.referencia, objeto: t.objeto, facultades: t.facultades.slice(), nota: "" });
  }

  /* ---------- Formularios por tipo ---------- */
  var FORMS = {};
  function mount(root, html, again) { root.innerHTML = html; if (!root._bound) { bindForm(root, again); root._bound = true; } }

  FORMS.propuesta = function (root) {
    var d = E.d.data;
    function draw() {
      mount(root,
        sec("1. Servicio y plantilla", '<div class="f"><label>Plantilla rápida</label>' + chips("plantilla", plantillas().map(function (p) { return p.nombre; }), d.plantilla) + '<small class="muted">Al elegir una plantilla se llenan alcance, ley, requisitos y plan de pagos.</small></div>' + text("servicio", "Nombre del servicio", d.servicio)) +
        sec("2. Situación del cliente", area("situacion", "Resumen del caso (en palabras del cliente)", d.situacion, 4, "Ej.: Nació en Venezuela y tiene registro en Cúcuta; le negaron el pasaporte…") + (E.l.mensaje ? '<button type="button" class="crm-add" data-situ>↧ Usar el mensaje que dejó el cliente</button>' : "")) +
        sec("3. Lo que haremos", listEd("alcance", d.alcance, "Agregar paso")) +
        sec("4. Fundamento legal", area("baseLegal", "Explicación sencilla", d.baseLegal, 4) + '<div class="f"><label>Normas</label>' + listEd("normas", d.normas, "Agregar norma") + "</div>", false) +
        sec("5. Documentos requeridos", reqEd(d.requisitos)) +
        sec("6. Tiempos", '<div class="f"><label>Tiempo estimado del trámite</label>' + chips("tiempo", DEF.tiempos, d.tiempo) + '<input type="text" data-k="tiempo" value="' + esc(d.tiempo) + '" placeholder="O escriba otro"></div>' +
          '<div class="f"><label>Tiempo de respuesta</label>' + chips("respuesta", DEF.respuestas, d.respuesta) + "</div>") +
        sec("7. Honorarios y forma de pago", moneyIn("honorarios", "Valor de los honorarios", d.honorarios) + '<label class="check"><input type="checkbox" data-bool="iva"' + (d.iva ? " checked" : "") + "><span>Sumar IVA (19%)</span></label>" + '<div class="f"><label>Plan de pagos</label>' + planEd(d.plan) + "</div>") +
        sec("8. Gastos no incluidos", chips("gastos", DEF.gastos, d.gastos, true), false) +
        sec("9. Cuentas para pago", accountsPick(d.cuentas)) +
        sec("10. Vigencia, abogado y notas", '<div class="f"><label>Vigencia de la propuesta</label>' + chips("vigencia", DEF.vigencias.map(function (n) { return [n, n + " días"]; }), d.vigencia) + "</div>" + lawyerPick(d.abogado) +
          '<div class="grid2"><div class="f"><label>Fecha</label><input type="date" data-k="fecha" value="' + esc(d.fecha) + '"></div></div>' + area("notas", "Notas adicionales (opcional)", d.notas, 2), false),
        draw);
    }
    root.addEventListener("click", function (e) {
      var b = e.target.closest('[data-chips="plantilla"] button');
      if (!b) return;
      var tp = findTemplate(b.getAttribute("data-v"));
      if (d.alcance && d.alcance.length && !confirm("¿Aplicar la plantilla «" + tp.nombre + "»? Se reemplazarán alcance, ley, requisitos y plan.")) return;
      var keep = { honorarios: d.honorarios, situacion: d.situacion, cuentas: d.cuentas, abogado: d.abogado, fecha: d.fecha };
      applyTemplate(d, tp, E.l);
      if (keep.honorarios) d.honorarios = keep.honorarios;
      Object.assign(d, { situacion: keep.situacion, cuentas: keep.cuentas, abogado: keep.abogado, fecha: keep.fecha });
      draw(); preview();
    }, true);
    draw();
  };

  FORMS.contrato = function (root) {
    var d = E.d.data;
    var props = (E.l.docs || []).filter(function (x) { return x.tipo === "propuesta"; });
    function draw() {
      mount(root,
        (props.length ? sec("Basado en la propuesta", chips("propuestaRef", props.map(function (p) { return p.numero; }), d.propuestaRef) + '<small class="muted">Toque una propuesta para copiar servicio, alcance, honorarios y plan de pagos.</small>') : "") +
        sec("1. Datos del cliente", clientFields(d.cliente || {})) +
        sec("2. Objeto del contrato", text("servicio", "Servicio", d.servicio) + '<div class="f"><label>Alcance</label>' + listEd("alcance", d.alcance, "Agregar actividad") + "</div>") +
        sec("3. Honorarios y pagos", moneyIn("honorarios", "Valor de los honorarios", d.honorarios) + '<label class="check"><input type="checkbox" data-bool="iva"' + (d.iva ? " checked" : "") + "><span>Sumar IVA (19%)</span></label>" + planEd(d.plan) + '<div class="f"><label>Cuentas autorizadas</label>' + accountsPick(d.cuentas) + "</div>") +
        sec("4. Gastos y duración", chips("gastos", DEF.gastos, d.gastos, true) + '<div class="f"><label>Tiempo estimado</label>' + chips("tiempo", DEF.tiempos, d.tiempo) + '<input type="text" data-k="tiempo" value="' + esc(d.tiempo) + '"></div>') +
        sec("5. Cláusulas", '<p class="muted">Active o desactive cláusulas y edite su texto. Variables: {SERVICIO}, {HONORARIOS}, {HONORARIOS_LETRAS}, {PLAN}, {GASTOS}, {TIEMPO}, {ALCANCE}.</p>' +
          (d.clausulas || []).map(function (c, i) {
            return '<div class="crm-clause' + (c.on === false ? " is-off" : "") + '"><label class="crm-clause__h"><input type="checkbox" data-clon data-i="' + i + '"' + (c.on !== false ? " checked" : "") + '><input type="text" value="' + esc(c.titulo) + '" data-cl="titulo" data-i="' + i + '"></label><textarea rows="3" data-cl="texto" data-i="' + i + '">' + esc(c.texto) + "</textarea></div>";
          }).join("") + '<div class="crm-grid2"><button type="button" class="crm-add" data-cladd>＋ Agregar cláusula</button><button type="button" class="crm-add" data-clreset>↺ Restaurar cláusulas</button></div>', false) +
        sec("6. Firma", '<div class="grid2">' + text("ciudadFirma", "Ciudad de firma", d.ciudadFirma) + '<div class="f"><label>Fecha</label><input type="date" data-k="fecha" value="' + esc(d.fecha) + '"></div></div>' + lawyerPick(d.abogado)),
        draw);
    }
    root.addEventListener("click", function (e) {
      var b = e.target.closest('[data-chips="propuestaRef"] button');
      if (!b) return;
      var p = props.find(function (x) { return x.numero === b.getAttribute("data-v"); });
      if (!p) return;
      Object.assign(d, { servicio: p.data.servicio, alcance: (p.data.alcance || []).slice(), honorarios: p.data.honorarios, iva: p.data.iva, plan: JSON.parse(JSON.stringify(p.data.plan || [])), planNombre: p.data.planNombre, gastos: (p.data.gastos || []).slice(), tiempo: p.data.tiempo, cuentas: (p.data.cuentas || []).slice(), propuestaRef: p.numero });
      draw(); preview();
    }, true);
    draw();
  };

  FORMS.poder = function (root) {
    var d = E.d.data;
    if (!d.poderdantes) d.poderdantes = [Object.assign({ tipoDoc: "cédula de ciudadanía", calidad: "en nombre propio" }, d.cliente || {})];
    d.asunto = d.asunto || {};
    var DEST = ["Registraduría Nacional del Estado Civil", "Juez (Reparto)", "Juez de Familia (Reparto)", "Juez Civil Municipal (Reparto)", "Notario(a) del Círculo", "Autoridad competente del Registro Civil — República Bolivariana de Venezuela"];
    var TIPOSDOC = PP.TIPOS_DOC.map(function (t) { return t[4]; });
    function tokens() { var t = {}; String((d.objeto || "") + " " + (d.referencia || "") + " " + (d.notas || "")).replace(/\{([A-Z_]+)\}/g, function (m, k) { t[k] = 1; }); return Object.keys(t); }
    function draw() {
      var tk = tokens();
      mount(root,
        sec("1. ¿Para qué es el poder?", '<p class="muted">Elija un modelo: se llenan el destinatario, el objeto, las facultades y la forma de otorgamiento.</p>' +
          '<div class="crm-ptypes">' + DEF.tiposPoder.map(function (t) { return '<button type="button" data-ptype="' + t.id + '" class="' + (d.tipoPoder === t.id ? "is-on" : "") + '">' + esc(t.nombre) + "</button>"; }).join("") + "</div>") +
        (tk.length ? sec("2. Datos del asunto", '<p class="muted">Complete los datos que aparecen en el texto del poder.</p>' + tk.map(function (k) { return '<div class="f"><label>' + esc(DEF.camposPoder[k] || k) + '</label><input type="text" data-k="asunto.' + k + '" value="' + esc(d.asunto[k] || "") + '"></div>'; }).join("")) : "") +
        sec((tk.length ? "3" : "2") + ". Poderdante(s)", d.poderdantes.map(function (p, i) {
          return '<div class="crm-pd"><div class="crm-pd__h"><b>Poderdante ' + (i + 1) + "</b>" + (d.poderdantes.length > 1 ? '<button type="button" data-pdrm="' + i + '">Quitar</button>' : "") + "</div>" +
            '<div class="grid2">' + text("poderdantes." + i + ".nombre", "Nombre completo", p.nombre) + '<div class="f"><label>Tipo de documento</label><select data-pdsel="' + i + '" data-field="tipoDoc">' + TIPOSDOC.map(function (x) { return "<option" + (x === p.tipoDoc ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></div></div>" +
            '<div class="grid2">' + text("poderdantes." + i + ".cedula", "Número de documento", p.cedula) + text("poderdantes." + i + ".expedida", "Expedido en", p.expedida) + "</div>" +
            '<div class="grid2"><div class="f"><label>Género</label><select data-pdsel="' + i + '" data-field="genero">' + [["", "—"]].concat(PP.GENEROS).map(function (g) { return '<option value="' + g[0] + '"' + (g[0] === (p.genero || "") ? " selected" : "") + ">" + g[1] + "</option>"; }).join("") + "</select></div>" +
            '<div class="f"><label>Estado civil</label><select data-pdsel="' + i + '" data-field="estadoCivil"><option value="">—</option>' + PP.ESTADOS_CIVILES.map(function (e) { return '<option value="' + e + '"' + (e === p.estadoCivil ? " selected" : "") + ">" + esc(PP.estadoCivil({ genero: p.genero, estadoCivil: e })) + "</option>"; }).join("") + "</select></div></div>" +
            '<div class="grid2"><div class="f"><label>Nacionalidad</label><select data-pdsel="' + i + '" data-field="nacionalidad"><option value="">—</option>' + PP.NACIONALIDADES.map(function (n) { return "<option" + (n === p.nacionalidad ? " selected" : "") + ">" + n + "</option>"; }).join("") + "</select></div>" + text("poderdantes." + i + ".email", "Correo para notificaciones", p.email) + "</div>" +
            '<div class="grid2">' + text("poderdantes." + i + ".direccion", "Dirección de residencia", p.direccion) + text("poderdantes." + i + ".ciudad", "Ciudad / municipio de domicilio", p.ciudad) + "</div>" +
            '<div class="f"><label>Actúa en calidad de</label>' + '<div class="crm-chipset" data-pdcal="' + i + '">' + DEF.calidades.map(function (c) { return '<button type="button" data-v="' + esc(c) + '" class="' + (p.calidad === c ? "is-on" : "") + '">' + esc(c) + "</button>"; }).join("") + '</div><input type="text" data-k="poderdantes.' + i + '.calidad" value="' + esc(p.calidad || "") + '"></div></div>';
        }).join("") + '<button type="button" class="crm-add" data-pdadd>＋ Agregar otro poderdante (p. ej., otro heredero)</button>') +
        sec((tk.length ? "4" : "3") + ". Destinatario y referencia", '<div class="f"><label>Dirigido a</label>' + chips("destinatario", DEST, d.destinatario) + '<input type="text" data-k="destinatario" value="' + esc(d.destinatario) + '"></div>' +
          '<div class="grid2">' + text("ciudadDest", "Ciudad", d.ciudadDest) + text("radicado", "Radicado (si ya existe)", d.radicado) + "</div>" +
          text("referencia", "Referencia", d.referencia) + text("contraparte", "Contraparte (si aplica)", d.contraparte), false) +
        sec((tk.length ? "5" : "4") + ". Objeto del poder", area("objeto", "Para que en mi nombre y representación…", d.objeto, 6) + '<small class="muted">Los textos entre llaves, como {CAUSANTE}, se llenan con los datos del asunto.</small>', false) +
        sec((tk.length ? "6" : "5") + ". Facultades", '<p class="muted">Arts. 74 y 77 del Código General del Proceso: las facultades de disposición (recibir, desistir, conciliar, transigir…) deben otorgarse de forma expresa.</p>' + chips("facultades", DEF.facultades, d.facultades, true)) +
        sec((tk.length ? "7" : "6") + ". Apoderado y forma de otorgamiento", lawyerPick(d.abogado) +
          '<div class="grid2">' + text("emailApoderado", "Correo del apoderado inscrito en el Registro Nacional de Abogados", d.emailApoderado) + text("direccionApoderado", "Dirección de notificaciones", d.direccionApoderado) + "</div>" +
          '<div class="grid2">' + text("sustituto", "Apoderado sustituto (opcional)", d.sustituto) + text("sustitutoTp", "T.P. del sustituto", d.sustitutoTp) + "</div>" +
          '<div class="f"><label>Forma de otorgamiento</label>' + chips("forma", Object.keys(DEF.formasPoder).map(function (k) { return [k, DEF.formasPoder[k][0]]; }), d.forma) + '<small class="muted">' + esc((DEF.formasPoder[d.forma] || DEF.formasPoder.datos)[1]) + "</small></div>" +
          '<div class="grid2">' + text("ciudadFirma", "Ciudad de firma", d.ciudadFirma) + '<div class="f"><label>Fecha</label><input type="date" data-k="fecha" value="' + esc(d.fecha) + '"></div></div>' +
          area("notas", "Texto adicional (opcional)", d.notas, 2)),
        draw);
    }
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ptype]");
      if (b) {
        var t = DEF.tiposPoder.find(function (x) { return x.id === b.getAttribute("data-ptype"); });
        switchModel(E.d, function () { applyPoderType(d, t); }); draw(); preview(); return;
      }
      var cal = e.target.closest("[data-pdcal] button");
      if (cal) { var i = +cal.closest("[data-pdcal]").getAttribute("data-pdcal"); d.poderdantes[i].calidad = cal.getAttribute("data-v"); d.asunto.CALIDAD = d.asunto.CALIDAD || d.poderdantes[0].calidad; draw(); preview(); return; }
      if (e.target.closest("[data-pdadd]")) { d.poderdantes.push({ tipoDoc: "cédula de ciudadanía", calidad: d.poderdantes[0].calidad || "" }); draw(); preview(); return; }
      var rm = e.target.closest("[data-pdrm]");
      if (rm) { d.poderdantes.splice(+rm.getAttribute("data-pdrm"), 1); draw(); preview(); return; }
      var fm = e.target.closest('[data-chips="forma"] button');
      if (fm) { setTimeout(function () { draw(); preview(); }, 0); }
    }, true);
    root.addEventListener("change", function (e) {
      var sel = e.target.closest("[data-pdsel]");
      if (sel) { d.poderdantes[+sel.getAttribute("data-pdsel")][sel.getAttribute("data-field")] = sel.value; if (sel.getAttribute("data-field") === "genero") draw(); preview(); }
    });
    draw();
  };

  FORMS.acta = function (root) {
    var d = E.d.data;
    function draw() {
      mount(root,
        sec("1. Trámite", text("servicio", "Servicio", d.servicio) + '<div class="f"><label>Fecha</label><input type="date" data-k="fecha" value="' + esc(d.fecha) + '"></div>') +
        sec("2. Documentos recibidos", reqEd(d.requisitos)) +
        sec("3. Observaciones y firma", area("notas", "Observaciones (opcional)", d.notas, 3, "Ej.: Se reciben originales para apostillar.") + lawyerPick(d.abogado)),
        draw);
    }
    draw();
  };

  FORMS.libre = function (root) {
    var d = E.d.data;
    function draw() {
      mount(root,
        sec("1. Plantilla", chips("modelo", DEF.libres.map(function (x) { return x[0]; }), d.titulo) + '<small class="muted">Elija un modelo o escriba su propio documento.</small>') +
        sec("2. Contenido", text("titulo", "Título", d.titulo) + area("cuerpo", "Texto del documento", d.cuerpo, 12)) +
        sec("3. Firmas", '<label class="check"><input type="checkbox" data-bool="firmaFirma"' + (d.firmaFirma !== false ? " checked" : "") + "><span>Incluir firma de la firma de abogados</span></label>" + lawyerPick(d.abogado) + '<div class="f"><label>Fecha</label><input type="date" data-k="fecha" value="' + esc(d.fecha) + '"></div>'),
        draw);
    }
    root.addEventListener("click", function (e) {
      var b = e.target.closest('[data-chips="modelo"] button');
      if (!b) return;
      var m = DEF.libres.find(function (x) { return x[0] === b.getAttribute("data-v"); });
      switchModel(E.d, function () { d.titulo = m[0]; d.cuerpo = fillLead(m[1], E.l); }); draw(); preview();
    }, true);
    draw();
  };

  FORMS.recibo = function (root) {
    var d = E.d.data;
    function draw() {
      mount(root,
        sec("Recibo", moneyIn("valor", "Valor recibido", d.valor) + text("concepto", "Concepto", d.concepto) + text("servicio", "Servicio", d.servicio) +
          '<div class="f"><label>Medio de pago</label>' + chips("metodo", DEF.metodos, d.metodo) + "</div>" + accountsPick(d.cuentas) +
          '<div class="grid2">' + text("referencia", "Referencia / N.º de comprobante", d.referencia) + '<div class="f"><label>Fecha</label><input type="date" data-k="fecha" value="' + esc(d.fecha) + '"></div></div>' +
          text("recibidoPor", "Recibido por", d.recibidoPor)),
        draw);
    }
    draw();
  };

  /* ---------- Requisitos y archivos ---------- */
  TABS.req = function (b, l) {
    l.requisitos = l.requisitos || [];
    var L = { pendiente: "Pendiente", revision: "En revisión", recibido: "✓ Recibido", na: "No aplica" };
    var files = l.archivos || [];
    b.innerHTML =
      '<div class="crm-h"><b>Documentos requeridos</b><span class="muted">' + l.requisitos.filter(function (r) { return r.estado === "recibido"; }).length + " de " + l.requisitos.filter(function (r) { return r.estado !== "na"; }).length + " recibidos</span></div>" +
      (l.requisitos.length ? '<div class="crm-reqlist">' + l.requisitos.map(function (r, i) {
        return '<div class="crm-req2 is-' + (r.estado || "pendiente") + '"><span>' + esc(r.t) + '</span><select data-rs="' + i + '">' + Object.keys(L).map(function (k) { return '<option value="' + k + '"' + ((r.estado || "pendiente") === k ? " selected" : "") + ">" + L[k] + "</option>"; }).join("") + "</select></div>";
      }).join("") + "</div>" : '<p class="muted">Se llenan automáticamente al crear la propuesta. También puede cargarlos desde una plantilla:</p>') +
      '<div class="crm-row"><select id="tpl-req"><option value="">Cargar lista desde plantilla…</option>' + plantillas().map(function (p) { return "<option>" + esc(p.nombre) + "</option>"; }).join("") + '</select><input type="text" id="req-new" placeholder="Agregar documento…"><button type="button" class="btn btn--line btn--sm" id="req-add">Agregar</button></div>' +
      '<div class="crm-row"><button type="button" class="btn btn--wa btn--sm" id="req-ask">💬 Solicitar pendientes por WhatsApp</button><button type="button" class="btn btn--line btn--sm" id="req-acta">🗂 Generar acta de recepción</button></div>' +
      '<div class="crm-h"><b>Archivos del expediente</b><button type="button" class="btn btn--navy btn--sm" id="file-up">＋ Subir soporte</button></div>' +
      (files.length ? '<div class="crm-files">' + files.map(function (f, i) {
        var reqName = f.requisito != null && l.requisitos[f.requisito] ? l.requisitos[f.requisito].t : "";
        return '<div class="crm-file' + (f.por === "cliente" && !f.revisado ? " is-new" : "") + '"><span class="crm-doc__ic">' + (/pdf/.test(f.tipo) ? "PDF" : "IMG") + '</span><div class="crm-doc__m"><b>' + esc(f.nombre) + "</b><small>" + (f.por === "cliente" ? "Enviado por el cliente" : "Subido por la firma") + " · " + A.fmtDate(f.subidoEn) + (reqName ? " · " + esc(reqName) : "") + "</small></div>" +
          '<a class="icon" href="/api/crmfile?lead=' + encodeURIComponent(l.id) + "&file=" + encodeURIComponent(f.id) + '" target="_blank" rel="noopener" title="Ver" data-fview="' + i + '">👁</a>' +
          (f.por === "cliente" && reqName ? '<button type="button" class="btn btn--line btn--sm" data-fok="' + i + '">✓ Aprobar</button>' : "") +
          '<button type="button" class="icon" data-fvis="' + i + '" title="' + (f.visibleCliente === false ? "Oculto al cliente" : "Visible al cliente") + '">' + (f.visibleCliente === false ? "🙈" : "👁‍🗨") + "</button></div>";
      }).join("") + "</div>" : '<p class="muted">Aquí aparecerán los documentos que el cliente envíe desde su portal y los soportes que usted suba (radicados, resoluciones, constancias).</p>');
    $$("[data-rs]", b).forEach(function (s) { s.onchange = function () { var r = l.requisitos[+s.getAttribute("data-rs")]; r.estado = s.value; log(l, "requisito", "«" + r.t + "» → " + L[s.value] + "."); checkComplete(l); save(); renderPanel(); }; });
    $("#tpl-req", b).onchange = function (e) { var tp = findTemplate(e.target.value); if (!tp) return; tp.requisitos.forEach(function (t) { if (!l.requisitos.some(function (r) { return r.t === t; })) l.requisitos.push({ t: t, estado: "pendiente" }); }); save(); renderPanel(); };
    $("#req-add", b).onclick = function () { var v = $("#req-new", b).value.trim(); if (!v) return; l.requisitos.push({ t: v, estado: "pendiente" }); save(); renderPanel(); };
    $("#req-ask", b).onclick = function () { var pend = l.requisitos.filter(function (r) { return !r.estado || r.estado === "pendiente"; }); waOpen(l, "Hola " + firstName(l.nombre) + ", para avanzar con su trámite necesitamos:\n" + (pend.map(function (r) { return "• " + r.t; }).join("\n") || "• (sin pendientes)") + "\n\nPuede enviarlos con una foto desde su celular aquí: " + portalUrl(l)); log(l, "envio", "Solicitud de documentos por WhatsApp."); save(); };
    $("#req-acta", b).onclick = function () { editDoc(l, newDoc(l, "acta")); };
    $$("[data-fview]", b).forEach(function (a) { a.addEventListener("click", function () { var f = files[+a.getAttribute("data-fview")]; if (!f.revisado) { f.revisado = true; save(); } }); });
    $$("[data-fok]", b).forEach(function (x) { x.onclick = function () { var f = files[+x.getAttribute("data-fok")]; f.revisado = true; var r = l.requisitos[f.requisito]; if (r) { r.estado = "recibido"; log(l, "requisito", "Aprobado: «" + r.t + "»."); } checkComplete(l); save("Documento aprobado"); renderPanel(); }; });
    $$("[data-fvis]", b).forEach(function (x) { x.onclick = function () { var f = files[+x.getAttribute("data-fvis")]; f.visibleCliente = f.visibleCliente === false; save(); renderPanel(); }; });
    $("#file-up", b).onclick = async function () {
      var picked = await window.ACUpload.pick("image/*,application/pdf", true);
      for (var i = 0; i < picked.length; i++) {
        try {
          var f = picked[i], body = /^image\/(jpeg|png|webp)$/.test(f.type) ? await window.ACUpload.compress(f, { maxSize: 2200 }) : f;
          var r = await fetch("/api/crmfile?lead=" + encodeURIComponent(l.id) + "&name=" + encodeURIComponent(f.name), { method: "POST", credentials: "same-origin", headers: { "Content-Type": body.type || f.type, "x-ac-admin": "1" }, body: body });
          var j = await r.json(); if (!r.ok) throw new Error(j.error);
          l.archivos = l.archivos || []; l.archivos.unshift(j.file); log(l, "archivo", "Soporte subido: «" + f.name + "».");
        } catch (e) { A.toast(e.message, true); }
      }
      save("Archivos guardados"); renderPanel();
    };
  };
  function checkComplete(l) {
    var req = (l.requisitos || []).filter(function (r) { return r.estado !== "na"; });
    if (req.length && req.every(function (r) { return r.estado === "recibido"; }) && !l._docsOk) { l._docsOk = true; log(l, "requisito", "✓ Documentación completa."); advance(l, "documentos", "documentación completa"); }
  }

  /* ---------- Pagos ---------- */
  TABS.pagos = function (b, l) {
    var total = valor(l), pag = pagado(l), saldo = Math.max(0, total - pag);
    var prop = lastDoc(l, "contrato") || lastDoc(l, "propuesta");
    var rows = prop ? D.planRows(prop.data) : [];
    b.innerHTML =
      '<div class="crm-paysum"><div><span>Valor del servicio</span><b>' + money(total) + "</b></div><div><span>Pagado</span><b>" + money(pag) + '</b></div><div class="is-due"><span>Saldo</span><b>' + money(saldo) + "</b></div></div>" +
      '<div class="crm-progress"><span style="width:' + (total ? Math.min(100, pag / total * 100) : 0) + '%"></span></div>' +
      (rows.length ? '<div class="crm-h"><b>Plan de pagos</b><span class="muted">' + esc(prop.numero) + "</span></div>" + '<div class="crm-planlist">' + rows.map(function (r, i) {
        var acum = rows.slice(0, i + 1).reduce(function (s, x) { return s + x.valor; }, 0), ok = pag >= acum;
        return '<div class="' + (ok ? "is-ok" : "") + '"><span>' + (ok ? "✓" : i + 1) + "</span><b>" + esc(r.concepto) + "</b><small>" + esc(r.momento) + "</small><em>" + money(r.valor) + "</em></div>";
      }).join("") + "</div>" : "") +
      '<div class="crm-row"><button type="button" class="btn btn--gold" id="pay-new">＋ Registrar pago y generar recibo</button><button type="button" class="btn btn--wa btn--sm" id="pay-ask">💬 Recordar pago</button></div>' +
      ((l.pagos || []).length ? '<div class="crm-h"><b>Pagos recibidos</b></div><div class="crm-docs">' + l.pagos.map(function (p) {
        var rec = (l.docs || []).find(function (d) { return d.id === p.reciboId; });
        return '<div class="crm-doc"><span class="crm-doc__ic">$</span><div class="crm-doc__m"><b>' + money(p.valor) + "</b><small>" + D.fecha(p.fecha) + " · " + esc(p.metodo) + (p.referencia ? " · Ref. " + esc(p.referencia) : "") + "</small></div>" + (rec ? '<span class="tag tag--ok">' + esc(rec.numero) + "</span>" : "") + "</div>";
      }).join("") + "</div>" : "");
    $("#pay-new", b).onclick = function () { registerPayment(l); };
    $("#pay-ask", b).onclick = function () { waOpen(l, "Hola " + firstName(l.nombre) + ", le recordamos amablemente que tiene un saldo pendiente de *" + money(saldo) + "* por su servicio de " + (l.servicio || "") + ". En su portal encuentra las cuentas autorizadas: " + portalUrl(l) + "\n¡Gracias!"); log(l, "envio", "Recordatorio de pago por WhatsApp."); save(); };
  };
  function registerPayment(l) {
    var total = valor(l), pag = pagado(l), saldo = Math.max(0, total - pag);
    var prop = lastDoc(l, "contrato") || lastDoc(l, "propuesta");
    var rows = prop ? D.planRows(prop.data) : [];
    var nextRow = rows.find(function (r, i) { return pag < rows.slice(0, i + 1).reduce(function (s, x) { return s + x.valor; }, 0); });
    var quick = [];
    if (nextRow) quick.push([nextRow.valor, nextRow.concepto]);
    if (saldo && (!nextRow || saldo !== nextRow.valor)) quick.push([saldo, "Saldo total"]);
    var cuentas = cfg().cuentas;
    sheet("Registrar pago",
      '<div class="form" id="payf">' + (quick.length ? '<div class="f"><label>Valores rápidos</label><div class="crm-chipset">' + quick.map(function (q) { return '<button type="button" data-q="' + q[0] + '" data-c="' + esc(q[1]) + '">' + esc(q[1]) + " · " + money(q[0]) + "</button>"; }).join("") + "</div></div>" : "") +
      '<div class="f"><label>Valor recibido</label><div class="crm-money"><span>$</span><input type="text" inputmode="numeric" name="valor" value="' + (nextRow ? nextRow.valor.toLocaleString("es-CO") : "") + '"></div></div>' +
      '<div class="f"><label>Concepto</label><input type="text" name="concepto" value="' + esc(nextRow ? nextRow.concepto + " — honorarios" : "Abono de honorarios") + '"></div>' +
      '<div class="f"><label>Medio de pago</label><div class="crm-chipset" data-one="metodo">' + DEF.metodos.map(function (m, i) { return '<button type="button" data-v="' + esc(m) + '" class="' + (i === 0 ? "is-on" : "") + '">' + esc(m) + "</button>"; }).join("") + "</div></div>" +
      (cuentas.length ? '<div class="f"><label>Cuenta</label><select name="cuenta">' + cuentas.map(function (c) { return '<option value="' + c.id + '">' + esc(c.banco + " · " + c.tipo + " " + c.numero) + "</option>"; }).join("") + '<option value="">Ninguna (efectivo u otro)</option></select></div>' : "") +
      '<div class="grid2"><div class="f"><label>Fecha</label><input type="date" name="fecha" value="' + today() + '"></div><div class="f"><label>Referencia / comprobante</label><input type="text" name="referencia" placeholder="Opcional"></div></div>' +
      '<label class="check"><input type="checkbox" name="enviar" checked><span>Enviar el recibo al cliente por WhatsApp</span></label></div>',
      function (box) {
        var metodo = DEF.metodos[0];
        $$("[data-q]", box).forEach(function (x) { x.onclick = function () { box.querySelector("[name=valor]").value = Number(x.getAttribute("data-q")).toLocaleString("es-CO"); box.querySelector("[name=concepto]").value = x.getAttribute("data-c") + " — honorarios"; }; });
        $$('[data-one="metodo"] button', box).forEach(function (x) { x.onclick = function () { metodo = x.getAttribute("data-v"); $$('[data-one="metodo"] button', box).forEach(function (y) { y.classList.toggle("is-on", y === x); }); }; });
        box.querySelector("[name=valor]").oninput = function (e) { var n = e.target.value.replace(/\D/g, ""); e.target.value = n ? Number(n).toLocaleString("es-CO") : ""; };
        return function () {
          var val = Number(box.querySelector("[name=valor]").value.replace(/\D/g, ""));
          if (!val) { A.toast("Escriba el valor recibido", true); return false; }
          var cuentaSel = box.querySelector("[name=cuenta]"), cuenta = cuentaSel ? cuentaSel.value : "";
          var fechaP = box.querySelector("[name=fecha]").value || today(), ref = box.querySelector("[name=referencia]").value.trim();
          var rec = { id: "D" + rid(10), tipo: "recibo", numero: nextNumber("recibo"), creado: now(), estado: "enviado", data: {
            fecha: fechaP, valor: val, concepto: box.querySelector("[name=concepto]").value.trim(), servicio: l.servicio, metodo: metodo, cuentas: cuenta ? [cuenta] : [],
            referencia: ref, totalServicio: total, pagadoAntes: pag, saldo: Math.max(0, total - pag - val), recibidoPor: cfg().firma.representante || ""
          } };
          l.docs = l.docs || []; l.docs.unshift(rec);
          l.pagos = l.pagos || []; l.pagos.unshift({ id: rid(8), fecha: fechaP, valor: val, metodo: metodo, cuenta: cuenta, referencia: ref, reciboId: rec.id });
          log(l, "pago", "Pago registrado por " + money(val) + " (" + metodo + "). Recibo " + rec.numero + ".");
          advance(l, "anticipo", "pago recibido");
          if (box.querySelector("[name=enviar]").checked) waOpen(l, sendText(l, rec));
          save("Pago registrado"); renderPanel();
        };
      }, "Registrar pago");
  }

  /* ---------- Actividad ---------- */
  var ICON = { creado: "✨", etapa: "➜", envio: "📤", doc: "📄", firma: "✍️", visto: "👁", archivo: "📎", pago: "💵", requisito: "✅", nota: "📝", avance: "📣", aceptacion: "✅" };
  TABS.act = function (b, l) {
    b.innerHTML = '<div class="crm-note"><textarea id="note" rows="3" placeholder="Escriba una nota interna (llamada, acuerdo, observación)…"></textarea><button type="button" class="btn btn--navy btn--sm" id="note-add">Guardar nota</button></div>' +
      '<ol class="crm-tl">' + (l.actividad || []).map(function (a) { return '<li><span>' + (ICON[a.tipo] || "•") + "</span><div><p>" + esc(a.texto) + "</p><small>" + A.fmtDate(a.t) + "</small></div></li>"; }).join("") + "</ol>";
    $("#note-add", b).onclick = function () { var v = $("#note", b).value.trim(); if (!v) return; log(l, "nota", v); save(); renderPanel(); };
  };

  /* ---------- Hoja inferior genérica ---------- */
  var sh = document.createElement("div");
  sh.className = "crm-sheet"; sh.hidden = true;
  document.body.appendChild(sh);
  function sheet(title, html, bind, okLabel) {
    sh.innerHTML = '<div class="crm-sheet__bg" data-sx></div><div class="crm-sheet__p"><header><b>' + esc(title) + '</b><button type="button" class="crm-x" data-sx>✕</button></header><div class="crm-sheet__b">' + html + "</div>" + (okLabel ? '<footer><button type="button" class="btn btn--gold btn--block" data-sok>' + esc(okLabel) + "</button></footer>" : "") + "</div>";
    sh.hidden = false;
    $$("[data-sx]", sh).forEach(function (x) { x.onclick = closeSheet; });
    var ok = bind && bind($(".crm-sheet__b", sh));
    var okb = $("[data-sok]", sh);
    if (okb && typeof ok === "function") okb.onclick = function () { if (ok() !== false) closeSheet(); };
  }
  function closeSheet() { sh.hidden = true; }

  /* ==========================================================================
     Vista: Documentos y cuentas (configuración)
     ========================================================================== */
  A.VIEWS.documentos = async function (v) {
    v.innerHTML = '<div class="empty">Cargando…</div>';
    try { await load(true); } catch (e) { v.innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; return; }
    if (!isAdmin()) { location.hash = "perfil"; return; }
    var c = cfg(), f = c.firma;
    v.innerHTML =
      '<div class="card"><h2>Datos de la firma</h2><p class="muted">Aparecen en el encabezado, el pie y las firmas de todos los documentos.</p><div class="form" id="firmf">' +
      '<div class="grid2">' + fi("nombre", "Nombre comercial", f.nombre || "Ariango Consultores") + fi("razon", "Razón social (si aplica)", f.razon) + "</div>" +
      '<div class="grid2">' + fi("nit", "NIT", f.nit) + fi("representante", "Representante legal / abogado titular", f.representante || "Walter Enrique Arias Moreno") + "</div>" +
      '<div class="grid2">' + fi("cedulaRep", "Cédula del representante", f.cedulaRep) + fi("tarjeta", "Tarjeta profesional", f.tarjeta) + "</div>" +
      '<div class="grid2">' + fi("direccion", "Dirección", f.direccion) + fi("ciudad", "Ciudad", f.ciudad || "Cúcuta") + "</div>" +
      '<div class="grid2">' + fi("telefono", "Teléfono", f.telefono || "+57 315 600 2993") + fi("whatsapp", "WhatsApp del portal (solo números)", f.whatsapp || "573156002993") + "</div>" +
      '<div class="grid2">' + fi("email", "Correo", f.email || "gerencia@ariangoconsultores.com") + fi("web", "Sitio web", f.web || "ariangoconsultores.com") + "</div>" +
      '<label class="check"><input type="checkbox" name="ivaResponsable"' + (f.ivaResponsable ? " checked" : "") + "><span>Somos responsables de IVA (sumar 19% por defecto)</span></label>" +
      fi("notaRecibo", "Nota al pie de los recibos", f.notaRecibo || "Este recibo es soporte del pago de honorarios profesionales. No reemplaza la factura electrónica cuando esta sea exigible.") +
      '<button type="button" class="btn btn--gold" id="firm-save">Guardar datos</button></div></div>' +

      '<div class="card"><h2>Firma de los abogados</h2><p class="muted">Dibuje la firma con el dedo o el mouse, o suba una imagen. Se estampa en propuestas, contratos, poderes y recibos.</p>' +
      '<div class="f"><label>Abogado</label><select id="sig-who"><option value="firma">Representante legal (firma de la empresa: contratos y recibos)</option>' + lawyers().map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nombre) + "</option>"; }).join("") + "</select><small>Cada abogado también puede dibujar su firma en «Mi perfil».</small></div>" +
      '<div class="crm-sigpad"><canvas id="sig-pad"></canvas><img id="sig-cur" alt=""><span>Firme aquí</span></div>' +
      '<div class="crm-row"><button type="button" class="btn btn--line btn--sm" id="sig-clear">Borrar</button><button type="button" class="btn btn--line btn--sm" id="sig-up">Subir imagen</button><button type="button" class="btn btn--gold btn--sm" id="sig-save">Guardar firma</button></div></div>' +

      '<div class="card"><div class="list-head"><div><h2>Cuentas bancarias</h2><p class="muted" style="margin:0">Se muestran en propuestas, contratos, recibos y en el portal del cliente.</p></div><button type="button" class="btn btn--gold" id="acc-add">＋ Agregar cuenta</button></div>' +
      '<div class="items" style="margin-top:14px">' + (c.cuentas.length ? c.cuentas.map(function (a, i) {
        return '<div class="item"><div class="item__thumb" style="font-size:.8rem;font-weight:800">' + esc((a.banco || "").slice(0, 3).toUpperCase()) + '</div><div class="item__main"><b>' + esc(a.banco + " · " + a.tipo + " " + a.numero) + "</b><small>" + esc(a.titular + (a.documento ? " · " + a.documento : "")) + "</small>" + (a.predeterminada ? '<div class="tags"><span class="tag tag--ok">Predeterminada</span></div>' : "") + '</div><div class="item__actions"><button type="button" class="icon" data-acc="' + i + '">✏️</button><button type="button" class="icon icon--danger" data-accdel="' + i + '">🗑</button></div></div>';
      }).join("") : '<div class="empty">Agregue la primera cuenta para recibir pagos.</div>') + "</div></div>" +

      '<div class="card"><h2>Plantillas de servicios</h2><p class="muted">Precio, plan de pagos, tiempos, alcance y requisitos por defecto. Hacen que una propuesta quede lista en segundos.</p><div class="items">' + plantillas().map(function (p, i) {
        return '<div class="item"><div class="item__thumb">📄</div><div class="item__main"><b>' + esc(p.nombre) + "</b><small>" + (Number(p.honorarios) ? money(p.honorarios) : "Sin precio base") + " · Plan " + esc(p.plan) + (p.tiempo ? " · " + esc(p.tiempo) : "") + '</small></div><div class="item__actions"><button type="button" class="icon" data-tpl="' + i + '">✏️</button></div></div>';
      }).join("") + '</div><div class="crm-row"><button type="button" class="btn btn--line btn--sm" id="tpl-add">＋ Nueva plantilla</button></div></div>' +

      '<div class="card"><h2>Numeración</h2><p class="muted">Consecutivos automáticos: ' + Object.keys(D.PREFIJO).map(function (k) { return D.PREFIJO[k] + " " + ((crm.db.seq || {})[k] || 0); }).join(" · ") + "</p></div>";

    $("#firm-save", v).onclick = function () {
      $$("#firmf input", v).forEach(function (el) { f[el.name] = el.type === "checkbox" ? el.checked : el.value.trim(); });
      f.whatsapp = (f.whatsapp || "").replace(/\D/g, "");
      save("Datos de la firma guardados");
    };
    // Firma
    var cv = $("#sig-pad", v), cx = cv.getContext("2d"), drew = false, down = false, last;
    function size() { var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.lineWidth = 2.6; cx.lineCap = "round"; cx.lineJoin = "round"; cx.strokeStyle = "#0A1A30"; drew = false; }
    function curSig() { var id = $("#sig-who", v).value; if (id === "firma") return f.firmaImg || ""; var p = lawyerById(id) || {}; return p.firmaImg || c.firmas[p.nombre] || ""; }
    async function storeSig(img) {
      var id = $("#sig-who", v).value, p = lawyerById(id) || {};
      if (id === "firma") { f.firmaImg = img; save("Firma del representante legal guardada"); showCur(); return; }
      if (/^U/.test(id)) {
        try { await A.api("/api/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, firmaImg: img }) }); p.firmaImg = img; await load(true); A.toast("Firma guardada"); } catch (e) { A.toast(e.message, true); }
      } else { c.firmas[p.nombre] = img; save("Firma guardada"); }
      showCur();
    }
    function showCur() { var img = $("#sig-cur", v), s = curSig(); img.src = s || ""; img.style.display = s ? "block" : "none"; }
    requestAnimationFrame(function () { size(); showCur(); });
    function P(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cv.addEventListener("pointerdown", function (e) { e.preventDefault(); cv.setPointerCapture(e.pointerId); down = true; last = P(e); $("#sig-cur", v).style.display = "none"; });
    cv.addEventListener("pointermove", function (e) { if (!down) return; var p = P(e); cx.beginPath(); cx.moveTo(last.x, last.y); cx.lineTo(p.x, p.y); cx.stroke(); last = p; drew = true; });
    ["pointerup", "pointercancel"].forEach(function (ev) { cv.addEventListener(ev, function () { down = false; }); });
    var pending = "";
    $("#sig-who", v).onchange = function () { cx.clearRect(0, 0, cv.width, cv.height); drew = false; pending = ""; showCur(); };
    $("#sig-clear", v).onclick = function () { cx.clearRect(0, 0, cv.width, cv.height); drew = false; pending = ""; showCur(); };
    $("#sig-save", v).onclick = function () {
      if (pending) { var img0 = pending; pending = ""; storeSig(img0); return; }
      if (drew) { var img = trim(cv); cx.clearRect(0, 0, cv.width, cv.height); drew = false; storeSig(img); return; }
      A.toast(curSig() ? "Esta firma ya está guardada. Dibuje o suba otra para reemplazarla." : "Dibuje la firma o suba una imagen.", !curSig());
    };
    $("#sig-up", v).onclick = async function () {
      var fl = await window.ACUpload.pick("image/png,image/jpeg,image/webp"); if (!fl.length) return;
      try { pending = await sigFromFile(fl[0]); } catch (e) { A.toast(e.message, true); return; }
      cx.clearRect(0, 0, cv.width, cv.height); drew = false;
      var im = $("#sig-cur", v); im.src = pending; im.style.display = "block";
      storeSig(pending); pending = "";
    };
    // Cuentas
    $("#acc-add", v).onclick = function () { editAccount(-1); };
    $$("[data-acc]", v).forEach(function (b) { b.onclick = function () { editAccount(+b.getAttribute("data-acc")); }; });
    $$("[data-accdel]", v).forEach(function (b) { b.onclick = function () { if (!confirm("¿Eliminar esta cuenta?")) return; c.cuentas.splice(+b.getAttribute("data-accdel"), 1); save("Cuenta eliminada"); A.route(); }; });
    // Plantillas
    $$("[data-tpl]", v).forEach(function (b) { b.onclick = function () { editTemplate(+b.getAttribute("data-tpl")); }; });
    $("#tpl-add", v).onclick = function () { editTemplate(-1); };
  };
  function fi(name, label, val) { return '<div class="f"><label>' + label + '</label><input type="text" name="' + name + '" value="' + esc(val || "") + '"></div>'; }
  function trim(cv) {
    var cx = cv.getContext("2d"), w = cv.width, h = cv.height, px = cx.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) if (px[(y * w + x) * 4 + 3] > 10) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 <= x0) return cv.toDataURL("image/png");
    var o = document.createElement("canvas"), sw = x1 - x0 + 20, sh2 = y1 - y0 + 20, s = Math.min(1, 600 / sw);
    o.width = sw * s; o.height = sh2 * s; o.getContext("2d").drawImage(cv, Math.max(0, x0 - 10), Math.max(0, y0 - 10), sw, sh2, 0, 0, o.width, o.height);
    return o.toDataURL("image/png");
  }
  /* Convierte una foto o escaneo de la firma en PNG con fondo transparente y recortado. */
  function sigFromFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
      img.onload = function () {
        var s = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        var x = c.getContext("2d"); x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        var d = x.getImageData(0, 0, c.width, c.height), p = d.data;
        for (var i = 0; i < p.length; i += 4) {
          var lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
          if (lum > 215) p[i + 3] = 0;                       // fondo claro → transparente
          else if (lum > 150) p[i + 3] = Math.round(p[i + 3] * (215 - lum) / 65); // bordes suaves
        }
        x.putImageData(d, 0, 0);
        var out = trim(c);
        if (out.length > 240000) { // reduce si es muy pesada
          var t = new Image(); t.onload = function () { var k = document.createElement("canvas"); k.width = Math.round(t.width * 0.6); k.height = Math.round(t.height * 0.6); k.getContext("2d").drawImage(t, 0, 0, k.width, k.height); resolve(k.toDataURL("image/png")); }; t.src = out;
        } else resolve(out);
      };
      img.src = url;
    });
  }
  var BANCOS = ["Bancolombia", "Banco de Bogotá", "Davivienda", "BBVA", "Banco de Occidente", "Banco Popular", "Banco AV Villas", "Banco Caja Social", "Scotiabank Colpatria", "Banco Agrario", "Itaú", "Nequi", "Daviplata", "Otro"];
  var TIPOS_CTA = ["Cuenta de ahorros", "Cuenta corriente", "Nequi", "Daviplata", "Llave Bre-B"];
  function editAccount(i) {
    var c = cfg(), a = i >= 0 ? c.cuentas[i] : { id: "C" + rid(6), banco: "Bancolombia", tipo: TIPOS_CTA[0], numero: "", titular: c.firma.razon || c.firma.nombre || "", documento: c.firma.nit ? "NIT " + c.firma.nit : "", predeterminada: !c.cuentas.length };
    sheet(i >= 0 ? "Editar cuenta" : "Nueva cuenta",
      '<div class="form"><div class="f"><label>Banco</label><div class="crm-chipset" data-one="banco">' + BANCOS.map(function (b) { return '<button type="button" data-v="' + b + '" class="' + (a.banco === b ? "is-on" : "") + '">' + b + "</button>"; }).join("") + '</div><input type="text" name="banco" value="' + esc(a.banco) + '"></div>' +
      '<div class="f"><label>Tipo</label><div class="crm-chipset" data-one="tipo">' + TIPOS_CTA.map(function (b) { return '<button type="button" data-v="' + b + '" class="' + (a.tipo === b ? "is-on" : "") + '">' + b + "</button>"; }).join("") + "</div></div>" +
      '<div class="grid2"><div class="f"><label>Número o llave</label><input type="text" name="numero" value="' + esc(a.numero) + '"></div><div class="f"><label>Titular</label><input type="text" name="titular" value="' + esc(a.titular) + '"></div></div>' +
      '<div class="grid2"><div class="f"><label>NIT / C.C. del titular</label><input type="text" name="documento" value="' + esc(a.documento) + '"></div><div class="f"><label>Nota (opcional)</label><input type="text" name="nota" value="' + esc(a.nota || "") + '" placeholder="Ej.: Envíe el comprobante por WhatsApp"></div></div>' +
      '<label class="check"><input type="checkbox" name="predeterminada"' + (a.predeterminada ? " checked" : "") + "><span>Usar por defecto en las propuestas</span></label></div>",
      function (box) {
        var tipo = a.tipo;
        $$('[data-one="banco"] button', box).forEach(function (x) { x.onclick = function () { box.querySelector("[name=banco]").value = x.getAttribute("data-v"); $$('[data-one="banco"] button', box).forEach(function (y) { y.classList.toggle("is-on", y === x); }); }; });
        $$('[data-one="tipo"] button', box).forEach(function (x) { x.onclick = function () { tipo = x.getAttribute("data-v"); $$('[data-one="tipo"] button', box).forEach(function (y) { y.classList.toggle("is-on", y === x); }); }; });
        return function () {
          var o = { id: a.id, tipo: tipo };
          $$("input[name]", box).forEach(function (el) { o[el.name] = el.type === "checkbox" ? el.checked : el.value.trim(); });
          if (!o.numero || !o.titular) { A.toast("Escriba el número y el titular", true); return false; }
          if (i >= 0) c.cuentas[i] = o; else c.cuentas.push(o);
          save("Cuenta guardada"); A.route();
        };
      }, "Guardar cuenta");
  }
  function editTemplate(i) {
    var c = cfg();
    if (!c.plantillas) c.plantillas = JSON.parse(JSON.stringify(DEF.plantillas));
    var p = i >= 0 ? c.plantillas[i] : { id: "t" + rid(5), nombre: "", alcance: [], baseLegal: "", normas: [], requisitos: [], tiempo: "", respuesta: "48 horas hábiles", honorarios: 0, plan: "50 / 50" };
    sheet(i >= 0 ? "Editar plantilla" : "Nueva plantilla",
      '<div class="form"><div class="f"><label>Nombre del servicio</label><input type="text" name="nombre" value="' + esc(p.nombre) + '"></div>' +
      '<div class="grid2"><div class="f"><label>Honorarios base (COP)</label><input type="text" inputmode="numeric" name="honorarios" value="' + (Number(p.honorarios) ? Number(p.honorarios).toLocaleString("es-CO") : "") + '"></div>' +
      '<div class="f"><label>Plan de pagos</label><select name="plan">' + Object.keys(DEF.planes).map(function (k) { return "<option" + (k === p.plan ? " selected" : "") + ">" + k + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="grid2"><div class="f"><label>Tiempo estimado</label><input type="text" name="tiempo" value="' + esc(p.tiempo) + '" placeholder="Ej.: 2 a 4 meses"></div><div class="f"><label>Tiempo de respuesta</label><input type="text" name="respuesta" value="' + esc(p.respuesta) + '"></div></div>' +
      '<div class="f"><label>Lo que haremos (un paso por línea)</label><textarea name="alcance" rows="5">' + esc(p.alcance.join("\n")) + "</textarea></div>" +
      '<div class="f"><label>Documentos requeridos (uno por línea)</label><textarea name="requisitos" rows="6">' + esc(p.requisitos.join("\n")) + "</textarea></div>" +
      '<div class="f"><label>Fundamento legal en palabras sencillas</label><textarea name="baseLegal" rows="4">' + esc(p.baseLegal) + "</textarea></div>" +
      '<div class="f"><label>Normas (una por línea)</label><textarea name="normas" rows="4">' + esc(p.normas.join("\n")) + "</textarea></div>" +
      (i >= 0 ? '<button type="button" class="btn btn--danger btn--sm" data-tdel>Eliminar plantilla</button>' : "") + "</div>",
      function (box) {
        var del = $("[data-tdel]", box);
        if (del) del.onclick = function () { if (!confirm("¿Eliminar la plantilla?")) return; c.plantillas.splice(i, 1); save("Plantilla eliminada"); closeSheet(); A.route(); };
        box.querySelector("[name=honorarios]").oninput = function (e) { var n = e.target.value.replace(/\D/g, ""); e.target.value = n ? Number(n).toLocaleString("es-CO") : ""; };
        return function () {
          var g = function (n) { return box.querySelector("[name=" + n + "]").value; };
          var lines = function (n) { return g(n).split("\n").map(function (x) { return x.trim(); }).filter(Boolean); };
          if (!g("nombre").trim()) { A.toast("Escriba el nombre", true); return false; }
          var o = Object.assign({}, p, { nombre: g("nombre").trim(), honorarios: Number(g("honorarios").replace(/\D/g, "")) || 0, plan: g("plan"), tiempo: g("tiempo").trim(), respuesta: g("respuesta").trim(), alcance: lines("alcance"), requisitos: lines("requisitos"), baseLegal: g("baseLegal").trim(), normas: lines("normas") });
          if (i >= 0) c.plantillas[i] = o; else c.plantillas.push(o);
          save("Plantilla guardada"); A.route();
        };
      }, "Guardar plantilla");
  }

  /* ==========================================================================
     Vista: Documentos (crear, editar, descargar y enviar en un solo lugar)
     ========================================================================== */
  A.TITLES.docs = "Documentos";
  var hub = { tipo: "todos", q: "" };
  var NUEVOS = [
    ["poder", "🖋", "Poder especial", "Registraduría, juez, notaría, sucesiones o Venezuela. Con todas las facultades legales."],
    ["propuesta", "📄", "Propuesta de servicios", "Alcance, ley aplicable, requisitos, honorarios y plan de pagos."],
    ["contrato", "📑", "Contrato de servicios", "Cláusulas completas, honorarios y firma electrónica."],
    ["acta", "🗂", "Acta de recepción", "Constancia de los documentos que entrega el cliente."],
    ["recibo", "💵", "Recibo de pago", "Registra el pago y genera el recibo con el valor en letras."],
    ["libre", "📝", "Otro documento", "Autorización de datos, declaración, paz y salvo o texto libre."]
  ];
  A.VIEWS.docs = async function (v) {
    v.innerHTML = '<div class="empty">Cargando documentos…</div>';
    try { await load(true); } catch (e) { v.innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; return; }
    renderHub(v);
  };
  function renderHub(v) {
    var rows = [];
    crm.db.leads.forEach(function (l) { (l.docs || []).forEach(function (d) { rows.push({ l: l, d: d }); }); });
    rows.sort(function (a, b) { return a.d.creado < b.d.creado ? 1 : -1; });
    var q = hub.q.toLowerCase();
    var list = rows.filter(function (r) {
      return (hub.tipo === "todos" || r.d.tipo === hub.tipo) && (!q || [r.d.numero, r.l.nombre, r.l.cedula, r.d.data && (r.d.data.servicio || r.d.data.titulo || r.d.data.referencia)].join(" ").toLowerCase().indexOf(q) > -1);
    });
    var counts = {}; rows.forEach(function (r) { counts[r.d.tipo] = (counts[r.d.tipo] || 0) + 1; });
    var pend = rows.filter(function (r) { return r.d.tipo !== "recibo" && r.d.estado !== "borrador" && !r.d.firma; }).length;
    v.innerHTML =
      '<div class="crm-newgrid">' + NUEVOS.map(function (n) { return '<button type="button" data-hnew="' + n[0] + '"><span>' + n[1] + "</span><b>" + n[2] + "</b><small>" + n[3] + "</small></button>"; }).join("") + "</div>" +
      '<div class="crm-stats"><div><b>' + rows.length + '</b><span>Documentos</span></div><div><b>' + rows.filter(function (r) { return r.d.estado === "borrador"; }).length + '</b><span>Borradores</span></div><div><b>' + pend + '</b><span>Esperando firma</span></div><div><b>' + rows.filter(function (r) { return r.d.firma; }).length + "</b><span>Firmados</span></div></div>" +
      '<div class="crm-bar"><input type="search" id="h-q" placeholder="🔎 Buscar por número, cliente o cédula…" value="' + esc(hub.q) + '"></div>' +
      '<div class="crm-chips">' + [["todos", "Todos"]].concat(Object.keys(D.TIPOS).map(function (k) { return [k, D.TIPOS[k]]; })).map(function (c) {
        return '<button type="button" data-ht="' + c[0] + '" class="' + (hub.tipo === c[0] ? "is-on" : "") + '">' + c[1] + " <b>" + (c[0] === "todos" ? rows.length : counts[c[0]] || 0) + "</b></button>";
      }).join("") + "</div>" +
      (list.length ? '<div class="crm-docs">' + list.map(function (r, i) {
        var d = r.d, st = d.tipo === "recibo" ? ["Pagado", "ok"] : ESTADO[d.estado] || ["", ""];
        return '<div class="crm-doc"><span class="crm-doc__ic">' + esc(D.PREFIJO[d.tipo]) + '</span><div class="crm-doc__m"><b>' + esc(d.tipo === "libre" ? d.data.titulo : D.TIPOS[d.tipo]) + " · " + esc(r.l.nombre || "Sin nombre") + "</b><small>" + esc(d.numero) + " · " + A.fmtDate(d.creado) + (d.tipo === "poder" && d.data.referencia ? " · " + esc(String(d.data.referencia).replace(/\{([A-Z_]+)\}/g, function (m, k) { return (d.data.asunto || {})[k] || "…"; }).slice(0, 70)) : d.data && d.data.servicio ? " · " + esc(d.data.servicio) : "") + "</small></div>" +
          '<span class="tag ' + (st[1] ? "tag--" + st[1] : "") + '">' + st[0] + '</span><div class="crm-doc__a">' +
          (!d.firma ? '<button type="button" class="icon" data-hd="edit" data-i="' + i + '" title="Editar">✏️</button>' : "") +
          '<button type="button" class="btn btn--navy btn--sm" data-hd="pdf" data-i="' + i + '">⬇ PDF</button>' +
          '<button type="button" class="btn btn--wa btn--sm" data-hd="send" data-i="' + i + '">Enviar</button>' +
          '<button type="button" class="icon" data-hd="more" data-i="' + i + '" title="Más">⋯</button></div></div>';
      }).join("") + "</div>" : '<div class="empty">' + (rows.length ? "No hay documentos con ese filtro." : "Aún no hay documentos. Cree el primero con los botones de arriba.") + "</div>") +
      tplSection();
    $("#h-q", v).addEventListener("input", function (e) { hub.q = e.target.value; var pos = e.target.selectionStart; renderHub(v); var x = $("#h-q", v); x.focus(); x.setSelectionRange(pos, pos); });
    $$("[data-ht]", v).forEach(function (b) { b.onclick = function () { hub.tipo = b.getAttribute("data-ht"); renderHub(v); }; });
    $$("[data-hnew]", v).forEach(function (b) { b.onclick = function () { pickClient(b.getAttribute("data-hnew")); }; });
    $$("[data-hd]", v).forEach(function (b) {
      b.onclick = function () {
        var r = list[+b.getAttribute("data-i")], a = b.getAttribute("data-hd");
        if (a === "edit") { E.from = "hub"; editDoc(r.l, r.d); }
        if (a === "pdf") downloadPdf(r.l, r.d);
        if (a === "send") { sendDoc(r.l, r.d); renderHub(v); }
        if (a === "more") docMenu(r.l, r.d);
      };
    });
    $$("[data-tpldel]", v).forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-tpldel"), t = docTemplates()[k];
        if (!t || !confirm("¿Quitar la plantilla «" + t.nombre + "»? Los documentos nuevos volverán a usar el modelo original. Los documentos ya creados no cambian.")) return;
        delete docTemplates()[k]; save("Plantilla quitada"); renderHub(v);
      };
    });
  }
  function tplSection() {
    var T = docTemplates(), keys = Object.keys(T).sort(function (a, b) { return (T[a].nombre || "").localeCompare(T[b].nombre || ""); });
    return '<section class="crm-hubsec"><h3>⭐ Plantillas del bufete</h3>' +
      '<p class="muted">Para ajustar un modelo a su manera: abra o cree un documento, toque <b>✍️ Editar sobre el documento</b>, corrija el texto (encabezado, cuerpo, firmas y pie) y toque <b>⭐ Guardar como plantilla</b>. Los documentos nuevos de ese tipo empezarán con ese texto y con los datos de cada cliente.</p>' +
      (keys.length ? '<div class="crm-tpls">' + keys.map(function (k) {
        var t = T[k];
        return '<div class="crm-tpl"><span class="crm-doc__ic">' + esc(D.PREFIJO[t.tipo] || "DOC") + "</span><div><b>" + esc(t.nombre) + "</b><small>Actualizada el " + A.fmtDate(t.at) + (t.por ? " por " + esc(t.por) : "") + "</small></div>" +
          (isAdmin() ? '<button type="button" class="btn btn--line btn--sm" data-tpldel="' + esc(k) + '">Quitar</button>' : "") + "</div>";
      }).join("") + "</div>" : '<div class="empty">Aún no hay plantillas propias. Se usan los modelos originales.</div>') + "</section>";
  }
  function pickClient(tipo) {
    var name = (NUEVOS.find(function (n) { return n[0] === tipo; }) || [])[2];
    sheet(name + " · ¿Para qué cliente?",
      '<div class="form"><input type="search" class="crm-pick-q" placeholder="🔎 Buscar cliente por nombre, cédula o teléfono…">' +
      '<div class="crm-pick" id="pick-list"></div>' +
      '<details class="crm-sec"><summary>＋ Cliente nuevo</summary><div class="crm-sec__b"><div class="grid2">' + fi("n_nombres", "Nombres", "") + fi("n_apellidos", "Apellidos", "") + "</div>" +
      '<div class="grid2"><div class="f"><label>Tipo de documento</label><select name="n_tipo">' + PP.TIPOS_DOC.map(function (t) { return '<option value="' + t[0] + '">' + esc(t[1]) + "</option>"; }).join("") + "</select></div>" + fi("n_cedula", "Número de documento", "") + "</div>" +
      '<div class="f"><label>WhatsApp</label><div class="crm-phone"><select name="n_ind">' + PP.PAISES.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + " +" + x[0] + "</option>"; }).join("") + '</select><input type="tel" name="n_tel" inputmode="tel" placeholder="315 000 0000"></div></div>' + fi("n_ciudad", "Ciudad", "Cúcuta") +
      '<small class="muted">Los demás datos (dirección, nacimiento, género…) se completan después en la ficha del cliente.</small>' +
      '<button type="button" class="btn btn--gold btn--block" data-newcli>Crear cliente y continuar</button></div></details></div>',
      function (box) {
        function draw(q) {
          q = (q || "").toLowerCase();
          var ls = crm.db.leads.filter(function (l) { return !q || [l.nombre, l.cedula, l.telefono].join(" ").toLowerCase().indexOf(q) > -1; }).slice(0, 30);
          $("#pick-list", box).innerHTML = ls.map(function (l) { return '<button type="button" data-pick="' + l.id + '"><b>' + esc(l.nombre || "(sin nombre)") + "</b><small>" + esc([l.cedula ? "C.C. " + l.cedula : "", l.servicio, etapaName(l.etapa)].filter(Boolean).join(" · ")) + "</small></button>"; }).join("") || '<p class="muted">No se encontraron clientes. Créelo abajo.</p>';
        }
        draw("");
        $(".crm-pick-q", box).addEventListener("input", function (e) { draw(e.target.value); });
        function go(l) {
          closeSheet();
          if (tipo === "recibo") { openPanel(l.id, "pagos"); setTimeout(function () { registerPayment(l); }, 50); return; }
          E.from = "hub"; editDoc(l, newDoc(l, tipo));
        }
        box.addEventListener("click", function (e) {
          var p = e.target.closest("[data-pick]"); if (p) go(lead(p.getAttribute("data-pick")));
          if (e.target.closest("[data-newcli]")) {
            var g = function (n) { return box.querySelector("[name=" + n + "]").value.trim(); };
            if (!g("n_nombres")) { A.toast("Escriba los nombres del cliente", true); return; }
            var l = { id: "L" + Date.now().toString(36) + rid(4), createdAt: now(), etapaDesde: now(), nombres: g("n_nombres"), apellidos: g("n_apellidos"), nombre: (g("n_nombres") + " " + g("n_apellidos")).trim(), tipoDoc: g("n_tipo"), cedula: g("n_cedula").replace(/[^\dA-Za-z-]/g, ""), indicativo: g("n_ind"), telefono: g("n_tel").replace(/[^\d ]/g, ""), ciudad: g("n_ciudad"), email: "", servicio: "", etapa: "contactado", abogadoId: isAdmin() ? "" : me().id, abogado: isAdmin() ? "" : me().nombre, valor: 0, etiquetas: ["Documento"], actividad: [], notas: [], docs: [], pagos: [], requisitos: [], archivos: [] };
            log(l, "creado", "Cliente creado desde Documentos.");
            crm.db.leads.unshift(l); save();
            go(l);
          }
        });
      });
  }

  /* ---------- Asignación de casos ---------- */
  function assignLead(l, id) {
    var p = lawyerById(id);
    l.abogadoId = id || ""; l.abogado = p ? p.nombre : "";
    (l.docs || []).forEach(function (d) { if (d.estado === "borrador" && d.data) d.data.abogado = lawyerData(l.abogadoId); });
    log(l, "asignacion", p ? "Asignado a " + p.nombre + "." : "Quedó sin asignar.");
    save(p ? "Caso asignado a " + p.nombre : "Caso sin asignar");
    renderPanel();
    if (p && p.telefono && p.id !== me().id) {
      sheet("Avisar al abogado", '<p class="muted">¿Desea avisarle a <b>' + esc(p.nombre) + "</b> por WhatsApp que tiene un caso nuevo?</p>", function () {
        return function () {
          var tel = String(p.telefono).replace(/\D/g, ""); if (tel.length === 10) tel = "57" + tel;
          window.open("https://wa.me/" + tel + "?text=" + encodeURIComponent("Hola " + firstName(p.nombre.replace(/^Dr[a]?\.\s*/, "")) + ", se te asignó un caso nuevo en Ariango Consultores:\n\n👤 " + (l.nombre || "Cliente") + "\n📄 " + (l.servicio || "Sin servicio") + "\n📞 " + (l.telefono || "") + "\n\nIngresa al panel para atenderlo: " + location.origin + "/admin/#clientes"), "_blank", "noopener");
        };
      }, "Avisar por WhatsApp");
    }
  }

  /* ==========================================================================
     Vista: Abogados (solo administrador)
     ========================================================================== */
  A.TITLES.abogados = "Abogados y accesos";
  A.TITLES.perfil = "Mi perfil";
  A.VIEWS.abogados = async function (v) {
    v.innerHTML = '<div class="empty">Cargando…</div>';
    try { await load(true); } catch (e) { v.innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; return; }
    if (!isAdmin()) { location.hash = "perfil"; return; }
    var mes = new Date().toISOString().slice(0, 7);
    var list = users();
    function stats(id) {
      var ls = crm.db.leads.filter(function (l) { return l.abogadoId === id; });
      return {
        activos: ls.filter(function (l) { return ["finalizado", "perdido"].indexOf(l.etapa) < 0; }).length,
        nuevos: ls.filter(function (l) { return l.etapa === "nuevo"; }).length,
        cobrado: ls.reduce(function (s, l) { return s + (l.pagos || []).filter(function (p) { return String(p.fecha).slice(0, 7) === mes; }).reduce(function (a, p) { return a + (Number(p.valor) || 0); }, 0); }, 0),
        porCobrar: ls.filter(function (l) { return ["perdido", "nuevo", "contactado", "propuesta"].indexOf(l.etapa) < 0; }).reduce(function (s, l) { return s + Math.max(0, valor(l) - pagado(l)); }, 0)
      };
    }
    var sinAsignar = crm.db.leads.filter(function (l) { return !l.abogadoId && l.etapa !== "perdido"; }).length;
    v.innerHTML =
      '<div class="card"><div class="list-head"><div><h2>Abogados del bufete</h2><p class="muted" style="margin:0">Cada abogado entra con su correo y contraseña, y solo ve los casos que tiene asignados.</p></div><button type="button" class="btn btn--gold" id="u-new">＋ Crear abogado</button></div></div>' +
      '<div class="card"><h2>Asignación de solicitudes nuevas</h2><p class="muted">Cómo se reparten las solicitudes que llegan desde la página web.</p>' +
      '<div class="crm-toggle crm-toggle--wide"><button type="button" data-asg="manual" class="' + ((crm.db.config.asignacion || "manual") === "manual" ? "is-on" : "") + '">Manual (yo las asigno)</button><button type="button" data-asg="rotacion" class="' + (crm.db.config.asignacion === "rotacion" ? "is-on" : "") + '">Automática por turnos</button></div>' +
      (sinAsignar ? '<p class="warn" style="margin:12px 0 0">Hay <b>' + sinAsignar + '</b> caso(s) sin asignar. <a href="#clientes" id="u-unassigned">Verlos</a></p>' : "") + "</div>" +
      (list.length ? '<div class="crm-team">' + list.map(function (u) {
        var st = stats(u.id);
        return '<div class="crm-law' + (u.activo === false ? " is-off" : "") + '"><div class="crm-law__top"><span class="crm-law__av">' + esc((u.nombre || "?").replace(/^Dr[a]?\.\s*/, "").split(" ").map(function (x) { return x[0]; }).slice(0, 2).join("")) + "</span>" +
          '<div><b>' + esc(u.nombre) + "</b><small>" + esc(u.email) + "</small>" +
          '<div class="tags"><span class="tag ' + (u.rol === "admin" ? "tag--warn" : "") + '">' + (u.rol === "admin" ? "Administrador" : "Abogado") + "</span>" + (u.activo === false ? '<span class="tag tag--off">Inactivo</span>' : "") + (u.recibeCasos === false ? '<span class="tag">No recibe turnos</span>' : "") + (u.firmaImg ? '<span class="tag tag--ok">Firma ✓</span>' : '<span class="tag tag--off">Sin firma</span>') + "</div></div></div>" +
          '<div class="crm-law__st"><div><b>' + st.activos + "</b><span>Casos activos</span></div><div><b>" + st.nuevos + "</b><span>Nuevos</span></div><div><b>" + money(st.cobrado) + "</b><span>Cobrado mes</span></div><div><b>" + money(st.porCobrar) + "</b><span>Por cobrar</span></div></div>" +
          '<div class="crm-row"><button type="button" class="btn btn--line btn--sm" data-u-cases="' + u.id + '">Ver sus casos</button><button type="button" class="btn btn--line btn--sm" data-u-edit="' + u.id + '">✏️ Editar</button><button type="button" class="btn btn--line btn--sm" data-u-pass="' + u.id + '">🔑 Contraseña</button></div></div>';
      }).join("") + "</div>" : '<div class="empty">Aún no hay abogados. Cree el primero para asignarle casos.</div>');
    $("#u-new", v).onclick = function () { editUser(null); };
    $$("[data-asg]", v).forEach(function (b) { b.onclick = async function () { try { await A.api("/api/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asignacion: b.getAttribute("data-asg") }) }); A.toast("Asignación actualizada"); A.route(); } catch (e) { A.toast(e.message, true); } }; });
    var un = $("#u-unassigned", v); if (un) un.onclick = function () { crm.abogadoF = "sin"; };
    $$("[data-u-cases]", v).forEach(function (b) { b.onclick = function () { crm.abogadoF = b.getAttribute("data-u-cases"); location.hash = "clientes"; }; });
    $$("[data-u-edit]", v).forEach(function (b) { b.onclick = function () { editUser(users().find(function (u) { return u.id === b.getAttribute("data-u-edit"); })); }; });
    $$("[data-u-pass]", v).forEach(function (b) { b.onclick = function () { resetPass(users().find(function (u) { return u.id === b.getAttribute("data-u-pass"); })); }; });
  };
  function genPass() { var a = new Uint8Array(10); crypto.getRandomValues(a); return "Ac-" + Array.prototype.map.call(a, function (x) { return "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 55]; }).join(""); }
  function editUser(u) {
    var isNew = !u; u = u || { rol: "abogado", activo: true, recibeCasos: true };
    var pw = isNew ? genPass() : "";
    sheet(isNew ? "Crear abogado" : "Editar abogado",
      '<div class="form" id="uf">' +
      '<div class="grid2">' + fi("nombre", "Nombre completo (como firma)", u.nombre) + fi("email", "Correo (será su usuario)", u.email) + "</div>" +
      (isNew ? '<div class="f"><label>Contraseña inicial</label><input type="text" name="password" value="' + pw + '"><small>Compártala con el abogado; podrá cambiarla en «Mi perfil».</small></div>' : "") +
      '<div class="f"><label>Rol</label><div class="crm-chipset" data-one="rol"><button type="button" data-v="abogado" class="' + (u.rol !== "admin" ? "is-on" : "") + '">Abogado (solo sus casos)</button><button type="button" data-v="admin" class="' + (u.rol === "admin" ? "is-on" : "") + '">Administrador (ve todo)</button></div></div>' +
      '<div class="grid2">' + fi("cargo", "Cargo", u.cargo || "Abogado") + fi("especialidad", "Especialidad", u.especialidad) + "</div>" +
      '<div class="grid2">' + fi("cedula", "Cédula", u.cedula) + fi("tarjeta", "Tarjeta profesional", u.tarjeta) + "</div>" +
      '<div class="grid2">' + fi("telefono", "WhatsApp (para avisos y para sus clientes)", u.telefono) + fi("ciudad", "Ciudad", u.ciudad || "Cúcuta") + "</div>" +
      '<label class="check"><input type="checkbox" name="activo"' + (u.activo !== false ? " checked" : "") + "><span>Cuenta activa<small>Si la desactiva, no podrá ingresar y se cierran sus sesiones.</small></span></label>" +
      '<label class="check"><input type="checkbox" name="recibeCasos"' + (u.recibeCasos !== false ? " checked" : "") + "><span>Recibe casos nuevos en la asignación automática</span></label>" +
      (!isNew ? '<button type="button" class="btn btn--danger btn--sm" data-udel>Eliminar cuenta</button>' : "") + "</div>",
      function (box) {
        var rol = u.rol || "abogado";
        $$('[data-one="rol"] button', box).forEach(function (x) { x.onclick = function () { rol = x.getAttribute("data-v"); $$('[data-one="rol"] button', box).forEach(function (y) { y.classList.toggle("is-on", y === x); }); }; });
        var del = $("[data-udel]", box);
        if (del) del.onclick = async function () {
          if (!confirm("¿Eliminar la cuenta de " + u.nombre + "? Sus casos quedarán sin asignar.")) return;
          try { await A.api("/api/users?id=" + encodeURIComponent(u.id), { method: "DELETE" }); A.toast("Cuenta eliminada"); closeSheet(); A.route(); } catch (e) { A.toast(e.message, true); }
        };
        return function () {
          var o = { rol: rol };
          $$("input[name]", box).forEach(function (el) { o[el.name] = el.type === "checkbox" ? el.checked : el.value.trim(); });
          if (!isNew) o.id = u.id;
          A.api("/api/users", { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) }).then(function () {
            A.toast(isNew ? "Abogado creado" : "Datos guardados");
            if (isNew) shareAccess(o.nombre, o.email, o.password, o.telefono);
            A.route();
          }, function (e) { A.toast(e.message, true); });
        };
      }, isNew ? "Crear cuenta" : "Guardar");
  }
  function shareAccess(nombre, email, pass, tel) {
    var msg = "Hola " + firstName(String(nombre).replace(/^Dr[a]?\.\s*/, "")) + ", bienvenido(a) al panel de Ariango Consultores.\n\n🔗 " + location.origin + "/admin/\n👤 Usuario: " + email + "\n🔑 Contraseña: " + pass + "\n\nAl ingresar, cambia tu contraseña y dibuja tu firma en «Mi perfil».";
    sheet("Datos de acceso", '<p class="muted">Comparta estos datos con el abogado. Por seguridad, la contraseña no se volverá a mostrar.</p><div class="crm-link" style="white-space:pre-wrap;font-family:inherit">' + esc(msg) + '</div><div class="crm-grid2"><button type="button" class="btn btn--line" data-c>Copiar</button>' + (tel ? '<button type="button" class="btn btn--wa" data-w>Enviar por WhatsApp</button>' : "") + "</div>", function (box) {
      $("[data-c]", box).onclick = function () { navigator.clipboard.writeText(msg); A.toast("Copiado"); };
      var w = $("[data-w]", box); if (w) w.onclick = function () { var t = String(tel).replace(/\D/g, ""); if (t.length === 10) t = "57" + t; window.open("https://wa.me/" + t + "?text=" + encodeURIComponent(msg), "_blank", "noopener"); };
    });
  }
  function resetPass(u) {
    var pw = genPass();
    sheet("Nueva contraseña", '<p class="muted">Se asignará esta contraseña a <b>' + esc(u.nombre) + '</b> y se cerrarán sus sesiones abiertas.</p><div class="f"><label>Nueva contraseña</label><input type="text" name="np" value="' + pw + '"></div>', function (box) {
      return function () {
        var np = $("[name=np]", box).value.trim();
        A.api("/api/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, password: np }) }).then(function () { A.toast("Contraseña cambiada"); shareAccess(u.nombre, u.email, np, u.telefono); }, function (e) { A.toast(e.message, true); });
      };
    }, "Cambiar contraseña");
  }

  /* ==========================================================================
     Vista: Mi perfil (cada abogado)
     ========================================================================== */
  A.VIEWS.perfil = async function (v) {
    v.innerHTML = '<div class="empty">Cargando…</div>';
    var r;
    try { r = await A.api("/api/me"); } catch (e) { v.innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; return; }
    var u = r.usuario;
    if (u.id === "owner") { v.innerHTML = '<div class="card"><h2>Administrador principal</h2><p class="muted">Su acceso se configura en Vercel con la variable <code>ADMIN_PASSWORD</code>. Para firmar documentos, cree su propia cuenta de abogado en <a href="#abogados">Abogados y accesos</a>.</p></div>'; return; }
    v.innerHTML =
      '<div class="card"><h2>Mis datos</h2><p class="muted">Aparecen en las propuestas, contratos y poderes de sus casos, y en el portal de sus clientes.</p><div class="form" id="pf">' +
      '<div class="grid2">' + fi("nombre", "Nombre completo", u.nombre) + fi("cargo", "Cargo", u.cargo) + "</div>" +
      '<div class="grid2">' + fi("cedula", "Cédula", u.cedula) + fi("tarjeta", "Tarjeta profesional", u.tarjeta) + "</div>" +
      '<div class="grid2">' + fi("telefono", "WhatsApp", u.telefono) + fi("especialidad", "Especialidad", u.especialidad) + "</div>" +
      '<button type="button" class="btn btn--gold" id="pf-save">Guardar mis datos</button></div></div>' +
      '<div class="card"><h2>Mi firma</h2><p class="muted">Dibújela con el dedo o el mouse. Se estampa en los documentos de sus casos.</p>' +
      '<div class="crm-sigpad"><canvas id="mpad"></canvas><img id="mcur" alt=""' + (u.firmaImg ? ' src="' + esc(u.firmaImg) + '"' : ' style="display:none"') + '><span>Firme aquí</span></div>' +
      '<div class="crm-row"><button type="button" class="btn btn--line btn--sm" id="m-clear">Borrar</button><button type="button" class="btn btn--line btn--sm" id="m-up">Subir imagen</button><button type="button" class="btn btn--gold btn--sm" id="m-save">Guardar firma</button></div></div>' +
      '<div class="card"><h2>Cambiar contraseña</h2><div class="form"><div class="grid2"><div class="f"><label>Contraseña actual</label><input type="password" id="pw1" autocomplete="current-password"></div><div class="f"><label>Nueva contraseña (mín. 8)</label><input type="password" id="pw2" autocomplete="new-password"></div></div><button type="button" class="btn btn--navy" id="pw-save">Cambiar contraseña</button></div></div>';
    async function put(body, msg) {
      try { await A.api("/api/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); A.toast(msg); crm.db = null; } catch (e) { A.toast(e.message, true); }
    }
    $("#pf-save", v).onclick = function () { var o = {}; $$("#pf input", v).forEach(function (el) { o[el.name] = el.value.trim(); }); put(o, "Datos guardados"); };
    $("#pw-save", v).onclick = function () { put({ actual: $("#pw1", v).value, nueva: $("#pw2", v).value }, "Contraseña cambiada"); };
    var pad = sigPad($("#mpad", v), $("#mcur", v));
    $("#m-clear", v).onclick = pad.clear;
    $("#m-save", v).onclick = function () { if (!pad.drew()) { A.toast(u.firmaImg ? "Su firma ya está guardada. Dibuje o suba otra para reemplazarla." : "Dibuje su firma o suba una imagen.", !u.firmaImg); return; } var img = trim($("#mpad", v)); put({ firmaImg: img }, "Firma guardada"); u.firmaImg = img; $("#mcur", v).src = img; $("#mcur", v).style.display = "block"; pad.clear(); };
    $("#m-up", v).onclick = async function () {
      var fl = await window.ACUpload.pick("image/png,image/jpeg,image/webp"); if (!fl.length) return;
      try { var img = await sigFromFile(fl[0]); pad.clear(); $("#mcur", v).src = img; $("#mcur", v).style.display = "block"; await put({ firmaImg: img }, "Firma guardada"); u.firmaImg = img; } catch (e) { A.toast(e.message, true); }
    };
  };
  function sigPad(cv, cur) {
    var cx = cv.getContext("2d"), down = false, drew = false, last;
    function size() { var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.lineWidth = 2.6; cx.lineCap = "round"; cx.lineJoin = "round"; cx.strokeStyle = "#0A1A30"; }
    requestAnimationFrame(size);
    function P(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cv.addEventListener("pointerdown", function (e) { e.preventDefault(); cv.setPointerCapture(e.pointerId); down = true; last = P(e); if (cur) cur.style.display = "none"; });
    cv.addEventListener("pointermove", function (e) { if (!down) return; var p = P(e); cx.beginPath(); cx.moveTo(last.x, last.y); cx.lineTo(p.x, p.y); cx.stroke(); last = p; drew = true; });
    ["pointerup", "pointercancel"].forEach(function (ev) { cv.addEventListener(ev, function () { down = false; }); });
    return { clear: function () { cx.clearRect(0, 0, cv.width, cv.height); drew = false; }, drew: function () { return drew; } };
  }

  /* ==========================================================================
     Inicio: resumen del CRM
     ========================================================================== */
  var baseInicio = A.VIEWS.inicio;
  A.VIEWS.inicio = function (v) {
    var lawyer = A.state.user && A.state.user.rol !== "admin";
    if (lawyer) v.innerHTML = '<div class="card hello"><h2>Hola, ' + esc(firstName(String(A.state.user.nombre || "").replace(/^Dr[a]?\.\s*/, ""))) + ' 👋</h2><p>Aquí ve sus casos asignados, sus pendientes y sus clientes nuevos.</p></div>';
    else baseInicio(v);
    load().then(function () {
      if (lawyer) {
        var mine = crm.db.leads, mes = new Date().toISOString().slice(0, 7);
        var st = document.createElement("div");
        st.className = "crm-stats";
        st.innerHTML = "<div><b>" + mine.filter(function (l) { return ["finalizado", "perdido"].indexOf(l.etapa) < 0; }).length + "</b><span>Casos activos</span></div><div><b>" +
          mine.filter(function (l) { return (l.archivos || []).some(function (f) { return f.por === "cliente" && !f.revisado; }); }).length + "</b><span>Con documentos nuevos</span></div><div><b>" +
          money(mine.reduce(function (s2, l) { return s2 + (l.pagos || []).filter(function (p) { return String(p.fecha).slice(0, 7) === mes; }).reduce(function (a, p) { return a + (Number(p.valor) || 0); }, 0); }, 0)) + "</b><span>Cobrado este mes</span></div><div><b>" +
          money(mine.filter(function (l) { return ["perdido", "nuevo", "contactado", "propuesta"].indexOf(l.etapa) < 0; }).reduce(function (s2, l) { return s2 + Math.max(0, valor(l) - pagado(l)); }, 0)) + "</b><span>Por cobrar</span></div>";
        v.appendChild(st);
      }
      var nuevos = crm.db.leads.filter(function (l) { return l.etapa === "nuevo"; });
      var firmar = crm.db.leads.filter(function (l) { return (l.docs || []).some(function (d) { return d.firma && !d._seen; }); });
      var box = document.createElement("div");
      box.className = "card crm-home";
      box.innerHTML = '<div class="list-head"><div><h2>💼 Clientes</h2><p class="muted" style="margin:0">' + nuevos.length + " solicitud(es) nueva(s) por contactar · " + crm.db.leads.length + ' clientes en total</p></div><a class="btn btn--gold" href="#clientes">Abrir CRM</a></div>' +
        (nuevos.length ? '<div class="crm-list" style="margin-top:12px">' + nuevos.slice(0, 4).map(card).join("") + "</div>" : "");
      var hello = v.querySelector(".hello");
      if (hello) hello.after(box); else v.prepend(box);
      $$("[data-lead]", box).forEach(function (c) { c.addEventListener("click", function () { openPanel(c.getAttribute("data-lead")); }); });
      void firmar;
    }).catch(function () {});
  };
})();

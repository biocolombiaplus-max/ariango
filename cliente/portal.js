/* Portal del cliente — Ariango Consultores */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = window.ACDocs.esc, D = window.ACDocs;
  var q = new URLSearchParams(location.search);
  var L = q.get("l"), T = q.get("t");
  var base = "/api/portal?l=" + encodeURIComponent(L || "") + "&t=" + encodeURIComponent(T || "");
  var data = null, current = null;

  var STEPS = [["propuesta", "Propuesta"], ["aceptada", "Aceptación"], ["anticipo", "Pago inicial"], ["contrato", "Contrato"], ["documentos", "Documentos"], ["tramite", "En trámite"], ["finalizado", "Finalizado"]];
  var ORDER = STEPS.map(function (s) { return s[0]; });
  var TIPO_IC = { propuesta: "PRO", contrato: "CON", recibo: "REC", poder: "POD", acta: "ACT", libre: "DOC" };

  function toast(msg, err) {
    var t = $("#toast"); t.textContent = msg; t.className = "p-toast" + (err ? " is-error" : ""); t.hidden = false;
    clearTimeout(t._h); t._h = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function needsSign(d) { return d.tipo !== "recibo" && !d.firma; }
  function ctxFor(doc) {
    var ids = (doc.data && doc.data.cuentas) || [];
    return { firma: data.firma, cliente: data.cliente, cuentas: data.cuentas.filter(function (c) { return ids.indexOf(c.id) > -1; }) };
  }

  async function load() {
    if (!L || !T) return fail("Enlace incompleto. Solicite a su abogado un nuevo enlace.");
    try {
      var r = await fetch(base, { cache: "no-store" });
      var j = await r.json();
      if (!r.ok) return fail(j.error || "No se pudo abrir el expediente.");
      data = j; render();
      var open = q.get("doc");
      if (open && !current) { var d = data.docs.find(function (x) { return x.id === open; }); if (d) openDoc(d); }
    } catch (e) { fail("No se pudo conectar. Revise su internet e intente de nuevo."); }
  }
  function fail(msg) { $("#app").innerHTML = '<div class="p-error"><h1>No pudimos abrir su expediente</h1><p class="p-muted">' + esc(msg) + "</p></div>"; }

  function render() {
    var nombre = (data.cliente.nombre || "").split(" ")[0];
    var p = ORDER.indexOf(data.etapa);
    var steps = STEPS.map(function (s, i) {
      var cls = data.etapa === "finalizado" || i < p || (i === p) ? "is-done" : i === p + 1 ? "is-now" : "";
      return '<div class="p-step ' + cls + '"><i>' + (cls === "is-done" ? "✓" : i + 1) + "</i><span>" + s[1] + "</span></div>";
    }).join("");
    var nowIdx = data.etapa === "finalizado" ? 6 : Math.min(6, p + 1);
    var nowTxt = data.etapa === "finalizado" ? "¡Caso finalizado!" : "Paso " + (nowIdx + 1) + " de 7 · <b>" + STEPS[nowIdx][1] + "</b>";
    var pend = data.docs.filter(needsSign);
    var reqPend = data.requisitos.filter(function (r) { return r.estado !== "recibido" && r.estado !== "na" && r.estado !== "revision"; });
    var wa = String(data.whatsapp || data.abogadoTel || "").replace(/\D/g, "");
    var waLink = wa ? "https://wa.me/" + wa + "?text=" + encodeURIComponent("Hola, soy " + data.cliente.nombre + ". Le escribo desde mi portal de cliente sobre mi caso de " + (data.servicio || "") + ".") : "";
    var tasks = pend.map(function (d) {
      return '<button type="button" class="p-task" data-doc="' + d.id + '"><span class="p-task__ic">✍️</span><span><b>Firmar ' + esc(D.TIPOS[d.tipo] || "documento").toLowerCase() + "</b><small>" + esc(d.numero) + " · toma menos de 1 minuto</small></span><span class=\"p-task__go\">→</span></button>";
    }).join("") + (reqPend.length ? '<a class="p-task" href="#docs-req" style="text-decoration:none"><span class="p-task__ic">📎</span><span><b>Enviar ' + reqPend.length + " documento(s)</b><small>Foto con el celular o PDF</small></span><span class=\"p-task__go\">→</span></a>" : "");
    var pagado = data.pagos.pagado, total = data.pagos.total, saldo = Math.max(0, total - pagado);

    $("#app").innerHTML =
      '<section class="p-hello"><small>Su expediente</small><h1>Hola, ' + esc(nombre) + "</h1><p>" + esc(data.servicio || "Su caso") + "</p>" +
      '<div class="p-steps">' + steps + '</div><p class="p-now">' + nowTxt + "</p>" +
      (data.abogado || waLink ? '<div class="p-lawyer"><span>⚖️</span><span>Abogado a cargo<br><b>' + esc(data.abogado || "Equipo Ariango") + "</b></span>" + (waLink ? '<a href="' + waLink + '" target="_blank" rel="noopener">WhatsApp</a>' : "") + "</div>" : "") + "</section>" +
      '<section class="p-card"><h2>Pendientes</h2>' + (tasks ? '<p class="p-muted">Complete estos pasos para avanzar con su caso.</p><div class="p-todo">' + tasks + "</div>" : '<div class="p-alldone">✓ No tiene pendientes. Le avisaremos cada avance.</div>') + "</section>" +
      (data.docs.length ? '<section class="p-card"><h2>Mis documentos</h2><p class="p-muted">Toque un documento para verlo, firmarlo o descargarlo en PDF.</p><div class="p-docs">' + data.docs.map(function (d) {
        var chip = d.tipo === "recibo" ? '<span class="p-chip p-chip--ok">Pagado</span>' : d.firma ? '<span class="p-chip p-chip--ok">✓ Firmado</span>' : '<span class="p-chip p-chip--warn">Por firmar</span>';
        return '<button type="button" class="p-doc" data-doc="' + d.id + '"><span class="p-doc__ic">' + (TIPO_IC[d.tipo] || "DOC") + '</span><span><b>' + esc(d.tipo === "libre" ? (d.data.titulo || "Documento") : D.TIPOS[d.tipo]) + "</b><small>" + esc(d.numero) + " · " + D.fecha(d.data.fecha || d.creado) + "</small></span>" + chip + "</button>";
      }).join("") + "</div></section>" : "") +
      (data.requisitos.length ? '<section class="p-card" id="docs-req"><h2>Documentos que necesitamos</h2><p class="p-muted">Tómeles una foto clara o adjunte el PDF. Su información viaja cifrada.</p><div class="p-reqs">' + data.requisitos.map(function (r, i) {
        if (r.estado === "na") return "";
        var cls = r.estado === "recibido" ? "is-ok" : r.estado === "revision" ? "is-rev" : "";
        var right = r.estado === "recibido" ? '<span class="p-chip p-chip--ok">Recibido</span>' : r.estado === "revision" ? '<span class="p-chip p-chip--rev">En revisión</span>' : '<button type="button" class="p-up" data-req="' + i + '">📷 Enviar</button>';
        return '<div class="p-req ' + cls + '"><span class="p-req__dot">' + (r.estado === "recibido" ? "✓" : r.estado === "revision" ? "…" : "") + "</span><span>" + esc(r.t) + "</span>" + right + "</div>";
      }).join("") + '</div><button type="button" class="p-extra" data-req="">＋ Enviar otro documento</button></section>' : "") +
      (data.archivos.length ? '<section class="p-card"><h2>Archivos del expediente</h2><div class="p-docs">' + data.archivos.map(function (f) {
        return '<a class="p-doc" style="text-decoration:none" href="' + base + "&file=" + encodeURIComponent(f.id) + '" target="_blank" rel="noopener"><span class="p-doc__ic">' + (/pdf/.test(f.tipo) ? "PDF" : "IMG") + '</span><span><b>' + esc(f.nombre) + "</b><small>" + (f.por === "cliente" ? "Enviado por usted" : "Compartido por su abogado") + " · " + D.fecha(f.subidoEn) + "</small></span></a>";
      }).join("") + "</div></section>" : "") +
      (total || data.cuentas.length ? '<section class="p-card"><h2>Pagos</h2>' + (total ? '<div class="p-pay"><div><span>Total</span><b>' + D.money(total) + "</b></div><div><span>Pagado</span><b>" + D.money(pagado) + "</b></div><div><span>Saldo</span><b>" + D.money(saldo) + '</b></div></div><div class="p-bar"><span style="width:' + Math.min(100, total ? pagado / total * 100 : 0) + '%"></span></div>' : "") +
        (data.cuentas.length ? '<p class="p-muted">Puede pagar en estas cuentas y enviar el comprobante por WhatsApp:</p><div class="p-accts">' + data.cuentas.map(function (c) {
          return '<div class="p-acct"><small>' + esc(c.banco) + "</small><b>" + esc(c.numero) + "</b><span>" + esc(c.tipo) + " · " + esc(c.titular) + (c.documento ? " · " + esc(c.documento) : "") + '</span><button type="button" class="p-copy" data-copy="' + esc(c.numero) + '">Copiar</button></div>';
        }).join("") + "</div>" : "") + "</section>" : "") +
      '<p class="p-foot">🔒 Este enlace es personal. No lo comparta.<br>' + esc(data.firma.nombre || "Ariango Consultores") + " · " + esc(data.firma.ciudad || "Cúcuta") + "</p>";
  }

  /* ---------- Eventos ---------- */
  document.addEventListener("click", function (e) {
    var d = e.target.closest("[data-doc]");
    if (d) { openDoc(data.docs.find(function (x) { return x.id === d.getAttribute("data-doc"); })); return; }
    var c = e.target.closest("[data-copy]");
    if (c) { navigator.clipboard && navigator.clipboard.writeText(c.getAttribute("data-copy")); toast("Número de cuenta copiado"); return; }
    var u = e.target.closest("[data-req]");
    if (u) upload(u);
  });

  /* ---------- Visor ---------- */
  var viewer = $("#viewer");
  function fit() {
    var box = $("#docfit"), doc = $("#docbox .acd");
    if (!doc) return;
    var w = viewer.querySelector(".p-viewer__body").clientWidth - 16;
    var natural = doc.offsetWidth;
    var s = Math.min(1, w / natural);
    box.style.width = natural + "px";
    box.style.transform = "scale(" + s + ")";
    box.style.height = doc.offsetHeight * s + "px";
    box.style.marginLeft = Math.max(8, (w + 16 - natural * s) / 2) + "px";
  }
  window.addEventListener("resize", fit);
  function openDoc(doc) {
    if (!doc) return;
    current = doc;
    $("#viewer-title").textContent = (doc.tipo === "libre" ? doc.data.titulo : D.TIPOS[doc.tipo]) + " · " + doc.numero;
    $("#docbox").innerHTML = D.render(doc, ctxFor(doc));
    viewer.hidden = false; document.body.style.overflow = "hidden";
    $(".p-viewer__body").scrollTop = 0;
    requestAnimationFrame(fit);
    var act = $("#viewer-actions");
    act.innerHTML = needsSign(doc) ? '<button type="button" class="p-btn p-btn--gold" id="go-sign">✍️ Firmar ' + esc((D.TIPOS[doc.tipo] || "documento").toLowerCase()) + "</button>" :
      doc.firma ? '<div class="p-signed">✓ Firmado el ' + D.fecha(doc.firma.fecha) + "</div>" : "";
    var gs = $("#go-sign"); if (gs) gs.addEventListener("click", openSign);
    if (!doc.vistoEn) fetch(base + "&action=view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docId: doc.id }) }).catch(function () {});
    var u = new URL(location.href); u.searchParams.set("doc", doc.id); history.replaceState(null, "", u);
  }
  $("[data-close-viewer]").addEventListener("click", function () {
    viewer.hidden = true; document.body.style.overflow = ""; current = null;
    var u = new URL(location.href); u.searchParams.delete("doc"); history.replaceState(null, "", u);
  });
  $("#viewer-pdf").addEventListener("click", function () {
    var holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff";
    holder.innerHTML = D.render(current, ctxFor(current));
    document.body.appendChild(holder);
    toast("Generando PDF…");
    D.pdf(holder.firstChild, (current.numero || "documento") + ".pdf").then(function () { holder.remove(); }, function () { holder.remove(); });
  });

  /* ---------- Firma ---------- */
  var sheet = $("#sign"), form = $("#sign-form"), canvas = $("#pad"), ctx2 = canvas.getContext("2d"), strokes = 0, drawing = false, last = null;
  function sizePad() {
    var r = canvas.getBoundingClientRect(), dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2.lineWidth = 2.6; ctx2.lineCap = "round"; ctx2.lineJoin = "round"; ctx2.strokeStyle = "#0A1A30";
    strokes = 0; $("#pad-hint").classList.remove("is-hidden");
  }
  function pt(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener("pointerdown", function (e) { e.preventDefault(); canvas.setPointerCapture(e.pointerId); drawing = true; last = pt(e); ctx2.beginPath(); ctx2.arc(last.x, last.y, 1.2, 0, Math.PI * 2); ctx2.fillStyle = "#0A1A30"; ctx2.fill(); $("#pad-hint").classList.add("is-hidden"); });
  canvas.addEventListener("pointermove", function (e) {
    if (!drawing) return;
    var p = pt(e), mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
    ctx2.beginPath(); ctx2.moveTo(last.x, last.y); ctx2.quadraticCurveTo(last.x, last.y, mid.x, mid.y); ctx2.lineTo(p.x, p.y); ctx2.stroke();
    last = p; strokes++;
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { canvas.addEventListener(ev, function () { drawing = false; }); });
  $("#pad-clear").addEventListener("click", function () { ctx2.clearRect(0, 0, canvas.width, canvas.height); strokes = 0; $("#pad-hint").classList.remove("is-hidden"); });

  function trimmedSignature() {
    var w = canvas.width, h = canvas.height, px = ctx2.getImageData(0, 0, w, h).data, minX = w, minY = h, maxX = 0, maxY = 0;
    for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) if (px[(y * w + x) * 4 + 3] > 10) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
    if (maxX <= minX) return canvas.toDataURL("image/png");
    var pad = 12, out = document.createElement("canvas");
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad); maxX = Math.min(w, maxX + pad); maxY = Math.min(h, maxY + pad);
    var sw = maxX - minX, sh = maxY - minY, scale = Math.min(1, 600 / sw);
    out.width = sw * scale; out.height = sh * scale;
    out.getContext("2d").drawImage(canvas, minX, minY, sw, sh, 0, 0, out.width, out.height);
    return out.toDataURL("image/png");
  }
  function openSign() {
    $("#sign-doc").textContent = (D.TIPOS[current.tipo] || "Documento") + " " + current.numero;
    form.nombre.value = form.nombre.value || data.cliente.nombre || "";
    form.documento.value = form.documento.value || data.cliente.cedula || "";
    $("#sign-msg").textContent = "";
    sheet.hidden = false;
    requestAnimationFrame(sizePad);
  }
  $$("[data-close-sign]").forEach(function (b) { b.addEventListener("click", function () { sheet.hidden = true; }); });
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var msg = $("#sign-msg"), btn = $("button[type=submit]", form);
    if (form.nombre.value.trim().length < 5) return (msg.textContent = "Escriba su nombre completo.");
    if (form.documento.value.trim().length < 4) return (msg.textContent = "Escriba su número de documento.");
    if (strokes < 8) return (msg.textContent = "Dibuje su firma en el recuadro.");
    if (!form.acepto.checked) return (msg.textContent = "Marque la casilla de aceptación.");
    btn.disabled = true; btn.textContent = "Firmando…";
    try {
      var r = await fetch(base + "&action=sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docId: current.id, nombre: form.nombre.value.trim(), documento: form.documento.value.trim(), acepto: true, imagen: trimmedSignature() }) });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || "No se pudo firmar");
      current.firma = j.firma; current.estado = "firmado";
      sheet.hidden = true;
      openDoc(current); render();
      celebrate();
    } catch (err) { msg.textContent = err.message; }
    btn.disabled = false; btn.textContent = "✍️ Firmar documento";
  });
  function celebrate() {
    var c = document.createElement("div");
    c.className = "p-celebrate";
    c.innerHTML = "<div><i>✓</i><h3>¡Documento firmado!</h3><p>Quedó registrado con fecha, hora y huella digital. Su abogado ya fue notificado.</p><button type=\"button\" class=\"p-btn p-btn--gold\">Continuar</button></div>";
    document.body.appendChild(c);
    c.querySelector("button").addEventListener("click", function () { c.remove(); });
  }

  /* ---------- Subir documentos ---------- */
  async function upload(btn) {
    var files = await window.ACUpload.pick("image/*,application/pdf", true);
    if (!files.length) return;
    var idx = btn.getAttribute("data-req");
    btn.classList.add("is-loading"); var label = btn.textContent; btn.textContent = "Enviando…";
    var ok = 0;
    for (var i = 0; i < files.length; i++) {
      try {
        var f = files[i];
        var body = /^image\/(jpeg|png|webp)$/.test(f.type) ? await window.ACUpload.compress(f, { maxSize: 2200 }) : f;
        if (body.size > 4 * 1024 * 1024) throw new Error("El archivo «" + f.name + "» pesa más de 4 MB.");
        var r = await fetch(base + "&action=upload&name=" + encodeURIComponent(f.name || "documento") + (idx !== "" && idx != null ? "&req=" + idx : ""), { method: "POST", headers: { "Content-Type": body.type || f.type }, body: body });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(j.error || "No se pudo enviar");
        ok++;
      } catch (e) { toast(e.message, true); }
    }
    btn.classList.remove("is-loading"); btn.textContent = label;
    if (ok) { toast("✓ " + ok + " archivo(s) enviado(s). Su abogado los revisará."); load(); }
  }

  load();
})();

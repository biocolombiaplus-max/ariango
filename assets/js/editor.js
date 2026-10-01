/* ==========================================================================
   Editor visual — se activa con /?editar=1 cuando hay sesión de administrador.
   Permite editar textos en la página, cambiar el logo y las imágenes de fondo.
   ========================================================================== */
(async function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var session = await fetch("/api/session", { credentials: "same-origin", cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return {}; });
  if (!session.authed) { location.href = "/admin/?next=editor"; return; }

  var AC = window.AC;
  var draft = JSON.parse(JSON.stringify(AC.getContent() || {}));
  draft.texts = draft.texts || {};
  draft.images = draft.images || {};
  draft.backgrounds = draft.backgrounds || {};
  var dirty = false;

  /* ---------- Estilos del editor ---------- */
  var css = document.createElement("style");
  css.textContent = [
    "body.ac-editing{padding-top:58px}",
    ".ac-bar{position:fixed;top:0;left:0;right:0;z-index:200;height:58px;display:flex;align-items:center;gap:10px;padding:0 14px;background:#040C1A;color:#fff;font:600 14px/1.2 Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4);border-bottom:1px solid rgba(235,203,151,.3)}",
    ".ac-bar__title{display:flex;align-items:center;gap:8px;color:#EBCB97;white-space:nowrap}",
    ".ac-bar__status{flex:1;color:rgba(255,255,255,.6);font-weight:500;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".ac-bar__status.is-dirty{color:#F0CD8E}",
    ".ac-bar button,.ac-bar a{border:0;border-radius:999px;padding:9px 14px;font:inherit;cursor:pointer;text-decoration:none;white-space:nowrap}",
    ".ac-bar .ac-save{background:linear-gradient(135deg,#F0CD8E,#CF9A55 40%,#A26C32);color:#040C1A}",
    ".ac-bar .ac-save[disabled]{opacity:.5}",
    ".ac-bar .ac-sec{background:rgba(255,255,255,.1);color:#fff}",
    "body.ac-editing .header{top:58px}",
    "body.ac-editing [data-e]{outline:1.5px dashed rgba(199,146,80,.55);outline-offset:3px;border-radius:4px;cursor:text;transition:outline-color .15s, background .15s}",
    "body.ac-editing [data-e]:hover{outline-color:#C79250;background:rgba(240,205,142,.12)}",
    "body.ac-editing [data-e]:focus{outline:2px solid #1FAF54;background:rgba(31,175,84,.08)}",
    "body.ac-editing [data-e].ac-changed{outline-color:#1FAF54}",
    "body.ac-editing [data-img]{outline:2px dashed #C79250;outline-offset:3px;cursor:pointer}",
    "body.ac-editing .reveal{opacity:1!important;transform:none!important}",
    "body.ac-editing .marquee__row{animation-play-state:paused}",
    ".ac-bgbtn{position:absolute;top:12px;right:12px;z-index:30;display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:999px;border:1px solid rgba(235,203,151,.6);background:rgba(4,12,26,.85);color:#EBCB97;font:600 12.5px Inter,system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(6px)}",
    ".ac-pop{position:absolute;top:52px;right:12px;z-index:31;width:260px;padding:14px;border-radius:16px;background:#fff;color:#141C2A;box-shadow:0 20px 50px rgba(0,0,0,.35);font:500 13px/1.4 Inter,system-ui,sans-serif;display:grid;gap:10px}",
    ".ac-pop b{font-size:13px}",
    ".ac-pop button{border:0;border-radius:10px;padding:9px 12px;font:600 13px Inter,system-ui,sans-serif;cursor:pointer;background:#F2EADC;color:#0A1A30}",
    ".ac-pop button.ac-primary{background:#0A1A30;color:#fff}",
    ".ac-pop input[type=range]{width:100%;accent-color:#A9733A}",
    ".ac-pop .ac-thumb{height:90px;border-radius:10px;background:#F2EADC center/cover no-repeat;display:grid;place-items:center;color:#667085;font-size:12px}",
    ".ac-note{position:relative;z-index:30;display:flex;align-items:center;justify-content:space-between;gap:10px;max-width:760px;margin:0 auto 22px;padding:12px 16px;border-radius:14px;background:#FBF3E6;border:1px dashed #C79250;color:#0A1A30;font:600 14px Inter,system-ui,sans-serif}",
    ".ac-note a{color:#fff;background:#0A1A30;padding:8px 12px;border-radius:999px;text-decoration:none;white-space:nowrap}",
    ".ac-fmt{position:fixed;z-index:210;display:flex;gap:4px;padding:5px;border-radius:12px;background:#040C1A;box-shadow:0 10px 30px rgba(0,0,0,.35)}",
    ".ac-fmt button{border:0;border-radius:8px;padding:6px 10px;background:transparent;color:#fff;font:700 13px Inter,system-ui,sans-serif;cursor:pointer}",
    ".ac-fmt button:hover{background:rgba(255,255,255,.12)}",
    ".ac-toast{position:fixed;left:50%;bottom:100px;transform:translateX(-50%);z-index:220;padding:12px 18px;border-radius:12px;background:#0A1A30;color:#fff;font:600 14px Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35)}",
    "@media(max-width:760px){.ac-bar__title span{display:none}.ac-bar{gap:6px;padding:0 8px}.ac-bar button,.ac-bar a{padding:8px 11px;font-size:13px}.ac-bar__status{font-size:12px}}"
  ].join("");
  document.head.appendChild(css);
  document.body.classList.add("ac-editing");

  /* ---------- Barra superior ---------- */
  var barEl = document.createElement("div");
  barEl.className = "ac-bar";
  barEl.innerHTML =
    '<div class="ac-bar__title">✏️ <span>Editor visual</span></div>' +
    '<div class="ac-bar__status">Toque cualquier texto con borde punteado para editarlo</div>' +
    '<a class="ac-sec" href="/admin/">Panel</a>' +
    '<button type="button" class="ac-sec ac-exit">Salir</button>' +
    '<button type="button" class="ac-save" disabled>Publicar</button>';
  document.body.appendChild(barEl);
  var statusEl = $(".ac-bar__status", barEl), saveBtn = $(".ac-save", barEl);

  function setDirty(on, text) {
    dirty = on;
    saveBtn.disabled = !on;
    statusEl.classList.toggle("is-dirty", on);
    statusEl.textContent = text || (on ? "Cambios sin publicar" : "Todo publicado");
  }
  function toast(t) {
    var el = document.createElement("div");
    el.className = "ac-toast"; el.textContent = t;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  /* ---------- Textos editables ---------- */
  function makeEditable(scope) {
    $$("[data-e]", scope).forEach(function (el) {
      if (el._acEditable) return;
      el._acEditable = true;
      el.setAttribute("contenteditable", "true");
      el.setAttribute("spellcheck", "true");
      el.addEventListener("input", function () {
        var key = el.getAttribute("data-e");
        draft.texts[key] = AC.sanitize(el.innerHTML);
        el.classList.add("ac-changed");
        $$('[data-e="' + key + '"]').forEach(function (o) { if (o !== el) o.innerHTML = draft.texts[key]; });
        setDirty(true);
      });
      el.addEventListener("paste", function (e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData("text/plain");
        document.execCommand("insertText", false, text);
      });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); document.execCommand("insertLineBreak"); }
      });
    });
  }
  makeEditable(document);
  new MutationObserver(function () { makeEditable(document); }).observe($("#team-featured"), { childList: true, subtree: true });

  // Abrir todos los desplegables para poder editarlos
  $$("details").forEach(function (d) { d.open = true; });
  $$("[data-faq]").forEach(function (d) { d.hidden = false; });

  // Bloquear navegación y acciones mientras se edita
  document.addEventListener("click", function (e) {
    if (e.target.closest(".ac-bar, .ac-pop, .ac-bgbtn, .ac-fmt, .ac-note a, [role=tab], .quiz, .wizard__back, .opt, .rail-nav")) return;
    var hit = e.target.closest("a, button, summary, [data-open-lead]");
    if (hit) { e.preventDefault(); e.stopPropagation(); }
    var img = e.target.closest("[data-img]");
    if (img) changeImage(img.getAttribute("data-img"));
  }, true);

  // Mini barra de formato (negrita, dorado, limpiar)
  var fmt = document.createElement("div");
  fmt.className = "ac-fmt"; fmt.hidden = true;
  fmt.innerHTML = '<button type="button" data-f="bold"><b>B</b></button><button type="button" data-f="gold" style="color:#F0CD8E">Dorado</button><button type="button" data-f="clear">Limpiar</button>';
  document.body.appendChild(fmt);
  fmt.addEventListener("mousedown", function (e) { e.preventDefault(); });
  fmt.addEventListener("click", function (e) {
    var b = e.target.closest("[data-f]");
    if (!b) return;
    var f = b.getAttribute("data-f");
    var sel = window.getSelection();
    if (!sel.rangeCount) return;
    if (f === "bold") document.execCommand("bold");
    if (f === "clear") document.execCommand("removeFormat");
    if (f === "gold") {
      var r = sel.getRangeAt(0), span = document.createElement("span");
      span.className = "gold-text";
      try { r.surroundContents(span); } catch (er) { span.textContent = r.toString(); r.deleteContents(); r.insertNode(span); }
    }
    var host = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement).closest("[data-e]");
    if (host) host.dispatchEvent(new Event("input"));
  });
  document.addEventListener("selectionchange", function () {
    var sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) { fmt.hidden = true; return; }
    var node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    if (!node || !node.closest("[data-e]")) { fmt.hidden = true; return; }
    var rect = sel.getRangeAt(0).getBoundingClientRect();
    fmt.hidden = false;
    fmt.style.top = Math.max(64, rect.top - 46) + "px";
    fmt.style.left = Math.max(8, Math.min(window.innerWidth - 220, rect.left)) + "px";
  });

  /* ---------- Logo ---------- */
  async function changeImage(key) {
    var files = await window.ACUpload.pick("image/png,image/jpeg,image/webp");
    if (!files.length) return;
    statusEl.textContent = "Subiendo imagen…";
    try {
      var url = await window.ACUpload.upload(files[0], { keepPng: true, maxSize: 800 });
      draft.images[key] = url;
      $$('[data-img="' + key + '"]').forEach(function (img) { img.src = url; });
      setDirty(true);
    } catch (err) { alert(err.message); setDirty(dirty); }
  }

  /* ---------- Fondos de sección ---------- */
  var openPop = null;
  $$("[data-bg]").forEach(function (sec) {
    var key = sec.getAttribute("data-bg");
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "ac-bgbtn"; btn.innerHTML = "🖼 Fondo";
    sec.appendChild(btn);
    btn.addEventListener("click", function () {
      if (openPop) { openPop.remove(); if (openPop._key === key) { openPop = null; return; } }
      var bg = draft.backgrounds[key] || {};
      var dark = sec.getAttribute("data-bg-tone") === "dark";
      var val = typeof bg.overlay === "number" ? bg.overlay : dark ? 0.78 : 0.86;
      var pop = document.createElement("div");
      pop.className = "ac-pop"; pop._key = key;
      pop.innerHTML = '<b>Fondo de la sección</b>' +
        '<div class="ac-thumb" style="' + (bg.url ? "background-image:url('" + bg.url + "')" : "") + '">' + (bg.url ? "" : "Sin imagen") + "</div>" +
        '<button type="button" class="ac-primary" data-a="up">Subir imagen</button>' +
        '<label>Capa de color sobre la imagen: <b data-v>' + Math.round(val * 100) + '%</b><input type="range" min="0.3" max="0.97" step="0.01" value="' + val + '"></label>' +
        '<small>Más capa = texto más legible. Recomendado entre 75% y 90%.</small>' +
        (bg.url ? '<button type="button" data-a="rm">Quitar imagen</button>' : "");
      sec.appendChild(pop);
      openPop = pop;
      function apply() { AC.applyContent(Object.assign({}, AC.getContent(), { texts: draft.texts, images: draft.images, backgrounds: draft.backgrounds })); }
      pop.addEventListener("click", async function (e) {
        var a = e.target.closest("[data-a]");
        if (!a) return;
        if (a.getAttribute("data-a") === "up") {
          var files = await window.ACUpload.pick("image/jpeg,image/png,image/webp");
          if (!files.length) return;
          a.textContent = "Subiendo…";
          try {
            var url = await window.ACUpload.upload(files[0], { maxSize: 2200 });
            draft.backgrounds[key] = { url: url, overlay: val };
            apply(); setDirty(true); pop.remove(); openPop = null;
          } catch (err) { alert(err.message); a.textContent = "Subir imagen"; }
        } else {
          delete draft.backgrounds[key];
          apply(); setDirty(true); pop.remove(); openPop = null;
        }
      });
      $("input", pop).addEventListener("input", function (e) {
        val = parseFloat(e.target.value);
        $("[data-v]", pop).textContent = Math.round(val * 100) + "%";
        if (draft.backgrounds[key]) { draft.backgrounds[key].overlay = val; apply(); setDirty(true); }
      });
    });
  });

  /* ---------- Avisos para secciones administradas desde el panel ---------- */
  [["#casos-exito", "Los casos de éxito se agregan y editan en el panel.", "/admin/#casos"], ["#equipo", "Los abogados del equipo y sus fotos se editan en el panel.", "/admin/#equipo"]].forEach(function (n) {
    var sec = $(n[0] + " .container");
    var note = document.createElement("div");
    note.className = "ac-note";
    note.innerHTML = "<span>" + n[1] + '</span><a href="' + n[2] + '">Abrir panel</a>';
    sec.insertBefore(note, sec.firstChild);
  });

  /* ---------- Guardar ---------- */
  saveBtn.addEventListener("click", async function () {
    saveBtn.disabled = true;
    statusEl.textContent = "Publicando…";
    try {
      var latest = await AC.loadContent(true);
      var payload = Object.assign({}, latest, { texts: draft.texts, images: draft.images, backgrounds: draft.backgrounds });
      var r = await fetch("/api/content", {
        method: "PUT", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-ac-admin": "1" },
        body: JSON.stringify(payload)
      });
      var data = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(data.error || "No se pudo publicar");
      $$(".ac-changed").forEach(function (el) { el.classList.remove("ac-changed"); });
      setDirty(false, "Publicado ✓ — los visitantes verán los cambios en menos de un minuto");
      toast("¡Cambios publicados!");
    } catch (err) {
      setDirty(true, "Error: " + err.message);
      if (/Sesión/.test(err.message)) location.href = "/admin/?next=editor";
    }
  });

  $(".ac-exit", barEl).addEventListener("click", function () {
    if (dirty && !confirm("Tiene cambios sin publicar. ¿Salir de todos modos?")) return;
    dirty = false;
    location.href = "/";
  });
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
})();

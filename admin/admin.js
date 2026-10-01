/* ==========================================================================
   Panel administrativo — Ariango Consultores
   ========================================================================== */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var DEF = window.AC_DEFAULTS || { team: [], cases: [] };
  var CFG = window.ARIANGO_CONFIG || {};

  var state = { session: {}, saved: {}, draft: {}, changed: {} };

  var SECTIONS = [
    ["inicio", "Portada (inicio)", "dark"], ["problema", "¿Le pasa esto?", "light"], ["facil", "Explicado fácil", "cream"],
    ["urgencia", "Entre más espere…", "dark"], ["servicios", "Servicios", "light"], ["test", "Test de 30 segundos", "cream"],
    ["proceso", "Cómo trabajamos", "dark"], ["casos-exito", "Casos de éxito", "light"], ["equipo", "Equipo", "cream"],
    ["marco-legal", "Marco legal", "light"], ["compromiso", "Compromiso", "dark"], ["documentos", "Documentos", "light"],
    ["faq", "Preguntas frecuentes", "cream"], ["contacto", "Contacto", "dark"]
  ];
  var CATS = ["Nulidad en Colombia", "Nulidad en Venezuela", "Doble registro", "Sucesión", "Sucesión binacional", "Corrección de registro civil", "Nacionalidad", "Derecho de familia"];

  /* ---------- Utilidades ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function toast(msg, err) {
    var t = $("#toast");
    t.textContent = msg; t.className = "toast" + (err ? " is-error" : ""); t.hidden = false;
    clearTimeout(t._h); t._h = setTimeout(function () { t.hidden = true; }, 3000);
  }
  async function api(path, opts) {
    opts = opts || {};
    opts.credentials = "same-origin";
    opts.headers = Object.assign({ "x-ac-admin": "1" }, opts.headers || {});
    var r = await fetch(path, opts);
    var data = await r.json().catch(function () { return {}; });
    if (r.status === 401 && path !== "/api/login") { showLogin(); throw new Error(data.error || "Sesión expirada"); }
    if (!r.ok) throw new Error(data.error || "Error " + r.status);
    return data;
  }
  function fmtDate(ms) {
    return new Date(ms).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
  }

  /* ---------- Estado ---------- */
  function cases() { return state.draft.cases || (state.draft.cases = clone(DEF.cases)); }
  function team() { return state.draft.team || (state.draft.team = clone(DEF.team)); }
  function mark(key) {
    state.changed[key] = true;
    $("#savebar").hidden = false;
  }
  function resetDraft() {
    state.draft = clone(state.saved);
    state.changed = {};
    $("#savebar").hidden = true;
  }

  /* ---------- Sesión ---------- */
  function showLogin() {
    $("#app").hidden = true; $("#login").hidden = false;
    $("#login-help").hidden = state.session.configured !== false;
    setTimeout(function () { $("#password").focus(); }, 50);
  }
  async function showApp() {
    $("#login").hidden = true; $("#app").hidden = false;
    var who = await fetch("/api/session", { credentials: "same-origin", cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return {}; });
    state.user = who.user || { rol: "admin", nombre: "Administrador" };
    state.session.storage = who.storage || state.session.storage;
    var lawyer = state.user.rol !== "admin";
    document.body.classList.toggle("is-lawyer", lawyer);
    $("#side-user").innerHTML = "<span>" + (lawyer ? "Abogado" : "Administrador") + "</span><b>" + esc(state.user.nombre || "") + "</b>";
    if (lawyer) {
      state.saved = {}; resetDraft();
      if (!location.hash || ["#clientes", "#perfil", "#inicio", "#docs"].indexOf(location.hash) < 0) location.hash = "clientes";
      route();
      return;
    }
    var c = await fetch("/api/content?fresh=1&t=" + Date.now(), { credentials: "same-origin", cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return {}; });
    state.saved = c || {};
    resetDraft();
    var banner = $("#mode-banner");
    if (state.session.storage === "local") {
      banner.hidden = false;
      banner.innerHTML = "🧪 <b>Modo de prueba local.</b> Los cambios se guardan en esta computadora. En Vercel, conecte <b>Storage → Blob</b> para guardarlos en línea.";
    }
    var next = new URLSearchParams(location.search).get("next");
    if (next === "editor") { location.href = "/?editar=1"; return; }
    route();
  }

  $("#login-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var msg = $(".login__msg"), btn = $("button[type=submit]", this);
    msg.textContent = ""; btn.disabled = true; btn.textContent = "Verificando…";
    try {
      await api("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: $("#email").value, password: $("#password").value }) });
      state.session.authed = true;
      $("#password").value = "";
      state.user = null;
      showApp();
    } catch (err) { msg.textContent = err.message; }
    btn.disabled = false; btn.textContent = "Ingresar";
  });
  $(".pw__toggle").addEventListener("click", function () {
    var i = $("#password"); i.type = i.type === "password" ? "text" : "password";
  });
  $("#logout").addEventListener("click", logout);
  async function logout() {
    if (Object.keys(state.changed).length && !confirm("Tiene cambios sin publicar. ¿Cerrar sesión de todos modos?")) return;
    await api("/api/logout", { method: "POST" }).catch(function () {});
    state.changed = {};
    location.href = "/admin/";
  }

  /* ---------- Publicar ---------- */
  $("#publish").addEventListener("click", async function () {
    var btn = this; btn.disabled = true; btn.textContent = "Publicando…";
    try {
      var latest = await fetch("/api/content?fresh=1&t=" + Date.now(), { credentials: "same-origin", cache: "no-store" }).then(function (r) { return r.json(); });
      var payload = Object.assign({}, latest);
      Object.keys(state.changed).forEach(function (k) {
        if (k === "*") Object.assign(payload, state.draft);
        else if (state.draft[k] === undefined) delete payload[k];
        else payload[k] = state.draft[k];
      });
      await api("/api/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      state.saved = payload;
      resetDraft();
      toast("✓ Publicado. El sitio se actualiza en menos de un minuto.");
      route();
    } catch (err) { toast(err.message, true); }
    btn.disabled = false; btn.textContent = "Publicar cambios";
  });
  $("#discard").addEventListener("click", function () {
    if (!confirm("¿Descartar los cambios sin publicar?")) return;
    resetDraft(); route();
  });
  window.addEventListener("beforeunload", function (e) { if (Object.keys(state.changed).length) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Navegación ---------- */
  var TITLES = { inicio: "Inicio", casos: "Casos de éxito", equipo: "Equipo de abogados", imagenes: "Imágenes y fondos", ajustes: "Ajustes", historial: "Historial de versiones" };
  window.addEventListener("hashchange", route);
  function route() {
    if ($("#app").hidden) return;
    var v = (location.hash || "#inicio").slice(1);
    if (!TITLES[v]) v = "inicio";
    if (state.user && state.user.rol !== "admin" && ["clientes", "perfil", "docs"].indexOf(v) < 0) v = "clientes";
    $("#view-title").textContent = TITLES[v];
    $$("[data-view]").forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("data-view") === v); });
    var view = $("#view"); view.className = "view view--" + v; VIEWS[v](view);
    window.scrollTo(0, 0);
  }

  /* ---------- Hoja de edición ---------- */
  var drawer = $("#drawer");
  function openDrawer(title, html, onOk, okLabel) {
    $("#drawer-title").textContent = title;
    $("#drawer-body").innerHTML = html;
    $("#drawer-ok").textContent = okLabel || "Guardar";
    drawer.hidden = false;
    drawer._ok = onOk;
    document.body.style.overflow = "hidden";
  }
  function closeDrawer() { drawer.hidden = true; document.body.style.overflow = ""; }
  $$("[data-close-drawer]", drawer).forEach(function (b) { b.addEventListener("click", closeDrawer); });
  $("#drawer-ok").addEventListener("click", function () { if (drawer._ok && drawer._ok($("#drawer-body")) !== false) closeDrawer(); });

  function field(name, label, value, opts) {
    opts = opts || {};
    var input = opts.textarea
      ? '<textarea name="' + name + '" rows="' + (opts.rows || 3) + '" placeholder="' + esc(opts.ph || "") + '">' + esc(value) + "</textarea>"
      : opts.options
        ? '<select name="' + name + '">' + opts.options.map(function (o) { return "<option" + (o === value ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select>"
        : '<input type="' + (opts.type || "text") + '" name="' + name + '" value="' + esc(value) + '" placeholder="' + esc(opts.ph || "") + '">';
    return '<div class="f"><label>' + label + "</label>" + input + (opts.help ? "<small>" + opts.help + "</small>" : "") + "</div>";
  }
  function check(name, label, on, help) {
    return '<label class="check"><input type="checkbox" name="' + name + '"' + (on ? " checked" : "") + "><span>" + label + (help ? "<small>" + help + "</small>" : "") + "</span></label>";
  }
  function readForm(root) {
    var o = {};
    $$("input[name], select[name], textarea[name]", root).forEach(function (el) {
      o[el.name] = el.type === "checkbox" ? el.checked : el.value.trim();
    });
    return o;
  }

  /* Subida de imágenes dentro de un formulario */
  function uploaderHtml(urls, max) {
    return '<div class="uploader" data-max="' + max + '">' +
      urls.map(function (u) { return thumbHtml(u); }).join("") +
      (urls.length < max ? '<button type="button" class="up-add">＋<br>Agregar</button>' : "") + "</div>";
  }
  function thumbHtml(u) {
    return /\.pdf($|\?)/i.test(u)
      ? '<div class="up-img up-img--pdf" data-url="' + esc(u) + '">PDF<button type="button" aria-label="Quitar">✕</button></div>'
      : '<div class="up-img" data-url="' + esc(u) + '" style="background-image:url(\'' + esc(u) + '\')"><button type="button" aria-label="Quitar">✕</button></div>';
  }
  function bindUploader(root, opts) {
    var box = $(".uploader", root);
    box.addEventListener("click", async function (e) {
      var rm = e.target.closest(".up-img button");
      if (rm) { rm.parentNode.remove(); refresh(); return; }
      var add = e.target.closest(".up-add");
      if (!add) return;
      var max = +box.getAttribute("data-max");
      var files = await window.ACUpload.pick(opts.accept || "image/*", max > 1);
      files = files.slice(0, max - $$(".up-img", box).length);
      if (!files.length) return;
      add.classList.add("is-loading"); add.innerHTML = "Subiendo…";
      for (var i = 0; i < files.length; i++) {
        try {
          var url = await window.ACUpload.upload(files[i], opts);
          add.insertAdjacentHTML("beforebegin", thumbHtml(url));
        } catch (err) { toast(err.message, true); }
      }
      add.classList.remove("is-loading"); add.innerHTML = "＋<br>Agregar";
      refresh();
    });
    function refresh() {
      var max = +box.getAttribute("data-max"), add = $(".up-add", box), n = $$(".up-img", box).length;
      if (n >= max && add) add.remove();
      if (n < max && !add) box.insertAdjacentHTML("beforeend", '<button type="button" class="up-add">＋<br>Agregar</button>');
    }
  }
  /* Ajuste de encuadre de la primera foto de un formulario */
  function fitBtn() { return '<button type="button" class="btn btn--gold btn--sm fit-btn" data-fit-open>✂️ Ajustar cómo se ve la foto</button><small class="fit-state"></small>'; }
  function bindFit(root, enc, title, frames) {
    root._enc = enc || null;
    var btn = $("[data-fit-open]", root), stt = $(".fit-state", root);
    function first() { var u = uploaderValue(root)[0] || ""; return /\.pdf($|\?)/i.test(u) ? "" : u; }
    function show() {
      var u = first();
      btn.hidden = !u;
      stt.textContent = u && root._enc && root._enc.url === u ? "✓ Foto ajustada" : "";
      var th = u && $('.up-img[data-url="' + u.replace(/"/g, "") + '"]', root);
      if (th) th.setAttribute("style", "background-image:url('" + esc(u) + "');" + (root._enc && root._enc.url === u ? window.ACFrame.bgStyle(root._enc) : ""));
    }
    btn.onclick = async function () {
      var u = first(); if (!u) return;
      var r = await window.ACFrame.open({ url: u, title: title, frames: frames, value: root._enc && root._enc.url === u ? root._enc : null, fill: "#0A1A30" });
      if (r) { root._enc = Object.assign({ url: u }, r); show(); }
    };
    new MutationObserver(show).observe($(".uploader", root), { childList: true });
    show();
  }
  function fitVal(root, url) { return root._enc && url && root._enc.url === url ? root._enc : null; }
  function uploaderValue(root) { return $$(".up-img", root).map(function (d) { return d.getAttribute("data-url"); }); }

  /* Listas ordenables */
  function listActions(i, n, hidden) {
    return '<div class="item__actions">' +
      '<button type="button" class="icon" data-act="up" data-i="' + i + '" title="Subir"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
      '<button type="button" class="icon" data-act="down" data-i="' + i + '" title="Bajar"' + (i === n - 1 ? " disabled" : "") + ">↓</button>" +
      '<button type="button" class="icon" data-act="toggle" data-i="' + i + '" title="' + (hidden ? "Mostrar" : "Ocultar") + '">' + (hidden ? "🙈" : "👁") + "</button>" +
      '<button type="button" class="icon" data-act="edit" data-i="' + i + '" title="Editar">✏️</button>' +
      '<button type="button" class="icon icon--danger" data-act="del" data-i="' + i + '" title="Eliminar">🗑</button></div>';
  }
  function bindList(root, arr, key, onEdit) {
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var i = +b.getAttribute("data-i"), act = b.getAttribute("data-act"), list = arr();
      if (act === "up" && i > 0) list.splice(i - 1, 0, list.splice(i, 1)[0]);
      if (act === "down" && i < list.length - 1) list.splice(i + 1, 0, list.splice(i, 1)[0]);
      if (act === "toggle") list[i].visible = list[i].visible === false;
      if (act === "del") { if (!confirm("¿Eliminar este elemento?")) return; list.splice(i, 1); }
      if (act === "edit") { onEdit(i); return; }
      mark(key); route();
    });
  }

  /* ==========================================================================
     Vistas
     ========================================================================== */
  var VIEWS = {};

  VIEWS.inicio = function (v) {
    var c = cases(), t = team();
    var bgCount = Object.keys(state.draft.backgrounds || {}).length;
    var real = c.filter(function (x) { return x.real && x.visible !== false; }).length;
    var updated = state.saved.updatedAt ? fmtDate(state.saved.updatedAt) : "Aún sin publicar";
    var sheet = (state.draft.settings || {}).sheetUrl;
    v.innerHTML =
      '<div class="card hello"><h2>¡Bienvenido! 👋</h2><p>Desde aquí administra todo el contenido de <b>ariangoconsultores.com</b>. Los cambios se publican al tocar <b>“Publicar cambios”</b>.</p></div>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + c.length + "</b><span>casos de éxito (" + real + " reales)</span></div>" +
      '<div class="stat"><b>' + t.length + "</b><span>abogados en el equipo</span></div>" +
      '<div class="stat"><b>' + bgCount + "</b><span>fondos personalizados</span></div>" +
      '<div class="stat"><b style="font-size:1rem;font-family:inherit">' + esc(updated) + "</b><span>última publicación</span></div></div>" +
      '<div class="quick">' +
      '<a href="/?editar=1"><span>✏️</span><b>Editor visual</b><small>Cambie cualquier texto tocándolo en la página</small></a>' +
      '<button type="button" data-go="casos" data-new><span>🏆</span><b>Nuevo caso de éxito</b><small>Con fotos de documentos reales</small></button>' +
      '<button type="button" data-go="equipo" data-new><span>👤</span><b>Agregar abogado</b><small>Foto, cargo y especialidad</small></button>' +
      '<a href="#imagenes"><span>🖼</span><b>Fondos y logo</b><small>Imágenes premium por sección</small></a>' +
      (sheet ? '<a href="' + esc(sheet) + '" target="_blank" rel="noopener"><span>📊</span><b>Ver solicitudes</b><small>Base de datos de clientes</small></a>' : '<a href="#ajustes"><span>📊</span><b>Conectar solicitudes</b><small>Google Sheets y correo</small></a>') +
      '<a href="#historial"><span>🕘</span><b>Historial</b><small>Restaure una versión anterior</small></a></div>' +
      '<div class="card"><h2>Recomendaciones para un sitio que vende más</h2><ul class="tips">' +
      "<li>Publique <b>casos reales</b> con autorización escrita del cliente y <b>tache</b> nombres, números de documento, firmas y fotos.</li>" +
      "<li>Suba una <b>foto profesional</b> del Dr. Walter y de cada abogado: genera confianza inmediata.</li>" +
      "<li>Use fondos <b>sobrios</b> (oficina, Cúcuta, documentos, frontera) y deje la capa de color entre 75% y 90% para que el texto se lea bien.</li>" +
      "<li>Evite prometer resultados o tiempos exactos (Código Disciplinario del Abogado, Ley 1123 de 2007).</li></ul></div>";
    $$("[data-go]", v).forEach(function (b) {
      b.addEventListener("click", function () {
        location.hash = b.getAttribute("data-go");
        setTimeout(function () { (b.getAttribute("data-go") === "casos" ? editCase : editLawyer)(-1); }, 50);
      });
    });
  };

  /* ---------- Casos de éxito ---------- */
  VIEWS.casos = function (v) {
    var list = cases();
    v.innerHTML =
      '<div class="list-head"><p class="muted" style="margin:0">Se muestran en la sección “Casos de éxito”, en este orden.</p><button type="button" class="btn btn--gold" id="add-case">＋ Nuevo caso</button></div>' +
      '<div class="items" id="case-list">' + (list.length ? list.map(function (c, i) {
        var img = (c.imagenes || []).filter(function (u) { return !/\.pdf/i.test(u); })[0];
        return '<div class="item' + (c.visible === false ? " is-hidden" : "") + '">' +
          '<div class="item__thumb" style="' + (img ? "background-image:url('" + esc(img) + "')" : "") + '">' + (img ? "" : "📄") + "</div>" +
          '<div class="item__main"><b>' + esc(c.titulo || "(sin título)") + "</b><small>" + esc(c.categoria) + (c.ciudad ? " · " + esc(c.ciudad) : "") + "</small>" +
          '<div class="tags">' + (c.real ? '<span class="tag tag--ok">✓ Caso real</span>' : '<span class="tag tag--warn">Ilustrativo</span>') +
          '<span class="tag">' + (c.imagenes || []).length + " archivo(s)</span>" + (c.visible === false ? '<span class="tag tag--off">Oculto</span>' : "") + "</div></div>" +
          listActions(i, list.length, c.visible === false) + "</div>";
      }).join("") : '<div class="empty">Aún no hay casos. Agregue el primero.</div>') + "</div>";
    $("#add-case", v).addEventListener("click", function () { editCase(-1); });
    bindList($("#case-list", v), cases, "cases", editCase);
  };
  function editCase(i) {
    var c = i >= 0 ? cases()[i] : { id: uid(), visible: true, real: true, categoria: CATS[0], imagenes: [] };
    openDrawer(i >= 0 ? "Editar caso de éxito" : "Nuevo caso de éxito",
      '<div class="form">' +
      '<div class="warn">🔒 <b>Antes de publicar:</b> obtenga autorización escrita del cliente y tache nombres, números de documento, NUIP, firmas y huellas en las imágenes (Ley 1581 de 2012 y secreto profesional).</div>' +
      '<div class="f"><label>Imágenes de documentos (hasta 6)</label>' + uploaderHtml(c.imagenes || [], 6) + "<small>JPG, PNG o PDF. Las fotos se optimizan automáticamente. La primera es la portada del caso.</small>" + fitBtn() + "</div>" +
      field("categoria", "Categoría", c.categoria, { options: CATS.indexOf(c.categoria) < 0 ? [c.categoria].concat(CATS) : CATS }) +
      field("titulo", "Título del caso", c.titulo, { ph: "Ej. Nació en San Cristóbal, pero estaba registrada en Cúcuta" }) +
      field("situacion", "Situación (el problema)", c.situacion, { textarea: true, rows: 2 }) +
      field("solucion", "Solución (lo que hicimos)", c.solucion, { textarea: true, rows: 2 }) +
      field("resultado", "Resultado", c.resultado, { textarea: true, rows: 2 }) +
      '<div class="grid2">' + field("ciudad", "Ciudad", c.ciudad, { ph: "Cúcuta" }) + field("tiempo", "Tiempo del trámite (opcional)", c.tiempo, { ph: "Ej. 4 meses" }) + "</div>" +
      field("testimonio", "Testimonio del cliente (opcional)", c.testimonio, { textarea: true, rows: 2, ph: "Palabras del cliente, con su autorización" }) +
      field("cliente", "Nombre a mostrar (opcional)", c.cliente, { ph: "Ej. M. P., Cúcuta", help: "Use iniciales para proteger la identidad." }) +
      check("real", "Es un caso real autorizado por el cliente", c.real !== false, "Si lo desmarca, se mostrará con la etiqueta “Caso ilustrativo”.") +
      check("visible", "Mostrar en el sitio", c.visible !== false) + "</div>",
      function (root) {
        var o = readForm(root);
        if (!o.titulo) { toast("Escriba un título", true); return false; }
        var item = Object.assign({}, c, o, { imagenes: uploaderValue(root) });
        item.enc = fitVal(root, item.imagenes[0]); if (!item.enc) delete item.enc;
        if (i >= 0) cases()[i] = item; else cases().unshift(item);
        mark("cases"); route();
        toast("Caso guardado. Recuerde publicar.");
      });
    bindUploader($("#drawer-body"), { accept: "image/jpeg,image/png,image/webp,application/pdf", maxSize: 2200 });
    bindFit($("#drawer-body"), c.enc, "Portada del caso", [{ id: "a", label: "Portada en la página", ratio: 16 / 10 }]);
  }

  /* ---------- Equipo ---------- */
  VIEWS.equipo = function (v) {
    var list = team();
    v.innerHTML =
      '<div class="list-head"><p class="muted" style="margin:0">El abogado marcado como <b>destacado</b> aparece en grande; los demás, en tarjetas.</p><button type="button" class="btn btn--gold" id="add-law">＋ Agregar abogado</button></div>' +
      '<div class="items" id="law-list">' + (list.length ? list.map(function (p, i) {
        return '<div class="item' + (p.visible === false ? " is-hidden" : "") + '">' +
          '<div class="item__thumb item__thumb--round" style="' + (p.foto ? "background-image:url('" + esc(p.foto) + "');" + (p.enc && p.enc.url === p.foto ? window.ACFrame.bgStyle(p.enc) : "") : "") + '">' + (p.foto ? "" : "👤") + "</div>" +
          '<div class="item__main"><b>' + esc(p.nombre) + "</b><small>" + esc(p.cargo) + "</small>" +
          '<div class="tags">' + (p.destacado ? '<span class="tag tag--ok">★ Destacado</span>' : "") + (p.visible === false ? '<span class="tag tag--off">Oculto</span>' : "") + (!p.foto ? '<span class="tag tag--warn">Sin foto</span>' : "") + "</div></div>" +
          listActions(i, list.length, p.visible === false) + "</div>";
      }).join("") : '<div class="empty">Aún no hay abogados.</div>') + "</div>";
    $("#add-law", v).addEventListener("click", function () { editLawyer(-1); });
    bindList($("#law-list", v), team, "team", editLawyer);
  };
  function editLawyer(i) {
    var p = i >= 0 ? team()[i] : { id: uid(), visible: true, destacado: false };
    openDrawer(i >= 0 ? "Editar abogado" : "Nuevo abogado",
      '<div class="form">' +
      '<div class="f"><label>Foto profesional</label>' + uploaderHtml(p.foto ? [p.foto] : [], 1) + "<small>Ideal: foto vertical, fondo neutro, buena luz.</small>" + fitBtn() + "</div>" +
      field("nombre", "Nombre completo", p.nombre, { ph: "Dr. / Dra. …" }) +
      field("cargo", "Cargo", p.cargo, { ph: "Abogado(a) especialista en…" }) +
      field("especialidad", "Especialidad", p.especialidad, { ph: "Registro civil, familia, sucesiones…" }) +
      field("tarjeta", "Tarjeta profesional (opcional)", p.tarjeta, { ph: "Número de T.P." }) +
      field("bio", "Reseña breve", p.bio, { textarea: true, rows: 3 }) +
      check("destacado", "Abogado destacado (aparece en grande)", !!p.destacado) +
      check("visible", "Mostrar en el sitio", p.visible !== false) + "</div>",
      function (root) {
        var o = readForm(root);
        if (!o.nombre) { toast("Escriba el nombre", true); return false; }
        var item = Object.assign({}, p, o, { foto: uploaderValue(root)[0] || "" });
        item.enc = fitVal(root, item.foto); if (!item.enc) delete item.enc;
        if (item.destacado) team().forEach(function (x) { x.destacado = false; });
        if (i >= 0) team()[i] = item; else team().push(item);
        mark("team"); route();
        toast("Guardado. Recuerde publicar.");
      });
    bindUploader($("#drawer-body"), { accept: "image/jpeg,image/png,image/webp", maxSize: 1400 });
    bindFit($("#drawer-body"), p.enc, "Foto del abogado", [{ id: "a", label: "Foto destacada", ratio: 4 / 5 }, { id: "b", label: "Tarjeta del equipo", ratio: 1 }]);
  }

  /* ---------- Imágenes y fondos ---------- */
  VIEWS.imagenes = function (v) {
    var imgs = state.draft.images || {}, bgs = state.draft.backgrounds || {};
    v.innerHTML =
      '<div class="card"><h2>Logo</h2><p class="muted">Se usa en el encabezado, el pie de página y la portada. Recomendado: PNG con fondo transparente.</p>' +
      '<div class="logo-box"><div class="logo-box__prev"><img src="' + esc(imgs.logo || "/assets/img/logo-ac.png") + '" alt="Logo"></div>' +
      '<div style="display:grid;gap:8px"><button type="button" class="btn btn--navy" id="logo-up">Subir nuevo logo</button>' +
      (imgs.logo ? '<button type="button" class="btn btn--line" id="logo-rm">Volver al logo original</button>' : "") + "</div></div></div>" +
      '<div class="card"><h2>Fondos de cada sección</h2><p class="muted">Suba una imagen de fondo para cualquier sección. Se aplica una capa de color encima para que el texto siempre se lea bien.</p>' +
      '<div class="bgs">' + SECTIONS.map(function (s) {
        var b = bgs[s[0]] || {}, dark = s[2] === "dark";
        var ov = typeof b.overlay === "number" ? b.overlay : dark ? 0.78 : 0.86;
        var col = dark ? "rgba(7,19,38," + ov + ")" : "rgba(250,246,239," + ov + ")";
        return '<div class="bg" data-key="' + s[0] + '" data-dark="' + (dark ? 1 : 0) + '">' +
          '<div class="bg__prev" style="--ov:' + col + ";" + (b.url ? "background-image:url('" + esc(b.url) + "');background-color:" + (dark ? "#0A1A30" : "#FAF6EF") + ";" + window.ACFrame.bgStyle(b.enc) : "background:" + (dark ? "#0A1A30" : s[2] === "cream" ? "#FAF6EF" : "#fff")) + ";color:" + (dark ? "#fff" : "#0A1A30") + '"><span>' + esc(s[1]) + "</span></div>" +
          '<div class="bg__body">' + (b.url ? '<label>Capa de color: <b>' + Math.round(ov * 100) + '%</b><input type="range" min="0.3" max="0.97" step="0.01" value="' + ov + '"></label>' : '<small class="muted">Sin imagen (usa el color de la marca)</small>') +
          '<div class="bg__actions">' + (b.url ? '<button type="button" class="btn btn--gold btn--sm" data-bg-fit>✂️ Ajustar foto</button>' : "") + '<button type="button" class="btn btn--navy btn--sm" data-bg-up>' + (b.url ? "Cambiar" : "Subir imagen") + "</button>" + (b.url ? '<button type="button" class="btn btn--line btn--sm" data-bg-rm>Quitar</button>' : "") + "</div>" +
          (b.url && (b.enc || b.encM) ? '<small class="muted">✓ Foto ajustada' + (b.encM ? " (computador y celular por separado)" : "") + "</small>" : "") + "</div></div>";
      }).join("") + "</div></div>";

    $("#logo-up", v).addEventListener("click", async function () {
      var f = await window.ACUpload.pick("image/png,image/webp,image/jpeg");
      if (!f.length) return;
      this.textContent = "Subiendo…";
      try {
        var url = await window.ACUpload.upload(f[0], { keepPng: true, maxSize: 800 });
        state.draft.images = Object.assign({}, state.draft.images, { logo: url });
        mark("images"); route();
      } catch (e) { toast(e.message, true); this.textContent = "Subir nuevo logo"; }
    });
    var rmLogo = $("#logo-rm", v);
    if (rmLogo) rmLogo.addEventListener("click", function () {
      state.draft.images = Object.assign({}, state.draft.images); delete state.draft.images.logo;
      mark("images"); route();
    });
    $$(".bg", v).forEach(function (card) {
      var key = card.getAttribute("data-key");
      $("[data-bg-up]", card).addEventListener("click", async function () {
        var f = await window.ACUpload.pick("image/jpeg,image/png,image/webp");
        if (!f.length) return;
        this.textContent = "Subiendo…";
        try {
          var url = await window.ACUpload.upload(f[0], { maxSize: 2200 });
          state.draft.backgrounds = Object.assign({}, state.draft.backgrounds);
          var prev = state.draft.backgrounds[key] || {};
          state.draft.backgrounds[key] = { url: url, overlay: typeof prev.overlay === "number" ? prev.overlay : card.getAttribute("data-dark") === "1" ? 0.78 : 0.86 };
          mark("backgrounds"); route();
        } catch (e) { toast(e.message, true); this.textContent = "Subir imagen"; }
      });
      var fit = $("[data-bg-fit]", card);
      if (fit) fit.addEventListener("click", async function () {
        var b = state.draft.backgrounds[key], dark = card.getAttribute("data-dark") === "1";
        var ov = typeof b.overlay === "number" ? b.overlay : dark ? 0.78 : 0.86;
        var name = (SECTIONS.find(function (x) { return x[0] === key; }) || [])[1];
        var r = await window.ACFrame.open({
          url: b.url, title: "Fondo: " + (name || key), separate: true, value: { d: b.enc, m: b.encM },
          frames: [{ id: "d", label: "💻 Computador", ratio: 16 / 9 }, { id: "m", label: "📱 Celular", ratio: 1 / 2 }],
          overlay: dark ? "rgba(7,19,38," + ov + ")" : "rgba(250,246,239," + ov + ")", fill: dark ? "#0A1A30" : "#FAF6EF"
        });
        if (!r) return;
        state.draft.backgrounds = Object.assign({}, state.draft.backgrounds);
        var nb = Object.assign({}, b, { enc: r.d }); if (r.m) nb.encM = r.m; else delete nb.encM;
        state.draft.backgrounds[key] = nb;
        mark("backgrounds"); route(); toast("Ajuste guardado. Recuerde publicar.");
      });
      var rm = $("[data-bg-rm]", card);
      if (rm) rm.addEventListener("click", function () {
        state.draft.backgrounds = Object.assign({}, state.draft.backgrounds); delete state.draft.backgrounds[key];
        mark("backgrounds"); route();
      });
      var range = $("input[type=range]", card);
      if (range) range.addEventListener("input", function () {
        var ov = parseFloat(range.value), dark = card.getAttribute("data-dark") === "1";
        state.draft.backgrounds = Object.assign({}, state.draft.backgrounds);
        state.draft.backgrounds[key] = Object.assign({}, state.draft.backgrounds[key], { overlay: ov });
        $(".bg__prev", card).style.setProperty("--ov", dark ? "rgba(7,19,38," + ov + ")" : "rgba(250,246,239," + ov + ")");
        $("label b", card).textContent = Math.round(ov * 100) + "%";
        mark("backgrounds");
      });
    });
  };

  /* ---------- Ajustes ---------- */
  VIEWS.ajustes = function (v) {
    var s = Object.assign({}, CFG, state.draft.settings || {});
    v.innerHTML =
      '<div class="quick"><a href="/?editar=1"><span>✏️</span><b>Editor visual</b><small>Editar textos de la página</small></a>' +
      '<a href="#documentos"><span>🏦</span><b>Documentos y cuentas</b><small>Firma, cuentas, plantillas</small></a>' +
      '<a href="#equipo"><span>👥</span><b>Equipo</b><small>Abogados y fotos</small></a>' +
      '<a href="#historial"><span>🕘</span><b>Historial</b><small>Versiones anteriores</small></a>' +
      '<button type="button" id="logout2"><span>🚪</span><b>Cerrar sesión</b><small>Salir del panel</small></button></div>' +
      '<div class="card"><h2>Contacto</h2><p class="muted">Se actualiza en toda la página y en el mensaje de WhatsApp.</p><div class="form" id="set-contact">' +
      '<div class="grid2">' +
      field("whatsapp", "WhatsApp (formato internacional)", s.whatsapp, { ph: "573156002993", help: "Solo números, con 57 al inicio." }) +
      field("whatsappVisible", "WhatsApp como se muestra", s.whatsappVisible, { ph: "+57 315 600 2993" }) +
      field("phone", "Teléfono para llamadas", s.phone, { type: "tel", ph: "+573156002993" }) +
      field("email", "Correo", s.email, { type: "email" }) + "</div>" +
      field("address", "Dirección de la oficina", s.address, { ph: "Calle …, Cúcuta, Norte de Santander" }) +
      field("hours", "Horario de atención", s.hours, { ph: "Lunes a viernes 8:00 a. m. – 6:00 p. m." }) +
      field("mapQuery", "Dirección para el mapa", s.mapQuery, { ph: "Ej. Avenida 0 # 10-20, Cúcuta", help: "Déjelo vacío para mostrar Cúcuta en general." }) +
      field("waIntro", "Saludo del mensaje de WhatsApp", s.waIntro, { ph: "Hola, Ariango Consultores 👋" }) + "</div></div>" +
      '<div class="card"><h2>Solicitudes de clientes</h2><p class="muted">Dónde se guardan los datos que dejan las personas.</p><div class="form" id="set-leads">' +
      field("googleSheetsEndpoint", "URL de Google Apps Script (/exec)", s.googleSheetsEndpoint, { type: "url", ph: "https://script.google.com/macros/s/…/exec", help: "Ver google-apps-script/Code.gs en el README." }) +
      field("sheetUrl", "Enlace de la hoja de Google Sheets (para abrirla desde el panel)", s.sheetUrl, { type: "url", ph: "https://docs.google.com/spreadsheets/…" }) +
      check("formSubmitEnabled", "Enviar aviso por correo de cada solicitud (FormSubmit)", s.formSubmitEnabled !== false, "La primera vez llega un correo de activación que hay que confirmar.") + "</div></div>" +
      '<div class="card"><h2>Medición de campañas</h2><div class="form grid2" id="set-ads">' +
      field("ga4Id", "Google Analytics 4", s.ga4Id, { ph: "G-XXXXXXXXXX" }) +
      field("metaPixelId", "Pixel de Meta (Facebook / Instagram)", s.metaPixelId, { ph: "123456789012345" }) + "</div></div>";
    $("#logout2", v).addEventListener("click", logout);
    $$("input, select, textarea", v).forEach(function (el) {
      el.addEventListener("input", saveSettings);
      el.addEventListener("change", saveSettings);
    });
    function saveSettings() {
      var o = Object.assign(readForm($("#set-contact", v)), readForm($("#set-leads", v)), readForm($("#set-ads", v)));
      o.whatsapp = (o.whatsapp || "").replace(/\D/g, "");
      state.draft.settings = o;
      mark("settings");
    }
  };

  /* ---------- Historial ---------- */
  VIEWS.historial = async function (v) {
    v.innerHTML = '<div class="card"><p class="muted" style="margin:0">Cada vez que publica se guarda una copia. Puede volver a cualquiera de las últimas 40 versiones.</p></div><div class="hist" id="hist"><div class="empty">Cargando…</div></div>';
    try {
      var data = await api("/api/history");
      var box = $("#hist", v);
      if (!data.items.length) { box.innerHTML = '<div class="empty">Aún no hay versiones publicadas.</div>'; return; }
      box.innerHTML = data.items.map(function (it, i) {
        return '<div class="hist__row"><div><b>' + esc(fmtDate(it.savedAt)) + "</b>" + (i === 0 ? ' <span class="tag tag--ok">Actual</span>' : "") + '<br><small class="muted">' + Math.round(it.size / 1024 * 10) / 10 + " KB</small></div>" +
          (i === 0 ? "" : '<button type="button" class="btn btn--line btn--sm" data-v="' + esc(it.version) + '">Restaurar</button>') + "</div>";
      }).join("");
      $$("[data-v]", box).forEach(function (b) {
        b.addEventListener("click", async function () {
          if (!confirm("¿Cargar esta versión? Podrá revisarla y luego publicarla.")) return;
          var c = await api("/api/content?version=" + encodeURIComponent(b.getAttribute("data-v")));
          delete c.updatedAt;
          state.draft = c; state.changed = { "*": true };
          ["texts", "images", "backgrounds", "cases", "team", "settings"].forEach(function (k) { state.changed[k] = true; });
          $("#savebar").hidden = false;
          toast("Versión cargada. Toque “Publicar cambios” para aplicarla.");
          location.hash = "inicio";
        });
      });
    } catch (e) { $("#hist", v).innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; }
  };

  /* API para módulos adicionales (CRM, documentos) */
  window.ACAdmin = {
    VIEWS: VIEWS, TITLES: TITLES, state: state, toast: toast, api: api, esc: esc, uid: uid, route: route,
    team: function () { return team(); }, fmtDate: fmtDate
  };

  /* ---------- Arranque ---------- */
  fetch("/api/session", { credentials: "same-origin", cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (s) { state.session = s; if (s.user) showApp(); else showLogin(); })
    .catch(function () {
      state.session = { configured: false };
      showLogin();
      $(".login__msg").textContent = "No se pudo conectar con el servidor. Publique el sitio en Vercel para usar el panel.";
    });
})();

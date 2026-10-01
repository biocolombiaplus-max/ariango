/* ==========================================================================
   Ariango Consultores — interacción, contenido administrable,
   captura de datos y redirección a WhatsApp
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.ARIANGO_CONFIG || {};
  var DEF = window.AC_DEFAULTS || { team: [], cases: [] };
  var CONTENT = {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function settings() {
    var s = {}, k;
    for (k in CFG) s[k] = CFG[k];
    var o = CONTENT.settings || {};
    for (k in o) if (o[k] !== "" && o[k] !== null && o[k] !== undefined) s[k] = o[k];
    return s;
  }

  /* ---------- Utilidades de seguridad ---------- */
  var ALLOWED = { B: 1, STRONG: 1, EM: 1, I: 1, U: 1, BR: 1, SPAN: 1 };
  function sanitize(html) {
    var tpl = document.createElement("template");
    tpl.innerHTML = String(html || "");
    (function walk(node) {
      $$("*", node).reverse().forEach(function (el) {
        if (!ALLOWED[el.tagName]) {
          el.replaceWith(document.createTextNode(el.textContent));
          return;
        }
        var cls = el.getAttribute("class");
        while (el.attributes.length) el.removeAttribute(el.attributes[0].name);
        if (el.tagName === "SPAN" && cls && /(^|\s)(gold-text|red-text)(\s|$)/.test(cls)) el.className = cls.match(/gold-text|red-text/)[0];
      });
    })(tpl.content);
    return tpl.innerHTML;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) {
    u = String(u || "").trim();
    return /^(https:\/\/|\/|assets\/)/.test(u) && !/["'()\\\s]/.test(u) ? u : "";
  }

  /* ---------- Asistentes (wizard) ---------- */
  var tpl = $("#tpl-wizard");
  $$("[data-wizard]").forEach(function (host) {
    var node = tpl.content.cloneNode(true);
    var form = node.querySelector("form");
    var id = host.getAttribute("data-wizard");
    form.setAttribute("data-source", id);
    if (host.hasAttribute("data-wizard-full")) form.classList.add("wizard--full");
    $$("input, select, textarea", form).forEach(function (el) {
      if (el.type === "hidden" || el.classList.contains("hp")) return;
      el.id = "w-" + id + "-" + el.name;
      var lab = el.closest(".field") && el.closest(".field").querySelector("label");
      if (lab) lab.setAttribute("for", el.id);
    });
    host.appendChild(node);
    setupWizard(form);
  });

  function setupWizard(form) {
    var s1 = $('[data-step="1"]', form), s2 = $('[data-step="2"]', form);
    form.setAttribute("data-at", "1");
    form.goTo = function (step, service) {
      if (service) {
        form.servicio.value = service;
        $(".wizard__chosen-txt", form).textContent = service;
      }
      s1.hidden = step !== 1; s2.hidden = step !== 2;
      form.setAttribute("data-at", String(step));
      $(".wizard__n", form).textContent = step;
      if (step === 2) {
        track("wizard_step2", { service: form.servicio.value, form: form.getAttribute("data-source") });
        setTimeout(function () { try { form.nombre.focus({ preventScroll: true }); } catch (e) { /* nada */ } }, 80);
      }
    };
    $$(".opt", form).forEach(function (b) {
      b.addEventListener("click", function () { form.goTo(2, b.getAttribute("data-service")); });
    });
    $(".wizard__back", form).addEventListener("click", function () { form.goTo(1); });
    setupLeadForm(form);
  }

  /* ---------- Modal ---------- */
  var modal = $("#lead-modal");
  var modalForm = $("form", modal);
  var lastFocus = null;
  function openModal(service, extra) {
    if (document.body.classList.contains("ac-editing")) return;
    lastFocus = document.activeElement;
    closeSheet();
    modalForm.resultado_test.value = extra || "";
    if (service) modalForm.goTo(2, service); else modalForm.goTo(1);
    modal.hidden = false;
    document.body.classList.add("no-scroll");
    track("open_lead_modal", { service: service || "" });
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("no-scroll");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-open-lead]");
    if (!t) return;
    e.preventDefault();
    openModal(t.getAttribute("data-service"));
  });
  $$("[data-close]", modal).forEach(function (el) { el.addEventListener("click", closeModal); });

  /* ---------- Menú tipo hoja inferior ---------- */
  var sheet = $("#menu-sheet");
  function openSheet() { sheet.hidden = false; document.body.classList.add("no-scroll"); }
  function closeSheet() { if (!sheet.hidden) { sheet.hidden = true; document.body.classList.remove("no-scroll"); } }
  $("#menu-btn").addEventListener("click", openSheet);
  $$("[data-close-sheet]", sheet).forEach(function (el) { el.addEventListener("click", closeSheet); });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!modal.hidden) closeModal();
    closeSheet();
    closeLightbox();
  });

  /* ---------- Header, progreso de lectura y barra inferior ---------- */
  var header = $("#header"), bar = $("#progress-bar");
  var tabItems = $$(".tabbar__item"), navLinks = $$(".nav a");
  function onScroll() {
    var y = window.scrollY, h = document.documentElement.scrollHeight - window.innerHeight;
    header.classList.toggle("is-scrolled", y > 10);
    bar.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if ("IntersectionObserver" in window) {
    var secObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id;
        var tabMap = { inicio: "inicio", problema: "inicio", facil: "inicio", urgencia: "inicio", servicios: "servicios", test: "servicios", proceso: "servicios", "casos-exito": "casos-exito", equipo: "casos-exito", "marco-legal": "faq", compromiso: "faq", documentos: "faq", faq: "faq", contacto: "faq" };
        tabItems.forEach(function (t) { t.classList.toggle("is-active", t.getAttribute("data-tab") === tabMap[id]); });
        navLinks.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    $$("main > section[id]").forEach(function (s) { secObs.observe(s); });
  }

  /* ---------- Animaciones de entrada ---------- */
  function observeReveal(scope) {
    var els = $$(".reveal:not(.is-visible)", scope);
    if (!("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-visible"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
    }, { threshold: 0.1, rootMargin: "0px 0px -30px 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Carruseles con indicadores ---------- */
  function setupRail(rail) {
    if (rail._dots) rail._dots.remove();
    var items = rail.children;
    if (items.length < 2) return;
    var dots = document.createElement("div");
    dots.className = "rail-dots";
    for (var i = 0; i < items.length; i++) dots.appendChild(document.createElement("span"));
    rail.parentNode.insertBefore(dots, rail.nextSibling);
    if (rail.parentNode.classList.contains("cases-wrap")) rail.parentNode.parentNode.insertBefore(dots, rail.parentNode.nextSibling);
    rail._dots = dots;
    function update() {
      var c = rail.scrollLeft + rail.clientWidth / 2, best = 0, bd = Infinity;
      for (var j = 0; j < items.length; j++) {
        var it = items[j], d = Math.abs(it.offsetLeft + it.offsetWidth / 2 - c);
        if (d < bd) { bd = d; best = j; }
      }
      $$("span", dots).forEach(function (s, k) { s.classList.toggle("is-on", k === best); });
      var prev = $('[data-rail-prev="' + rail.id + '"]'), next = $('[data-rail-next="' + rail.id + '"]');
      if (prev) prev.disabled = rail.scrollLeft < 8;
      if (next) next.disabled = rail.scrollLeft + rail.clientWidth > rail.scrollWidth - 8;
    }
    if (!rail._bound) {
      rail.addEventListener("scroll", function () { window.requestAnimationFrame(update); }, { passive: true });
      window.addEventListener("resize", update);
      rail._bound = true;
    }
    update();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-rail-prev],[data-rail-next]");
    if (!b) return;
    var rail = document.getElementById(b.getAttribute("data-rail-prev") || b.getAttribute("data-rail-next"));
    var dir = b.hasAttribute("data-rail-next") ? 1 : -1;
    rail.scrollBy({ left: dir * rail.clientWidth * 0.9, behavior: "smooth" });
  });

  /* ---------- Problema: tarjetas que se marcan ---------- */
  var painCards = $$("[data-pain]"), painResult = $("#pain-result");
  painCards.forEach(function (c) {
    c.addEventListener("click", function () {
      if (document.body.classList.contains("ac-editing")) return;
      c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") === "true" ? "false" : "true");
      var n = painCards.filter(function (x) { return x.getAttribute("aria-pressed") === "true"; }).length;
      $("#pain-count").textContent = n;
      painResult.hidden = n === 0;
      if (n === 1) track("pain_selected", {});
    });
  });

  /* ---------- Pestañas del marco legal ---------- */
  $$("[data-tabs]").forEach(function (wrap) {
    var tabs = $$('[role="tab"]', wrap);
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab); });
      tab.addEventListener("keydown", function (e) {
        var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        var next = tabs[(i + dir + tabs.length) % tabs.length];
        select(next); next.focus();
      });
    });
  });
  if (window.matchMedia("(min-width: 961px)").matches) $$(".law__refs").forEach(function (d) { d.open = true; });
  if (window.matchMedia("(max-width: 760px)").matches) $$(".docs__col").forEach(function (d, i) { d.open = i === 0; });

  /* ---------- Filtro de preguntas ---------- */
  $$("[data-faq-filter]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var f = chip.getAttribute("data-faq-filter");
      $$("[data-faq-filter]").forEach(function (c) { c.classList.toggle("is-active", c === chip); });
      $$("[data-faq]").forEach(function (d) {
        var g = d.getAttribute("data-faq");
        d.hidden = !(f === "all" || g === f || g === "all") || d.getAttribute("data-empty") === "1";
      });
    });
  });

  /* ---------- Test de 30 segundos ---------- */
  var quiz = $("#quiz");
  var Q = {
    start: { q: "¿Qué necesita resolver?", opts: [["🪪", "Tengo registro en Colombia y en Venezuela", "reg"], ["🏠", "Una sucesión o herencia", "suc"]] },
    born: { q: "¿Dónde nació realmente?", opts: [["🇻🇪", "En Venezuela", "VE"], ["🇨🇴", "En Colombia", "CO"], ["🤔", "No estoy seguro(a)", "NS"]] },
    parent: function (a) {
      var nat = a.born === "VE" ? "colombiano(a)" : "venezolano(a)";
      return { q: "¿Su papá o su mamá es " + nat + "?", opts: [["👍", "Sí", "SI"], ["✋", "No", "NO"], ["🤔", "No sé", "NS"]] };
    },
    worry: { q: "¿Qué le preocupa más en este momento?", opts: [["🪪", "Mi cédula", "ced"], ["✈️", "Pasaporte o viajar", "via"], ["🏠", "Herencia o bienes", "her"], ["💼", "Trabajo, salud o pensión", "tra"]] },
    agree: { q: "¿Todos los herederos están de acuerdo?", opts: [["🤝", "Sí, todos de acuerdo", "SI"], ["⚡", "No, hay diferencias", "NO"], ["🤔", "No sé / falta alguien", "NS"]] },
    abroad: { q: "¿Hay bienes o herederos en Venezuela?", opts: [["🇻🇪", "Sí", "SI"], ["🇨🇴", "No, todo en Colombia", "NO"]] }
  };
  var qa = {}, qHist = [];
  function quizFlow() {
    if (!qa.start) return "start";
    if (qa.start === "reg") {
      if (!qa.born) return "born";
      if (qa.born !== "NS" && !qa.parent) return "parent";
      if (!qa.worry) return "worry";
      return "result";
    }
    if (!qa.agree) return "agree";
    if (!qa.abroad) return "abroad";
    return "result";
  }
  function quizTotal() { return qa.start === "suc" ? 3 : qa.born === "NS" ? 3 : 4; }
  function quizResult() {
    var r = {};
    if (qa.start === "reg") {
      if (qa.born === "VE") {
        r.service = "Nulidad de Registro Civil en Colombia";
        r.route = "Nulidad del registro civil colombiano";
        r.text = qa.parent === "SI"
          ? "Como su papá o su mamá es colombiano(a), en muchos casos puede <b>conservar la nacionalidad colombiana</b>: se anula el registro con datos que no son reales y se hace uno nuevo como colombiano(a) nacido(a) en el exterior (Constitución, art. 96)."
          : "Se anula el registro colombiano que no corresponde. Revisaremos con cuidado su situación de nacionalidad y migratoria para <b>proteger sus derechos en Colombia</b>; existen alternativas que evaluamos con usted.";
      } else if (qa.born === "CO") {
        r.service = "Nulidad de Partida de Nacimiento en Venezuela";
        r.route = "Nulidad de la partida de nacimiento venezolana";
        r.text = qa.parent === "SI"
          ? "Se anula el acta venezolana que no corresponde. Por ser hijo(a) de venezolano(a), <b>podría conservar la nacionalidad venezolana por la vía correcta</b> (Constitución venezolana, art. 32)."
          : "Se anula el acta venezolana que no corresponde para que usted tenga <b>una sola identidad: la colombiana</b>, sin contradicciones.";
      } else {
        r.service = "Doble registro (no sé cuál anular)";
        r.route = "Diagnóstico de doble registro";
        r.text = "Revisaremos ambos documentos para definir <b>cuál registro anular</b> y cómo proteger su nacionalidad y sus derechos.";
      }
      r.extra = {
        ced: "Diseñamos la estrategia para que el tiempo sin documento sea el menor posible.",
        via: "Con su identidad en regla podrá tramitar su pasaporte con un solo documento válido.",
        her: "Con su identidad clara podrá recibir y escriturar los bienes de su familia.",
        tra: "Una identidad en regla le permite acceder a salud, pensión y empleo formal sin bloqueos."
      }[qa.worry];
    } else {
      r.service = "Sucesión / herencia";
      r.route = qa.agree === "SI" ? "Sucesión notarial" : "Sucesión judicial";
      r.text = qa.agree === "SI"
        ? "Como todos están de acuerdo, la sucesión puede hacerse <b>en notaría</b>, que suele ser la vía más ágil (Decreto 902 de 1988)."
        : "Cuando hay diferencias o falta algún heredero, la sucesión se tramita <b>ante un juez</b>, que protege la parte de cada uno (Código General del Proceso).";
      if (qa.agree === "NS") r.text = "Si no hay certeza del acuerdo, primero lo verificamos: si todos están de acuerdo se hace <b>en notaría</b>; si no, <b>ante un juez</b>.";
      r.extra = qa.abroad === "SI" ? "Además, coordinamos lo necesario para los bienes o herederos en Venezuela (sucesión binacional)." : "Le ayudamos a calcular el impuesto de ganancia ocasional y a escriturar los bienes.";
    }
    return r;
  }
  function renderQuiz() {
    var step = quizFlow();
    var html;
    if (step === "result") {
      var r = quizResult();
      quiz._result = r;
      html = '<div class="quiz__step">' +
        '<span class="quiz__result-badge">✓ Su ruta legal más probable</span>' +
        '<h3 class="quiz__route">' + esc(r.route) + "</h3>" +
        '<p class="quiz__text">' + r.text + "</p>" +
        (r.extra ? '<div class="quiz__extra"><svg class="ic"><use href="#i-spark"/></svg><span>' + esc(r.extra) + "</span></div>" : "") +
        '<div class="quiz__actions">' +
        '<button type="button" class="btn btn--wa btn--block btn--lg" data-quiz-cta><svg class="ic"><use href="#i-wa"/></svg> Hablar con un abogado sobre mi resultado</button>' +
        '<button type="button" class="btn btn--outline btn--block" data-quiz-reset>Volver a hacer el test</button></div>' +
        '<p class="quiz__note">Resultado orientativo. No reemplaza la revisión de sus documentos por un abogado.</p></div>';
      track("quiz_complete", { route: r.route });
    } else {
      var def = typeof Q[step] === "function" ? Q[step](qa) : Q[step];
      var n = qHist.length + 1;
      html = '<div class="quiz__top"><span>Pregunta ' + n + " de " + (qa.start ? quizTotal() : "3–4") + "</span><span>⏱ 30 s</span></div>" +
        '<div class="quiz__bar"><span style="width:' + Math.round((n - 1) / (qa.start ? quizTotal() : 4) * 100) + '%"></span></div>' +
        '<div class="quiz__step"><h3 class="quiz__q">' + esc(def.q) + '</h3><div class="quiz__opts">' +
        def.opts.map(function (o) { return '<button type="button" class="quiz__opt" data-k="' + step + '" data-v="' + o[2] + '"><span>' + o[0] + "</span><span>" + esc(o[1]) + "</span></button>"; }).join("") +
        "</div>" + (qHist.length ? '<button type="button" class="quiz__back" data-quiz-back><svg class="ic"><use href="#i-back"/></svg> Atrás</button>' : "") + "</div>";
    }
    quiz.innerHTML = html;
  }
  quiz.addEventListener("click", function (e) {
    var o = e.target.closest(".quiz__opt");
    if (o) {
      if (!qHist.length) track("quiz_start", {});
      qa[o.getAttribute("data-k")] = o.getAttribute("data-v"); qHist.push(o.getAttribute("data-k")); renderQuiz(); return;
    }
    if (e.target.closest("[data-quiz-back]")) { delete qa[qHist.pop()]; renderQuiz(); return; }
    if (e.target.closest("[data-quiz-reset]")) { qa = {}; qHist = []; renderQuiz(); return; }
    if (e.target.closest("[data-quiz-cta]")) {
      var r = quiz._result;
      openModal(r.service, "Hice el test de la página y mi resultado fue: " + r.route + ".");
    }
  });
  renderQuiz();

  /* ---------- Casos de éxito ---------- */
  var casesRail = $("#cases-rail");
  var LB = { items: [], i: 0 };
  function renderCases(list) {
    list = (list || []).filter(function (c) { return c && c.visible !== false; });
    casesRail.innerHTML = list.map(function (c, idx) {
      var imgs = (c.imagenes || []).map(safeUrl).filter(Boolean);
      var media = imgs.length
        ? '<img src="' + esc(imgs[0]) + '" alt="Documento del caso: ' + esc(c.titulo) + '" loading="lazy">' +
          '<span class="case__zoom"><svg class="ic"><use href="#i-eye"/></svg> Ver documento</span>' +
          (imgs.length > 1 ? '<span class="case__count">' + imgs.length + " imágenes</span>" : "")
        : '<span class="case__media-ph"><svg class="ic"><use href="#i-doc"/></svg>Documento protegido</span>';
      var badge = c.real
        ? '<span class="case__badge case__badge--real">✓ Caso real</span>'
        : '<span class="case__badge case__badge--demo">Caso ilustrativo</span>';
      var row = function (k, v, cls) { return v ? '<div class="case__row ' + (cls || "") + '"><b>' + k + "</b><span>" + esc(v) + "</span></div>" : ""; };
      var meta = [c.ciudad ? "📍 " + esc(c.ciudad) : "", c.tiempo ? "⏱ " + esc(c.tiempo) : ""].filter(Boolean);
      return '<article class="case">' +
        '<button type="button" class="case__media" data-case="' + idx + '"' + (imgs.length ? "" : " disabled") + ">" + media + badge + "</button>" +
        '<div class="case__body"><span class="case__cat">' + esc(c.categoria) + "</span>" +
        '<h3 class="case__title">' + esc(c.titulo) + "</h3>" +
        '<div class="case__rows">' + row("Situación", c.situacion) + row("Solución", c.solucion) + row("Resultado", c.resultado, "case__row--ok") + "</div>" +
        (c.testimonio ? '<blockquote class="case__quote">“' + esc(c.testimonio) + "”" + (c.cliente ? "<cite>— " + esc(c.cliente) + "</cite>" : "") + "</blockquote>" : "") +
        (meta.length ? '<div class="case__meta"><span>' + meta.join("</span><span>") + "</span></div>" : "") +
        "</div></article>";
    }).join("");
    casesRail._list = list;
    setupRail(casesRail);
  }
  casesRail.addEventListener("click", function (e) {
    var m = e.target.closest("[data-case]");
    if (!m || m.disabled) return;
    var c = casesRail._list[+m.getAttribute("data-case")];
    LB.items = (c.imagenes || []).map(safeUrl).filter(Boolean).map(function (u) { return { src: u, cap: c.titulo }; });
    LB.i = 0; showLightbox();
  });
  var lb = $("#lightbox");
  function showLightbox() {
    var it = LB.items[LB.i];
    if (!it) return;
    if (/\.pdf($|\?)/i.test(it.src)) { window.open(it.src, "_blank", "noopener"); return; }
    $("#lightbox-img").src = it.src;
    $("#lightbox-cap").textContent = it.cap + (LB.items.length > 1 ? " · " + (LB.i + 1) + "/" + LB.items.length : "");
    $$(".lightbox__nav", lb).forEach(function (b) { b.hidden = LB.items.length < 2; });
    lb.hidden = false; document.body.classList.add("no-scroll");
  }
  function closeLightbox() { if (!lb.hidden) { lb.hidden = true; document.body.classList.remove("no-scroll"); } }
  $("[data-close-lb]", lb).addEventListener("click", closeLightbox);
  lb.addEventListener("click", function (e) { if (e.target === lb) closeLightbox(); });
  $("[data-lb-prev]", lb).addEventListener("click", function () { LB.i = (LB.i - 1 + LB.items.length) % LB.items.length; showLightbox(); });
  $("[data-lb-next]", lb).addEventListener("click", function () { LB.i = (LB.i + 1) % LB.items.length; showLightbox(); });

  /* ---------- Equipo ---------- */
  function renderTeam(list) {
    list = (list || []).filter(function (p) { return p && p.visible !== false; });
    var featured = list.filter(function (p) { return p.destacado; })[0] || list[0];
    var rest = list.filter(function (p) { return p !== featured; });
    var logo = safeUrl(images().logo) || "assets/img/logo-ac.png";
    var fWrap = $("#team-featured");
    if (featured) {
      var foto = safeUrl(featured.foto);
      fWrap.innerHTML =
        '<div class="portrait">' + (foto ? '<img src="' + esc(foto) + '" alt="' + esc(featured.nombre) + '">' : '<div class="portrait__ph"><img src="' + esc(logo) + '" alt=""></div>') +
        '<div class="portrait__exp"><b data-e="team.expN">' + (CONTENT.texts && CONTENT.texts["team.expN"] ? sanitize(CONTENT.texts["team.expN"]) : "30+") + "</b>años de experiencia</div></div>" +
        '<div class="featured__copy"><p class="eyebrow">Director</p><h3 class="h3">' + esc(featured.nombre) + "</h3>" +
        '<p class="featured__role">' + esc(featured.cargo) + "</p>" +
        (featured.especialidad ? '<span class="featured__spec"><svg class="ic"><use href="#i-scale"/></svg>' + esc(featured.especialidad) + "</span>" : "") +
        (featured.bio ? '<p class="featured__bio">' + esc(featured.bio) + "</p>" : "") +
        (featured.tarjeta ? '<p class="featured__tp">T.P. ' + esc(featured.tarjeta) + "</p>" : "") +
        '<button type="button" class="btn btn--gold" data-open-lead>Hablar con el equipo <svg class="ic"><use href="#i-arrow"/></svg></button></div>';
    } else fWrap.innerHTML = "";
    var grid = $("#team-grid");
    grid.innerHTML = rest.map(function (p) {
      var f = safeUrl(p.foto);
      return '<article class="lawyer"><div class="lawyer__img">' + (f ? '<img src="' + esc(f) + '" alt="' + esc(p.nombre) + '" loading="lazy">' : '<svg class="ic"><use href="#i-user"/></svg>') + "</div>" +
        '<div class="lawyer__body"><b>' + esc(p.nombre) + "</b><span>" + esc(p.cargo) + "</span>" +
        (p.especialidad ? "<p>" + esc(p.especialidad) + "</p>" : "") + (p.tarjeta ? "<p>T.P. " + esc(p.tarjeta) + "</p>" : "") + "</div></article>";
    }).join("");
    grid.hidden = !rest.length;
    setupRail(grid);
  }
  // Ícono de usuario para abogados sin foto
  if (!document.getElementById("i-user")) {
    var sym = document.createElementNS("http://www.w3.org/2000/svg", "symbol");
    sym.id = "i-user"; sym.setAttribute("viewBox", "0 0 24 24");
    sym.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/></g>';
    $("svg").appendChild(sym);
  }

  /* ---------- Aplicar contenido administrable ---------- */
  function images() { return CONTENT.images || {}; }
  function applyContent(c) {
    CONTENT = c || {};
    var texts = CONTENT.texts || {};
    Object.keys(texts).forEach(function (k) {
      $$('[data-e="' + k.replace(/"/g, "") + '"]').forEach(function (el) {
        el.innerHTML = sanitize(texts[k]);
        var empty = !el.textContent.trim();
        var item = el.closest("details[data-faq], .also li");
        if (item && (el.tagName === "SUMMARY" || item.tagName === "LI")) { item.hidden = empty; item.setAttribute("data-empty", empty ? "1" : "0"); }
      });
    });
    var logo = safeUrl(images().logo);
    if (logo) $$('[data-img="logo"]').forEach(function (img) { img.src = logo; });

    var bgs = CONTENT.backgrounds || {};
    $$("[data-bg]").forEach(function (sec) {
      var b = bgs[sec.getAttribute("data-bg")];
      var url = b && safeUrl(b.url);
      sec.classList.toggle("has-bg", !!url);
      if (url) {
        var dark = sec.getAttribute("data-bg-tone") === "dark";
        var a = typeof b.overlay === "number" ? b.overlay : dark ? 0.78 : 0.86;
        sec.style.setProperty("--bg-img", 'url("' + url + '")');
        sec.style.setProperty("--bg-overlay", dark ? "rgba(7,19,38," + a + ")" : "rgba(250,246,239," + a + ")");
      } else {
        sec.style.removeProperty("--bg-img");
        sec.style.removeProperty("--bg-overlay");
      }
    });

    var s = settings();
    $$("[data-set]").forEach(function (el) {
      var v = s[el.getAttribute("data-set")];
      if (v) el.textContent = v;
    });
    $$("[data-set-href]").forEach(function (el) {
      var kind = el.getAttribute("data-set-href");
      if (kind === "mailto" && s.email) el.href = "mailto:" + s.email;
      if (kind === "tel") el.href = "tel:" + String(s.phone || "+" + s.whatsapp).replace(/[^\d+]/g, "");
    });
    var map = $("#map");
    var mapSrc = "https://maps.google.com/maps?q=" + encodeURIComponent(s.mapQuery || "Cúcuta, Norte de Santander") + "&z=" + (s.mapQuery ? 16 : 13) + "&output=embed";
    if (map._src !== mapSrc) {
      map._src = mapSrc;
      if ("IntersectionObserver" in window) {
        var mo = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { map.src = map._src; mo.disconnect(); } }, { rootMargin: "300px" });
        mo.observe(map);
      } else map.src = mapSrc;
    }

    renderCases(CONTENT.cases || DEF.cases);
    renderTeam(CONTENT.team || DEF.team);
    $$("[data-rail]").forEach(function (r) { if (r.id !== "cases-rail" && r.id !== "team-grid") setupRail(r); });
    syncTicker();
    observeReveal(document);
  }

  function syncTicker() {
    var row = $(".ticker__row:not(.ticker__row--clone)"), clone = $(".ticker__row--clone");
    if (!row || !clone) return;
    clone.innerHTML = row.innerHTML.replace(/ data-e="[^"]*"/g, "").replace(/ contenteditable="true"/g, "");
  }

  function loadContent(fresh) {
    if (location.protocol === "file:") return Promise.resolve({});
    return fetch("/api/content" + (fresh ? "?fresh=1&t=" + Date.now() : ""), { credentials: "same-origin", cache: fresh ? "no-store" : "default" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; });
  }

  applyContent({});
  var editing = /[?&]editar\b/.test(location.search);
  loadContent(editing).then(function (c) {
    if (c && Object.keys(c).length) applyContent(c);
    initAnalytics();
    if (editing) {
      ["assets/js/ac-upload.js?v=20261001c", "assets/js/editor.js?v=20261001c"].reduce(function (p, src) {
        return p.then(function () {
          return new Promise(function (res, rej) { var sc = document.createElement("script"); sc.src = src; sc.onload = res; sc.onerror = rej; document.body.appendChild(sc); });
        });
      }, Promise.resolve());
    }
  });

  /* API pública para el editor visual */
  window.AC = {
    getContent: function () { return CONTENT; },
    applyContent: applyContent,
    loadContent: loadContent,
    sanitize: sanitize
  };

  /* ---------- Barra inferior: se oculta al bajar y sobre formularios ---------- */
  (function () {
    var tb = $(".tabbar");
    if (!tb) return;
    var lastY = window.scrollY, wizardInView = false, typing = false;
    function update(hideByScroll) {
      tb.classList.toggle("is-hidden", hideByScroll || wizardInView || typing);
    }
    var scrollHide = false;
    window.addEventListener("scroll", function () {
      var y = window.scrollY, d = y - lastY;
      if (Math.abs(d) < 6) return;
      scrollHide = d > 0 && y > 240;
      lastY = y;
      update(scrollHide);
    }, { passive: true });
    if ("IntersectionObserver" in window) {
      var seen = new Set();
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
        wizardInView = seen.size > 0;
        update(scrollHide);
      }, { threshold: 0.2 });
      $$("main .wizard, #quiz").forEach(function (w) { io.observe(w); });
    }
    document.addEventListener("focusin", function (e) { if (e.target.matches("input, textarea, select")) { typing = true; update(scrollHide); } });
    document.addEventListener("focusout", function () { typing = false; update(scrollHide); });
  })();

  /* ---------- Año ---------- */
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Burbuja del botón flotante ---------- */
  var wa = $(".wa-float");
  setTimeout(function () { wa.classList.add("show-tip"); }, 7000);
  setTimeout(function () { wa.classList.remove("show-tip"); }, 14000);

  /* ---------- Parámetros de campaña (UTM) ---------- */
  var tracking = (function () {
    var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
    var stored = {};
    try { stored = JSON.parse(sessionStorage.getItem("ac_utm") || "{}"); } catch (e) { stored = {}; }
    var params = new URLSearchParams(location.search);
    keys.forEach(function (k) { if (params.get(k)) stored[k] = params.get(k); });
    if (!stored.referrer && document.referrer) stored.referrer = document.referrer;
    try { sessionStorage.setItem("ac_utm", JSON.stringify(stored)); } catch (e) { /* sin almacenamiento */ }
    return stored;
  })();

  /* ---------- Mensaje de WhatsApp ---------- */
  function buildWhatsAppMessage(d) {
    var s = settings();
    var lines = [
      s.waIntro || "Hola, Ariango Consultores 👋",
      "",
      "Mi nombre es *" + d.nombre + "*" + (d.ciudad ? ", escribo desde *" + d.ciudad + "*" : "") + ".",
      "Dejé mis datos en su página web y quiero orientación sobre: *" + d.servicio + "*."
    ];
    if (d.resultado_test) lines.push("", d.resultado_test);
    if (d.mensaje) lines.push("", "Mi caso en breve: " + d.mensaje);
    lines.push("", "¿Qué opciones tengo, qué documentos necesito y cuál es el siguiente paso?", "", "Quedo atento(a). ¡Gracias!");
    return lines.join("\n");
  }
  function waLink(text) {
    var num = String(settings().whatsapp || "573156002993").replace(/\D/g, "");
    return "https://wa.me/" + num + "?text=" + encodeURIComponent(text);
  }

  /* ---------- Envío de datos ---------- */
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (r) { setTimeout(r, ms); })]); }
  function sendToSheets(data) {
    var url = settings().googleSheetsEndpoint;
    if (!url) return Promise.resolve();
    var body = new URLSearchParams();
    Object.keys(data).forEach(function (k) { body.append(k, data[k]); });
    return fetch(url, { method: "POST", mode: "no-cors", body: body, keepalive: true }).catch(function () {});
  }
  function sendToEmail(data) {
    var s = settings();
    if (!s.formSubmitEnabled || !s.email) return Promise.resolve();
    var payload = {
      _subject: "Nueva solicitud web: " + data.servicio + " — " + data.nombre,
      _template: "table", _captcha: "false",
      Nombre: data.nombre, Telefono: data.telefono, Email: data.email || "—", Ciudad: data.ciudad || "—",
      Servicio: data.servicio, Mensaje: data.mensaje || "—", Test: data.resultado_test || "—",
      Formulario: data.formulario, Fecha: data.fecha,
      Origen: [data.utm_source, data.utm_medium, data.utm_campaign].filter(Boolean).join(" / ") || "directo"
    };
    if (data.email) payload._replyto = data.email;
    return fetch("https://formsubmit.co/ajax/" + encodeURIComponent(s.email), {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload), keepalive: true
    }).catch(function () {});
  }

  /* ---------- Validación y envío ---------- */
  function setInvalid(el, on) {
    var w = el.closest(".field") || el.closest(".consent");
    if (w) w.classList.toggle("is-invalid", on);
  }
  function validate(form) {
    var ok = true, first = null;
    $$("[required]", form).forEach(function (el) {
      var bad = el.type === "checkbox" ? !el.checked : el.name === "telefono" ? el.value.replace(/\D/g, "").length < 7 : !el.value.trim();
      setInvalid(el, bad);
      if (bad) { ok = false; if (!first) first = el; }
    });
    var email = form.email;
    if (email && email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { setInvalid(email, true); ok = false; if (!first) first = email; }
    if (first) first.focus();
    return ok;
  }
  function setupLeadForm(form) {
    $$("input, select, textarea", form).forEach(function (el) {
      el.addEventListener("input", function () { setInvalid(el, false); });
      el.addEventListener("change", function () { setInvalid(el, false); });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = $(".form-msg", form), btn = $('button[type="submit"]', form), label = $(".btn__label", btn);
      msg.className = "form-msg"; msg.textContent = "";
      if (form.elements._honey && form.elements._honey.value) return;
      if (!form.servicio.value) { form.goTo(1); return; }
      if (!validate(form)) { msg.classList.add("is-error"); msg.textContent = "Complete los campos obligatorios y acepte la política de datos."; return; }

      var fd = new FormData(form);
      var get = function (k) { return (fd.get(k) || "").toString().trim(); };
      var ind = get("indicativo");
      var data = {
        fecha: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
        nombre: get("nombre"),
        telefono: (ind && ind !== "otro" ? ind + " " : "") + get("telefono"),
        email: get("email"), ciudad: get("ciudad"), servicio: get("servicio"),
        mensaje: get("mensaje"), resultado_test: get("resultado_test"),
        formulario: form.getAttribute("data-source") || "web", consentimiento: "Sí",
        pagina: location.href.split("#")[0].split("?")[0],
        utm_source: tracking.utm_source || "", utm_medium: tracking.utm_medium || "", utm_campaign: tracking.utm_campaign || "",
        utm_term: tracking.utm_term || "", utm_content: tracking.utm_content || "",
        gclid: tracking.gclid || "", fbclid: tracking.fbclid || "", referrer: tracking.referrer || ""
      };
      btn.disabled = true;
      var original = label.textContent;
      label.textContent = "Enviando…";
      track("generate_lead", { service: data.servicio, form: data.formulario });

      var link = waLink(buildWhatsAppMessage(data));
      withTimeout(Promise.all([sendToSheets(data), sendToEmail(data)]), 3500).then(function () {
        msg.classList.add("is-ok");
        msg.innerHTML = "¡Gracias, " + esc(data.nombre.split(" ")[0]) + "! Le llevamos a WhatsApp… Si no se abre, <a href=\"" + esc(link) + "\" target=\"_blank\" rel=\"noopener\">toque aquí</a>.";
        label.textContent = "¡Listo! Abriendo WhatsApp…";
        setTimeout(function () {
          location.href = link;
          setTimeout(function () { btn.disabled = false; label.textContent = original; form.reset(); form.goTo(1); msg.textContent = ""; }, 3000);
        }, 700);
      });
    });
  }

  /* ---------- Intención de salida (solo escritorio, una vez por sesión) ---------- */
  if (window.matchMedia("(pointer: fine) and (min-width: 961px)").matches) {
    var armed = false;
    setTimeout(function () { armed = true; }, 20000);
    document.addEventListener("mouseout", function (e) {
      if (!armed || e.relatedTarget || e.clientY > 10 || editing) return;
      try { if (sessionStorage.getItem("ac_exit")) return; sessionStorage.setItem("ac_exit", "1"); } catch (er) { return; }
      armed = false;
      if (modal.hidden) openModal();
    });
  }

  /* ---------- Analítica opcional ---------- */
  function track(event, params) {
    try {
      if (window.gtag) window.gtag("event", event, params || {});
      if (window.fbq) {
        if (event === "generate_lead") window.fbq("track", "Lead", { content_name: params && params.service });
        else window.fbq("trackCustom", event, params || {});
      }
    } catch (e) { /* nada */ }
  }
  function initAnalytics() {
    var s = settings();
    if (s.ga4Id && /^G-[A-Z0-9]+$/.test(s.ga4Id) && !window.gtag) {
      var sc = document.createElement("script");
      sc.async = true; sc.src = "https://www.googletagmanager.com/gtag/js?id=" + s.ga4Id;
      document.head.appendChild(sc);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", s.ga4Id);
    }
    if (s.metaPixelId && /^\d+$/.test(s.metaPixelId) && !window.fbq) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq("init", s.metaPixelId);
      window.fbq("track", "PageView");
    }
  }
})();

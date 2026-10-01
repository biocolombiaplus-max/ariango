/* ==========================================================================
   Ariango Consultores — interacción, captura de datos y redirección a WhatsApp
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.ARIANGO_CONFIG || {};
  var WA_NUMBER = CFG.whatsapp || "573156002993";

  /* ---------- Año del footer ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Header con sombra al hacer scroll ---------- */
  var header = document.getElementById("header");
  function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 10); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Menú móvil ---------- */
  var burger = document.getElementById("burger");
  var nav = document.getElementById("nav");
  function closeNav() {
    nav.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("modal-open");
  }
  burger.addEventListener("click", function () {
    var open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("modal-open", open);
  });
  nav.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", closeNav); });

  /* ---------- Animaciones de entrada ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Contadores ---------- */
  var counters = document.querySelectorAll("[data-count]");
  function runCounter(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    var start = null, dur = 1400;
    function step(t) {
      if (!start) start = t;
      var p = Math.min((t - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { runCounter(e.target); co.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { co.observe(c); });
  } else {
    counters.forEach(function (c) { c.textContent = c.getAttribute("data-count"); });
  }

  /* ---------- Pestañas del marco legal ---------- */
  document.querySelectorAll("[data-tabs]").forEach(function (wrap) {
    var tabs = Array.prototype.slice.call(wrap.querySelectorAll('[role="tab"]'));
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
        var dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        var next = tabs[(i + dir + tabs.length) % tabs.length];
        select(next); next.focus();
      });
    });
  });

  /* ---------- Parámetros de campaña (UTM) ---------- */
  var tracking = (function () {
    var keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
    var stored = {};
    try { stored = JSON.parse(sessionStorage.getItem("ac_utm") || "{}"); } catch (e) { stored = {}; }
    var params = new URLSearchParams(window.location.search);
    keys.forEach(function (k) { if (params.get(k)) stored[k] = params.get(k); });
    if (!stored.landing) stored.landing = window.location.pathname;
    if (!stored.referrer && document.referrer) stored.referrer = document.referrer;
    try { sessionStorage.setItem("ac_utm", JSON.stringify(stored)); } catch (e) { /* sin almacenamiento */ }
    return stored;
  })();

  /* ---------- Modal de captura ---------- */
  var modal = document.getElementById("lead-modal");
  var lastFocus = null;
  function openModal(service) {
    lastFocus = document.activeElement;
    if (service) {
      var sel = modal.querySelector('select[name="servicio"]');
      if (sel) sel.value = service;
    }
    modal.hidden = false;
    document.body.classList.add("modal-open");
    setTimeout(function () { var f = modal.querySelector("input[name='nombre']"); if (f) f.focus(); }, 60);
    track("open_lead_modal", { service: service || "" });
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    if (lastFocus) lastFocus.focus();
  }
  document.querySelectorAll("[data-open-lead]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      closeNav();
      openModal(el.getAttribute("data-service"));
    });
  });
  modal.querySelectorAll("[data-close]").forEach(function (el) { el.addEventListener("click", closeModal); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });

  // Mostrar la burbuja del botón flotante unos segundos después de cargar
  var wa = document.querySelector(".wa-float");
  if (wa) {
    setTimeout(function () { wa.classList.add("show-tip"); }, 6000);
    setTimeout(function () { wa.classList.remove("show-tip"); }, 13000);
  }

  /* ---------- Mensaje de WhatsApp ---------- */
  function buildWhatsAppMessage(d) {
    var nombre = d.nombre.split(" ")[0];
    var lines = [
      "Hola, Ariango Consultores 👋",
      "",
      "Mi nombre es *" + d.nombre + "*" + (d.ciudad ? ", escribo desde *" + d.ciudad + "*" : "") + ".",
      "Acabo de dejar mis datos en su página web y quiero recibir orientación sobre: *" + d.servicio + "*."
    ];
    if (d.mensaje) { lines.push("", "Mi caso en breve: " + d.mensaje); }
    lines.push(
      "",
      "Quisiera saber qué opciones tengo, qué documentos necesito y cuáles son los siguientes pasos para iniciar.",
      "",
      "Quedo atento(a). ¡Gracias! — " + nombre
    );
    return lines.join("\n");
  }
  function waLink(text) {
    return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(text);
  }

  /* ---------- Envío de datos ---------- */
  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(function (resolve) { setTimeout(resolve, ms); })]);
  }

  function sendToSheets(data) {
    if (!CFG.googleSheetsEndpoint) return Promise.resolve();
    var body = new URLSearchParams();
    Object.keys(data).forEach(function (k) { body.append(k, data[k]); });
    return fetch(CFG.googleSheetsEndpoint, { method: "POST", mode: "no-cors", body: body, keepalive: true })
      .catch(function () { /* se ignora: no debe impedir el contacto */ });
  }

  function sendToEmail(data) {
    if (!CFG.formSubmitEnabled || !CFG.email) return Promise.resolve();
    var payload = {
      _subject: "Nueva solicitud web: " + data.servicio + " — " + data.nombre,
      _template: "table",
      _captcha: "false",
      Nombre: data.nombre,
      Telefono: data.telefono,
      Email: data.email || "—",
      Ciudad: data.ciudad || "—",
      Servicio: data.servicio,
      Mensaje: data.mensaje || "—",
      Formulario: data.formulario,
      Fecha: data.fecha,
      Origen: [data.utm_source, data.utm_medium, data.utm_campaign].filter(Boolean).join(" / ") || "directo"
    };
    if (data.email) payload._replyto = data.email;
    return fetch("https://formsubmit.co/ajax/" + encodeURIComponent(CFG.email), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () { /* se ignora */ });
  }

  function saveLocalBackup(data) {
    try {
      var list = JSON.parse(localStorage.getItem("ac_leads") || "[]");
      list.push(data);
      localStorage.setItem("ac_leads", JSON.stringify(list.slice(-20)));
    } catch (e) { /* sin almacenamiento */ }
  }

  /* ---------- Validación ---------- */
  function setInvalid(el, on) {
    var wrap = el.closest(".field") || el.closest(".consent");
    if (wrap) wrap.classList.toggle("is-invalid", on);
  }
  function validate(form) {
    var ok = true, first = null;
    form.querySelectorAll("[required]").forEach(function (el) {
      var bad;
      if (el.type === "checkbox") bad = !el.checked;
      else if (el.name === "telefono") bad = el.value.replace(/\D/g, "").length < 7;
      else bad = !el.value.trim();
      setInvalid(el, bad);
      if (bad) { ok = false; if (!first) first = el; }
    });
    var email = form.querySelector('input[name="email"]');
    if (email && email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      setInvalid(email, true); ok = false; if (!first) first = email;
    }
    if (first) first.focus();
    return ok;
  }

  document.querySelectorAll(".lead-form").forEach(function (form) {
    form.querySelectorAll("input, select, textarea").forEach(function (el) {
      el.addEventListener("input", function () { setInvalid(el, false); });
      el.addEventListener("change", function () { setInvalid(el, false); });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = form.querySelector(".form-msg");
      var btn = form.querySelector('button[type="submit"]');
      var label = btn.querySelector(".btn__label");
      msg.className = "form-msg"; msg.textContent = "";

      var hp = form.elements["_honey"];
      if (hp && hp.value) return; // bot
      if (!validate(form)) {
        msg.classList.add("is-error");
        msg.textContent = "Por favor complete los campos obligatorios y acepte la política de datos.";
        return;
      }

      var fd = new FormData(form);
      var get = function (k) { return (fd.get(k) || "").toString().trim(); };
      var indicativo = get("indicativo");
      var data = {
        fecha: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
        nombre: get("nombre"),
        telefono: (indicativo && indicativo !== "otro" ? indicativo + " " : "") + get("telefono"),
        email: get("email"),
        ciudad: get("ciudad"),
        servicio: get("servicio"),
        mensaje: get("mensaje"),
        formulario: form.getAttribute("data-source") || "web",
        consentimiento: "Sí",
        pagina: window.location.href.split("#")[0],
        utm_source: tracking.utm_source || "",
        utm_medium: tracking.utm_medium || "",
        utm_campaign: tracking.utm_campaign || "",
        utm_term: tracking.utm_term || "",
        utm_content: tracking.utm_content || "",
        gclid: tracking.gclid || "",
        fbclid: tracking.fbclid || "",
        referrer: tracking.referrer || ""
      };

      btn.disabled = true;
      var original = label.textContent;
      label.textContent = "Enviando…";

      saveLocalBackup(data);
      track("generate_lead", { service: data.servicio, form: data.formulario });

      var link = waLink(buildWhatsAppMessage(data));
      withTimeout(Promise.all([sendToSheets(data), sendToEmail(data)]), 3500).then(function () {
        msg.classList.add("is-ok");
        msg.innerHTML = "¡Gracias, " + escapeHtml(data.nombre.split(" ")[0]) + "! Le estamos llevando a WhatsApp… " +
          'Si no se abre, <a href="' + link + '" target="_blank" rel="noopener">toque aquí</a>.';
        label.textContent = "¡Listo! Abriendo WhatsApp…";
        setTimeout(function () {
          window.location.href = link;
          setTimeout(function () {
            btn.disabled = false; label.textContent = original; form.reset();
          }, 2500);
        }, 700);
      });
    });
  });

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Analítica opcional (GA4 / Meta Pixel) ---------- */
  function track(event, params) {
    try {
      if (window.gtag) window.gtag("event", event, params || {});
      if (window.fbq) {
        if (event === "generate_lead") window.fbq("track", "Lead", { content_name: params && params.service });
        else window.fbq("trackCustom", event, params || {});
      }
    } catch (e) { /* nada */ }
  }

  if (CFG.ga4Id) {
    var s = document.createElement("script");
    s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + CFG.ga4Id;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", CFG.ga4Id);
  }
  if (CFG.metaPixelId) {
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq("init", CFG.metaPixelId);
    window.fbq("track", "PageView");
  }
})();

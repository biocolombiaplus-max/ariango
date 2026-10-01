/* ==========================================================================
   Ajustar encuadre de una foto: acercar, mover y mostrar completa.
   ACFrame.open({ url, title, frames, value, separate, overlay, fill }) → Promise<valor | null>
   valor = { x, y, z, fit }  (y si separate: { d: {...}, m: {...} | null })
   ========================================================================== */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function norm(e) {
    e = e || {};
    var n = function (v, a, b, d) { v = Number(v); return isFinite(v) ? clamp(v, a, b) : d; };
    return { x: n(e.x, 0, 100, 50), y: n(e.y, 0, 100, 50), z: n(e.z, 1, 4, 1), fit: e.fit === "contain" ? "contain" : "cover" };
  }

  var box = document.createElement("div");
  box.className = "frm"; box.hidden = true;
  document.body.appendChild(box);

  function open(o) {
    return new Promise(function (resolve) {
      var frames = o.frames || [{ id: "d", label: "Vista", ratio: 16 / 9 }];
      var sep = !!o.separate;
      var st = { d: norm(sep ? o.value && o.value.d : o.value), m: sep && o.value && o.value.m ? norm(o.value.m) : null, cur: "d" };
      var same = sep && !st.m;

      box.innerHTML =
        '<div class="frm__bg" data-fx="cancel"></div><div class="frm__p" role="dialog" aria-modal="true" aria-label="Ajustar foto">' +
        '<header class="frm__h"><div><b>✂️ Ajustar la foto</b><span>' + esc(o.title || "") + '</span></div><button type="button" class="frm__x" data-fx="cancel" aria-label="Cerrar">✕</button></header>' +
        '<div class="frm__b">' +
        '<p class="frm__hint">👆 <b>Arrastre la foto</b> para moverla. Use <b>Acercar</b> para agrandarla o <b>Foto completa</b> para que se vea entera, sin recortes. La vista es aproximada: revise el resultado en el sitio después de publicar.</p>' +
        '<div class="frm__frames">' + frames.map(function (f) {
          return '<div class="frm__f" data-f="' + f.id + '" style="--r:' + f.ratio + '"><span class="frm__lab">' + esc(f.label) + '</span><div class="frm__win"><div class="frm__img"></div>' + (o.overlay ? '<div class="frm__ov"></div>' : "") + '<div class="frm__grid"></div></div></div>';
        }).join("") + "</div>" +
        (sep ? '<label class="frm__same"><input type="checkbox" id="frm-same"' + (same ? " checked" : "") + '><span>Usar el mismo ajuste en computador y celular</span></label>' +
          '<div class="frm__tabs" id="frm-tabs"><button type="button" data-cur="d">💻 Ajustar computador</button><button type="button" data-cur="m">📱 Ajustar celular</button></div>' : "") +
        '<div class="frm__ctl">' +
        '<div class="frm__modes"><button type="button" data-fit="cover"><b>Llenar el espacio</b><small>La foto cubre todo; se recortan los bordes</small></button><button type="button" data-fit="contain"><b>Foto completa</b><small>Se ve toda la foto, sin recortes</small></button></div>' +
        '<label class="frm__rg"><span>🔍 Acercar <b id="frm-zv"></b></span><input type="range" id="frm-z" min="1" max="3" step="0.01"></label>' +
        '<label class="frm__rg"><span>↔ Mover a los lados</span><input type="range" id="frm-x" min="0" max="100" step="1"></label>' +
        '<label class="frm__rg"><span>↕ Mover arriba o abajo</span><input type="range" id="frm-y" min="0" max="100" step="1"></label>' +
        '<button type="button" class="frm__reset" data-fx="reset">⟲ Centrar de nuevo</button></div></div>' +
        '<footer class="frm__foot"><button type="button" class="btn btn--line" data-fx="cancel">Cancelar</button><button type="button" class="btn btn--gold" data-fx="ok">✓ Guardar ajuste</button></footer></div>';
      box.hidden = false;

      function v() { return st.cur === "m" && st.m ? st.m : st.d; }
      function valFor(fid) { return sep && fid === "m" && st.m ? st.m : st.d; }
      function paint() {
        $$(".frm__f", box).forEach(function (f) {
          var fid = f.getAttribute("data-f"), e = valFor(fid), img = $(".frm__img", f);
          img.style.backgroundImage = "url('" + o.url.replace(/'/g, "%27") + "')";
          img.style.backgroundPosition = e.x + "% " + e.y + "%";
          img.style.backgroundSize = e.fit;
          img.style.backgroundColor = o.fill || "#0A1A30";
          img.style.transform = "scale(" + e.z + ")";
          img.style.transformOrigin = e.x + "% " + e.y + "%";
          var ov = $(".frm__ov", f); if (ov) ov.style.background = o.overlay;
          f.classList.toggle("is-cur", !sep || same || fid === st.cur);
        });
        var e = v();
        $("#frm-z", box).value = e.z; $("#frm-x", box).value = e.x; $("#frm-y", box).value = e.y;
        $("#frm-zv", box).textContent = Math.round(e.z * 100) + "%";
        $$("[data-fit]", box).forEach(function (b) { b.classList.toggle("is-on", b.getAttribute("data-fit") === e.fit); });
        var tabs = $("#frm-tabs", box);
        if (tabs) { tabs.hidden = same; $$("[data-cur]", tabs).forEach(function (b) { b.classList.toggle("is-on", b.getAttribute("data-cur") === st.cur); }); }
      }
      function set(k, val) { v()[k] = val; paint(); }

      $("#frm-z", box).oninput = function () { set("z", parseFloat(this.value)); };
      $("#frm-x", box).oninput = function () { set("x", parseFloat(this.value)); };
      $("#frm-y", box).oninput = function () { set("y", parseFloat(this.value)); };
      $$("[data-fit]", box).forEach(function (b) { b.onclick = function () { set("fit", b.getAttribute("data-fit")); }; });
      $$("[data-cur]", box).forEach(function (b) { b.onclick = function () { st.cur = b.getAttribute("data-cur"); paint(); }; });
      var sm = $("#frm-same", box);
      if (sm) sm.onchange = function () {
        same = sm.checked;
        if (same) { st.m = null; st.cur = "d"; } else { st.m = Object.assign({}, st.d); st.cur = "m"; }
        paint();
      };

      // Arrastrar para mover
      $$(".frm__f", box).forEach(function (f) {
        var win = $(".frm__win", f), drag = null;
        win.addEventListener("pointerdown", function (ev) {
          var fid = f.getAttribute("data-f");
          if (sep && !same && fid !== st.cur) { st.cur = fid; if (fid === "m" && !st.m) st.m = Object.assign({}, st.d); paint(); }
          var e = v();
          drag = { x: ev.clientX, y: ev.clientY, ex: e.x, ey: e.y, w: win.clientWidth, h: win.clientHeight };
          win.setPointerCapture(ev.pointerId); win.classList.add("is-drag");
        });
        win.addEventListener("pointermove", function (ev) {
          if (!drag) return;
          var e = v(), k = e.fit === "contain" ? 1 : -1;
          // Se mueve más despacio cuando la foto está acercada
          e.x = clamp(drag.ex + k * (ev.clientX - drag.x) / drag.w * 100 / Math.max(1, e.z * 0.8), 0, 100);
          e.y = clamp(drag.ey + k * (ev.clientY - drag.y) / drag.h * 100 / Math.max(1, e.z * 0.8), 0, 100);
          paint();
        });
        function end() { drag = null; win.classList.remove("is-drag"); }
        win.addEventListener("pointerup", end); win.addEventListener("pointercancel", end);
      });

      function close(val) { box.hidden = true; box.innerHTML = ""; document.removeEventListener("keydown", key); resolve(val); }
      function key(e) { if (e.key === "Escape") close(null); }
      document.addEventListener("keydown", key);
      box.onclick = function (e) {
        var b = e.target.closest("[data-fx]"); if (!b) return;
        var a = b.getAttribute("data-fx");
        if (a === "cancel") close(null);
        if (a === "reset") { var e2 = v(); e2.x = 50; e2.y = 50; e2.z = 1; paint(); }
        if (a === "ok") close(sep ? { d: st.d, m: same ? null : st.m } : st.d);
      };
      paint();
    });
  }

  /** Estilos de vista previa para miniaturas del panel. */
  function bgStyle(enc) {
    var e = norm(enc);
    return "background-position:" + e.x + "% " + e.y + "%;background-size:" + (e.fit === "contain" ? "contain" : "cover") + ";background-repeat:no-repeat;";
  }
  window.ACFrame = { open: open, norm: norm, bgStyle: bgStyle };
})();

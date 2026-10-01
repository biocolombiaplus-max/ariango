/* Simuladores de sucesiones — Ariango Consultores
   Orientativos: sucesión sin testamento (intestada), Código Civil arts. 1045 a 1051. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Valor de la UVT usado para la exención de vivienda (actualícelo cada año). */
  var UVT = 49799;          // UVT 2025 (Resolución DIAN 000193 de 2024)
  var EXENTA_VIVIENDA = 13000; // UVT exentas de la vivienda del causante (E.T., art. 307)
  var TARIFA = 0.15;        // Ganancia ocasional (Ley 2277 de 2022)

  function money(n) { return "$ " + Math.round(Number(n) || 0).toLocaleString("es-CO"); }
  function num(v) { return Number(String(v || "").replace(/\D/g, "")) || 0; }
  function moneyInput(el) { el.addEventListener("input", function () { var n = num(el.value); el.value = n ? n.toLocaleString("es-CO") : ""; }); }
  function talk(summary) { if (window.AC && window.AC.openModal) window.AC.openModal("Sucesión / herencia", summary); }
  function stepper(name, label, val, max) {
    return '<div class="sim-f"><label>' + label + '</label><div class="sim-step" data-step="' + name + '"><button type="button" data-d="-1">−</button><output>' + val + '</output><button type="button" data-d="1">+</button></div></div>' ;
  }
  function seg(name, label, opts, val) {
    return '<div class="sim-f"><label>' + label + '</label><div class="sim-seg" data-seg="' + name + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" class="' + (String(o[0]) === String(val) ? "is-on" : "") + '">' + o[1] + "</button>"; }).join("") + "</div></div>";
  }

  /* ---------- Tabs ---------- */
  $$("[data-sim]").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("[data-sim]").forEach(function (x) { x.classList.toggle("is-on", x === b); });
      $$(".sim__panel").forEach(function (p) { p.hidden = p.id !== "sim-" + b.getAttribute("data-sim"); });
    });
  });

  /* ---------- 1. ¿Quién hereda y cuánto? ---------- */
  var R = { valor: 300000000, conyuge: "si", social: "1", hijos: 2, padres: 0, hermanos: 0 };
  var rp = $("#sim-reparto");
  function drawReparto() {
    rp.innerHTML = '<div class="sim-grid"><div class="sim-in">' +
      '<div class="sim-f"><label>Valor aproximado de todos los bienes</label><div class="sim-money"><span>$</span><input inputmode="numeric" id="r-valor" value="' + R.valor.toLocaleString("es-CO") + '"></div></div>' +
      seg("conyuge", "¿Estaba casado(a) o tenía compañero(a) permanente?", [["si", "Sí"], ["no", "No"]], R.conyuge) +
      (R.conyuge === "si" ? seg("social", "¿Los bienes se compraron durante la unión?", [["1", "Todos"], ["0.5", "La mitad"], ["0", "Ninguno"]], R.social) : "") +
      stepper("hijos", "Número de hijos (vivos, o fallecidos con hijos)", R.hijos) +
      (R.hijos === 0 ? seg("padres", "¿Cuántos padres del fallecido viven?", [[0, "Ninguno"], [1, "Uno"], [2, "Ambos"]], R.padres) : "") +
      (R.hijos === 0 && R.padres === 0 ? stepper("hermanos", "Número de hermanos", R.hermanos) : "") +
      '</div><div class="sim-out" id="r-out"></div></div>';
    moneyInput($("#r-valor", rp));
    $("#r-valor", rp).addEventListener("input", function (e) { R.valor = num(e.target.value); calcReparto(); });
    calcReparto();
  }
  rp.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var sg = b.closest("[data-seg]"), st = b.closest("[data-step]");
    if (sg) { var k = sg.getAttribute("data-seg"), v = b.getAttribute("data-v"); R[k] = /^\d+$/.test(v) && k !== "social" ? Number(v) : v; drawReparto(); }
    if (st) { var k2 = st.getAttribute("data-step"); R[k2] = Math.max(0, Math.min(15, R[k2] + Number(b.getAttribute("data-d")))); drawReparto(); }
    if (b.hasAttribute("data-talk")) talk(rp._summary);
  });
  function calcReparto() {
    var V = R.valor, cony = R.conyuge === "si";
    var gan = cony ? V * Number(R.social) * 0.5 : 0, H = V - gan, out = [], note = "", law = "";
    if (R.hijos > 0) {
      for (var i = 0; i < R.hijos; i++) out.push(["Hijo(a) " + (i + 1), H / R.hijos]);
      law = "Primer orden: los hijos heredan por partes iguales (Código Civil, art. 1045).";
      if (cony) note = "El cónyuge o compañero(a) recibe sus gananciales y, si carece de recursos suficientes, puede reclamar la porción conyugal (arts. 1230 y ss.).";
    } else if (R.padres > 0) {
      var n = R.padres + (cony ? 1 : 0);
      for (var j = 0; j < R.padres; j++) out.push([R.padres === 1 ? "Padre o madre" : (j ? "Madre" : "Padre"), H / n]);
      if (cony) out.push(["Cónyuge / compañero(a) (herencia)", H / n]);
      law = "Segundo orden: padres y cónyuge o compañero(a), por partes iguales (art. 1046).";
    } else if (cony || R.hermanos > 0) {
      if (cony && R.hermanos > 0) { out.push(["Cónyuge / compañero(a) (herencia)", H / 2]); for (var k = 0; k < R.hermanos; k++) out.push(["Hermano(a) " + (k + 1), H / 2 / R.hermanos]); }
      else if (cony) out.push(["Cónyuge / compañero(a) (herencia)", H]);
      else for (var m = 0; m < R.hermanos; m++) out.push(["Hermano(a) " + (m + 1), H / R.hermanos]);
      law = "Tercer orden: cónyuge o compañero(a) y hermanos; la mitad para cada parte (art. 1047).";
      if (R.hermanos > 0) note = "Los medios hermanos reciben la mitad de lo que recibe un hermano de padre y madre.";
    } else {
      law = "Heredarían los sobrinos y, a falta de ellos, el ICBF (art. 1051).";
    }
    var max = Math.max.apply(null, out.map(function (o) { return o[1]; }).concat([gan, 1]));
    var rows = (gan ? '<div class="sim-bar sim-bar--g"><span>Gananciales del cónyuge / compañero(a)<small>No es herencia: es su mitad de lo adquirido en la unión</small></span><b>' + money(gan) + '</b><i style="width:' + (gan / max * 100) + '%"></i></div>' : "") +
      out.map(function (o) { return '<div class="sim-bar"><span>' + o[0] + "</span><b>" + money(o[1]) + '</b><i style="width:' + (o[1] / max * 100) + '%"></i></div>'; }).join("");
    $("#r-out", rp).innerHTML = '<span class="sim-kicker">Resultado orientativo</span><h3>Así se repartiría</h3>' +
      '<p class="sim-total">Herencia a repartir: <b>' + money(H) + "</b></p>" + rows +
      '<p class="sim-law">⚖️ ' + law + "</p>" + (note ? '<p class="sim-note">ℹ️ ' + note + "</p>" : "") +
      '<button type="button" class="btn btn--wa btn--block" data-talk><svg class="ic"><use href="#i-wa"/></svg> Hablar con un abogado sobre mi caso</button>' +
      '<small class="sim-disc">Sin testamento y sin descontar deudas. Cada caso puede variar.</small>';
    rp._summary = "Usé el simulador de herencia: bienes por " + money(V) + (cony ? ", con cónyuge/compañero(a)" : "") + ", " + R.hijos + " hijo(s). " + law;
  }
  drawReparto();

  /* ---------- 2. Impuesto aproximado ---------- */
  var T = { herencia: 300000000, vivienda: 200000000, tiene: "si" };
  var tp = $("#sim-impuesto");
  function drawTax() {
    tp.innerHTML = '<div class="sim-grid"><div class="sim-in">' +
      '<div class="sim-f"><label>Valor de lo que se hereda (sin gananciales)</label><div class="sim-money"><span>$</span><input inputmode="numeric" id="t-h" value="' + T.herencia.toLocaleString("es-CO") + '"></div></div>' +
      seg("tiene", "¿Incluye la vivienda donde vivía el fallecido?", [["si", "Sí"], ["no", "No"]], T.tiene) +
      (T.tiene === "si" ? '<div class="sim-f"><label>Valor de esa vivienda</label><div class="sim-money"><span>$</span><input inputmode="numeric" id="t-v" value="' + T.vivienda.toLocaleString("es-CO") + '"></div></div>' : "") +
      '</div><div class="sim-out" id="t-out"></div></div>';
    $$("input", tp).forEach(function (el) { moneyInput(el); el.addEventListener("input", function () { T.herencia = num($("#t-h", tp).value); if ($("#t-v", tp)) T.vivienda = num($("#t-v", tp).value); calcTax(); }); });
    calcTax();
  }
  tp.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var sg = b.closest("[data-seg]");
    if (sg) { T[sg.getAttribute("data-seg")] = b.getAttribute("data-v"); drawTax(); }
    if (b.hasAttribute("data-talk")) talk(tp._summary);
  });
  function calcTax() {
    var ex = T.tiene === "si" ? Math.min(T.vivienda, EXENTA_VIVIENDA * UVT) : 0;
    var base = Math.max(0, T.herencia - ex), imp = base * TARIFA;
    $("#t-out", tp).innerHTML = '<span class="sim-kicker">Estimado</span><h3>Impuesto de ganancia ocasional</h3>' +
      '<div class="sim-kpi"><div><span>Valor heredado</span><b>' + money(T.herencia) + "</b></div><div><span>Exención vivienda</span><b>− " + money(ex) + '</b></div><div><span>Base gravable</span><b>' + money(base) + '</b></div><div class="is-hl"><span>Impuesto aprox. (15%)</span><b>' + money(imp) + "</b></div></div>" +
      '<p class="sim-note">ℹ️ La vivienda del fallecido tiene exentas las primeras ' + EXENTA_VIVIENDA.toLocaleString("es-CO") + " UVT (" + money(EXENTA_VIVIENDA * UVT) + " con la UVT de referencia de " + money(UVT) + "). Existen otras exenciones que revisamos en su caso.</p>" +
      '<p class="sim-note">Además pueden causarse derechos notariales y de registro y el impuesto departamental de registro.</p>' +
      '<button type="button" class="btn btn--wa btn--block" data-talk><svg class="ic"><use href="#i-wa"/></svg> Quiero calcularlo con un abogado</button>' +
      '<small class="sim-disc">Cálculo orientativo (Estatuto Tributario, arts. 302 a 307; Ley 2277 de 2022). El valor real depende de los avalúos y de cada heredero.</small>';
    tp._summary = "Usé el simulador de impuesto: herencia por " + money(T.herencia) + ", impuesto aproximado " + money(imp) + ".";
  }
  drawTax();

  /* ---------- 3. ¿Notaría o juez? ---------- */
  var Vq = {}, vp = $("#sim-via");
  var QV = [
    ["acuerdo", "¿Todos los herederos están de acuerdo con el reparto?", [["si", "Sí, todos"], ["no", "No"], ["ns", "No sé"]]],
    ["ubicados", "¿Todos los herederos están identificados y localizables?", [["si", "Sí"], ["no", "Falta alguien"]]],
    ["exterior", "¿Hay bienes o herederos en Venezuela u otro país?", [["si", "Sí"], ["no", "No"]]]
  ];
  function drawVia() {
    var next = QV.find(function (q) { return !Vq[q[0]]; });
    if (next) {
      var i = QV.indexOf(next);
      vp.innerHTML = '<div class="sim-q"><span class="sim-kicker">Pregunta ' + (i + 1) + " de 3</span><h3>" + next[1] + '</h3><div class="sim-opts">' + next[2].map(function (o) { return '<button type="button" data-k="' + next[0] + '" data-v="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</div>" + (i ? '<button type="button" class="sim-back" data-back>← Atrás</button>' : "") + "</div>";
      return;
    }
    var notarial = Vq.acuerdo === "si" && Vq.ubicados === "si";
    var title = notarial ? "Su sucesión puede hacerse en notaría" : Vq.acuerdo === "ns" ? "Primero verificamos el acuerdo" : "Su sucesión debe tramitarse ante juez";
    var txt = notarial ? "Como todos están de acuerdo y localizables, puede tramitarse ante notario, que suele ser la vía más ágil (Decreto 902 de 1988)." :
      Vq.acuerdo === "ns" ? "Si logramos el acuerdo de todos, se hace en notaría (más ágil); si no, ante juez. Le ayudamos a conversar con los demás herederos." :
      "Cuando hay desacuerdo o herederos que no aparecen, el juez cita a todos y protege la parte de cada uno (Código General del Proceso, arts. 487 y ss.).";
    vp.innerHTML = '<div class="sim-q sim-q--res"><span class="sim-kicker">Resultado</span><h3>' + title + "</h3><p>" + txt + "</p>" +
      (Vq.exterior === "si" ? '<p class="sim-note">🌎 Además, coordinamos los poderes y trámites para los bienes o herederos en el exterior.</p>' : "") +
      '<button type="button" class="btn btn--wa btn--block" data-talk><svg class="ic"><use href="#i-wa"/></svg> Iniciar mi sucesión</button><button type="button" class="sim-back" data-reset>Volver a empezar</button></div>';
    vp._summary = "Hice el test de vías: " + title + ".";
  }
  vp.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-k")) { Vq[b.getAttribute("data-k")] = b.getAttribute("data-v"); drawVia(); }
    if (b.hasAttribute("data-back")) { var ks = QV.map(function (q) { return q[0]; }).filter(function (k) { return Vq[k]; }); delete Vq[ks.pop()]; drawVia(); }
    if (b.hasAttribute("data-reset")) { Vq = {}; drawVia(); }
    if (b.hasAttribute("data-talk")) talk(vp._summary);
  });
  drawVia();
})();

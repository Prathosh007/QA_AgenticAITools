/* ============================================================
   Chart beautifier — turns flat Plotly bars into gradient bars
   (dark base -> lighter tip) with a soft drop shadow.
   Purely cosmetic and fully defensive: if anything is missing
   the bars simply stay solid. Re-applies after every redraw.
   ============================================================ */
(function () {
  var NS = "http://www.w3.org/2000/svg";

  function shade(rgb, f) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
    if (!m) return rgb;
    var r = +m[1], g = +m[2], b = +m[3];
    if (f < 1) { r *= f; g *= f; b *= f; }
    else { var t = f - 1; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
    return "rgb(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + ")";
  }

  function ensureDefs(svg) {
    var d = svg.querySelector("defs");
    if (!d) { d = document.createElementNS(NS, "defs"); svg.insertBefore(d, svg.firstChild); }
    return d;
  }

  function ensureGrad(defs, id, horizontal, color) {
    if (defs.querySelector("#" + id)) return;
    var lg = document.createElementNS(NS, "linearGradient");
    lg.setAttribute("id", id);
    lg.setAttribute("x1", "0"); lg.setAttribute("y1", horizontal ? "0" : "1");
    lg.setAttribute("x2", horizontal ? "1" : "0"); lg.setAttribute("y2", "0");
    var s1 = document.createElementNS(NS, "stop");
    s1.setAttribute("offset", "0%"); s1.setAttribute("stop-color", shade(color, 0.55));
    var s2 = document.createElementNS(NS, "stop");
    s2.setAttribute("offset", "100%"); s2.setAttribute("stop-color", shade(color, 1.32));
    lg.appendChild(s1); lg.appendChild(s2); defs.appendChild(lg);
  }

  function ensureShadow(defs) {
    if (defs.querySelector("#barShadow")) return;
    var f = document.createElementNS(NS, "filter");
    f.setAttribute("id", "barShadow");
    f.setAttribute("x", "-20%"); f.setAttribute("y", "-20%");
    f.setAttribute("width", "140%"); f.setAttribute("height", "140%");
    var ds = document.createElementNS(NS, "feDropShadow");
    ds.setAttribute("dx", "0"); ds.setAttribute("dy", "1.5");
    ds.setAttribute("stdDeviation", "2.2");
    ds.setAttribute("flood-color", "#0f2b4a"); ds.setAttribute("flood-opacity", "0.28");
    f.appendChild(ds); defs.appendChild(f);
  }

  function enhance(gd) {
    try {
      if (!gd.data) return;
      var bar = null;
      for (var i = 0; i < gd.data.length; i++) {
        if (gd.data[i].type === "bar") { bar = gd.data[i]; break; }
      }
      if (!bar) return;
      var horizontal = bar.orientation === "h";
      var svg = gd.querySelector(".main-svg");
      if (!svg) return;
      var defs = ensureDefs(svg);
      ensureShadow(defs);
      var paths = gd.querySelectorAll(".barlayer .point path");
      paths.forEach(function (p) {
        var fill = p.style.fill || p.getAttribute("fill");
        if (!fill || fill.indexOf("url(") === 0) return;
        var id = "bg_" + (horizontal ? "h" : "v") + "_" + fill.replace(/[^0-9]/g, "");
        ensureGrad(defs, id, horizontal, fill);
        p.style.fill = "url(#" + id + ")";
        p.style.filter = "url(#barShadow)";
      });
    } catch (e) { /* leave bars solid on any error */ }
  }

  function run() {
    document.querySelectorAll(".js-plotly-plot").forEach(function (gd) {
      enhance(gd);
      if (typeof gd.on === "function") {
        gd.on("plotly_afterplot", function () { enhance(gd); });
      }
    });
  }

  function boot() { setTimeout(run, 250); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  window.addEventListener("load", boot);
})();

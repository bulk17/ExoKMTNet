(function () {
  "use strict";

  var RAW = window.KMTNET_PLANETS || [];

  var BD_PLANET_MASS_CUTOFF = 30; // M_Jup — above this, treat as BD/planet-boundary regardless of source notes

  function classify(row) {
    if (row.is_ffp) return "ffp";
    if (row.is_host_only_row && (row.type_note === "BD/Planet" || row.type_note === "BD")) return "bdplanet";
    if (row.pl_bmassj != null && row.pl_bmassj > BD_PLANET_MASS_CUTOFF) return "bdplanet";
    return "planet";
  }

  var TYPE_LABEL = {
    planet: "Planet",
    bdplanet: "Planet/BD",
    ffp: "Free-floating",
  };

  var rows = RAW.map(function (r, i) {
    return Object.assign({}, r, {
      _id: i,
      _type: classify(r),
    });
  });

  var nonFfpRows = rows.filter(function (r) { return r._type !== "ffp"; });

  // Non-KMTNet microlensing planets (NASA Exoplanet Archive), used only by the
  // cumulative "all microlensing planets" chart below — kept out of `rows` so
  // every other chart on this page stays scoped to the KMTNet catalog.
  var OTHER_RAW = window.OTHER_MICROLENSING_EVENTS || [];
  var otherRows = OTHER_RAW.map(function (r, i) {
    return Object.assign({}, r, { _id: "other-" + i, _type: classify(r) });
  });

  // ---------------- Theme ----------------
  var themeToggle = document.getElementById("themeToggle");
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  try {
    var savedTheme = localStorage.getItem("kmtnet-theme");
    if (savedTheme) applyTheme(savedTheme);
  } catch (e) {}
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var next;
      if (!cur) {
        var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        next = prefersDark ? "light" : "dark";
      } else {
        next = cur === "dark" ? "light" : "dark";
      }
      applyTheme(next);
      try { localStorage.setItem("kmtnet-theme", next); } catch (e) {}
    });
  }

  // ---------------- Shared table/format helpers (for the year-bar popup + drawer) ----------------
  var COLUMNS = [
    { key: "seq", label: "#", numeric: true },
    { key: "name", label: "Planet Name" },
    { key: "_type", label: "Type" },
    { key: "pl_bmassj", label: "Mass", unit: "M_J", numeric: true },
    { key: "pl_bmasse", label: "Mass", unit: "M_E", numeric: true },
    { key: "pl_orbsmax", label: "a", unit: "au", numeric: true },
    { key: "st_mass", label: "M_star", unit: "M_sun", numeric: true },
    { key: "sy_dist", label: "Distance", unit: "pc", numeric: true },
    { key: "ra", label: "RA" },
    { key: "dec", label: "Dec" },
    { key: "pub_year", label: "Year", numeric: true },
    { key: "ads_link", label: "Publication" },
  ];

  function fmtNum(v, digits) {
    if (v === null || v === undefined || v === "" || isNaN(v)) return null;
    var n = Number(v);
    return digits === undefined ? n.toLocaleString() : n.toFixed(digits);
  }

  function fmtAdaptive(v) {
    if (v === null || v === undefined || v === "" || isNaN(v)) return null;
    var n = Number(v);
    var abs = Math.abs(n);
    var digits = abs < 0.01 ? 4 : abs < 0.1 ? 3 : 2;
    return n.toFixed(digits);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function errParts(err1, err2, digits) {
    if (err1 == null || err2 == null) return null;
    var fmt = function (v) { return digits === undefined ? fmtAdaptive(v) : fmtNum(v, digits); };
    var hi = fmt(err1), lo = fmt(err2);
    if (hi === null || lo === null) return null;
    return { hi: hi, lo: lo };
  }

  function numOrNA(v, digits, err1, err2, isLimit, unmeasurable) {
    var f = digits === undefined ? fmtAdaptive(v) : fmtNum(v, digits);
    if (f === null) return unmeasurable ? '<span class="na">—</span>' : '<span class="na">TBD</span>';
    if (isLimit) f = "≲" + f;
    var parts = errParts(err1, err2, digits);
    if (!parts) return '<span class="val">' + f + "</span>";
    return (
      '<span class="val">' + f +
      '<span class="err-stack" title="+' + escapeAttr(parts.hi) + " / " + escapeAttr(parts.lo) + '">' +
      "<span>+" + parts.hi + "</span><span>" + parts.lo + "</span>" +
      "</span>" +
      "</span>"
    );
  }

  function cellHtml(row, col, rank) {
    if (col.key === "seq") {
      return rank != null ? String(rank) : String(row.seq);
    }
    if (col.key === "name") {
      return (
        '<div class="name-cell"><strong>' + escapeHtml(row.name) + "</strong>" +
        '<span class="host">' + escapeHtml(row.host_guess || "") + "</span></div>"
      );
    }
    if (col.key === "_type") {
      return '<span class="pill ' + row._type + '">' + TYPE_LABEL[row._type] + "</span>";
    }
    if (col.key === "ads_link") {
      return row.ads_link
        ? '<a href="' + escapeAttr(row.ads_link) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">ADS ↗</a>'
        : '<span class="na">—</span>';
    }
    if (col.key === "pl_bmassj") return numOrNA(row.pl_bmassj, undefined, row.pl_bmassj_err1, row.pl_bmassj_err2, row.pl_bmassj_upper_limit);
    if (col.key === "pl_bmasse") return numOrNA(row.pl_bmasse, 1, row.pl_bmasse_err1, row.pl_bmasse_err2, row.pl_bmassj_upper_limit);
    if (col.key === "pl_orbsmax") return numOrNA(row.pl_orbsmax, undefined, row.pl_orbsmax_err1, row.pl_orbsmax_err2, false, row.pl_orbsmax_unmeasurable);
    if (col.key === "st_mass") return numOrNA(row.st_mass, undefined, row.st_mass_err1, row.st_mass_err2, false, row.st_mass_unmeasurable);
    if (col.key === "sy_dist") return numOrNA(row.sy_dist, 0, row.sy_dist_err1, row.sy_dist_err2, false, row.sy_dist_unmeasurable);
    if (col.key === "ra" || col.key === "dec") return row[col.key] != null ? fmtNum(row[col.key], 4) : '<span class="na">TBD</span>';
    var v = row[col.key];
    return v === null || v === undefined || v === "" ? '<span class="na">—</span>' : escapeHtml(String(v));
  }

  // ---------------- Drawer (planet detail) ----------------
  var overlay = document.getElementById("overlay");
  var drawer = document.getElementById("drawer");
  var drawerBody = document.getElementById("drawerBody");
  var drawerClose = document.getElementById("drawerClose");

  function field(label, value) {
    return "<dt>" + label + "</dt><dd>" + (value === null || value === undefined || value === "" ? '<span class="na">—</span>' : value) + "</dd>";
  }

  function withErr(v, digits, err1, err2, isLimit) {
    var f = digits === undefined ? fmtAdaptive(v) : fmtNum(v, digits);
    if (f === null) return null;
    if (isLimit) f = "≲" + f;
    var parts = errParts(err1, err2, digits);
    return parts ? f + " (+" + parts.hi + " / " + parts.lo + ")" : f;
  }

  function openDrawer(row) {
    var html =
      "<h2>" + escapeHtml(row.name) + "</h2>" +
      '<span class="pill ' + row._type + '">' + TYPE_LABEL[row._type] + "</span>" +
      (row.title ? '<p class="title-text">' + escapeHtml(row.title) + "</p>" : "") +
      "<dl>" +
      field("Host star", escapeHtml(row.host_guess || "")) +
      field("Discovery/Pub. year", row.pub_year) +
      field("Discovery method", row.discoverymethod || "Microlensing") +
      field("Telescope", row.disc_telescope) +
      field("Facility", row.disc_facility) +
      field("Mass (M_Jup)", withErr(row.pl_bmassj, undefined, row.pl_bmassj_err1, row.pl_bmassj_err2, row.pl_bmassj_upper_limit)) +
      field("Mass (M_Earth)", withErr(row.pl_bmasse, 1, row.pl_bmasse_err1, row.pl_bmasse_err2, row.pl_bmassj_upper_limit)) +
      field("Semi-major axis (au)", withErr(row.pl_orbsmax, undefined, row.pl_orbsmax_err1, row.pl_orbsmax_err2)) +
      field("Host star mass (M_sun)", withErr(row.st_mass, undefined, row.st_mass_err1, row.st_mass_err2)) +
      field("Distance (pc)", withErr(row.sy_dist, 0, row.sy_dist_err1, row.sy_dist_err2)) +
      field("RA", row.ra != null ? fmtNum(row.ra, 5) : null) +
      field("Dec", row.dec != null ? fmtNum(row.dec, 5) : null) +
      field("Release date", row.releasedate) +
      field("Notes", row.mass_note || row.type_note) +
      "</dl>" +
      (row.ads_link ? '<a class="abstract-link" href="' + escapeAttr(row.ads_link) + '" target="_blank" rel="noopener">Read discovery paper (ADS) ↗</a>' : "");
    drawerBody.innerHTML = html;
    overlay.classList.add("open");
    drawer.classList.add("open");
  }

  function closeDrawer() {
    overlay.classList.remove("open");
    drawer.classList.remove("open");
  }
  overlay.addEventListener("click", closeDrawer);
  drawerClose.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeDrawer(); closeYearModal(); }
  });

  // ---------------- Chart: discoveries per year (free-floating candidates excluded) ----------------
  (function renderChart() {
    var svg = document.getElementById("yearChart");
    if (!svg) return;
    var byYear = {};
    nonFfpRows.forEach(function (r) {
      var y = r.pub_year;
      if (!y) return;
      byYear[y] = byYear[y] || { total: 0, bd: 0 };
      byYear[y].total++;
      if (r._type === "bdplanet") byYear[y].bd++;
    });
    var yearsSorted = Object.keys(byYear).map(Number).sort(function (a, b) { return a - b; });
    if (!yearsSorted.length) return;

    var W = 1100, H = 154, padL = 32, padB = 22, padT = 20, padR = 8;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;
    var maxVal = Math.max.apply(null, yearsSorted.map(function (y) { return byYear[y].total; }));
    var barW = innerW / yearsSorted.length;

    svg.setAttribute("viewBox", "0 0 " + W + " " + H);

    var svgns = "http://www.w3.org/2000/svg";
    function el(tag, attrs) {
      var e = document.createElementNS(svgns, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }

    svg.appendChild(el("line", {
      class: "axis-line", x1: padL, y1: H - padB, x2: W - padR, y2: H - padB,
    }));

    yearsSorted.forEach(function (y, i) {
      var d = byYear[y];
      var x = padL + i * barW;
      var planetH = ((d.total - d.bd) / maxVal) * innerH;
      var bdH = (d.bd / maxVal) * innerH;
      var yBase = H - padB;

      var group = el("g", { class: "year-group" });
      group.style.cursor = "pointer";
      group.addEventListener("click", function () { openYearModal(y); });
      var titleEl = document.createElementNS(svgns, "title");
      titleEl.textContent = "View " + d.total + " planets from " + y;
      group.appendChild(titleEl);

      group.appendChild(el("rect", {
        class: "bar-hit",
        x: x, y: padT, width: barW, height: innerH,
      }));

      var segs = [
        { h: planetH, cls: "bar" },
        { h: bdH, cls: "bar bd" },
      ];
      segs.forEach(function (s) {
        if (s.h <= 0) return;
        yBase -= s.h;
        group.appendChild(el("rect", {
          class: s.cls,
          x: x + barW * 0.12,
          y: yBase,
          width: Math.max(barW * 0.76, 1),
          height: s.h,
          rx: 1.5,
        }));
      });

      svg.appendChild(group);

      var countLabel = el("text", { class: "bar-label", x: x + barW / 2, y: yBase - 4, "text-anchor": "middle" });
      countLabel.textContent = String(d.total);
      svg.appendChild(countLabel);

      var t = el("text", { x: x + barW / 2, y: H - 6, "text-anchor": "middle" });
      t.textContent = String(y);
      svg.appendChild(t);
    });
  })();

  // ---------------- Chart: cumulative total & KMTNet's yearly share ----------------
  // Both lines share ONE linear axis (plain counts) instead of a dual left/right
  // scale — a percentage is just a number from 0-100, so plotting it as a raw
  // value on the same count axis as the cumulative total keeps it honestly
  // below the total it's a share of, instead of two independently-scaled axes
  // making the share line *look* like it tops out higher than the total. The
  // KMTNet share is each year's own KMTNet-count/total-count ratio (bounded
  // 0-100% by construction), shown from 2016 (KMTNet's first confirmed planet).
  (function renderCumulativeChart() {
    var svg = document.getElementById("cumulativeChart");
    if (!svg) return;

    var KMT_SHARE_START_YEAR = 2016;
    var kmtByYear = {}, otherByYear = {};
    rows.forEach(function (r) {
      if (r._type === "planet" && r.pub_year) kmtByYear[r.pub_year] = (kmtByYear[r.pub_year] || 0) + 1;
    });
    otherRows.forEach(function (r) {
      if (r._type === "planet" && r.pub_year) otherByYear[r.pub_year] = (otherByYear[r.pub_year] || 0) + 1;
    });

    var allYears = Object.keys(kmtByYear).concat(Object.keys(otherByYear)).map(Number);
    if (!allYears.length) return;
    var minYear = Math.min.apply(null, allYears);
    var maxYear = Math.max.apply(null, allYears);

    var cumTotal = 0, cumKmt = 0;
    var points = [];
    for (var y = minYear; y <= maxYear; y++) {
      var k = kmtByYear[y] || 0;
      var o = otherByYear[y] || 0;
      var t = k + o;
      cumTotal += t;
      cumKmt += k;
      points.push({
        year: y,
        cumTotal: cumTotal,
        kmtYear: k,
        totalYear: t,
        yearlyPct: (y >= KMT_SHARE_START_YEAR && t > 0) ? Math.round((k / t) * 100) : null,
      });
    }

    var W = 1100, H = 220, padL = 34, padR = 14, padT = 28, padB = 22;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;
    var n = points.length;
    var stepX = n > 1 ? innerW / (n - 1) : 0;

    var maxCum = Math.max.apply(null, points.map(function (p) { return p.cumTotal; }));
    var axisMax = Math.max(100, Math.ceil(maxCum / 50) * 50);
    if (axisMax <= maxCum) axisMax += 50;

    function xPix(i) { return padL + i * stepX; }
    function yPix(v) { return padT + innerH - (v / axisMax) * innerH; }

    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = "";

    var svgns = "http://www.w3.org/2000/svg";
    function el(tag, attrs) {
      var e = document.createElementNS(svgns, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }

    // A single reference line at 100 — the hard ceiling a percentage can never
    // cross — so it's visible at a glance that the share line stays under it.
    var y100 = yPix(100);
    svg.appendChild(el("line", { class: "grid-line pct-ceiling", x1: padL, y1: y100, x2: W - padR, y2: y100 }));
    var y100Label = el("text", { class: "pct-label", x: padL - 6, y: y100 + 3, "text-anchor": "end" });
    y100Label.textContent = "100%";
    svg.appendChild(y100Label);

    [0, axisMax].forEach(function (v) {
      if (v === 100) return;
      var gy = yPix(v);
      var lt = el("text", { x: padL - 6, y: gy + 3, "text-anchor": "end" });
      lt.textContent = String(Math.round(v));
      svg.appendChild(lt);
    });

    svg.appendChild(el("line", { class: "axis-line", x1: padL, y1: H - padB, x2: W - padR, y2: H - padB }));

    points.forEach(function (p, i) {
      var xt = el("text", { x: xPix(i), y: H - 6, "text-anchor": "middle" });
      xt.textContent = String(p.year);
      svg.appendChild(xt);
    });

    var cumPath = points.map(function (p, i) {
      return (i === 0 ? "M" : "L") + xPix(i) + " " + yPix(p.cumTotal);
    }).join(" ");
    svg.appendChild(el("path", { class: "line cum-line", d: cumPath }));

    points.forEach(function (p, i) {
      var group = el("g", { class: "line-point-group" });
      var titleEl = document.createElementNS(svgns, "title");
      titleEl.textContent = p.year + ": " + p.cumTotal + " cumulative planets";
      group.appendChild(titleEl);
      group.appendChild(el("circle", { class: "line-point cum-point", cx: xPix(i), cy: yPix(p.cumTotal), r: 3 }));
      svg.appendChild(group);

      var label = el("text", { class: "bar-label", x: xPix(i), y: yPix(p.cumTotal) - 7, "text-anchor": "middle" });
      label.textContent = String(p.cumTotal);
      svg.appendChild(label);
    });

    var pctPoints = points.filter(function (p) { return p.yearlyPct !== null; });
    if (pctPoints.length) {
      var pctPath = pctPoints.map(function (p, i) {
        return (i === 0 ? "M" : "L") + xPix(points.indexOf(p)) + " " + yPix(p.yearlyPct);
      }).join(" ");
      svg.appendChild(el("path", { class: "line pct-line", d: pctPath }));

      pctPoints.forEach(function (p) {
        var idx = points.indexOf(p);
        var group = el("g", { class: "line-point-group" });
        var titleEl = document.createElementNS(svgns, "title");
        titleEl.textContent = p.year + ": KMTNet " + p.kmtYear + " of " + p.totalYear + " (" + p.yearlyPct + "%)";
        group.appendChild(titleEl);
        group.appendChild(el("circle", { class: "line-point pct-point", cx: xPix(idx), cy: yPix(p.yearlyPct), r: 3 }));
        svg.appendChild(group);

        var label = el("text", { class: "bar-label pct-label", x: xPix(idx), y: yPix(p.yearlyPct) + 15, "text-anchor": "middle" });
        label.textContent = p.yearlyPct + "%";
        svg.appendChild(label);
      });
    }
  })();

  // ---------------- Chart: reusable histogram (mass ratio, distance) ----------------
  function buildHistogram(values, binWidth, minEdge, maxEdge) {
    var binCount = Math.max(1, Math.round((maxEdge - minEdge) / binWidth));
    var bins = [];
    for (var i = 0; i < binCount; i++) {
      bins.push({ x0: minEdge + i * binWidth, x1: minEdge + (i + 1) * binWidth, count: 0 });
    }
    values.forEach(function (v) {
      var idx = Math.floor((v - minEdge) / binWidth);
      if (idx < 0) idx = 0;
      if (idx >= bins.length) idx = bins.length - 1;
      bins[idx].count++;
    });
    return bins;
  }

  // opts.contiguous: true draws bars edge-to-edge (a true histogram, adjacent
  // bins touching); false (default) keeps a small gap between bars.
  function renderHistogram(svgId, bins, tickLabelFn, hoverLabelFn, opts) {
    var svg = document.getElementById(svgId);
    if (!svg || !bins.length) return;
    var contiguous = !!(opts && opts.contiguous);

    var W = 1100, H = 154, padL = 32, padB = 22, padT = 16, padR = 8;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;
    var maxVal = Math.max.apply(null, bins.map(function (b) { return b.count; }));
    if (maxVal <= 0) maxVal = 1;
    var barW = innerW / bins.length;
    var insetFrac = contiguous ? 0 : 0.08;
    var rx = contiguous ? 0 : 1.5;

    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = "";

    var svgns = "http://www.w3.org/2000/svg";
    function el(tag, attrs) {
      var e = document.createElementNS(svgns, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }

    svg.appendChild(el("line", {
      class: "axis-line", x1: padL, y1: H - padB, x2: W - padR, y2: H - padB,
    }));

    var tickEvery = Math.max(1, Math.ceil(bins.length / 12));

    bins.forEach(function (b, i) {
      var x = padL + i * barW;
      var h = (b.count / maxVal) * innerH;
      var yTop = H - padB - h;

      var group = el("g", { class: "hist-group" });
      group.style.cursor = "default";
      var titleEl = document.createElementNS(svgns, "title");
      titleEl.textContent = hoverLabelFn(b);
      group.appendChild(titleEl);

      group.appendChild(el("rect", {
        class: "bar-hit", x: x, y: padT, width: barW, height: innerH,
      }));

      if (h > 0) {
        group.appendChild(el("rect", {
          class: "bar",
          x: x + barW * insetFrac,
          y: yTop,
          width: Math.max(barW * (1 - 2 * insetFrac), 1),
          height: h,
          rx: rx,
        }));
        if (barW > 20) {
          var countLabel = el("text", { class: "bar-label", x: x + barW / 2, y: yTop - 4, "text-anchor": "middle" });
          countLabel.textContent = String(b.count);
          svg.appendChild(countLabel);
        }
      }

      svg.appendChild(group);

      if (i % tickEvery === 0 || i === bins.length - 1) {
        var t = el("text", { x: x, y: H - 6, "text-anchor": "middle" });
        t.textContent = tickLabelFn(b);
        svg.appendChild(t);
      }
    });
  }

  // Planet-to-host mass ratio: log10(pl_bmassj[M_Jup] * M_Jup-in-M_sun / st_mass[M_sun])
  (function renderMassRatioChart() {
    var M_JUP_IN_MSUN = 0.0009543;
    var logRatios = [];
    nonFfpRows.forEach(function (r) {
      if (r.is_host_only_row) return;
      if (r.pl_bmassj == null || r.st_mass == null || r.st_mass <= 0) return;
      var q = (r.pl_bmassj * M_JUP_IN_MSUN) / r.st_mass;
      if (q > 0) logRatios.push(Math.log10(q));
    });
    if (!logRatios.length) return;
    var binWidth = 0.25;
    var minEdge = Math.floor(Math.min.apply(null, logRatios) / binWidth) * binWidth;
    var maxEdge = Math.ceil(Math.max.apply(null, logRatios) / binWidth) * binWidth;
    if (maxEdge <= minEdge) maxEdge = minEdge + binWidth;
    var bins = buildHistogram(logRatios, binWidth, minEdge, maxEdge);
    renderHistogram(
      "massRatioChart",
      bins,
      function (b) { return b.x0.toFixed(2); },
      function (b) { return "log₁₀(q) " + b.x0.toFixed(2) + " to " + b.x1.toFixed(2) + ": " + b.count; },
      { contiguous: true }
    );
  })();

  // System distance from the Sun, clipped to 0–10 kpc
  (function renderDistanceChart() {
    var kpcVals = [];
    nonFfpRows.forEach(function (r) {
      if (r.is_host_only_row) return;
      if (r.sy_dist == null) return;
      var kpc = r.sy_dist / 1000;
      if (kpc >= 0 && kpc <= 10) kpcVals.push(kpc);
    });
    if (!kpcVals.length) return;
    var bins = buildHistogram(kpcVals, 0.5, 0, 10);
    renderHistogram(
      "distanceChart",
      bins,
      function (b) { return b.x0.toFixed(1); },
      function (b) { return b.x0.toFixed(1) + "–" + b.x1.toFixed(1) + " kpc: " + b.count; },
      { contiguous: true }
    );
  })();

  // ---------------- Chart: planet mass vs. orbital period (log-log scatter) ----------------
  // Orbital period isn't directly measured for most microlensing planets, so it's
  // derived via Kepler's third law from the semi-major axis and host star mass,
  // assuming a circular orbit: P[yr] = sqrt(a[au]^3 / M_star[M_sun]).
  (function renderMassPeriodChart() {
    var svg = document.getElementById("massPeriodChart");
    if (!svg) return;

    var points = [];
    nonFfpRows.forEach(function (r) {
      if (r.is_host_only_row) return;
      if (r.pl_orbsmax == null || r.st_mass == null || r.st_mass <= 0) return;
      if (r.pl_bmassj == null || r.pl_bmassj <= 0) return;
      var period = Math.sqrt(Math.pow(r.pl_orbsmax, 3) / r.st_mass);
      if (period > 0) points.push({ period: period, mass: r.pl_bmassj, row: r });
    });
    if (!points.length) return;

    var W = 1100, H = 280, padL = 56, padB = 38, padT = 16, padR = 16;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;

    var xVals = points.map(function (p) { return p.period; });
    var yVals = points.map(function (p) { return p.mass; });
    var xMinExp = Math.floor(Math.log10(Math.min.apply(null, xVals)));
    var xMaxExp = Math.ceil(Math.log10(Math.max.apply(null, xVals)));
    var yMinExp = Math.floor(Math.log10(Math.min.apply(null, yVals)));
    var yMaxExp = Math.ceil(Math.log10(Math.max.apply(null, yVals)));
    if (xMaxExp <= xMinExp) xMaxExp = xMinExp + 1;
    if (yMaxExp <= yMinExp) yMaxExp = yMinExp + 1;

    function xPix(v) { return padL + (Math.log10(v) - xMinExp) / (xMaxExp - xMinExp) * innerW; }
    function yPix(v) { return padT + innerH - (Math.log10(v) - yMinExp) / (yMaxExp - yMinExp) * innerH; }
    function fmtTick(exp) {
      var v = Math.pow(10, exp);
      return v >= 1 ? v.toLocaleString() : String(v);
    }

    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = "";

    var svgns = "http://www.w3.org/2000/svg";
    function el(tag, attrs) {
      var e = document.createElementNS(svgns, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }

    for (var xe = xMinExp; xe <= xMaxExp; xe++) {
      var gx = xPix(Math.pow(10, xe));
      svg.appendChild(el("line", { class: "grid-line", x1: gx, y1: padT, x2: gx, y2: H - padB }));
      var xt = el("text", { x: gx, y: H - padB + 14, "text-anchor": "middle" });
      xt.textContent = fmtTick(xe);
      svg.appendChild(xt);
    }
    for (var ye = yMinExp; ye <= yMaxExp; ye++) {
      var gy = yPix(Math.pow(10, ye));
      svg.appendChild(el("line", { class: "grid-line", x1: padL, y1: gy, x2: W - padR, y2: gy }));
      var yt = el("text", { x: padL - 8, y: gy + 3, "text-anchor": "end" });
      yt.textContent = fmtTick(ye);
      svg.appendChild(yt);
    }

    svg.appendChild(el("line", { class: "axis-line", x1: padL, y1: H - padB, x2: W - padR, y2: H - padB }));
    svg.appendChild(el("line", { class: "axis-line", x1: padL, y1: padT, x2: padL, y2: H - padB }));

    var xTitle = el("text", { class: "axis-title", x: padL + innerW / 2, y: H - 4, "text-anchor": "middle" });
    xTitle.textContent = "Orbital period (yr)";
    svg.appendChild(xTitle);

    var yMid = padT + innerH / 2;
    var yTitle = el("text", {
      class: "axis-title", x: 14, y: yMid, "text-anchor": "middle",
      transform: "rotate(-90 14 " + yMid + ")",
    });
    yTitle.textContent = "Planet mass (M_Jup)";
    svg.appendChild(yTitle);

    points.forEach(function (p) {
      var cx = xPix(p.period), cy = yPix(p.mass);
      var group = el("g", { class: "scatter-group" });
      group.addEventListener("click", function () { openDrawer(p.row); });
      var titleEl = document.createElementNS(svgns, "title");
      titleEl.textContent = p.row.name + " — " + p.mass.toFixed(2) + " M_Jup, P ≈ " + p.period.toFixed(3) + " yr";
      group.appendChild(titleEl);
      group.appendChild(el("circle", {
        class: "point" + (p.row._type === "bdplanet" ? " bd" : ""),
        cx: cx, cy: cy, r: 4,
      }));
      svg.appendChild(group);
    });
  })();

  // ---------------- Year-bar popup ----------------
  var yearOverlay = document.getElementById("yearOverlay");
  var yearModal = document.getElementById("yearModal");
  var yearModalClose = document.getElementById("yearModalClose");
  var yearModalTitle = document.getElementById("yearModalTitle");
  var yearModalSubtitle = document.getElementById("yearModalSubtitle");
  var yearThead = document.querySelector("#yearTable thead tr");
  var yearTbody = document.querySelector("#yearTable tbody");

  function openYearModal(year) {
    var yearRows = rows.filter(function (r) { return r.pub_year === year && r._type !== "ffp"; });
    yearRows.sort(function (a, b) { return b.seq - a.seq; });
    var bdCount = yearRows.filter(function (r) { return r._type === "bdplanet"; }).length;

    yearModalTitle.textContent = "Planets Announced in " + year;
    yearModalSubtitle.textContent = yearRows.length + " " + (yearRows.length === 1 ? "entry" : "entries") + " (Planet/BD: " + bdCount + "개)";

    yearThead.innerHTML = COLUMNS.map(function (col) {
      return (
        '<th class="' + (col.key === "name" ? "col-name" : "") + '">' +
        '<span class="col-label">' + escapeHtml(col.label) + "</span>" +
        (col.unit ? '<span class="col-unit">(' + escapeHtml(col.unit) + ")</span>" : "") +
        "</th>"
      );
    }).join("");

    yearTbody.innerHTML = yearRows.map(function (r, i) {
      return (
        '<tr data-id="' + r._id + '">' +
        COLUMNS.map(function (c) { return '<td class="' + (c.key === "name" ? "col-name" : "") + '">' + cellHtml(r, c, i + 1) + "</td>"; }).join("") +
        "</tr>"
      );
    }).join("");

    yearOverlay.classList.add("open");
    yearModal.classList.add("open");
  }

  function closeYearModal() {
    yearOverlay.classList.remove("open");
    yearModal.classList.remove("open");
  }

  yearOverlay.addEventListener("click", closeYearModal);
  yearModalClose.addEventListener("click", closeYearModal);
  yearTbody.addEventListener("click", function (e) {
    var tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    var id = Number(tr.getAttribute("data-id"));
    var row = rows.find(function (r) { return r._id === id; });
    if (row) {
      closeYearModal();
      openDrawer(row);
    }
  });
})();

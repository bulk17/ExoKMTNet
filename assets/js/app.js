(function () {
  "use strict";

  var RAW = window.KMTNET_PLANETS || [];

  function classify(row) {
    if (row.is_ffp) return "ffp";
    if (row.type_note === "BD/Planet") return "bdplanet";
    if (row.type_note === "BD") return "bd";
    return "planet";
  }

  var TYPE_LABEL = {
    planet: "Planet",
    bd: "Brown Dwarf",
    bdplanet: "BD/Planet",
    ffp: "Free-floating",
  };

  var rows = RAW.map(function (r, i) {
    return Object.assign({}, r, {
      _id: i,
      _type: classify(r),
    });
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

  // ---------------- Stats ----------------
  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  var total = rows.length;
  var ffpCount = rows.filter(function (r) { return r._type === "ffp"; }).length;
  var bdCount = rows.filter(function (r) { return r._type === "bd" || r._type === "bdplanet"; }).length;
  var years = rows.map(function (r) { return r.pub_year; }).filter(Boolean);
  var latestYear = years.length ? Math.max.apply(null, years) : "-";
  var matched = rows.filter(function (r) { return r.nasa_matched; }).length;

  setText("statTotal", total);
  setText("statFfp", ffpCount);
  setText("statBd", bdCount);
  setText("statYear", latestYear);
  setText("statMatched", matched + " / " + total);

  // ---------------- Chart: discoveries per year ----------------
  (function renderChart() {
    var svg = document.getElementById("yearChart");
    if (!svg) return;
    var byYear = {};
    rows.forEach(function (r) {
      var y = r.pub_year;
      if (!y) return;
      byYear[y] = byYear[y] || { total: 0, bd: 0, ffp: 0 };
      byYear[y].total++;
      if (r._type === "bd" || r._type === "bdplanet") byYear[y].bd++;
      if (r._type === "ffp") byYear[y].ffp++;
    });
    var yearsSorted = Object.keys(byYear).map(Number).sort(function (a, b) { return a - b; });
    if (!yearsSorted.length) return;

    var W = 1100, H = 220, padL = 32, padB = 22, padT = 10, padR = 8;
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
      var planetH = ((d.total - d.bd - d.ffp) / maxVal) * innerH;
      var bdH = (d.bd / maxVal) * innerH;
      var ffpH = (d.ffp / maxVal) * innerH;
      var yBase = H - padB;

      var segs = [
        { h: planetH, cls: "bar" },
        { h: bdH, cls: "bar bd" },
        { h: ffpH, cls: "bar ffp" },
      ];
      segs.forEach(function (s) {
        if (s.h <= 0) return;
        yBase -= s.h;
        svg.appendChild(el("rect", {
          class: s.cls,
          x: x + barW * 0.12,
          y: yBase,
          width: Math.max(barW * 0.76, 1),
          height: s.h,
          rx: 1.5,
        }));
      });

      if (i % 1 === 0) {
        var t = el("text", { x: x + barW / 2, y: H - 6, "text-anchor": "middle" });
        t.textContent = String(y).slice(2);
        svg.appendChild(t);
      }
    });
  })();

  // ---------------- Table state ----------------
  var state = {
    q: "",
    type: "all",
    sortKey: "seq",
    sortDir: 1,
    page: 1,
    pageSize: 50,
  };

  var COLUMNS = [
    { key: "seq", label: "#", numeric: true },
    { key: "name", label: "Planet / Host" },
    { key: "_type", label: "Type" },
    { key: "pub_year", label: "Year", numeric: true },
    { key: "pl_bmassj", label: "Mass (M_J)", numeric: true },
    { key: "pl_orbsmax", label: "a (au)", numeric: true },
    { key: "st_mass", label: "M_star (M_sun)", numeric: true },
    { key: "sy_dist", label: "Dist (pc)", numeric: true },
    { key: "disc_telescope", label: "Telescope" },
    { key: "ra", label: "RA" },
    { key: "dec", label: "Dec" },
    { key: "ads_link", label: "Publication" },
  ];

  var tbody = document.querySelector("#dataTable tbody");
  var thead = document.querySelector("#dataTable thead tr");
  var countEl = document.getElementById("resultCount");
  var pagerInfo = document.getElementById("pagerInfo");
  var searchInput = document.getElementById("searchInput");
  var typeSelect = document.getElementById("typeSelect");
  var pageSizeSelect = document.getElementById("pageSizeSelect");
  var prevBtn = document.getElementById("prevPage");
  var nextBtn = document.getElementById("nextPage");
  var exportBtn = document.getElementById("exportCsv");

  function fmtNum(v, digits) {
    if (v === null || v === undefined || v === "" || isNaN(v)) return null;
    var n = Number(v);
    return digits === undefined ? n.toLocaleString() : n.toFixed(digits);
  }

  function cellHtml(row, col) {
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
    if (col.key === "pl_bmassj") return numOrNA(row.pl_bmassj, 2);
    if (col.key === "pl_orbsmax") return numOrNA(row.pl_orbsmax, 2);
    if (col.key === "st_mass") return numOrNA(row.st_mass, 2);
    if (col.key === "sy_dist") return numOrNA(row.sy_dist, 0);
    if (col.key === "disc_telescope") return row.disc_telescope ? escapeHtml(row.disc_telescope) : '<span class="na">TBD</span>';
    if (col.key === "ra" || col.key === "dec") return row[col.key] != null ? fmtNum(row[col.key], 4) : '<span class="na">TBD</span>';
    var v = row[col.key];
    return v === null || v === undefined || v === "" ? '<span class="na">—</span>' : escapeHtml(String(v));
  }

  function numOrNA(v, digits) {
    var f = fmtNum(v, digits);
    return f === null ? '<span class="na">TBD</span>' : f;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function getFiltered() {
    var q = state.q.trim().toLowerCase();
    return rows.filter(function (r) {
      if (state.type !== "all" && r._type !== state.type) return false;
      if (!q) return true;
      return (
        (r.name && r.name.toLowerCase().indexOf(q) !== -1) ||
        (r.host_guess && r.host_guess.toLowerCase().indexOf(q) !== -1) ||
        (r.title && r.title.toLowerCase().indexOf(q) !== -1)
      );
    });
  }

  function getSorted(list) {
    var key = state.sortKey, dir = state.sortDir;
    return list.slice().sort(function (a, b) {
      var av = a[key], bv = b[key];
      var aEmpty = av === null || av === undefined || av === "";
      var bEmpty = bv === null || bv === undefined || bv === "";
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      if (typeof av === "number" || typeof bv === "number") {
        return (Number(av) - Number(bv)) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  function renderHead() {
    thead.innerHTML = "";
    COLUMNS.forEach(function (col) {
      var th = document.createElement("th");
      th.textContent = col.label;
      if (col.key === state.sortKey) {
        th.classList.add("sorted");
        var arrow = document.createElement("span");
        arrow.className = "arrow";
        arrow.textContent = state.sortDir === 1 ? "▲" : "▼";
        th.appendChild(arrow);
      }
      th.addEventListener("click", function () {
        if (state.sortKey === col.key) {
          state.sortDir *= -1;
        } else {
          state.sortKey = col.key;
          state.sortDir = 1;
        }
        render();
      });
      thead.appendChild(th);
    });
  }

  var currentPageRows = [];

  function render() {
    var filtered = getFiltered();
    var sorted = getSorted(filtered);
    var pageSize = state.pageSize === "all" ? sorted.length || 1 : Number(state.pageSize);
    var pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
    if (state.page > pageCount) state.page = pageCount;
    var start = (state.page - 1) * pageSize;
    var pageRows = sorted.slice(start, start + pageSize);
    currentPageRows = pageRows;

    renderHead();
    tbody.innerHTML = pageRows.map(function (r) {
      return (
        '<tr data-id="' + r._id + '">' +
        COLUMNS.map(function (c) { return "<td>" + cellHtml(r, c) + "</td>"; }).join("") +
        "</tr>"
      );
    }).join("");

    countEl.textContent = filtered.length + " of " + rows.length + " entries";
    pagerInfo.textContent =
      (sorted.length === 0 ? 0 : start + 1) + "–" + Math.min(start + pageSize, sorted.length) + " / " + sorted.length + " · page " + state.page + "/" + pageCount;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= pageCount;
  }

  tbody.addEventListener("click", function (e) {
    var tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    var id = Number(tr.getAttribute("data-id"));
    var row = rows.find(function (r) { return r._id === id; });
    if (row) openDrawer(row);
  });

  searchInput.addEventListener("input", function () {
    state.q = searchInput.value;
    state.page = 1;
    render();
  });
  typeSelect.addEventListener("change", function () {
    state.type = typeSelect.value;
    state.page = 1;
    render();
  });
  pageSizeSelect.addEventListener("change", function () {
    state.pageSize = pageSizeSelect.value;
    state.page = 1;
    render();
  });
  prevBtn.addEventListener("click", function () { state.page--; render(); });
  nextBtn.addEventListener("click", function () { state.page++; render(); });

  exportBtn.addEventListener("click", function () {
    var filtered = getSorted(getFiltered());
    var header = ["name", "host_guess", "type", "pub_year", "pl_bmassj", "pl_orbsmax", "st_mass", "sy_dist", "disc_telescope", "ra", "dec", "ads_link"];
    var lines = [header.join(",")];
    filtered.forEach(function (r) {
      var vals = [r.name, r.host_guess, TYPE_LABEL[r._type], r.pub_year, r.pl_bmassj, r.pl_orbsmax, r.st_mass, r.sy_dist, r.disc_telescope, r.ra, r.dec, r.ads_link];
      lines.push(vals.map(function (v) {
        v = v === null || v === undefined ? "" : String(v);
        return '"' + v.replace(/"/g, '""') + '"';
      }).join(","));
    });
    var blob = new Blob([lines.join("\n")], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "kmtnet_exoplanets.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // ---------------- Drawer ----------------
  var overlay = document.getElementById("overlay");
  var drawer = document.getElementById("drawer");
  var drawerBody = document.getElementById("drawerBody");
  var drawerClose = document.getElementById("drawerClose");

  function field(label, value) {
    return "<dt>" + label + "</dt><dd>" + (value === null || value === undefined || value === "" ? '<span class="na">—</span>' : value) + "</dd>";
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
      field("Mass (M_Jup)", fmtNum(row.pl_bmassj, 2)) +
      field("Semi-major axis (au)", fmtNum(row.pl_orbsmax, 2)) +
      field("Host star mass (M_sun)", fmtNum(row.st_mass, 2)) +
      field("Distance (pc)", fmtNum(row.sy_dist, 0)) +
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
    if (e.key === "Escape") closeDrawer();
  });

  render();
})();

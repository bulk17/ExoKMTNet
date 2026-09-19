(function () {
  "use strict";

  var RAW = window.KMTNET_PLANETS || [];

  var BD_PLANET_MASS_CUTOFF = 30; // M_Jup — above this, treat as BD/planet-boundary regardless of source notes

  function classify(row) {
    if (row.is_ffp) return "ffp";
    // type_note only forces BD for host-only rows (a lens star's own mass, never "a planet"
    // by mass cutoff) — companion/planet rows classify purely by the numeric mass cutoff.
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

  // Non-KMTNet microlensing planets (NASA Exoplanet Archive), shown only via
  // the "All microlensing planets" and "Non-KMT planet" scopes — kept out of
  // `rows` so the main table, stats and year chart stay scoped to KMTNet.
  var OTHER_RAW = window.OTHER_MICROLENSING_EVENTS || [];
  var otherRows = OTHER_RAW.map(function (r, i) {
    return Object.assign({}, r, { _id: "other-" + i, _type: classify(r) });
  });
  var allEventsRows = rows.concat(otherRows);

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

  var nonFfpRows = rows.filter(function (r) { return r._type !== "ffp"; });
  // "All microlensing planets" counts true planets only (<= 30 M_Jup) — KMTNet's own
  // Planet/BD boundary objects stay in the underlying data (see the "Planet/BD" card)
  // but are excluded from this combined-catalog total, same as a >30 M_Jup NASA entry
  // would be.
  var allEventsNonFfp = allEventsRows.filter(function (r) { return r._type === "planet"; });
  var planetCount = rows.filter(function (r) { return r._type === "planet"; }).length;
  var ffpCount = rows.filter(function (r) { return r._type === "ffp"; }).length;
  var bdCount = rows.filter(function (r) { return r._type === "bdplanet"; }).length;
  var otherPlanetCount = otherRows.filter(function (r) { return r._type === "planet"; }).length;
  var binaryCount = rows.filter(function (r) { return r.binary_host_status === "confirmed"; }).length;
  var multiHosts = {};
  rows.forEach(function (r) {
    if (r.multi_planet_status === "confirmed") multiHosts[r.host_guess] = true;
  });
  var multiCount = Object.keys(multiHosts).length;
  // Count distinct discovery papers by title rather than ADS link — a couple
  // of papers are catalogued under both their arXiv preprint and published-
  // journal links, which would otherwise double-count the same paper.
  var paperHasPlanet = {};
  rows.forEach(function (r) {
    if (!r.title) return;
    if (!(r.title in paperHasPlanet)) paperHasPlanet[r.title] = false;
    if (r._type === "planet") paperHasPlanet[r.title] = true;
  });
  var planetPaperCount = 0;
  Object.keys(paperHasPlanet).forEach(function (t) {
    if (paperHasPlanet[t]) planetPaperCount++;
  });
  var totalPaperCount = Object.keys(paperHasPlanet).length;

  setText("statTotal", planetCount);
  setText("statFfp", ffpCount);
  setText("statBd", bdCount);
  setText("statAllEvents", allEventsNonFfp.length);
  setText("statNonKmt", otherPlanetCount);
  setText("statBinary", binaryCount);
  setText("statMulti", multiCount);
  setText("statPapers", planetPaperCount + " / " + totalPaperCount);

  if (window.KMTNET_LIST_UPDATED) {
    var parts = window.KMTNET_LIST_UPDATED.split("-");
    setText("statUpdated", parts[0] + "." + Number(parts[1]) + "." + Number(parts[2]));
  }

  // ---------------- Table state ----------------
  var state = {
    q: "",
    type: "all",
    massMax: "30",
    scope: "kmtnet", // "kmtnet" (default catalog) or "all" (+ non-KMTNet NASA Exoplanet Archive events)
    special: null, // null, "binary" (confirmed binary-star hosts), or "multi" (confirmed multi-planet systems)
    sortKey: "seq",
    sortDir: -1,
    page: 1,
    pageSize: 50,
  };

  var ALL_COLUMNS = [
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

  // FFPs have no host star, so "a" (semi-major axis) and "M_star" never apply —
  // FFPs have no host star, so "a", "M_star", and "M_E" never apply — drop
  // those columns entirely when filtered to free-floating rows. Distance is
  // kept: unmeasured for most FFP rows (shown as "—"), but a few (e.g. the
  // parallax-measured KMT-2024-BLG-0792) do have a real value.
  var FFP_HIDDEN_COLUMNS = { pl_orbsmax: true, st_mass: true, pl_bmasse: true };
  function getColumns() {
    if (state.type === "ffp") {
      return ALL_COLUMNS.filter(function (c) { return !FFP_HIDDEN_COLUMNS[c.key]; });
    }
    return ALL_COLUMNS;
  }

  var tbody = document.querySelector("#dataTable tbody");
  var thead = document.querySelector("#dataTable thead tr");
  var countEl = document.getElementById("resultCount");
  var pagerInfo = document.getElementById("pagerInfo");
  var searchInput = document.getElementById("searchInput");
  var typeSelect = document.getElementById("typeSelect");
  var massSelect = document.getElementById("massSelect");
  var pageSizeSelect = document.getElementById("pageSizeSelect");
  var prevBtn = document.getElementById("prevPage");
  var nextBtn = document.getElementById("nextPage");
  var exportBtn = document.getElementById("exportCsv");

  function fmtNum(v, digits) {
    if (v === null || v === undefined || v === "" || isNaN(v)) return null;
    var n = Number(v);
    return digits === undefined ? n.toLocaleString() : n.toFixed(digits);
  }

  // More decimals for small values so e.g. 0.0042 doesn't round to "0.00".
  function fmtAdaptive(v) {
    if (v === null || v === undefined || v === "" || isNaN(v)) return null;
    var n = Number(v);
    var abs = Math.abs(n);
    var digits = abs < 0.01 ? 4 : abs < 0.1 ? 3 : 2;
    return n.toFixed(digits);
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
    if (col.key === "pl_bmassj") {
      if (row.pl_bmassj_disk_label) return diskBulgeLabelHtml(row.pl_bmassj_disk_label, row.pl_bmassj_bulge_label);
      return numOrNA(row.pl_bmassj, undefined, row.pl_bmassj_err1, row.pl_bmassj_err2, row.pl_bmassj_upper_limit);
    }
    if (col.key === "pl_bmasse") return numOrNA(row.pl_bmasse, 1, row.pl_bmasse_err1, row.pl_bmasse_err2, row.pl_bmassj_upper_limit);
    if (col.key === "pl_orbsmax") return numOrNA(row.pl_orbsmax, undefined, row.pl_orbsmax_err1, row.pl_orbsmax_err2, false, row.pl_orbsmax_unmeasurable);
    if (col.key === "st_mass") return numOrNA(row.st_mass, undefined, row.st_mass_err1, row.st_mass_err2, false, row.st_mass_unmeasurable);
    if (col.key === "sy_dist") return numOrNA(row.sy_dist, 0, row.sy_dist_err1, row.sy_dist_err2, false, row.sy_dist_unmeasurable);
    if (col.key === "ra" || col.key === "dec") return row[col.key] != null ? fmtNum(row[col.key], 4) : '<span class="na">TBD</span>';
    var v = row[col.key];
    return v === null || v === undefined || v === "" ? '<span class="na">—</span>' : escapeHtml(String(v));
  }

  // FFP disk-lens/bulge-lens solutions, shown as "disk/bulge" (the lens-distance
  // degeneracy for free-floating planets means the source paper reports one
  // value per assumed population, not a single measurement).
  // FFP mass can't be pinned down (disk-vs-bulge lens-distance degeneracy), so
  // papers describe it qualitatively per population rather than as a number.
  function diskBulgeLabelHtml(diskLabel, bulgeLabel) {
    var d = diskLabel || "—", b = bulgeLabel || "—";
    return '<span class="disk-bulge" title="Disk / Bulge solution">' + escapeHtml(d) + " / " + escapeHtml(b) + "</span>";
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

  // hi/lo formatted magnitudes for the "+upper / lower" asymmetric error bar.
  // err1 is stored positive (upper bound), err2 negative (lower bound).
  function errParts(err1, err2, digits) {
    if (err1 == null || err2 == null) return null;
    var fmt = function (v) { return digits === undefined ? fmtAdaptive(v) : fmtNum(v, digits); };
    var hi = fmt(err1), lo = fmt(err2);
    if (hi === null || lo === null) return null;
    return { hi: hi, lo: lo };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function getFiltered() {
    var q = state.q.trim().toLowerCase();
    var base = state.scope === "all" ? allEventsRows : state.scope === "other" ? otherRows : rows;
    return base.filter(function (r) {
      // "All types" means all planet types (Planet + Planet/BD) — free-floating
      // candidates are a separate category, reachable only via their own filter/card.
      // The mass cutoff only ever narrows *within* the "planet" bucket (all-types view,
      // or the explicit Planet type) — it never re-excludes an explicitly selected type
      // like Planet/BD or Free-floating.
      if (state.type === "all") {
        if (r._type === "ffp") return false;
        if (state.massMax === "30") {
          if (r._type !== "planet") return false;
        } else if (state.massMax === "13") {
          if (r._type !== "planet" || r.pl_bmassj == null || r.pl_bmassj > 13) return false;
        }
      } else {
        if (r._type !== state.type) return false;
        if (state.type === "planet" && state.massMax === "13") {
          if (r.pl_bmassj == null || r.pl_bmassj > 13) return false;
        }
      }
      if (state.special === "binary" && r.binary_host_status !== "confirmed") return false;
      if (state.special === "multi" && r.multi_planet_status !== "confirmed") return false;
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
    getColumns().forEach(function (col) {
      var th = document.createElement("th");
      if (col.key === "name") th.classList.add("col-name");
      var labelSpan = document.createElement("span");
      labelSpan.className = "col-label";
      labelSpan.textContent = col.label;
      th.appendChild(labelSpan);
      if (col.key === state.sortKey) {
        th.classList.add("sorted");
        var arrow = document.createElement("span");
        arrow.className = "arrow";
        arrow.textContent = state.sortDir === 1 ? "▲" : "▼";
        labelSpan.appendChild(arrow);
      }
      // In the FFP view, Mass shows a qualitative Disk/Bulge label instead of
      // an M_J number, so the "(M_J)" unit no longer applies to that column.
      var isFfpMassCol = state.type === "ffp" && col.key === "pl_bmassj";
      if (col.unit && !isFfpMassCol) {
        th.classList.add("has-unit");
        var unitSpan = document.createElement("span");
        unitSpan.className = "col-unit";
        unitSpan.textContent = "(" + col.unit + ")";
        th.appendChild(unitSpan);
      }
      if (isFfpMassCol) {
        th.classList.add("has-unit");
        var dbSpan = document.createElement("span");
        dbSpan.className = "col-unit col-disk-bulge";
        dbSpan.textContent = "Disk/Bulge";
        th.appendChild(dbSpan);
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
    var cols = getColumns();
    tbody.innerHTML = pageRows.map(function (r, i) {
      var rank = start + i + 1;
      return (
        '<tr data-id="' + r._id + '">' +
        cols.map(function (c) { return '<td class="' + (c.key === "name" ? "col-name" : "") + '">' + cellHtml(r, c, rank) + "</td>"; }).join("") +
        "</tr>"
      );
    }).join("");

    // The "of N" denominator matches whatever type the current view is scoped to,
    // so e.g. the Planet/BD view reads "25 of 25", not "25 of 292" (which would wrongly
    // imply most Planet/BD rows are hidden rather than simply being a different type).
    var scopeTotal;
    if (state.scope === "all") {
      scopeTotal = allEventsNonFfp.length;
    } else if (state.scope === "other") {
      scopeTotal = otherPlanetCount;
    } else if (state.type === "bdplanet") {
      scopeTotal = bdCount;
    } else if (state.type === "ffp") {
      scopeTotal = ffpCount;
    } else if (state.type === "planet" || state.massMax !== "all") {
      scopeTotal = planetCount;
    } else {
      scopeTotal = nonFfpRows.length;
    }
    countEl.textContent = filtered.length + " of " + scopeTotal + " entries";
    pagerInfo.textContent =
      (sorted.length === 0 ? 0 : start + 1) + "–" + Math.min(start + pageSize, sorted.length) + " / " + sorted.length + " · page " + state.page + "/" + pageCount;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= pageCount;
  }

  tbody.addEventListener("click", function (e) {
    var tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    var id = tr.getAttribute("data-id");
    var row = currentPageRows.find(function (r) { return String(r._id) === id; });
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
  massSelect.addEventListener("change", function () {
    state.massMax = massSelect.value;
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
    var header = [
      "name", "host_guess", "type", "pub_year",
      "pl_bmassj", "pl_bmassj_err1", "pl_bmassj_err2",
      "pl_bmassj_disk", "pl_bmassj_bulge", "pl_bmassj_disk_label", "pl_bmassj_bulge_label",
      "pl_bmasse", "pl_bmasse_err1", "pl_bmasse_err2",
      "pl_orbsmax", "pl_orbsmax_err1", "pl_orbsmax_err2",
      "st_mass", "st_mass_err1", "st_mass_err2",
      "sy_dist", "sy_dist_err1", "sy_dist_err2",
      "disc_telescope", "ra", "dec", "ads_link",
    ];
    var lines = [header.join(",")];
    filtered.forEach(function (r) {
      var vals = [
        r.name, r.host_guess, TYPE_LABEL[r._type], r.pub_year,
        r.pl_bmassj, r.pl_bmassj_err1, r.pl_bmassj_err2,
        r.pl_bmassj_disk, r.pl_bmassj_bulge, r.pl_bmassj_disk_label, r.pl_bmassj_bulge_label,
        r.pl_bmasse, r.pl_bmasse_err1, r.pl_bmasse_err2,
        r.pl_orbsmax, r.pl_orbsmax_err1, r.pl_orbsmax_err2,
        r.st_mass, r.st_mass_err1, r.st_mass_err2,
        r.sy_dist, r.sy_dist_err1, r.sy_dist_err2,
        r.disc_telescope, r.ra, r.dec, r.ads_link,
      ];
      lines.push(vals.map(function (v) {
        v = v === null || v === undefined ? "" : String(v);
        return '"' + v.replace(/"/g, '""') + '"';
      }).join(","));
    });
    var blob = new Blob([lines.join("\n")], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var today = new Date();
    var stamp = today.getFullYear() + String(today.getMonth() + 1).padStart(2, "0") + String(today.getDate()).padStart(2, "0");
    a.download = "kmtnet_exoplanets_" + stamp + ".csv";
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

  // Value plus its "(+hi / -lo)" error range, when both bounds are known.
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
      field(
        row.pl_bmassj_disk_label ? "Mass (Disk/Bulge)" : "Mass (M_Jup)",
        row.pl_bmassj_disk_label
          ? diskBulgeLabelHtml(row.pl_bmassj_disk_label, row.pl_bmassj_bulge_label)
          : withErr(row.pl_bmassj, undefined, row.pl_bmassj_err1, row.pl_bmassj_err2, row.pl_bmassj_upper_limit)
      ) +
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
    if (e.key === "Escape") closeDrawer();
  });

  // ---------------- Stat-card shortcuts ----------------
  var ffpCard = document.getElementById("ffpCard");
  var totalCard = document.getElementById("totalCard");
  var bdCard = document.getElementById("bdCard");
  var binaryCard = document.getElementById("binaryCard");
  var multiCard = document.getElementById("multiCard");
  var tableSection = document.getElementById("table");

  function applyTypeFilter(type, massMax, scope, special) {
    massMax = massMax || "all";
    scope = scope || "kmtnet";
    state.q = "";
    state.type = type;
    state.massMax = massMax;
    state.scope = scope;
    state.special = special || null;
    state.page = 1;
    searchInput.value = "";
    typeSelect.value = type;
    massSelect.value = massMax;
    scopeNote.hidden = scope === "kmtnet";
    if (scope === "other") {
      scopeNote.textContent = "Showing non-KMTNet microlensing planets from the NASA Exoplanet Archive only. Click “Planets” above to return to the KMTNet-only catalog.";
    } else if (scope === "all") {
      scopeNote.textContent = "Showing all microlensing planetary events, including non-KMTNet discoveries from the NASA Exoplanet Archive. Click “Planets” or “Free-floating planet candidates” above to return to the KMTNet-only catalog.";
    }
    render();
    tableSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onCardActivate(el, handler) {
    el.addEventListener("click", handler);
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handler();
      }
    });
  }

  onCardActivate(ffpCard, function () { applyTypeFilter("ffp", "30"); });
  onCardActivate(totalCard, function () { applyTypeFilter("all", "30"); });
  onCardActivate(bdCard, function () { applyTypeFilter("bdplanet", "30"); });
  onCardActivate(binaryCard, function () { applyTypeFilter("all", "all", "kmtnet", "binary"); });
  onCardActivate(multiCard, function () { applyTypeFilter("all", "all", "kmtnet", "multi"); });

  // ---------------- "All microlensing events" scope toggle ----------------
  // Switches the main table itself (search/filter/export and all) between the
  // KMTNet-only catalog and the full combined list, the same way the
  // Total-entries/FFP cards switch its type+mass filters.
  var allEventsCard = document.getElementById("allEventsCard");
  var nonKmtCard = document.getElementById("nonKmtCard");
  var scopeNote = document.getElementById("scopeNote");

  onCardActivate(allEventsCard, function () { applyTypeFilter("all", "30", "all"); });
  onCardActivate(nonKmtCard, function () { applyTypeFilter("planet", "30", "other"); });

  render();
})();

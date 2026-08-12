(function () {
  "use strict";

  /* ------------------------------------------------------------------
   * Google Sheets menu source
   * ------------------------------------------------------------------
   * Меню и карта бара — два разных листа ОДНОЙ таблицы. Разносить их по
   * разным файлам не нужно, но Google даёт отдельную ссылку на CSV для
   * каждого листа, поэтому ссылок здесь две.
   *
   * Как получить ссылку для листа:
   *   1. В Google Таблице откройте нужный лист (вкладку снизу).
   *   2. Файл → Поделиться → Опубликовать в интернете.
   *   3. В первом выпадающем списке выберите именно этот лист (не «Всю
   *      книгу»), во втором — формат CSV, нажмите «Опубликовать».
   *   4. Скопируйте ссылку и вставьте в соответствующую константу ниже.
   *   5. Повторите для второго листа.
   *
   * Ожидаемые столбцы (первая строка — заголовок, порядок не важен):
   *   category | name | description | price
   * Пока ссылки не указаны — показывается встроенный снимок реального
   * меню (js/menu-data.js), актуальный на 06.08.2026.
   * ------------------------------------------------------------------ */
  var MENU_FOOD_CSV_URL = ""; // <-- CSV-ссылка листа с меню кухни
  var MENU_BAR_CSV_URL = "";  // <-- CSV-ссылка листа с картой бара

  var FALLBACK_MENU = (window.MUN_MENU_DATA || { food: [], bar: [] });
  var SEGMENT_LABELS = { food: "Кухня", bar: "Бар" };

  /* ------------------------------------------------------------------
   * Header / mobile nav
   * ------------------------------------------------------------------ */
  var burger = document.getElementById("burger");
  var mobileNav = document.getElementById("mobile-nav");

  function closeMobileNav() {
    if (!mobileNav) return;
    mobileNav.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
  }

  if (burger && mobileNav) {
    burger.addEventListener("click", function () {
      var open = mobileNav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mobileNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMobileNav);
    });
  }

  /* ------------------------------------------------------------------
   * Menu modal
   * ------------------------------------------------------------------ */
  var modal = document.getElementById("menu-modal");
  var modalBody = document.getElementById("menu-body");
  var modalTabs = document.getElementById("menu-tabs");
  var modalNote = document.getElementById("menu-note");
  var modalSegment = document.getElementById("menu-segment");
  var openTriggers = document.querySelectorAll("[data-open-menu]");
  var closeTriggers = document.querySelectorAll("[data-close-menu]");

  var activeSegment = "food";
  var loadedSegments = {}; // segment -> { items, isFallback }
  var lastFocused = null;

  if (modalSegment) {
    modalSegment.querySelectorAll(".menu-segment-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var seg = btn.getAttribute("data-segment");
        if (seg === activeSegment) return;
        activeSegment = seg;
        modalSegment.querySelectorAll(".menu-segment-btn").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        showSegment(seg);
      });
    });
  }

  function openModal() {
    lastFocused = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    closeMobileNav();
    showSegment(activeSegment);
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (lastFocused) lastFocused.focus();
  }

  openTriggers.forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      openModal();
    });
  });
  closeTriggers.forEach(function (el) {
    el.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  /* ---------------- CSV parsing ---------------- */
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n") {
        row.push(field); rows.push(row); row = []; field = "";
      } else if (c === "\r") {
        // skip
      } else {
        field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return v.trim() !== ""; }); });
  }

  function normalizeKey(key) {
    var k = key.trim().toLowerCase();
    var map = {
      "категория": "category", "category": "category",
      "название": "name", "блюдо": "name", "name": "name",
      "описание": "description", "description": "description", "состав": "description",
      "цена": "price", "price": "price", "стоимость": "price"
    };
    return map[k] || k;
  }

  function csvToMenu(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) return [];
    var headers = rows[0].map(normalizeKey);
    var items = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var item = {};
      headers.forEach(function (h, idx) { item[h] = (r[idx] || "").trim(); });
      if (item.name) items.push(item);
    }
    return items;
  }

  /* ---------------- Rendering ---------------- */
  function groupByCategory(items) {
    var groups = [];
    var index = {};
    items.forEach(function (item) {
      var cat = item.category || "Меню";
      if (!(cat in index)) {
        index[cat] = groups.length;
        groups.push({ category: cat, items: [] });
      }
      groups[index[cat]].items.push(item);
    });
    return groups;
  }

  function el(tag, className, html) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function renderMenu(items, isFallback) {
    var groups = groupByCategory(items);

    modalTabs.innerHTML = "";
    modalBody.innerHTML = "";

    if (!groups.length) {
      modalBody.innerHTML = '<p class="menu-error">Меню временно недоступно. Загляните позже или уточните у официанта.</p>';
      modalNote.textContent = "";
      return;
    }

    groups.forEach(function (group, i) {
      var tab = el("button", "menu-tab" + (i === 0 ? " is-active" : ""), group.category);
      tab.type = "button";
      tab.addEventListener("click", function () {
        modalTabs.querySelectorAll(".menu-tab").forEach(function (t) { t.classList.remove("is-active"); });
        tab.classList.add("is-active");
        var target = modalBody.querySelector('[data-cat="' + i + '"]');
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      modalTabs.appendChild(tab);

      var section = el("div");
      section.setAttribute("data-cat", i);
      section.appendChild(el("h4", "menu-category-title", group.category));

      group.items.forEach(function (item) {
        var row = el("div", "menu-item");
        var thumb = el("div", "menu-item-thumb", "<span></span>");
        var main = el("div", "menu-item-main");
        var nameRow = el("div", "menu-item-row");
        nameRow.appendChild(el("span", "menu-item-name", escapeHTML(item.name)));
        nameRow.appendChild(el("span", "menu-item-leader"));
        if (item.price) nameRow.appendChild(el("span", "menu-item-price", escapeHTML(item.price) + " ₽"));
        main.appendChild(nameRow);
        if (item.description) main.appendChild(el("p", "menu-item-desc", escapeHTML(item.description)));
        row.appendChild(thumb);
        row.appendChild(main);
        section.appendChild(row);
      });

      modalBody.appendChild(section);
    });

    modalNote.textContent = isFallback
      ? "Показан снимок меню на 06.08.2026. Актуальность и наличие позиций уточняйте у персонала."
      : "Цены и наличие позиций уточняйте у персонала.";
  }

  function escapeHTML(str) {
    var d = document.createElement("div");
    d.textContent = str == null ? "" : str;
    return d.innerHTML;
  }

  function showSegment(segment) {
    var cached = loadedSegments[segment];
    if (cached) {
      renderMenu(cached.items, cached.isFallback);
      return;
    }
    modalTabs.innerHTML = "";
    modalBody.innerHTML = '<p class="menu-loading">Загружаем меню…</p>';
    modalNote.textContent = "";
    loadSegment(segment);
  }

  function loadSegment(segment) {
    var csvUrl = segment === "bar" ? MENU_BAR_CSV_URL : MENU_FOOD_CSV_URL;
    var fallbackItems = FALLBACK_MENU[segment] || [];

    if (!csvUrl) {
      loadedSegments[segment] = { items: fallbackItems, isFallback: true };
      if (segment === activeSegment) renderMenu(fallbackItems, true);
      return;
    }

    fetch(csvUrl, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("network");
        return res.text();
      })
      .then(function (text) {
        var items = csvToMenu(text);
        if (!items.length) throw new Error("empty");
        loadedSegments[segment] = { items: items, isFallback: false };
        if (segment === activeSegment) renderMenu(items, false);
      })
      .catch(function () {
        loadedSegments[segment] = { items: fallbackItems, isFallback: true };
        if (segment === activeSegment) renderMenu(fallbackItems, true);
      });
  }

  /* ------------------------------------------------------------------
   * Misc
   * ------------------------------------------------------------------ */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();

(function () {
  "use strict";

  /* ------------------------------------------------------------------
   * Google Sheets menu source
   * ------------------------------------------------------------------
   * Paste the CSV export link of your published Google Sheet below.
   * How to get it:
   *   1. In Google Sheets: Файл → Поделиться → Опубликовать в интернете.
   *   2. Выберите нужный лист и формат "CSV", нажмите "Опубликовать".
   *   3. Скопируйте ссылку (обычно вида
   *      https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv)
   *      и вставьте её сюда.
   *
   * Expected columns (first row = header, any order, RU or EN names are ok):
   *   category | name | description | price
   * Example row: Бургеры, Чизбургер МУН, Говядина, чеддер, соус манго, 590
   *
   * Until a real link is set, the site shows clearly-labelled demo items
   * so the "Меню" button always works.
   * ------------------------------------------------------------------ */
  var MENU_SHEET_CSV_URL = ""; // <-- вставьте ссылку на опубликованный CSV сюда

  var DEMO_MENU = [
    { category: "Бургеры", name: "Бургер МУН", description: "Говяжья котлета, чеддер, соус, брошь", price: "—" },
    { category: "Бургеры", name: "Чикен-бургер", description: "Куриное бедро в темпуре, слоу, соус", price: "—" },
    { category: "Поке", name: "Поке с лососем", description: "Рис, лосось, авокадо, эдамаме", price: "—" },
    { category: "Поке", name: "Поке с тунцом", description: "Рис, тунец, манго, кунжут", price: "—" },
    { category: "Супы", name: "Том-ям", description: "С креветками, кокосовым молоком и грибами", price: "—" },
    { category: "Супы", name: "Фо-бо", description: "Говяжья лапша с зеленью и лаймом", price: "—" },
    { category: "Стейки", name: "Стейк Рибай", description: "Мраморная говядина, гриль-овощи", price: "—" },
    { category: "Салаты", name: "Салат с креветками", description: "Микс салатов, авокадо, цитрус", price: "—" },
    { category: "Крылья", name: "Куриные крылья BBQ", description: "Соус барбекю, сельдерей", price: "—" },
    { category: "Бар", name: "Коктейль дня", description: "Уточняйте у бармена", price: "—" }
  ];

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
  var openTriggers = document.querySelectorAll("[data-open-menu]");
  var closeTriggers = document.querySelectorAll("[data-close-menu]");

  var menuLoaded = false;
  var lastFocused = null;

  function openModal() {
    lastFocused = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    closeMobileNav();
    if (!menuLoaded) loadMenu();
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

  function renderMenu(items, isDemo) {
    var groups = groupByCategory(items);

    modalTabs.innerHTML = "";
    modalBody.innerHTML = "";

    if (!groups.length) {
      modalBody.innerHTML = '<p class="menu-error">Меню временно недоступно. Загляните позже или уточните у официанта.</p>';
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
        if (item.price) nameRow.appendChild(el("span", "menu-item-price", escapeHTML(item.price) + (isDemo ? "" : " ₽")));
        main.appendChild(nameRow);
        if (item.description) main.appendChild(el("p", "menu-item-desc", escapeHTML(item.description)));
        row.appendChild(thumb);
        row.appendChild(main);
        section.appendChild(row);
      });

      modalBody.appendChild(section);
    });

    modalNote.textContent = isDemo
      ? "Показаны демонстрационные позиции. Актуальное меню подключается через Google Таблицу."
      : "Цены и наличие позиций уточняйте у персонала.";
  }

  function escapeHTML(str) {
    var d = document.createElement("div");
    d.textContent = str == null ? "" : str;
    return d.innerHTML;
  }

  function loadMenu() {
    if (!MENU_SHEET_CSV_URL) {
      renderMenu(DEMO_MENU, true);
      menuLoaded = true;
      return;
    }
    fetch(MENU_SHEET_CSV_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("network");
        return res.text();
      })
      .then(function (text) {
        var items = csvToMenu(text);
        if (!items.length) throw new Error("empty");
        renderMenu(items, false);
      })
      .catch(function () {
        renderMenu(DEMO_MENU, true);
      })
      .finally(function () {
        menuLoaded = true;
      });
  }

  /* ------------------------------------------------------------------
   * Misc
   * ------------------------------------------------------------------ */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();

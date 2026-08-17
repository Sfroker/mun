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
   * Столбцы распознаются по названию (регистр и порядок не важны, форматы
   * вроде «Наименование», «Отпускная цена новая», «Регион/Страна», «Объем»
   * поддержаны из коробки — см. normalizeKey ниже). Строки-разделители
   * разделов (где заполнена только одна ячейка) читаются как заголовок
   * категории для всех следующих строк — под такую структуру и сделаны
   * оба листа таблицы «Мун Меню и Карта бара».
   * Пока ссылки не указаны — показывается встроенный снимок реального
   * меню (js/menu-data.js), актуальный на 06.08.2026.
   * ------------------------------------------------------------------ */
  var MENU_FOOD_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRCfb102KV9uc-4rD_IF5uLubRoAKLe-Y7wNTly6ZQggB6XTJsBgI7rSnKvUZvbDfKXOItiYxCqyh-s/pub?gid=1020992713&single=true&output=csv";
  var MENU_BAR_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRCfb102KV9uc-4rD_IF5uLubRoAKLe-Y7wNTly6ZQggB6XTJsBgI7rSnKvUZvbDfKXOItiYxCqyh-s/pub?gid=1889053653&single=true&output=csv";

  var FALLBACK_MENU = (window.MUN_MENU_DATA || { food: [], bar: [] });

  /* ------------------------------------------------------------------
   * Header / mobile nav (same small widget as the main page)
   * ------------------------------------------------------------------ */
  var burger = document.getElementById("burger");
  var mobileNav = document.getElementById("mobile-nav");

  if (burger && mobileNav) {
    burger.addEventListener("click", function () {
      var open = mobileNav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ------------------------------------------------------------------
   * Segment toggle (Кухня / Бар)
   * ------------------------------------------------------------------ */
  var menuBody = document.getElementById("menu-body");
  var menuNote = document.getElementById("menu-note");
  var menuSegment = document.getElementById("menu-segment");
  var menuSegmentIndicator = document.getElementById("menu-segment-indicator");

  var activeSegment = "food";
  var loadedSegments = {}; // segment -> { items, isFallback }

  function debounce(fn, wait) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  function positionSegmentIndicator() {
    if (!menuSegment || !menuSegmentIndicator) return;
    var activeBtn = menuSegment.querySelector(".menu-segment-btn.is-active");
    if (!activeBtn) return;
    menuSegmentIndicator.style.width = activeBtn.offsetWidth + "px";
    menuSegmentIndicator.style.transform = "translateX(" + activeBtn.offsetLeft + "px)";
  }

  if (menuSegment) {
    menuSegment.querySelectorAll(".menu-segment-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var seg = btn.getAttribute("data-segment");
        menuSegment.querySelectorAll(".menu-segment-btn").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        positionSegmentIndicator();
        if (seg === activeSegment) return;
        activeSegment = seg;
        showSegment(seg);
      });
    });
    window.addEventListener("resize", debounce(positionSegmentIndicator, 150));
    requestAnimationFrame(positionSegmentIndicator);
  }

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
    if (k === "category" || k.indexOf("категор") !== -1) return "category";
    if (k === "name" || k.indexOf("наимен") !== -1 || k.indexOf("назв") !== -1 || k.indexOf("блюд") !== -1) return "name";
    if (k === "price" || k.indexOf("цена") !== -1 || k.indexOf("стоим") !== -1) return "price";
    if (k === "description" || k.indexOf("описан") !== -1) return "description";
    if (k.indexOf("состав") !== -1) return "composition";
    if (k.indexOf("регион") !== -1 || k.indexOf("стран") !== -1) return "region";
    if (k.indexOf("объ") !== -1 && (k.indexOf("объем") !== -1 || k.indexOf("объём") !== -1)) return "volume";
    return k; // прочие столбцы (поставщик, значок в меню и т.п.) игнорируются
  }

  function formatPrice(raw) {
    if (!raw) return "";
    var cleaned = String(raw).replace(/[^\d,\s]/g, "").trim();
    if (!cleaned) return "";
    cleaned = cleaned.replace(/,00\s*$/, "");
    cleaned = cleaned.replace(/\s+/g, "");
    return cleaned;
  }

  function csvToMenu(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) return [];
    var headers = rows[0].map(normalizeKey);
    var items = [];
    var currentCategory = "";

    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var nonEmpty = r.filter(function (v) { return v && v.trim() !== ""; });

      // Строка-разделитель раздела: заполнена только одна ячейка —
      // так на обоих листах таблицы оформлены заголовки категорий
      // (объединённые ячейки экспортируются как одно значение в строке).
      if (nonEmpty.length <= 1) {
        if (nonEmpty.length === 1) currentCategory = nonEmpty[0].trim();
        continue;
      }

      var raw = {};
      headers.forEach(function (h, idx) { raw[h] = (r[idx] || "").trim(); });
      if (!raw.name) continue;

      var descParts = [];
      if (raw.description) descParts.push(raw.description);
      if (raw.composition) descParts.push(raw.composition);
      if (raw.region) descParts.push(raw.region);
      if (raw.volume) {
        // числовые значения объёма без единицы (напр. «0,75») по умолчанию — литры
        descParts.push(/^[\d.,\s]+$/.test(raw.volume) ? raw.volume + " л" : raw.volume);
      }

      items.push({
        category: raw.category || currentCategory || "Меню",
        name: raw.name,
        description: descParts.join(" · "),
        price: formatPrice(raw.price)
      });
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

  function escapeHTML(str) {
    var d = document.createElement("div");
    d.textContent = str == null ? "" : str;
    return d.innerHTML;
  }

  function parsePriceNumber(priceStr) {
    if (!priceStr) return NaN;
    var n = parseFloat(String(priceStr).replace(/,/g, ""));
    return isNaN(n) ? NaN : n;
  }

  function paintQtyControl(wrap) {
    var key = wrap.getAttribute("data-key");
    var qty = cart[key] ? cart[key].qty : 0;
    if (qty > 0) {
      wrap.innerHTML =
        '<div class="menu-qty-stepper">' +
          '<button type="button" data-cart-action="dec" aria-label="Уменьшить количество">−</button>' +
          '<span class="menu-qty-count">' + qty + "</span>" +
          '<button type="button" data-cart-action="inc" aria-label="Увеличить количество">+</button>' +
        "</div>";
    } else {
      wrap.innerHTML = '<button type="button" class="menu-qty-add" data-cart-action="add" aria-label="Добавить в заказ">+</button>';
    }
  }

  function renderQtyControl(item, category) {
    var priceNum = parsePriceNumber(item.price);
    if (!priceNum || priceNum <= 0) return null;
    var wrap = el("div", "menu-qty");
    wrap.setAttribute("data-key", category + "|" + item.name + "|" + item.price);
    wrap.setAttribute("data-name", item.name);
    wrap.setAttribute("data-price", priceNum);
    wrap.setAttribute("data-category", category);
    paintQtyControl(wrap);
    return wrap;
  }

  function renderMenu(items, isFallback) {
    var groups = groupByCategory(items);

    menuBody.innerHTML = "";

    if (!groups.length) {
      menuBody.innerHTML = '<p class="menu-error">Меню временно недоступно. Загляните позже или уточните у официанта.</p>';
      menuNote.textContent = "";
      return;
    }

    groups.forEach(function (group) {
      var category = el("div", "menu-category");
      category.appendChild(el("h4", "menu-category-title", group.category));

      group.items.forEach(function (item) {
        var row = el("div", "menu-item");
        var nameRow = el("div", "menu-item-row");
        nameRow.appendChild(el("span", "menu-item-name", escapeHTML(item.name)));
        nameRow.appendChild(el("span", "menu-item-leader"));
        if (item.price) nameRow.appendChild(el("span", "menu-item-price", escapeHTML(item.price) + " ₽"));
        var qtyControl = renderQtyControl(item, group.category);
        if (qtyControl) nameRow.appendChild(qtyControl);
        row.appendChild(nameRow);
        if (item.description) row.appendChild(el("p", "menu-item-desc", escapeHTML(item.description)));
        category.appendChild(row);
      });

      menuBody.appendChild(category);
    });

    menuNote.textContent = isFallback
      ? "Показан снимок меню на 06.08.2026. Актуальность и наличие позиций уточняйте у персонала."
      : "Цены и наличие позиций уточняйте у персонала.";
  }

  menuBody.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-cart-action]");
    if (!btn) return;
    var wrap = btn.closest(".menu-qty");
    if (!wrap) return;
    var key = wrap.getAttribute("data-key");
    var action = btn.getAttribute("data-cart-action");
    if (action === "add" || action === "inc") {
      if (!cart[key]) {
        cart[key] = {
          name: wrap.getAttribute("data-name"),
          price: parseFloat(wrap.getAttribute("data-price")),
          category: wrap.getAttribute("data-category"),
          qty: 0
        };
      }
      cart[key].qty++;
    } else if (action === "dec" && cart[key]) {
      cart[key].qty--;
      if (cart[key].qty <= 0) delete cart[key];
    }
    saveCart();
    paintQtyControl(wrap);
    updateCartBar();
  });

  function fadeBody(update) {
    menuBody.classList.add("is-fading");
    setTimeout(function () {
      update();
      menuBody.classList.remove("is-fading");
    }, 180);
  }

  function showSegment(segment) {
    var cached = loadedSegments[segment];
    fadeBody(function () {
      if (cached) {
        renderMenu(cached.items, cached.isFallback);
        return;
      }
      menuBody.innerHTML = '<p class="menu-loading">Загружаем меню…</p>';
      menuNote.textContent = "";
      loadSegment(segment);
    });
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

  showSegment(activeSegment);

  /* ------------------------------------------------------------------
   * Cart — "add to order" on every priced item, so a guest can collect
   * everything in one place and show the total (and the list) to a
   * waiter instead of pointing at items one by one. Lives only on this
   * page: the floating bar and the order view are both scoped here, not
   * shown on the rest of the site.
   * ------------------------------------------------------------------ */
  var menuBrowse = document.getElementById("menu-browse");
  var cartView = document.getElementById("cart-view");
  var cartBody = document.getElementById("cart-body");
  var cartTotalAmount = document.getElementById("cart-total-amount");
  var cartBar = document.getElementById("cart-bar");
  var cartBarCount = document.getElementById("cart-bar-count");
  var cartBarTotal = document.getElementById("cart-bar-total");
  var cartViewCloseBtn = document.getElementById("cart-view-close");
  var cartBackToMenuBtn = document.getElementById("cart-back-to-menu");
  var cartClearBtn = document.getElementById("cart-clear");

  function loadCart() {
    try {
      var raw = window.localStorage && localStorage.getItem("mun-cart");
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveCart() {
    try {
      if (window.localStorage) localStorage.setItem("mun-cart", JSON.stringify(cart));
    } catch (e) { /* private mode / storage full — cart just won't persist across reloads */ }
  }

  var cart = loadCart();

  function formatRub(n) {
    return n.toLocaleString("ru-RU") + " ₽";
  }

  function cartCount() {
    var n = 0;
    Object.keys(cart).forEach(function (k) { n += cart[k].qty; });
    return n;
  }

  function cartTotal() {
    var sum = 0;
    Object.keys(cart).forEach(function (k) { sum += cart[k].qty * cart[k].price; });
    return sum;
  }

  function updateCartBar() {
    var count = cartCount();
    if (cartBarCount) cartBarCount.textContent = count;
    if (cartBarTotal) cartBarTotal.textContent = formatRub(cartTotal());
    var cartViewOpen = cartView && !cartView.hidden;
    if (cartBar) cartBar.classList.toggle("is-visible", count > 0 && !cartViewOpen);
  }

  function renderCartView() {
    if (!cartBody) return;
    var keys = Object.keys(cart);
    if (!keys.length) {
      cartBody.innerHTML = '<p class="cart-empty">Пока пусто — добавьте блюда из меню, нажимая «+» рядом с позицией.</p>';
    } else {
      cartBody.innerHTML = "";
      keys.forEach(function (key) {
        var item = cart[key];
        var row = el("div", "cart-item");

        var info = el("div", "cart-item-info");
        info.appendChild(el("span", "cart-item-name", escapeHTML(item.name)));
        info.appendChild(el("span", "cart-item-line", formatRub(item.qty * item.price)));
        row.appendChild(info);

        var stepper = el("div", "menu-qty-stepper cart-item-stepper");
        stepper.setAttribute("data-key", key);
        var decBtn = el("button", "", "−");
        decBtn.type = "button";
        decBtn.setAttribute("data-cart-action", "dec");
        decBtn.setAttribute("aria-label", "Уменьшить количество");
        stepper.appendChild(decBtn);
        stepper.appendChild(el("span", "menu-qty-count", String(item.qty)));
        var incBtn = el("button", "", "+");
        incBtn.type = "button";
        incBtn.setAttribute("data-cart-action", "inc");
        incBtn.setAttribute("aria-label", "Увеличить количество");
        stepper.appendChild(incBtn);
        row.appendChild(stepper);

        var removeBtn = el("button", "cart-item-remove", "&times;");
        removeBtn.type = "button";
        removeBtn.setAttribute("data-cart-action", "remove");
        removeBtn.setAttribute("data-key", key);
        removeBtn.setAttribute("aria-label", "Удалить из заказа");
        row.appendChild(removeBtn);

        cartBody.appendChild(row);
      });
    }
    if (cartTotalAmount) cartTotalAmount.textContent = formatRub(cartTotal());
  }

  if (cartBody) {
    cartBody.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-cart-action]");
      if (!btn) return;
      var key = btn.getAttribute("data-key") || (btn.closest("[data-key]") && btn.closest("[data-key]").getAttribute("data-key"));
      if (!key || !cart[key]) return;
      var action = btn.getAttribute("data-cart-action");
      if (action === "inc") cart[key].qty++;
      else if (action === "dec") { cart[key].qty--; if (cart[key].qty <= 0) delete cart[key]; }
      else if (action === "remove") delete cart[key];
      saveCart();
      renderCartView();
      updateCartBar();
    });
  }

  function showCartView() {
    if (!cartView || !cartView.hidden) return;
    renderCartView();
    if (menuBrowse) menuBrowse.hidden = true;
    cartView.hidden = false;
    window.scrollTo(0, 0);
    updateCartBar();
  }

  function hideCartView() {
    if (!cartView || cartView.hidden) return;
    cartView.hidden = true;
    if (menuBrowse) menuBrowse.hidden = false;
    window.scrollTo(0, 0);
    updateCartBar();
  }

  if (cartBar) cartBar.addEventListener("click", showCartView);
  if (cartViewCloseBtn) cartViewCloseBtn.addEventListener("click", hideCartView);
  if (cartBackToMenuBtn) cartBackToMenuBtn.addEventListener("click", hideCartView);
  if (cartClearBtn) {
    cartClearBtn.addEventListener("click", function () {
      cart = {};
      saveCart();
      renderCartView();
      updateCartBar();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && cartView && !cartView.hidden) hideCartView();
  });

  updateCartBar();
})();

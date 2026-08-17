(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  var modalNote = document.getElementById("menu-note");
  var modalSegment = document.getElementById("menu-segment");
  var modalSegmentIndicator = document.getElementById("menu-segment-indicator");
  var openTriggers = document.querySelectorAll("[data-open-menu]");
  var closeTriggers = document.querySelectorAll("[data-close-menu]");

  var activeSegment = "food";
  var loadedSegments = {}; // segment -> { items, isFallback }
  var lastFocused = null;

  function positionSegmentIndicator() {
    if (!modalSegment || !modalSegmentIndicator) return;
    var activeBtn = modalSegment.querySelector(".menu-segment-btn.is-active");
    if (!activeBtn) return;
    modalSegmentIndicator.style.width = activeBtn.offsetWidth + "px";
    modalSegmentIndicator.style.transform = "translateX(" + activeBtn.offsetLeft + "px)";
  }

  if (modalSegment) {
    modalSegment.querySelectorAll(".menu-segment-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var seg = btn.getAttribute("data-segment");
        modalSegment.querySelectorAll(".menu-segment-btn").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        positionSegmentIndicator();
        if (seg === activeSegment) return;
        activeSegment = seg;
        showSegment(seg);
      });
    });
    window.addEventListener("resize", debounce(positionSegmentIndicator, 150));
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  // The modal replaces the page content in normal flow instead of
  // overlaying it (see the CSS comment above .menu-modal), so opening it
  // resets window scroll to the top of the modal and closing it needs to
  // restore wherever the visitor was on the main page.
  var savedScrollY = 0;

  function lockPageForModal() {
    savedScrollY = window.scrollY;
    document.body.classList.add("modal-open");
    window.scrollTo(0, 0);
  }

  function unlockPageAfterModal() {
    document.body.classList.remove("modal-open");
    window.scrollTo(0, savedScrollY);
  }

  function openModal() {
    if (modal.classList.contains("is-open")) return;
    lastFocused = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    lockPageForModal();
    closeMobileNav();
    showSegment(activeSegment);
    requestAnimationFrame(positionSegmentIndicator);
    updateCartBar();
  }

  function closeModal() {
    if (!modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    unlockPageAfterModal();
    if (lastFocused) lastFocused.focus({ preventScroll: true });
    updateCartBar();
  }

  openTriggers.forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      if (bookingModal) closeBookingModal();
      closeCartModal();
      openModal();
    });
  });
  closeTriggers.forEach(function (el) {
    el.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  /* ------------------------------------------------------------------
   * Booking modal
   * ------------------------------------------------------------------ */
  var bookingModal = document.getElementById("booking-modal");
  var bookingIframe = document.getElementById("booking-iframe");
  var bookingOpenTriggers = document.querySelectorAll("[data-open-booking]");
  var bookingCloseTriggers = document.querySelectorAll("[data-close-booking]");
  var bookingLastFocused = null;

  function openBookingModal() {
    if (bookingModal.classList.contains("is-open")) return;
    bookingLastFocused = document.activeElement;
    if (bookingIframe && !bookingIframe.getAttribute("src") && bookingIframe.dataset.src) {
      bookingIframe.src = bookingIframe.dataset.src;
    }
    bookingModal.classList.add("is-open");
    bookingModal.setAttribute("aria-hidden", "false");
    lockPageForModal();
    closeMobileNav();
    updateCartBar();
  }

  function closeBookingModal() {
    if (!bookingModal.classList.contains("is-open")) return;
    bookingModal.classList.remove("is-open");
    bookingModal.setAttribute("aria-hidden", "true");
    unlockPageAfterModal();
    if (bookingLastFocused) bookingLastFocused.focus({ preventScroll: true });
    updateCartBar();
  }

  if (bookingModal) {
    bookingOpenTriggers.forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        closeModal();
        closeCartModal();
        openBookingModal();
      });
    });
    bookingCloseTriggers.forEach(function (el) {
      el.addEventListener("click", closeBookingModal);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && bookingModal.classList.contains("is-open")) closeBookingModal();
    });
  }

  /* ------------------------------------------------------------------
   * Cart — "add to order" on every priced menu item, so a guest can
   * collect everything in one place and show the total (and the list)
   * to a waiter instead of pointing at items one by one.
   * ------------------------------------------------------------------ */
  var cartModal = document.getElementById("cart-modal");
  var cartBody = document.getElementById("cart-body");
  var cartTotalAmount = document.getElementById("cart-total-amount");
  var cartBar = document.getElementById("cart-bar");
  var cartBarCount = document.getElementById("cart-bar-count");
  var cartBarTotal = document.getElementById("cart-bar-total");
  var cartCloseTriggers = document.querySelectorAll("[data-close-cart]");
  var cartBackToMenuBtn = document.getElementById("cart-back-to-menu");
  var cartClearBtn = document.getElementById("cart-clear");
  var cartLastFocused = null;

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
    var bookingOpen = bookingModal && bookingModal.classList.contains("is-open");
    var cartOpen = cartModal && cartModal.classList.contains("is-open");
    if (cartBar) cartBar.classList.toggle("is-visible", count > 0 && !bookingOpen && !cartOpen);
  }

  function renderCartModal() {
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
      renderCartModal();
      updateCartBar();
    });
  }

  function openCartModal() {
    if (!cartModal || cartModal.classList.contains("is-open")) return;
    cartLastFocused = document.activeElement;
    renderCartModal();
    cartModal.classList.add("is-open");
    cartModal.setAttribute("aria-hidden", "false");
    lockPageForModal();
    closeMobileNav();
    updateCartBar();
  }

  function closeCartModal() {
    if (!cartModal || !cartModal.classList.contains("is-open")) return;
    cartModal.classList.remove("is-open");
    cartModal.setAttribute("aria-hidden", "true");
    unlockPageAfterModal();
    if (cartLastFocused) cartLastFocused.focus({ preventScroll: true });
    updateCartBar();
  }

  if (cartBar) {
    cartBar.addEventListener("click", function () {
      closeModal();
      closeBookingModal();
      openCartModal();
    });
  }
  cartCloseTriggers.forEach(function (el) { el.addEventListener("click", closeCartModal); });
  if (cartBackToMenuBtn) {
    cartBackToMenuBtn.addEventListener("click", function () {
      closeCartModal();
      openModal();
    });
  }
  if (cartClearBtn) {
    cartClearBtn.addEventListener("click", function () {
      cart = {};
      saveCart();
      renderCartModal();
      updateCartBar();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && cartModal && cartModal.classList.contains("is-open")) closeCartModal();
  });
  updateCartBar();

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

    modalBody.innerHTML = "";

    if (!groups.length) {
      modalBody.innerHTML = '<p class="menu-error">Меню временно недоступно. Загляните позже или уточните у официанта.</p>';
      modalNote.textContent = "";
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

      modalBody.appendChild(category);
    });

    modalNote.textContent = isFallback
      ? "Показан снимок меню на 06.08.2026. Актуальность и наличие позиций уточняйте у персонала."
      : "Цены и наличие позиций уточняйте у персонала.";
  }

  modalBody.addEventListener("click", function (e) {
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

  function escapeHTML(str) {
    var d = document.createElement("div");
    d.textContent = str == null ? "" : str;
    return d.innerHTML;
  }

  function fadeBody(update) {
    modalBody.classList.add("is-fading");
    setTimeout(function () {
      update();
      modalBody.classList.remove("is-fading");
    }, 180);
  }

  function showSegment(segment) {
    var cached = loadedSegments[segment];
    fadeBody(function () {
      if (cached) {
        renderMenu(cached.items, cached.isFallback);
        return;
      }
      modalBody.innerHTML = '<p class="menu-loading">Загружаем меню…</p>';
      modalNote.textContent = "";
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

  /* ------------------------------------------------------------------
   * Slides — full-screen sections. Tracks which one is currently most
   * visible so its heading/ghost numeral can animate in (replayably,
   * unlike the one-shot [data-reveal] items below), and drives the header
   * logo's "moon phase" — the eclipse shadow recedes as you move deeper
   * into the page, so the mark reads as fully hidden on the hero and
   * fully whole by the time you reach the contacts slide.
   * ------------------------------------------------------------------ */
  var slideEls = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var slideDots = document.querySelectorAll(".slide-dot");
  var slideRatios = new Map();

  function updateActiveSlide() {
    var best = null;
    var bestRatio = 0;
    slideEls.forEach(function (s) {
      var r = slideRatios.get(s) || 0;
      if (r > bestRatio) { bestRatio = r; best = s; }
    });
    if (!best) return;
    var idx = slideEls.indexOf(best);
    slideEls.forEach(function (s) { s.classList.toggle("is-active", s === best); });
    slideDots.forEach(function (d) {
      d.classList.toggle("is-active", d.getAttribute("data-slide-target") === best.id);
    });
    var phase = slideEls.length > 1 ? idx / (slideEls.length - 1) : 1;
    document.documentElement.style.setProperty("--moon-phase", phase.toFixed(3));
  }

  if (slideEls.length) {
    if ("IntersectionObserver" in window) {
      var slideObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          slideRatios.set(entry.target, entry.intersectionRatio);
        });
        updateActiveSlide();
      }, { threshold: [0, .15, .3, .45, .6, .75, .9, 1] });
      slideEls.forEach(function (s) { slideObserver.observe(s); });
    } else {
      slideEls.forEach(function (s) { s.classList.add("is-active"); });
      document.documentElement.style.setProperty("--moon-phase", "1");
    }
  }

  slideDots.forEach(function (dot) {
    dot.addEventListener("click", function () {
      var targetEl = document.getElementById(dot.getAttribute("data-slide-target"));
      if (targetEl) targetEl.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    });
  });

  /* ------------------------------------------------------------------
   * Scroll reveal
   * ------------------------------------------------------------------ */
  var revealTargets = document.querySelectorAll("[data-reveal]");

  if (revealTargets.length) {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealTargets.forEach(function (t) { t.classList.add("is-visible"); });
    } else {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });
      revealTargets.forEach(function (t) { revealObserver.observe(t); });
    }
  }

  /* ------------------------------------------------------------------
   * Mobile sticky action bar — appears once the hero is scrolled past
   * ------------------------------------------------------------------ */
  var stickyActions = document.querySelector(".sticky-actions");
  var heroSection = document.querySelector(".hero");

  if (stickyActions && heroSection) {
    if ("IntersectionObserver" in window) {
      var stickyObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyActions.classList.toggle("is-visible", !entry.isIntersecting);
        });
      }, { threshold: 0 });
      stickyObserver.observe(heroSection);
    } else {
      stickyActions.classList.add("is-visible");
    }
  }

  /* ------------------------------------------------------------------
   * Hero moon parallax (desktop pointer only)
   * ------------------------------------------------------------------ */
  var heroEl = document.querySelector(".hero");
  var heroLogoImg = document.querySelector(".hero-logo-img");
  var heroMist = document.querySelector(".hero-mist");
  var canHoverPrecisely = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (heroEl && heroLogoImg && !prefersReducedMotion && canHoverPrecisely) {
    var parallaxRaf = null;
    heroEl.addEventListener("mousemove", function (e) {
      var rect = heroEl.getBoundingClientRect();
      var relX = (e.clientX - rect.left) / rect.width - 0.5;
      var relY = (e.clientY - rect.top) / rect.height - 0.5;
      if (parallaxRaf) cancelAnimationFrame(parallaxRaf);
      parallaxRaf = requestAnimationFrame(function () {
        heroLogoImg.style.transform = "translate(" + (relX * 12).toFixed(1) + "px, " + (relY * 10).toFixed(1) + "px)";
        if (heroMist) {
          heroMist.style.transform = "translate(calc(-50% + " + (relX * 14).toFixed(1) + "px), " + (relY * 10).toFixed(1) + "px)";
        }
      });
    });
    heroEl.addEventListener("mouseleave", function () {
      heroLogoImg.style.transform = "";
      if (heroMist) heroMist.style.transform = "";
    });
  }

  /* ------------------------------------------------------------------
   * Misc
   * ------------------------------------------------------------------ */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();

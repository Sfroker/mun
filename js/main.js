(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
   * Booking modal — full-page takeover, native document scroll (see the
   * CSS comment above .menu-modal for why: position:fixed + an internally
   * scrolling div is a well-known source of touch-scroll dead zones on
   * mobile Safari). Opening it replaces the page content in normal flow,
   * so it resets window scroll to the top and closing it restores
   * wherever the visitor was.
   * ------------------------------------------------------------------ */
  var bookingModal = document.getElementById("booking-modal");
  var bookingIframe = document.getElementById("booking-iframe");
  var bookingOpenTriggers = document.querySelectorAll("[data-open-booking]");
  var bookingCloseTriggers = document.querySelectorAll("[data-close-booking]");
  var bookingLastFocused = null;
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
  }

  function closeBookingModal() {
    if (!bookingModal.classList.contains("is-open")) return;
    bookingModal.classList.remove("is-open");
    bookingModal.setAttribute("aria-hidden", "true");
    unlockPageAfterModal();
    if (bookingLastFocused) bookingLastFocused.focus({ preventScroll: true });
  }

  if (bookingModal) {
    bookingOpenTriggers.forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
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

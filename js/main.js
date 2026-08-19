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
   * Stories — pinned news/promo circles; clicking one opens a vertical
   * story viewer (reuses the same full-page-takeover modal pattern as
   * booking, so it's exempt from the mobile touch-scroll issues that
   * pattern was specifically built to avoid).
   * ------------------------------------------------------------------ */
  var storiesData = window.MUN_STORIES || [];
  var storiesRow = document.getElementById("stories-row");
  var storyModal = document.getElementById("story-modal");
  var storyCard = document.getElementById("story-card");
  var storyProgress = document.getElementById("story-progress");
  var storyContent = storyCard ? storyCard.querySelector(".story-content") : null;
  var storyTitle = document.getElementById("story-title");
  var storyText = document.getElementById("story-text");
  var storyBtn = document.getElementById("story-btn");
  var storyPrevBtn = document.getElementById("story-prev");
  var storyNextBtn = document.getElementById("story-next");
  var storyCloseTriggers = document.querySelectorAll("[data-close-story]");
  var storyLastFocused = null;
  var activeStoryIndex = 0;

  if (storiesRow && storiesData.length) {
    storiesData.forEach(function (story, i) {
      var btn = document.createElement("button");
      btn.className = "story-circle";
      btn.type = "button";
      btn.setAttribute("role", "listitem");
      btn.setAttribute("aria-label", story.label);
      var thumb = story.image
        ? '<span class="story-thumb" style="background-image:url(&quot;' + story.image + '&quot;)"></span>'
        : '<span class="story-thumb tint-' + (story.tint || "ember") + '"></span>';
      btn.innerHTML =
        '<span class="story-ring">' + thumb + "</span>" +
        '<span class="story-label">' + escapeHTML(story.label) + "</span>";
      btn.addEventListener("click", function () { openStoryModal(i); });
      storiesRow.appendChild(btn);
    });
  }

  function escapeHTML(str) {
    var d = document.createElement("div");
    d.textContent = str == null ? "" : str;
    return d.innerHTML;
  }

  function renderStory(index) {
    var story = storiesData[index];
    if (!story) return;
    activeStoryIndex = index;

    if (story.image) {
      storyCard.className = "story-card has-image";
      storyCard.style.backgroundImage = "url('" + story.image + "')";
    } else {
      storyCard.className = "story-card tint-" + (story.tint || "ember");
      storyCard.style.backgroundImage = "";
    }
    storyTitle.textContent = story.title || "";
    storyTitle.hidden = !story.title;
    storyText.textContent = story.text || "";
    storyText.hidden = !story.text;
    if (story.buttonText && story.buttonHref) {
      storyBtn.textContent = story.buttonText;
      storyBtn.href = story.buttonHref;
      storyBtn.style.display = "";
      // Anchor links point at sections inside <main>, which is hidden
      // (display:none) while this modal is open — a plain click would
      // silently do nothing. Close the story first, then either open the
      // booking modal (for #booking) or scroll to the target section.
      storyBtn.onclick = function (e) {
        var href = story.buttonHref;
        if (href.charAt(0) !== "#") return; // real page link (e.g. menu/) — let it navigate
        e.preventDefault();
        closeStoryModal();
        if (href === "#booking" && bookingModal) {
          openBookingModal();
          return;
        }
        var target = document.getElementById(href.slice(1));
        if (target) {
          requestAnimationFrame(function () {
            target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
          });
        }
      };
    } else {
      storyBtn.style.display = "none";
      storyBtn.onclick = null;
    }
    if (storyContent) {
      storyContent.hidden = !story.title && !story.text && !(story.buttonText && story.buttonHref);
    }

    storyProgress.innerHTML = "";
    storiesData.forEach(function (s, i) {
      var seg = document.createElement("span");
      if (i < index) seg.className = "is-done";
      else if (i === index) seg.className = "is-current";
      storyProgress.appendChild(seg);
    });

    if (storyPrevBtn) storyPrevBtn.style.visibility = index === 0 ? "hidden" : "visible";
    if (storyNextBtn) storyNextBtn.style.visibility = index === storiesData.length - 1 ? "hidden" : "visible";
  }

  function openStoryModal(index) {
    if (!storyModal || storyModal.classList.contains("is-open")) return;
    storyLastFocused = document.activeElement;
    renderStory(index);
    storyModal.classList.add("is-open");
    storyModal.setAttribute("aria-hidden", "false");
    lockPageForModal();
    closeMobileNav();
  }

  function closeStoryModal() {
    if (!storyModal || !storyModal.classList.contains("is-open")) return;
    storyModal.classList.remove("is-open");
    storyModal.setAttribute("aria-hidden", "true");
    unlockPageAfterModal();
    if (storyLastFocused) storyLastFocused.focus({ preventScroll: true });
  }

  if (storyPrevBtn) {
    storyPrevBtn.addEventListener("click", function () {
      if (activeStoryIndex > 0) renderStory(activeStoryIndex - 1);
    });
  }
  if (storyNextBtn) {
    storyNextBtn.addEventListener("click", function () {
      if (activeStoryIndex < storiesData.length - 1) renderStory(activeStoryIndex + 1);
    });
  }
  storyCloseTriggers.forEach(function (el) { el.addEventListener("click", closeStoryModal); });
  if (storyModal) {
    document.addEventListener("keydown", function (e) {
      if (!storyModal.classList.contains("is-open")) return;
      if (e.key === "Escape") closeStoryModal();
      else if (e.key === "ArrowLeft" && activeStoryIndex > 0) renderStory(activeStoryIndex - 1);
      else if (e.key === "ArrowRight" && activeStoryIndex < storiesData.length - 1) renderStory(activeStoryIndex + 1);
    });
    // Click on the dark backdrop (outside the card) also closes it.
    storyModal.addEventListener("click", function (e) {
      if (e.target === storyModal || e.target.classList.contains("story-modal-panel")) closeStoryModal();
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
   * Mobile sticky action bar — appears once the hero is scrolled past.
   * Driven directly off scroll position (rAF-throttled) rather than
   * IntersectionObserver: with scroll-snap in play, an IO callback can
   * lag a frame behind a fast snap animation, which read as "the bar
   * doesn't show until you scroll again." A plain scrollY check has no
   * such timing gap.
   * ------------------------------------------------------------------ */
  var stickyActions = document.querySelector(".sticky-actions");
  var heroSection = document.querySelector(".hero");

  if (stickyActions && heroSection) {
    var stickyTicking = false;
    function updateStickyActions() {
      stickyTicking = false;
      var pastHero = window.scrollY >= heroSection.offsetHeight - 4;
      stickyActions.classList.toggle("is-visible", pastHero);
    }
    window.addEventListener("scroll", function () {
      if (stickyTicking) return;
      stickyTicking = true;
      requestAnimationFrame(updateStickyActions);
    }, { passive: true });
    updateStickyActions();
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

(function () {
  "use strict";

  var STORAGE_KEY = "mun-cookie-consent";
  var banner = document.getElementById("cookie-banner");
  if (!banner) return;

  var accepted = false;
  try {
    accepted = window.localStorage && localStorage.getItem(STORAGE_KEY) === "1";
  } catch (e) { /* private mode / storage blocked — show the banner every visit */ }

  if (!accepted) banner.classList.add("is-visible");

  var acceptBtn = document.getElementById("cookie-banner-accept");
  if (acceptBtn) {
    acceptBtn.addEventListener("click", function () {
      banner.classList.remove("is-visible");
      try {
        if (window.localStorage) localStorage.setItem(STORAGE_KEY, "1");
      } catch (e) { /* no persistence — banner will show again next visit */ }
    });
  }
})();

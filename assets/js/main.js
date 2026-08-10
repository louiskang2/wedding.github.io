/* ============================================================
   MAIN — shared behavior on every page:
   - access gating (must have entered a name on the landing page)
   - reveal the top nav, chip strip (RSVP), and page content
   ============================================================ */

(function ($) {
  var page = $("body").data("page");        // home | info | travel | snow | rsvp
  var base = $("body").data("baseurl") || "";
  var session = WeddingAPI.getSession();

  // ---- Gate: non-home pages require a verified session -------
  if (page !== "home" && !session) {
    window.location.href = base + "/";
    return;
  }

  // ---- Home before verification: hero only, no scrolling -----
  if (page === "home" && !session) {
    $("body").addClass("no-scroll");
  }

  // ---- Reveal (home waits for the landing gate; see landing.js)
  window.revealSite = function () {
    $("body").removeClass("no-scroll");
    $("#page-content").addClass("visible");
    $("#top-nav").addClass("visible");
    $("#chip-strip").addClass("visible");
  };
  if (page !== "home") revealSite();

  // The strip's height depends on the web font, which lands after first paint.
  if (page === "rsvp" && window.ResizeObserver) {
    var strip = document.getElementById("chip-strip");
    new ResizeObserver(function () {
      document.documentElement.style.setProperty("--stickybar-height", strip.offsetHeight + "px");
    }).observe(strip);
  }

  // ---- Flickity (in case cells load after auto-init) ----------
  $(window).on("load", function () {
    $(".js-flickity").each(function () {
      var f = Flickity.data(this);
      if (f) f.resize();
    });
  });
})(jQuery);

/* ============================================================
   MAIN — shared behavior on every page:
   - access gating (must have entered a name on the landing page)
   - reveal the top nav, chip strip (RSVP), and page content
   ============================================================ */

(function ($) {
  var page = $("body").data("page");        // the nav_id of the current page
  var base = $("body").data("baseurl") || "";
  var session = WeddingAPI.getSession();

  // ---- Gate: non-home pages require a verified session -------
  if (page !== "home" && !session) {
    window.location.href = base + "/";
    return;
  }

  // Home's sections wait in a <template>, so their images and map embeds
  // are never fetched for a visitor who hasn't been verified.
  function mountHomeSections() {
    var tpl = document.getElementById("home-sections-tpl");
    if (!tpl) return;
    document.getElementById("home-sections").appendChild(tpl.content.cloneNode(true));
    tpl.remove();
  }

  // Anchors resolve .hostname against this document, so relative links and
  // mailto:/tel: fall through and only genuinely off-site ones are rewritten.
  function externalLinksNewTab() {
    $("a[href]").each(function () {
      if (this.hostname && this.hostname !== window.location.hostname) {
        this.target = "_blank";
        this.rel = "noopener noreferrer";
      }
    });
  }

  // ---- Table of contents -------------------------------------
  // Built from the headings kramdown already gave ids to, so a new
  // "## "/"### " in the markdown joins the list on its own.
  function buildToc() {
    var $toc = $("#page-toc");
    if (!$toc.length) return;
    var $list = $("<ol>").addClass("toc-list");
    $(".section").find("h2[id], h3[id]").each(function () {
      $("<li>")
        .addClass(this.tagName === "H3" ? "toc-sub" : "")
        .append($("<a>").attr("href", "#" + this.id).text($(this).text()))
        .appendTo($list);
    });
    if (!$list.children().length) return;
    $toc.append($list).removeAttr("hidden");
  }
  buildToc();

  // ---- Reveal (home waits for the landing gate; see landing.js)
  window.revealSite = function () {
    if (page === "home") mountHomeSections();
    externalLinksNewTab();
    document.documentElement.classList.add("revealed");
    $("#page-content").addClass("visible");
    $("#top-nav").addClass("visible");
    $("#chip-strip").addClass("visible");
  };
  if (page !== "home") revealSite();

  // The strip's height depends on the web font, which lands after first paint.
  var strip = document.getElementById("chip-strip");
  if (strip && window.ResizeObserver) {
    new ResizeObserver(function () {
      document.documentElement.style.setProperty("--stickybar-height", strip.offsetHeight + "px");
    }).observe(strip);
  }

  // Responses are closed: the notice is personalised from the session, so it
  // lives here rather than in rsvp.js, which isn't loaded in that case.
  var $closed = $("#rsvp-closed");
  if ($closed.length) {
    var name = session && session.matched ? session.matched.given : "";
    var received = name
      ? "Your party's RSVP has been received, " + name + ", thank you!"
      : "Your party's RSVP has been received, thank you!";
    if (session && session.hasResponded) {
      $closed.append($("<p>").append($("<strong>").text(received)));
    }
    $closed.append(
      $("<p>").addClass("mb-0")
        .text("The response period has ended. Please contact us if you have any questions.")
    );
  }

  // ---- Flickity (in case cells load after auto-init) ----------
  $(window).on("load", function () {
    $(".js-flickity").each(function () {
      var f = Flickity.data(this);
      if (f) f.resize();
    });
  });
})(jQuery);

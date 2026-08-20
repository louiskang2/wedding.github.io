/* ============================================================
   LANDING — the entry sequence on the home page.
   Images and names fade in via CSS; this file handles the
   name check. On success the hero STAYS PUT: the gate fades
   out in place, a welcome + scroll cue fades in where it was,
   and the rest of the page becomes available below.
   ============================================================ */

(function ($) {
  var session = WeddingAPI.getSession();

  function showWelcome(prefix, name, immediate) {
    var $gate = $("#landing-gate"), $welcome = $("#landing-welcome");
    var $heading = $("#welcome-heading").empty().text(prefix);
    if (name) $heading.append($("<span>").addClass("name").text(name));
    if (immediate) $gate.css("transition", "none");
    $gate.addClass("gate-out");
    $welcome.addClass("show");
    revealSite();
  }

  // Log out & switch guest: clear the session and return to the gate.
  // Saved answers go too — logging out means this isn't the guest's device.
  $("#logout-btn").on("click", function () {
    if (session && session.partyId) WeddingAPI.clearAnswers(session.partyId);
    WeddingAPI.clearSession();
    window.location.reload();
  });

  // Returning visitor in the same session: skip the gate
  if (session) {
    var name = session.matched ? session.matched.given : "";
    showWelcome(name ? "Welcome back, " : "Welcome back", name, true);
    return;
  }

  var $btn = $("#gate-btn"), $err = $("#gate-error");

  function tryEnter() {
    var given = $("#gate-given").val().trim();
    var family = $("#gate-family").val().trim();
    $err.text("");
    if (!given || !family) {
      $err.text("Please enter both your given and family name.");
      return;
    }
    $btn.prop("disabled", true).text("Checking…");
    WeddingAPI.verify(given, family)
      .then(function (res) {
        if (res && res.ok) {
          WeddingAPI.saveSession(res);
          showWelcome("Welcome, ", res.matched.given, false);
        } else {
          $err.text("We couldn't find that name. Please try again or contact us.");
          $btn.prop("disabled", false).text("Enter");
        }
      })
      .catch(function () {
        $err.text("Something went wrong during verification. Please try again in a moment.");
        $btn.prop("disabled", false).text("Enter");
      });
  }

  $btn.on("click", tryEnter);
  $("#gate-given, #gate-family").on("keydown", function (e) {
    if (e.key === "Enter") tryEnter();
  });
})(jQuery);

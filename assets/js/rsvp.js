/* ============================================================
   RSVP — a small wizard:
   Phase 1  "party"    build the guest list (add plus-one / children)
   Phase 2  "details"  one form per guest; active guest highlighted
   Phase 3  "comments" optional comments + submit
   Phase 4  "success"
   Guest chips stay pinned in the sticky top bar throughout.
   ============================================================ */

(function ($) {
  var session = WeddingAPI.getSession();
  if (!session) return; // main.js already redirected

  var $app = $("#rsvp-app");
  var $chips = $("#chip-bar");

  // ---------- State ------------------------------------------
  var members = [];        // {first,last,type,fromSheet,isPlusOne,done,data{}}
  var phase = "party";     // party | details | comments | success
  var activeIdx = -1;
  var comments = "";
  var plusOneAllowed = !!session.plusOneAllowed;

  var YESNO = ["Yes", "No"];
  var SHUTTLE_FROM_OPTIONS = ["Yes, party bus!", "Yes, relaxing bus", "No"];

  function blankData() {
    return { email: "", age: "", wedding: "", dietary: "",
             shuttleTo: "", shuttleFrom: "", afterparty: "", skiTrip: "" };
  }

  // Build initial member list: sheet members + anyone added in a
  // submission saved on this device, prefilled with those answers.
  function initMembers() {
    var prev = WeddingAPI.getAnswers(session.partyId);
    var prevGuests = prev && prev.guests ? prev.guests : [];
    comments = prev && prev.comments ? prev.comments : "";

    function findPrev(m) {
      return prevGuests.find(function (p) {
        return p.first.toLowerCase() === m.first.toLowerCase() &&
               p.last.toLowerCase() === m.last.toLowerCase();
      });
    }

    session.members.forEach(function (m) {
      var p = findPrev(m);
      members.push({
        first: m.first, last: m.last, type: m.type,
        fromSheet: true, isPlusOne: false,
        done: !!p,   // already answered last time — editable by clicking the chip
        data: $.extend(blankData(), {
          email: (p && p.email) || "", age: (p && p.age) || "", wedding: (p && p.wedding) || "",
          dietary: (p && p.dietary) || "", shuttleTo: (p && p.shuttleTo) || "",
          shuttleFrom: (p && p.shuttleFrom) || "", afterparty: (p && p.afterparty) || "",
          skiTrip: (p && p.skiTrip) || ""
        })
      });
    });

    // People added last time (plus-one / children) — deletable
    prevGuests.forEach(function (p) {
      var exists = members.some(function (m) {
        return m.first.toLowerCase() === p.first.toLowerCase() &&
               m.last.toLowerCase() === p.last.toLowerCase();
      });
      if (!exists) {
        members.push({
          first: p.first, last: p.last, type: p.type || "Adult",
          fromSheet: false, isPlusOne: p.isPlusOne === true || p.isPlusOne === "Yes",
          done: true,   // came from a completed submission
          data: $.extend(blankData(), p)
        });
      }
    });
  }

  function hasPlusOne() {
    return members.some(function (m) { return m.isPlusOne; });
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---------- Guest chip strip (below the top nav) -------------
  function renderChips() {
    $chips.empty();
    members.forEach(function (m, i) {
      var cls = "guest-chip clickable";
      if (phase === "details" && i === activeIdx) cls += " active";
      if (m.done) cls += " done";
      var $chip = $('<span class="' + cls + '" data-idx="' + i + '" role="button" tabindex="0" ' +
                    'title="Click to ' + (m.done ? "review or edit" : "fill in") + " " + esc(m.first) + '\u2019s answers"></span>');
      if (m.done) $chip.append('<span class="chip-check">✓</span> ');
      $chip.append(esc(m.first + " " + m.last));
      $chip.append('<span class="chip-edit" aria-hidden="true">✎</span>');
      if (phase === "party" && !m.fromSheet) {
        $chip.append('<button class="chip-remove" title="Remove ' + esc(m.first) + '" data-remove="' + i + '">×</button>');
      }
      $chips.append($chip);
    });
  }

  // Click (or keyboard-activate) a chip to jump to that guest's form —
  // works in every phase, including when revisiting a finished RSVP.
  function chipJump(el, e) {
    if ($(e.target).is(".chip-remove")) return;
    var i = $(el).data("idx");
    phase = "details";
    activeIdx = i;
    render();
  }
  $chips.on("click", ".guest-chip", function (e) { chipJump(this, e); });
  $chips.on("keydown", ".guest-chip", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chipJump(this, e); }
  });
  $chips.on("click", ".chip-remove", function () {
    removeMember($(this).data("remove"));
  });

  function removeMember(i) {
    if (members[i] && !members[i].fromSheet) {
      members.splice(i, 1);
      render();
    }
  }

  // ---------- Phase 1: build the party ------------------------
  function renderParty() {
    var rows = members.map(function (m, i) {
      var tag = m.fromSheet ? (m.type === "Child" ? "Child" : "Invited")
                            : (m.isPlusOne ? "Your guest" : "Child");
      var del = m.fromSheet ? "" :
        '<button class="btn btn-wed-outline btn-remove btn-sm" data-del="' + i + '">Remove</button>';
      return '<div class="member-row">' +
               '<span class="member-name">' + esc(m.first + " " + m.last) + '</span>' +
               '<span class="d-flex align-items-center gap-2">' +
                 '<span class="member-tag">' + tag + '</span>' + del +
               '</span>' +
             '</div>';
    }).join("");

    var addGuestBtn = (plusOneAllowed && !hasPlusOne())
      ? '<button class="btn btn-wed-outline" id="add-guest">+ Add a guest</button>' : "";

    var returning = members.some(function (m) { return m.done; });
    // The backend reports only that a response exists, never its contents.
    var elsewhere = session.hasResponded && !WeddingAPI.getAnswers(session.partyId);

    $app.html(
      '<div class="rsvp-card">' +
        '<h3>Your party</h3>' +
        '<p class="rsvp-note">' +
          (elsewhere ? "<strong>We have already received your RSVP, and what you send now replaces your entire party.</strong> " : "") +
          'These are the people on your invitation.' +
          (plusOneAllowed ? " We would be delighted for you to bring a guest." : "") +
          " You may also add children." +
        "</p>" +
        rows +
        '<div class="d-flex flex-wrap gap-2 mt-4">' + addGuestBtn +
          '<button class="btn btn-wed-outline" id="add-child">+ Add a child</button>' +
        '</div>' +
        '<div id="add-form" class="mt-3"></div>' +
        '<div class="text-end mt-4">' +
          '<button class="btn btn-wed" id="to-details">Continue →</button>' +
        '</div>' +
      '</div>'
    );

    $("[data-del]").on("click", function () { removeMember($(this).data("del")); });

    function showAddForm(kind) {
      $("#add-form").html(
        '<div class="row g-2 align-items-end">' +
          '<div class="col-12 col-sm-4"><label class="form-label">First name</label>' +
            '<input class="form-control" id="new-first"></div>' +
          '<div class="col-12 col-sm-4"><label class="form-label">Last name</label>' +
            '<input class="form-control" id="new-last"></div>' +
          '<div class="col-12 col-sm-4">' +
            '<button class="btn btn-wed w-100" id="new-save">Add ' +
            (kind === "child" ? "child" : "guest") + '</button></div>' +
          '<div class="col-12 text-danger small" id="new-err"></div>' +
        '</div>'
      );
      $("#new-first").trigger("focus");
      $("#new-save").on("click", function () {
        var f = $("#new-first").val().trim(), l = $("#new-last").val().trim();
        if (!f || !l) { $("#new-err").text("Please enter a first and last name."); return; }
        members.push({
          first: f, last: l,
          type: kind === "child" ? "Child" : "Adult",
          fromSheet: false, isPlusOne: kind === "guest",
          done: false, data: blankData()
        });
        render();
      });
    }
    $("#add-guest").on("click", function () { showAddForm("guest"); });
    $("#add-child").on("click", function () { showAddForm("child"); });

    $("#to-details").on("click", function () {
      phase = "details";
      activeIdx = 0;
      render();
    });
  }

  // ---------- Phase 2: per-guest details ----------------------
  function selectField(id, label, value, options) {
    var opts = ['<option value="">Choose…</option>'].concat(options.map(function (o) {
      return '<option' + (value === o ? " selected" : "") + '>' + o + "</option>";
    })).join("");
    return '<div class="col-12 col-sm-6"><label class="form-label">' + label + '</label>' +
           '<select class="form-select" id="' + id + '">' + opts + "</select></div>";
  }

  function renderDetails() {
    var m = members[activeIdx];
    var d = m.data;
    var isChild = m.type === "Child";

    var fields = "";
    if (!isChild) {
      fields += '<div class="col-12 col-sm-6"><label class="form-label">Email address</label>' +
        '<input type="email" class="form-control" id="f-email" value="' + esc(d.email) + '" placeholder="name@example.com"></div>';
    } else {
      fields += '<div class="col-12 col-sm-6"><label class="form-label">Age (on the wedding day)</label>' +
        '<input type="number" min="0" max="17" class="form-control" id="f-age" value="' + esc(d.age) + '"></div>';
    }
    fields += selectField("f-wedding", "Attending the wedding?", d.wedding, YESNO);

    // These only apply if the guest is coming to the wedding. They live in
    // their own group so we can show/hide them when the answer changes.
    var weddingOnly =
      '<div class="col-12"><label class="form-label">Dietary restrictions</label>' +
        '<input class="form-control" id="f-dietary" value="' + esc(d.dietary) + '" placeholder="None / vegetarian / allergies…"></div>' +
      selectField("f-shuttle-to", "Shuttle bus to the venue?", d.shuttleTo, YESNO) +
      selectField("f-shuttle-from", "Shuttle bus back to Tokyo?", d.shuttleFrom, SHUTTLE_FROM_OPTIONS);
    fields += '<div class="col-12" id="wedding-only"><div class="row g-3">' + weddingOnly + '</div></div>';

    if (!isChild) fields += selectField("f-afterparty", "Attending the afterparty?", d.afterparty, YESNO);
    fields += selectField("f-ski", "Joining the snow trip?", d.skiTrip, YESNO);

    $app.html(
      '<div class="rsvp-card">' +
        '<p class="rsvp-note mb-1">Guest ' + (activeIdx + 1) + " of " + members.length + "</p>" +
        '<h3>' + esc(m.first + " " + m.last) + (isChild ? ' <span class="member-tag">Child</span>' : "") + "</h3>" +
        '<div class="row g-3">' + fields + "</div>" +
        '<div class="text-danger small mt-2" id="f-err"></div>' +
        '<div class="d-flex justify-content-between mt-4">' +
          '<button class="btn btn-wed-outline" id="f-back">' +
            (activeIdx === 0 ? "← Your party" : "← Back") + "</button>" +
          '<button class="btn btn-wed" id="f-save">' +
            (activeIdx === members.length - 1 ? "Save & finish" : "Save & next →") + "</button>" +
        "</div>" +
      "</div>"
    );

    $("#f-back").on("click", function () {
      saveFields(false);
      if (activeIdx === 0) {
        phase = "party";        // step back out to the "Your party" list
      } else {
        activeIdx--;
      }
      render();
    });

    $("#f-save").on("click", function () { saveFields(true); });

    // Show the dietary + shuttle questions only when attending the wedding.
    function toggleWeddingOnly() {
      var attending = $("#f-wedding").val() === "Yes";
      $("#wedding-only").toggle(attending);
    }
    $("#f-wedding").on("change", toggleWeddingOnly);
    toggleWeddingOnly();  // set initial visibility (hidden if "No" or unanswered)

    function saveFields(validate) {
      d.email = isChild ? "" : ($("#f-email").val() || "").trim();
      d.age = isChild ? ($("#f-age").val() || "").trim() : "";
      d.wedding = $("#f-wedding").val() || "";
      d.afterparty = isChild ? "" : ($("#f-afterparty").val() || "");
      d.skiTrip = $("#f-ski").val() || "";

      var attending = d.wedding === "Yes";
      if (attending) {
        d.dietary = ($("#f-dietary").val() || "").trim();
        d.shuttleTo = $("#f-shuttle-to").val() || "";
        d.shuttleFrom = $("#f-shuttle-from").val() || "";
      } else {
        // Not attending the wedding — these questions don't apply, so clear
        // any previously entered answers rather than storing stale values.
        d.dietary = "";
        d.shuttleTo = "";
        d.shuttleFrom = "";
      }

      if (!validate) return;

      var missing = !d.wedding || !d.skiTrip ||
                    (!isChild && (!d.email || !d.afterparty)) ||
                    (isChild && d.age === "") ||
                    (attending && (!d.dietary || !d.shuttleTo || !d.shuttleFrom));
      if (missing) {
        $("#f-err").text("Please answer every question before continuing.");
        return;
      }

      m.done = true;
      if (activeIdx === members.length - 1) {
        phase = "comments";
      } else {
        activeIdx++;
      }
      render();
    }
  }

  // ---------- Phase 3: comments + submit ----------------------
  function renderComments() {
    $app.html(
      '<div class="rsvp-card">' +
        '<h3>Almost done</h3>' +
        '<p class="rsvp-note">Everyone above is checked off ✓. Add an optional note, then send it our way.</p>' +
        '<label class="form-label">Comments (optional)</label>' +
        '<textarea class="form-control" id="r-comments" rows="4" ' +
          'placeholder="Anything else…">' + esc(comments) + "</textarea>" +
        '<div class="text-danger small mt-2" id="r-err"></div>' +
        '<div class="d-flex justify-content-between mt-4">' +
          '<button class="btn btn-wed-outline" id="r-back">← Review answers</button>' +
          '<button class="btn btn-wed btn-contrast" id="r-submit">Submit RSVP</button>' +
        "</div>" +
      "</div>"
    );

    $("#r-back").on("click", function () {
      comments = $("#r-comments").val();
      phase = "details";
      activeIdx = 0;
      render();
    });

    $("#r-submit").on("click", function () {
      comments = $("#r-comments").val().trim();
      var $b = $("#r-submit").prop("disabled", true).text("Sending…");
      var payload = {
        partyId: session.partyId,
        comments: comments,
        guests: members.map(function (m) {
          return $.extend({
            first: m.first, last: m.last, type: m.type, isPlusOne: m.isPlusOne
          }, m.data);
        })
      };
      WeddingAPI.submit(payload)
        .then(function (res) {
          if (res && res.ok) {
            WeddingAPI.saveAnswers(session.partyId, { comments: comments, guests: payload.guests });
            phase = "success";
            render();
          } else { throw new Error("bad response"); }
        })
        .catch(function () {
          $("#r-err").text("The RSVP couldn't be sent. Please check your connection and try again.");
          $b.prop("disabled", false).text("Submit RSVP");
        });
    });
  }

  // ---------- Phase 4: success --------------------------------
  function renderSuccess() {
    $app.html(
      '<div class="rsvp-success">' +
        '<span class="big-check">✓</span>' +
        "<strong>Your RSVP has been received. Thank you!</strong>" +
        '<p class="mb-0 mt-2">Plans changed? Come back and resubmit—your newest answers replace the old ones.</p>' +
      "</div>" +
      '<div class="text-center mt-4">' +
        '<button class="btn btn-wed-outline btn-rsvp-update" id="r-again">Update my RSVP</button>' +
      "</div>"
    );
    $("#r-again").on("click", function () {
      // Answers stay saved (✓) — click any name in the strip to edit,
      // or use this to revisit the party list and re-send.
      phase = "party";
      render();
    });
  }

  // ---------- Render loop -------------------------------------
  function render() {
    renderChips();
    if (phase === "party") renderParty();
    else if (phase === "details") renderDetails();
    else if (phase === "comments") renderComments();
    else renderSuccess();
    // keep the sticky bar's scroll on the active chip
    var $active = $chips.find(".guest-chip.active");
    if ($active.length && $active[0].scrollIntoView) {
      $active[0].scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  initMembers();
  render();
})(jQuery);

---
# Jekyll processes this file so the Apps Script URL from _config.yml is injected.
---
/* ============================================================
   API — connection to the Google Apps Script backend.
   If site.apps_script_url is empty in _config.yml, the site runs
   in DEMO MODE using the sample guests below (matches the
   sample-data/Guests.csv file).
   ============================================================ */

window.WeddingAPI = (function () {
  var API_URL = "{{ site.apps_script_url }}";
  var DEMO = !API_URL;

  // ---- Demo data (mirrors sample-data/Guests.csv) -----------
  var DEMO_GUESTS = [
    { partyId: "P001", given: "Alex, Alexander", family: "Tanaka", type: "Adult", plusOne: true  },
    { partyId: "P002", given: "Jamie",  family: "Lee",      type: "Adult", plusOne: false },
    { partyId: "P002", given: "Morgan", family: "Lee",      type: "Adult", plusOne: false },
    { partyId: "P002", given: "Riley",  family: "Lee",      type: "Child", plusOne: false },
    { partyId: "P003", given: "Sofia",  family: "Rossi",    type: "Adult", plusOne: true  },
    { partyId: "P003", given: "Marco",  family: "Rossi",    type: "Adult", plusOne: true  },
    { partyId: "P004", given: "Haruto", family: "Sato",     type: "Adult", plusOne: false },
    { partyId: "P005", given: "Emma",   family: "Schmidt, Smith", type: "Adult", plusOne: true }
  ];
  var DEMO_RESPONDED = {}; // which parties submitted during this demo session

  function norm(s) {
    return String(s || "")
      .replace(/[\u00A0\u2000-\u200B\u3000]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  // Ignores the spacing and punctuation guests type inconsistently, so
  // "de Koonig" / "deKoonig" and "Mary Jane" / "Mary-Jane" all match.
  function nameKey(s) { return norm(s).replace(/[\s'\u2019\u02BC.\-]/g, ""); }

  // A name cell may list several options separated by commas
  // (e.g. "Robert, Bob, Bobby"): match any option, display the first.
  function nameOptions(cell) {
    return String(cell || "").split(",").map(nameKey).filter(Boolean);
  }
  function primaryName(cell) {
    return (String(cell || "").split(",")[0] || "").trim();
  }

  function demoVerify(given, family) {
    var hit = DEMO_GUESTS.find(function (g) {
      return nameOptions(g.given).indexOf(nameKey(given)) !== -1 &&
             nameOptions(g.family).indexOf(nameKey(family)) !== -1;
    });
    if (!hit) return { ok: false, error: "not_found" };
    var members = DEMO_GUESTS.filter(function (g) { return g.partyId === hit.partyId; });
    return {
      ok: true,
      partyId: hit.partyId,
      matched: { given: primaryName(hit.given), family: primaryName(hit.family) },
      members: members.map(function (g) {
        return { given: primaryName(g.given), family: primaryName(g.family), type: g.type, fromSheet: true };
      }),
      plusOneAllowed: members.some(function (g) { return g.plusOne; }),
      hasResponded: !!DEMO_RESPONDED[hit.partyId]
    };
  }

  // ---- Public methods ---------------------------------------
  // verify(given, family) -> Promise<result>
  function verify(given, family) {
    if (DEMO) {
      return new Promise(function (res) {
        setTimeout(function () { res(demoVerify(given, family)); }, 700);
      });
    }
    var url = API_URL + "?action=verify" +
      "&given=" + encodeURIComponent(given) +
      "&family="  + encodeURIComponent(family);
    return fetch(url).then(function (r) { return r.json(); });
  }

  // submit(payload) -> Promise<{ok:true}>
  // payload: { partyId, comments, guests: [...] }
  function submit(payload) {
    if (DEMO) {
      return new Promise(function (res) {
        setTimeout(function () {
          DEMO_RESPONDED[payload.partyId] = true;
          console.log("[DEMO] RSVP submitted:", payload);
          res({ ok: true });
        }, 900);
      });
    }
    // text/plain avoids a CORS preflight, which Apps Script doesn't handle
    return fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "submit", data: payload })
    }).then(function (r) { return r.json(); });
  }

  // ---- Session helpers (who is logged in) --------------------
  function saveSession(party) { sessionStorage.setItem("wedding_party", JSON.stringify(party)); }
  function getSession() {
    try { return JSON.parse(sessionStorage.getItem("wedding_party")); }
    catch (e) { return null; }
  }
  function clearSession() { sessionStorage.removeItem("wedding_party"); }

  // ---- Saved answers (this device only) ----------------------
  // The backend never sends a party's previous answers back, so RSVP
  // prefill comes from here — signing in elsewhere reveals nothing.
  var ANSWERS_KEY = "wedding_answers:";
  var ANSWERS_TTL = 400 * 864e5;

  function saveAnswers(partyId, answers) {
    try {
      localStorage.setItem(ANSWERS_KEY + partyId,
        JSON.stringify({ savedAt: Date.now(), answers: answers }));
    } catch (e) {}   // private browsing / quota: prefill is a nicety, never fatal
  }
  function getAnswers(partyId) {
    try {
      var rec = JSON.parse(localStorage.getItem(ANSWERS_KEY + partyId));
      if (!rec) return null;
      if (Date.now() - rec.savedAt > ANSWERS_TTL) { clearAnswers(partyId); return null; }
      return rec.answers;
    } catch (e) { return null; }
  }
  function clearAnswers(partyId) {
    try { localStorage.removeItem(ANSWERS_KEY + partyId); } catch (e) {}
  }

  return {
    demo: DEMO,
    verify: verify,
    submit: submit,
    saveSession: saveSession,
    getSession: getSession,
    clearSession: clearSession,
    saveAnswers: saveAnswers,
    getAnswers: getAnswers,
    clearAnswers: clearAnswers
  };
})();

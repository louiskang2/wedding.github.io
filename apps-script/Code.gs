/**
 * ============================================================
 * WEDDING RSVP BACKEND — Google Apps Script
 * ============================================================
 * SETUP (full walkthrough in the site README):
 *  1. Create a Google Sheet and import sample-data/Guests.csv
 *     into a tab named exactly "Guests".
 *  2. Extensions → Apps Script → paste this whole file into
 *     Code.gs (replace everything).
 *  3. Deploy → New deployment → type "Web app"
 *       Execute as:            Me
 *       Who has access:        Anyone
 *  4. Copy the Web App URL into apps_script_url in _config.yml.
 *
 * The script creates an "RSVPs" tab automatically on the first
 * submission. Resubmitting replaces a party's previous rows.
 * Every submission is also appended to an "RSVP log" tab, which is
 * never pruned — use it to recover answers a resubmission overwrote.
 * ============================================================
 */

var GUESTS_SHEET = 'Guests';
var GUEST_COLS = 5;   // PartyID | GivenName | FamilyName | Type | PlusOneAllowed
var RSVP_SHEET = 'RSVPs';
var RSVP_LOG_SHEET = 'RSVP log';
var RSVP_HEADERS = [
  'Timestamp', 'PartyID', 'GivenName', 'FamilyName', 'Type', 'IsPlusOne',
  'Email', 'Age', 'Wedding', 'Dietary', 'ShuttleTo', 'ShuttleFrom',
  'HighChair', 'Afterparty', 'SkiTrip', 'Comments'
];

function doGet(e) {
  var action = (e.parameter.action || '').toLowerCase();
  if (action === 'verify') {
    return json_(verifyGuest_(e.parameter.given, e.parameter.family));
  }
  return json_({ ok: false, error: 'unknown_action' });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === 'submit') return json_(saveRsvp_(body.data));
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ------------------------------------------------------------
function verifyGuest_(given, family) {
  given = norm_(given);
  family = norm_(family);
  if (!given || !family) return { ok: false, error: 'missing_name' };

  var rows = guestRows_();
  // Columns: PartyID | GivenName | FamilyName | Type | PlusOneAllowed
  // A GivenName or FamilyName cell may hold several options separated by
  // commas (e.g. "Robert, Bob, Bobby") — a guest matches if their typed
  // name equals ANY given option AND ANY family option. Names with spaces,
  // hyphens or apostrophes ("Mary Jane", "de Koonig", "O'Brien") match
  // regardless of how the guest spaces or punctuates them.
  var givenKey = nameKey_(given);
  var familyKey = nameKey_(family);
  var match = null;
  for (var i = 1; i < rows.length; i++) {
    if (nameOptions_(rows[i][1]).indexOf(givenKey) !== -1 &&
        nameOptions_(rows[i][2]).indexOf(familyKey) !== -1) {
      match = rows[i];
      break;
    }
  }
  if (!match) return { ok: false, error: 'not_found' };

  // A guest row with no PartyID would collect every blank separator row
  // below as a party member, so treat it as a miss and let them contact us.
  var partyId = String(match[0]).trim();
  if (!partyId) return { ok: false, error: 'not_found' };

  var members = [];
  var plusOneAllowed = false;
  for (var j = 1; j < rows.length; j++) {
    if (String(rows[j][0]).trim() === partyId) {
      members.push({
        given: primaryName_(rows[j][1]),   // show the first-listed option
        family: primaryName_(rows[j][2]),
        type: String(rows[j][3] || 'Adult'),
        fromSheet: true
      });
      if (norm_(rows[j][4]) === 'yes') plusOneAllowed = true;
    }
  }

  return {
    ok: true,
    partyId: partyId,
    matched: { given: primaryName_(match[1]), family: primaryName_(match[2]) },
    members: members,
    plusOneAllowed: plusOneAllowed,
    hasResponded: hasResponded_(partyId)
  };
}

// Look for a previous response
function hasResponded_(partyId) {
  return partyIdColumn_(rsvpSheet_()).indexOf(String(partyId).trim()) !== -1;
}

// Replace the party's old rows with the new submission, and append the
// same rows to the log, which keeps every submission ever made.
function saveRsvp_(data) {
  if (!data || !data.partyId || !data.guests || !data.guests.length) {
    return { ok: false, error: 'bad_payload' };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    return { ok: false, error: 'busy' };
  }

  try {
    var sh = rsvpSheet_();

    // delete existing rows for this party (bottom-up so indexes hold)
    var ids = partyIdColumn_(sh);
    var target = String(data.partyId).trim();
    for (var i = ids.length - 1; i >= 0; i--) {
      if (ids[i] === target) sh.deleteRow(i + 2);   // ids[0] is sheet row 2
    }

    // one timestamp for the whole submission, so log rows group by it
    var ts = new Date();
    var out = data.guests.map(function (g) {
      return [
        ts, data.partyId, g.given || '', g.family || '', g.type || 'Adult',
        g.isPlusOne ? 'Yes' : 'No', g.email || '', g.age || '',
        g.wedding || '', g.dietary || '', g.shuttleTo || '', g.shuttleFrom || '',
        g.highChair || '', g.afterparty || '', g.skiTrip || '', data.comments || ''
      ];
    });

    appendRows_(sh, out);
    appendRows_(rsvpLogSheet_(), out);
    SpreadsheetApp.flush();   // commit before another execution can read the sheet
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function appendRows_(sh, rows) {
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// ------------------------------------------------------------
function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet tab: "' + name + '"');
  return sh;
}

// Only columns A–E, so anything further right is free for your own notes.
function guestRows_() {
  var sh = sheet_(GUESTS_SHEET);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  return sh.getRange(1, 1, lastRow, GUEST_COLS).getValues();
}

// Column B of an RSVP tab — every data row's PartyID, sheet order, header skipped.
function partyIdColumn_(sh) {
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  return sh.getRange(2, 2, lastRow - 1, 1).getValues().map(function (r) {
    return String(r[0]).trim();
  });
}

function rsvpSheet_() { return rsvpTab_(RSVP_SHEET); }
function rsvpLogSheet_() { return rsvpTab_(RSVP_LOG_SHEET); }

function rsvpTab_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(RSVP_HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function norm_(s) {
  return String(s == null ? '' : s)
    .replace(/[\u00A0\u2000-\u200B\u3000]/g, ' ')   // non-breaking and exotic spaces
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Matching key: drops the spaces, hyphens, apostrophes and periods that
// guests type inconsistently, so "de Koonig", "De  Koonig" and "deKoonig"
// — or "Mary Jane" and "Mary-Jane" — all resolve to the same value.
function nameKey_(s) {
  return norm_(s).replace(/[\s'\u2019\u02BC.\-]/g, '');
}

// A name cell may list several options separated by commas
// (e.g. "Robert, Bob, Bobby"). Return them as matching keys.
function nameOptions_(cell) {
  return String(cell == null ? '' : cell).split(',')
    .map(function (s) { return nameKey_(s); })
    .filter(function (s) { return s.length; });
}

// The first option in a name cell — used as the display name.
function primaryName_(cell) {
  var parts = String(cell == null ? '' : cell).split(',');
  return (parts[0] || '').trim();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

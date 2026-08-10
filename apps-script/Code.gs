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
 * ============================================================
 */

var GUESTS_SHEET = 'Guests';
var RSVP_SHEET = 'RSVPs';
var RSVP_HEADERS = [
  'Timestamp', 'PartyID', 'FirstName', 'LastName', 'Type', 'IsPlusOne',
  'Email', 'Age', 'Wedding', 'Dietary', 'ShuttleTo', 'ShuttleFrom',
  'Afterparty', 'SkiTrip', 'Comments'
];

function doGet(e) {
  var action = (e.parameter.action || '').toLowerCase();
  if (action === 'verify') {
    return json_(verifyGuest_(e.parameter.first, e.parameter.last));
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
function verifyGuest_(first, last) {
  first = norm_(first);
  last = norm_(last);
  if (!first || !last) return { ok: false, error: 'missing_name' };

  var rows = sheet_(GUESTS_SHEET).getDataRange().getValues();
  // Columns: PartyID | FirstName | LastName | Type | PlusOneAllowed
  // A FirstName or LastName cell may hold several options separated by
  // commas (e.g. "Robert, Bob, Bobby") — a guest matches if their typed
  // name equals ANY first option AND ANY last option.
  var match = null;
  for (var i = 1; i < rows.length; i++) {
    if (nameOptions_(rows[i][1]).indexOf(first) !== -1 &&
        nameOptions_(rows[i][2]).indexOf(last) !== -1) {
      match = rows[i];
      break;
    }
  }
  if (!match) return { ok: false, error: 'not_found' };

  var partyId = String(match[0]);
  var members = [];
  var plusOneAllowed = false;
  for (var j = 1; j < rows.length; j++) {
    if (String(rows[j][0]) === partyId) {
      members.push({
        first: primaryName_(rows[j][1]),   // show the first-listed option
        last: primaryName_(rows[j][2]),
        type: String(rows[j][3] || 'Adult'),
        fromSheet: true
      });
      if (norm_(rows[j][4]) === 'yes') plusOneAllowed = true;
    }
  }

  return {
    ok: true,
    partyId: partyId,
    matched: { first: primaryName_(match[1]), last: primaryName_(match[2]) },
    members: members,
    plusOneAllowed: plusOneAllowed,
    previous: previousRsvp_(partyId)
  };
}

// Latest saved answers for a party (or null)
function previousRsvp_(partyId) {
  var sh = rsvpSheet_();
  var rows = sh.getDataRange().getValues();
  var guests = [];
  var comments = '';
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(partyId)) {
      guests.push({
        first: String(rows[i][2]), last: String(rows[i][3]),
        type: String(rows[i][4]), isPlusOne: norm_(rows[i][5]) === 'yes',
        email: String(rows[i][6]), age: String(rows[i][7]),
        wedding: String(rows[i][8]), dietary: String(rows[i][9]),
        shuttleTo: String(rows[i][10]), shuttleFrom: String(rows[i][11]),
        afterparty: String(rows[i][12]), skiTrip: String(rows[i][13])
      });
      comments = String(rows[i][14] || comments);
    }
  }
  return guests.length ? { comments: comments, guests: guests } : null;
}

// Replace the party's old rows with the new submission
function saveRsvp_(data) {
  if (!data || !data.partyId || !data.guests || !data.guests.length) {
    return { ok: false, error: 'bad_payload' };
  }
  var sh = rsvpSheet_();

  // delete existing rows for this party (bottom-up so indexes hold)
  var rows = sh.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][1]) === String(data.partyId)) sh.deleteRow(i + 1);
  }

  var ts = new Date();
  data.guests.forEach(function (g) {
    sh.appendRow([
      ts, data.partyId, g.first || '', g.last || '', g.type || 'Adult',
      g.isPlusOne ? 'Yes' : 'No', g.email || '', g.age || '',
      g.wedding || '', g.dietary || '', g.shuttleTo || '', g.shuttleFrom || '',
      g.afterparty || '', g.skiTrip || '', data.comments || ''
    ]);
  });
  return { ok: true };
}

// ------------------------------------------------------------
function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet tab: "' + name + '"');
  return sh;
}

function rsvpSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(RSVP_SHEET);
  if (!sh) {
    sh = ss.insertSheet(RSVP_SHEET);
    sh.appendRow(RSVP_HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function norm_(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

// A name cell may list several options separated by commas
// (e.g. "Robert, Bob, Bobby"). Return them normalized for matching.
function nameOptions_(cell) {
  return String(cell == null ? '' : cell).split(',')
    .map(function (s) { return norm_(s); })
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

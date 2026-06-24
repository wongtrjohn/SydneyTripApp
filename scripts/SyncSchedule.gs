/**
 * Sydney Trip — Sheet1 ➜ Schedule sync
 * --------------------------------------------------------------------------
 * Reads the free-form planning tab (Sheet1) and rebuilds the flat "Schedule"
 * tab that the app reads — one row per day. Run it from the
 *   "Trip Tools ▸ Sync to Schedule"
 * menu that appears after you open the sheet (refresh the page once after
 * pasting this script).
 *
 * Install: Extensions ▸ Apps Script ▸ paste this in ▸ Save ▸ reload the sheet.
 */

var TARGET_SHEET_NAME = "Schedule";   // tab the app reads (gid 105940139)
var SOURCE_SHEET_NAME = "";            // free-form planning tab; "" = first non-target tab
var TRIP_YEAR = 2026;

var MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Trip Tools")
    .addItem("Sync to Schedule", "syncToSchedule")
    .addToUi();
}

function syncToSchedule() {
  var ss = SpreadsheetApp.getActive();
  var target = ss.getSheetByName(TARGET_SHEET_NAME);
  if (!target) { SpreadsheetApp.getUi().alert('No tab named "' + TARGET_SHEET_NAME + '".'); return; }

  var source = SOURCE_SHEET_NAME ? ss.getSheetByName(SOURCE_SHEET_NAME) : null;
  if (!source) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getName() !== TARGET_SHEET_NAME) { source = sheets[i]; break; }
    }
  }
  if (!source) { SpreadsheetApp.getUi().alert("Couldn't find a source tab to read from."); return; }

  var values = source.getDataRange().getDisplayValues();

  // Locate the header block (the row that has both DATE and ACTIVITY).
  var headerRow = -1;
  for (var r = 0; r < values.length; r++) {
    var up = values[r].map(function (c) { return String(c).toUpperCase(); });
    var hasDate = up.some(function (c) { return c.indexOf("DATE") >= 0; });
    var hasAct = up.some(function (c) { return c.indexOf("ACTIVITY") >= 0; });
    if (hasDate && hasAct) { headerRow = r; break; }
  }
  if (headerRow < 0) { SpreadsheetApp.getUi().alert('Could not find a "DATE … ACTIVITY" header row in the source tab.'); return; }

  // Column map — combine this header row with the one below (TIME/PLACE/REF live there).
  var below = values[headerRow + 1] || [];
  var head = values[headerRow].map(function (c, i) {
    return (String(c) + " " + String(below[i] || "")).toUpperCase();
  });
  var find = function (kws) {
    for (var i = 0; i < head.length; i++) {
      for (var k = 0; k < kws.length; k++) { if (head[i].indexOf(kws[k]) >= 0) return i; }
    }
    return -1;
  };
  // NOTE: cLoc is a *dedicated* clean-address column (only matched by
  // LOCATION/ADDRESS). The free-form MEETING/PLACE column (cPlace) is treated as
  // notes and goes into Details — it's too unreliable to guess a single Location
  // (and a wrong Location pin is worse than none).
  var cDate = find(["DATE"]), cDay = find(["DAY"]), cAct = find(["ACTIVITY"]),
      cTime = find(["TIME"]), cLoc = find(["LOCATION", "ADDRESS"]),
      cPlace = find(["PLACE", "MEETING"]), cBook = find(["BOOK", "REF"]),
      cProv = find(["PROVIDER", "OPERATOR", "TOUR", "AGENT", "COMPANY"]);

  // Walk the rows, grouping each day-block.
  var days = [], cur = null;
  for (var rr = headerRow + 1; rr < values.length; rr++) {
    var row = values[rr];
    var rawDate = cDate >= 0 ? String(row[cDate]).trim() : "";
    if (isDate_(rawDate)) {
      cur = { date: rawDate, day: cDay >= 0 ? String(row[cDay]).trim() : "",
              acts: [], times: [], locs: [], places: [], books: [], provs: [] };
      days.push(cur);
    }
    if (!cur) continue; // skip anything before the first dated row (incl. the TIME/PLACE sub-header)
    pushIf_(cur.acts,   cAct,   row);
    pushIf_(cur.times,  cTime,  row);
    pushIf_(cur.locs,   cLoc,   row);
    pushIf_(cur.places, cPlace, row);
    pushIf_(cur.books,  cBook,  row);
    pushIf_(cur.provs,  cProv,  row);
  }

  // Build the flat rows.
  var out = [["Date", "Day", "Start", "End", "Activity", "Location", "Map Link", "Details", "Booking Reference", "Tour Provider"]];
  var COLS = 10;
  days.forEach(function (d) {
    var start = "";
    for (var t = 0; t < d.times.length; t++) { if (d.times[t]) { start = normTime_(d.times[t]); break; } }
    out.push([
      isoDate_(d.date),
      titleCase_(d.day),
      start,
      "",
      d.acts.map(titleCase_).join(" · "),
      d.locs.length ? titleCase_(d.locs.join(", ")) : "",   // Location — clean address column only (else blank)
      "",
      d.places.map(titleCase_).join("; "),                  // Details — the whole meeting-place column
      d.books.join(", "),                                   // Booking Reference — its own column
      d.provs.map(titleCase_).join(", "),                   // Tour Provider — its own column
    ]);
  });

  // Write — clear old content, force plain-text format so dates/times aren't re-coerced.
  target.getRange(1, 1, Math.max(target.getMaxRows(), out.length), COLS).clearContent();
  var range = target.getRange(1, 1, out.length, COLS);
  range.setNumberFormat("@");
  range.setValues(out);

  SpreadsheetApp.getActive().toast(days.length + " days synced to " + TARGET_SHEET_NAME + ".", "Done", 4);
}

// ── helpers ──────────────────────────────────────────────────────────────
function pushIf_(arr, col, row) {
  if (col < 0) return;
  var v = String(row[col]).trim();
  if (v) arr.push(v);
}

function isDate_(s) {
  if (!s) return false;
  return /^\d{1,2}\s*[-\/ ]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s) ||
         /^\d{4}-\d{1,2}-\d{1,2}/.test(s) ||
         /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s);
}

function isoDate_(s) {
  s = String(s).trim();
  var m = s.match(/^(\d{1,2})\s*[-\/ ]\s*([A-Za-z]{3,})/);
  if (m) {
    var mon = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mon >= 0) return TRIP_YEAR + "-" + pad_(mon + 1) + "-" + pad_(+m[1]);
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + pad_(+m[2]) + "-" + pad_(+m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); // d/m/y
  if (m) { var y = +m[3]; if (y < 100) y += 2000; return y + "-" + pad_(+m[2]) + "-" + pad_(+m[1]); }
  return s;
}
function pad_(n) { return (n < 10 ? "0" : "") + n; }

function normTime_(raw) {
  var s = String(raw).trim().toUpperCase();
  var ap = "";
  var m = s.match(/(AM|PM)/);
  if (m) ap = m[1];
  s = s.replace(/[AP]M/g, "").replace(/[.\s]/g, "");
  var h, mn;
  if (s.indexOf(":") >= 0) { var p = s.split(":"); h = p[0]; mn = p[1] || "00"; }
  else if (/^\d{3,4}$/.test(s)) { mn = s.slice(-2); h = s.slice(0, -2); }
  else if (/^\d{1,2}$/.test(s)) { h = s; mn = "00"; }
  else return String(raw).trim();
  h = parseInt(h, 10); mn = parseInt(mn, 10);
  if (isNaN(h) || isNaN(mn)) return String(raw).trim();
  if (!ap) { if (h > 12) { ap = "PM"; h -= 12; } else if (h === 12) { ap = "PM"; } else if (h === 0) { h = 12; ap = "AM"; } }
  return h + ":" + pad_(mn) + (ap ? " " + ap : "");
}

function titleCase_(s) {
  s = String(s).toLowerCase().replace(/([a-z])([a-z]*)/g, function (m, a, b) { return a.toUpperCase() + b; });
  return s.replace(/\b(Nsw|Bw|Tr|Id|Usa|Uk)\b/g, function (x) { return x.toUpperCase(); });
}

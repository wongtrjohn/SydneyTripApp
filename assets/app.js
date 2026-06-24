/* eslint-disable */
const { useState, useEffect, useMemo, useRef } = React;
const CFG = window.TRIP_CONFIG;
const CACHE_KEY = "SYDNEY_TRIP_CACHE_v1";

// ── Data source ──────────────────────────────────────────────────────────────
// "export" CSV endpoint: returns the tab's DISPLAYED values as plain text (no
// type-guessing, no header merging) and sends CORS headers, so we can fetch it
// straight from the browser and parse dates/times ourselves.
function sheetUrl() {
  const base = `https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}/export`;
  const q = new URLSearchParams({ format: "csv", gid: CFG.SHEET_GID });
  // cache-buster so "Refresh" always pulls the latest, never a stale CDN copy
  return `${base}?${q.toString()}&_=${Date.now()}`;
}

// Repair common "mojibake" — UTF-8 text that was pasted through a CP1252 path,
// so e.g. "·" arrives as "Â·" and "—" as "â€". Safety net for copy-paste.
const MOJIBAKE = [
  ["â€”", "—"], // —
  ["â€“", "–"], // –
  ["â€™", "’"], // ’
  ["â€˜", "‘"], // ‘
  ["â€œ", "“"], // “
  ["â€", "”"], // ”
  ["â€¦", "…"], // …
  ["Â·", "·"],       // ·
  ["Â ", " "],            // nbsp
];
function clean(s) {
  if (!s) return s;
  for (const [bad, good] of MOJIBAKE) s = s.split(bad).join(good);
  return s.replace(/Â(?=[ -¿])/g, "");
}

// ── CSV parsing (handles quoted fields, commas, and "" escapes) ──────────────
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* ignore */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Turn the header row + data rows into objects keyed by normalised header name.
function rowsToObjects(rows) {
  if (!rows.length) return [];
  const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  const headers = rows[0].map(norm);
  return rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = (r[i] || "").trim(); });
    return o;
  });
}

// ── Date parsing — accepts "2026-06-29", "29-Jun", "29 Jun 2026", "29/6/2026" ─
const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
function parseDate(raw) {
  if (!raw) return null;
  const s = raw.trim();
  let m;
  // ISO yyyy-mm-dd
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  // d-Mon[-yyyy] or "d Mon yyyy"
  if ((m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,})\.?(?:[\s-]+(\d{2,4}))?/))) {
    const mon = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mon >= 0) {
      let yr = m[3] ? +m[3] : CFG.TRIP_YEAR;
      if (yr < 100) yr += 2000;
      return new Date(yr, mon, +m[1]);
    }
  }
  // d/m[/yyyy]  (day-first, AU style)
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/))) {
    let yr = m[3] ? +m[3] : CFG.TRIP_YEAR;
    if (yr < 100) yr += 2000;
    return new Date(yr, +m[2] - 1, +m[1]);
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

const isoKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Parse a time-of-day to minutes-since-midnight. Accepts "9:30 AM", "930AM",
// "4:00 PM", "16:00". Returns null if unparseable.
function parseMin(raw) {
  if (!raw) return null;
  const s = raw.trim().toUpperCase().replace(/\./g, "");
  let m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/) || s.match(/^(\d{1,2})(\d{2})\s*(AM|PM)$/) ||
          s.match(/^(\d{1,2})\s*(AM|PM)$/);
  if (!m) return null;
  let h, min, ap;
  if (m.length === 4 && m[2] && m[2].length <= 2 && /:/.test(s)) { h = +m[1]; min = +m[2]; ap = m[3]; }
  else if (m.length === 4) { h = +m[1]; min = +m[2]; ap = m[3]; }
  else { h = +m[1]; min = 0; ap = m[2]; }
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Google Maps link: explicit map link wins, else search by location text.
function mapLink(item) {
  if (item.maplink) return item.maplink;
  if (item.location) {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(item.location);
  }
  return null;
}

// ── "Now" in the trip's timezone ─────────────────────────────────────────────
function nowInTZ() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CFG.TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date()).reduce((a, p) => (a[p.type] = p.value, a), {});
  return {
    key: `${parts.year}-${parts.month}-${parts.day}`,
    min: (+parts.hour % 24) * 60 + (+parts.minute),
  };
}

// ── Build day groups from sheet objects ──────────────────────────────────────
function buildDays(objs) {
  const map = new Map();
  for (const o of objs) {
    const d = parseDate(o.date);
    if (!d) continue;
    const activity = clean(o.activity || o.event || o.title || "");
    if (!activity && !o.location && !o.start && !o.details) continue; // skip blanks
    const key = isoKey(d);
    if (!map.has(key)) {
      map.set(key, {
        key, date: d,
        label: clean(o.day) || d.toLocaleDateString("en-AU", { weekday: "long" }),
        dateLabel: d.toLocaleDateString("en-AU", { day: "numeric", month: "long" }),
        items: [],
      });
    }
    map.get(key).items.push({
      start: o.start || o.time || "",
      end: o.end || "",
      activity, location: clean(o.location || ""), maplink: o.maplink || o.link || "",
      details: clean(o.details || o.detail || o.notes || ""),
      _min: parseMin(o.start || o.time || ""),
    });
  }
  const days = [...map.values()].sort((a, b) => a.date - b.date);
  // within a day, sort timed items by time, keep untimed in original order at top
  days.forEach((day) => {
    day.items.sort((a, b) => {
      if (a._min == null && b._min == null) return 0;
      if (a._min == null) return -1;
      if (b._min == null) return 1;
      return a._min - b._min;
    });
  });
  return days;
}

// ── Components ────────────────────────────────────────────────────────────────
function DayPicker({ days, selected, onChange, todayKey }) {
  return (
    <div className="daypicker">
      {days.map((d, i) => (
        <button
          key={d.key}
          className={"day-chip" + (i === selected ? " active" : "") + (d.key === todayKey ? " is-today" : "")}
          onClick={() => onChange(i)}
        >
          <span className="day-chip-dow">{d.label.slice(0, 3)}</span>
          <span className="day-chip-date">{d.date.getDate()}</span>
        </button>
      ))}
    </div>
  );
}

function ScheduleItem({ item, state }) {
  const link = mapLink(item);
  return (
    <div className={"sched-item" + (state ? " is-" + state : "")}>
      <div className="sched-time">
        {item.start ? <span>{item.start}</span> : <span className="sched-time-tbd">—</span>}
        {item.end && <span className="sched-end">{item.end}</span>}
      </div>
      <div className="sched-body">
        <div className="sched-name">
          {item.activity || "(to be confirmed)"}
          {state === "now" && <span className="pill pill-now">Now</span>}
          {state === "next" && <span className="pill pill-next">Next</span>}
        </div>
        {item.details && <div className="sched-detail">{item.details}</div>}
        {item.location && (
          link
            ? <a className="sched-loc" href={link} target="_blank" rel="noopener noreferrer">📍 {item.location}</a>
            : <span className="sched-loc plain">📍 {item.location}</span>
        )}
      </div>
    </div>
  );
}

function App() {
  const [days, setDays] = useState(() => {
    try { return buildDays(JSON.parse(localStorage.getItem(CACHE_KEY) || "{}").objs || []); }
    catch { return []; }
  });
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState(days.length ? "ready" : "loading");
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}").at || null; } catch { return null; }
  });
  const [now, setNow] = useState(nowInTZ);
  const didInitSelect = useRef(false);

  // tick "now" every 30s so Now/Next stay current
  useEffect(() => {
    const id = setInterval(() => setNow(nowInTZ()), 30000);
    return () => clearInterval(id);
  }, []);

  const todayKey = now.key;
  const todayIdx = useMemo(() => days.findIndex((d) => d.key === todayKey), [days, todayKey]);

  async function refresh() {
    setStatus((s) => (days.length ? "refreshing" : "loading"));
    setError("");
    try {
      const res = await fetch(sheetUrl(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      const objs = rowsToObjects(parseCSV(text));
      const built = buildDays(objs);
      if (!built.length) throw new Error("No dated rows found — check the tab (gid " + CFG.SHEET_GID + ") has a header row with a \"Date\" column, and the sheet is shared as \"Anyone with the link\".");
      setDays(built);
      const at = new Date().toISOString();
      setUpdated(at);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ objs, at }));
      setStatus("ready");
    } catch (e) {
      setError(e.message || String(e));
      setStatus(days.length ? "ready" : "error");
    }
  }

  useEffect(() => { refresh(); /* on mount */ }, []);

  // once data is in, jump to today (or first day) — only the first time
  useEffect(() => {
    if (!days.length || didInitSelect.current) return;
    didInitSelect.current = true;
    setSelected(todayIdx >= 0 ? todayIdx : 0);
  }, [days, todayIdx]);

  const day = days[selected];

  // compute Now / Next within the selected day, only if it is actually today
  let nowIdx = -1, nextIdx = -1;
  if (day && day.key === todayKey) {
    day.items.forEach((it, i) => {
      const start = it._min;
      const end = parseMin(it.end) ?? (start != null ? start + 60 : null);
      if (start != null && now.min >= start && end != null && now.min < end) nowIdx = i;
      if (nextIdx === -1 && start != null && start > now.min) nextIdx = i;
    });
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-top">
          <h1>{CFG.TITLE}</h1>
          <button className="refresh-btn" onClick={refresh} disabled={status === "refreshing" || status === "loading"}>
            <span className={"refresh-icon" + (status === "refreshing" || status === "loading" ? " spin" : "")}>↻</span>
            {status === "refreshing" || status === "loading" ? "Refreshing…" : "Refresh schedule"}
          </button>
        </div>
        {CFG.SUBTITLE && <p className="hero-sub">{CFG.SUBTITLE}</p>}
        {!!(CFG.INFO_CARDS || []).length && (
          <div className="info-cards">
            {CFG.INFO_CARDS.map((c, i) => (
              <div className="info-card" key={i}>
                <span className="info-icon">{c.icon}</span>
                <div className="info-text">
                  <span className="info-label">{c.label}</span>
                  {c.link
                    ? <a href={c.link} target="_blank" rel="noopener noreferrer">{c.text}</a>
                    : <span>{c.text}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </header>

      {error && (
        <div className="banner banner-error">
          ⚠️ Couldn’t refresh from the sheet: {error}
          {days.length ? " Showing the last saved copy." : ""}
        </div>
      )}

      {status === "loading" && !days.length && <div className="state">Loading schedule…</div>}
      {status === "error" && !days.length && (
        <div className="state">Couldn’t load the schedule. Tap “Refresh schedule” to try again.</div>
      )}

      {!!days.length && (
        <main className="main">
          <DayPicker days={days} selected={selected} onChange={setSelected} todayKey={todayKey} />
          {todayIdx >= 0 && selected !== todayIdx && (
            <button className="jump-today" onClick={() => setSelected(todayIdx)}>Jump to today →</button>
          )}
          {day && (
            <section className="day">
              <div className="day-head">
                <h2>{day.label}</h2>
                <span className="day-date">{day.dateLabel}</span>
                {day.key === todayKey && <span className="today-badge">Today</span>}
              </div>
              <div className="sched-list">
                {day.items.length
                  ? day.items.map((it, i) => (
                      <ScheduleItem key={i} item={it} state={i === nowIdx ? "now" : i === nextIdx ? "next" : ""} />
                    ))
                  : <div className="state">Nothing scheduled yet for this day.</div>}
              </div>
            </section>
          )}
        </main>
      )}

      <footer className="foot">
        {updated && <span>Updated {new Date(updated).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}</span>}
        <span className="foot-dot">·</span>
        <a href={`https://docs.google.com/spreadsheets/d/${CFG.SHEET_ID}/edit`} target="_blank" rel="noopener noreferrer">Open sheet</a>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

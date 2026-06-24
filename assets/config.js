// ─────────────────────────────────────────────────────────────────────────────
// Sydney Trip App — configuration
// Edit this file to point at a different Google Sheet / tab, or to change the
// header information shown at the top of the app. No build step needed.
// ─────────────────────────────────────────────────────────────────────────────
window.TRIP_CONFIG = {
  // The Google Sheet that holds the schedule.
  // 1) The sheet must be shared as "Anyone with the link can view".
  // 2) SHEET_GID identifies the schedule tab. To find it: open the sheet, click
  //    the schedule tab, and read the number after "gid=" in the browser URL.
  //    (The "Schedule" tab in this sheet is gid 105940139.)
  // We read the tab's *displayed* CSV (export endpoint) rather than the gviz
  // "typed" endpoint, so Google's locale date-guessing can't mangle the dates.
  SHEET_ID: "18bCsd6E7QjML369KbAXV1BbxzqrQ_6qNyUSlA58EPzY",
  SHEET_GID: "105940139",

  // Year used when a Date cell omits the year (e.g. "29-Jun").
  TRIP_YEAR: 2026,

  // Sydney is the trip's timezone — "Now / Next" highlighting uses this so it is
  // correct even when your phone is still on Singapore time.
  TIME_ZONE: "Australia/Sydney",

  // Header shown at the top of the app. Pure text — edit freely.
  TITLE: "Sydney Trip App",
  SUBTITLE: "Family Trip · 27 June – 5 July 2026",

  // Quick-reference cards under the header. Each: { icon, label, text, link? }
  INFO_CARDS: [
    {
      icon: "🏨",
      label: "Hotel",
      text: "Sydney Harbour Marriott, Circular Quay · 30 Pitt St, Sydney NSW 2000 · +61 2 9259 7000",
      link: "https://www.google.com/maps/search/?api=1&query=" +
            encodeURIComponent("Sydney Harbour Marriott Hotel, 30 Pitt St, Sydney NSW 2000"),
    },
    {
      icon: "✈️",
      label: "Flight home",
      text: "TR11 · departs 1:00 PM · Sun 5 Jul · Sydney → Singapore",
    },
  ],
};

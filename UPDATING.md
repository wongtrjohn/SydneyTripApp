# Updating the Sydney Trip App schedule

The app reads its schedule **live** from one Google Sheet tab. Edit the sheet,
then tap **Refresh schedule** in the app — no code changes, no redeploy.

## One-time setup of the sheet

1. Open the sheet:
   https://docs.google.com/spreadsheets/d/18bCsd6E7QjML369KbAXV1BbxzqrQ_6qNyUSlA58EPzY/edit
2. Make sure it is shared so the app can read it:
   **Share → General access → "Anyone with the link" → Viewer.**
3. Add a new tab for the schedule (bottom-left ➕). The app finds it by its
   **gid** (the number after `gid=` in the URL when that tab is open) — set as
   `SHEET_GID` in `assets/config.js`. The current tab is gid `105940139`.
4. In the **first row**, put these column headers (order doesn't matter, spelling does):

   | Date | Day | Start | End | Activity | Location | Map Link | Details |

5. Fill one row per activity. The repo includes **`schedule-template.csv`**
   pre-filled from your current sheet — open it, copy everything, and paste into
   cell **A1** of the `Schedule` tab to get started.

## What each column does

- **Date** — `2026-06-29`, `29 Jun`, or `29/6/2026` all work (day-first). Rows
  with the same date are grouped into one day. The app reads the *displayed*
  text, so Google's date auto-formatting won't break it.
- **Day** — optional label (`Mon`). If blank, the app works it out from the date.
- **Start / End** — `9:30 AM`, `4:00 PM`, `16:00`. Used for ordering and for the
  live **Now / Next** highlight (in Sydney time).
- **Activity** — the title shown in bold.
- **Location** — shown with a 📍. Automatically becomes a tappable Google Maps
  link unless you fill **Map Link**.
- **Map Link** — optional. Paste a specific URL (Google Maps, a venue page, a
  booking link) to override the automatic maps search.
- **Details** — small print under the activity (notes, group, what to bring).

Leave a cell blank if it doesn't apply. Empty rows are ignored.

## Daily use

- Edit cells in the `Schedule` tab → tap **Refresh schedule** in the app.
- The app keeps a copy in your browser, so it still opens (showing the last
  version) even with no signal.

## Changing the header / hotel / flight info

Those live in `assets/config.js` (`TITLE`, `SUBTITLE`, `INFO_CARDS`). Edit, then
commit & push — Vercel redeploys automatically.

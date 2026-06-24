# Sydney Trip App

A simple, mobile-friendly travel itinerary for a family trip to Sydney
(27 Jun – 5 Jul 2026). It shows each day's schedule with times, activities,
tappable map links, and live **Now / Next** highlighting — all driven by a
Google Sheet you can edit on the go.

- **Live schedule from Google Sheets** — edit the sheet, tap *Refresh schedule*.
- **No build step** — plain static site (React + Babel via CDN). Open
  `index.html` or deploy the folder as-is.
- **Works offline-ish** — caches the last schedule in the browser.

## How it works

```
index.html         → loads React + the app
assets/config.js   → sheet ID, tab name, header/hotel/flight info  (edit this)
assets/app.js      → app logic (fetch CSV → group by day → render)
assets/styles.css  → styling
schedule-template.csv → pre-filled starter data to paste into the sheet
UPDATING.md        → how to edit the schedule (non-technical)
```

The schedule is fetched from the Google Sheet's `gviz` CSV endpoint
(`…/gviz/tq?tqx=out:csv&sheet=Schedule`), which reads the tab by **name** and
returns CORS headers so the browser can fetch it directly.

## Editing the schedule

See **[UPDATING.md](UPDATING.md)**. Short version: edit the `Schedule` tab in the
linked Google Sheet, then tap **Refresh schedule** in the app.

## Run locally

Any static server works, e.g.:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open the printed URL.

## Deploy

Hosted on Vercel — pushing to `main` auto-deploys. See deploy steps in the
project setup notes.

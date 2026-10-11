# SafeRoute UI rebuild

## What changed
- Full-screen Leaflet map with a floating start/destination search card.
- Google-Maps-style route bottom sheet.
- Horizontal route swipe: the centered card becomes the selected route.
- Vertical handle drag/tap: expands/collapses route details.
- Selected route is blue; other routes remain visible with safety-based colors.
- Expanded details show the real current score breakdown, a generated explanation, nearby Safe Havens, and recent crime context from the existing ArcGIS feed.
- `I Feel Unsafe` mode reveals Fake Call, nearest confirmed-open Safe Haven, and Call 911 actions.
- Safety mode uses `navigator.geolocation.watchPosition()` and only runs the inactivity timer while safety mode is active.
- 20 m movement resets the inactivity timer.
- After 5 minutes without meaningful movement, an alarm + vibration safety check appears with a 30-second countdown. At zero the web app attempts to open `tel:911`.

## Test the inactivity feature quickly
Open `js/map.js` and find:

```js
const UNSAFE_INACTIVITY_TIME =
  5 * 60 * 1000;
```

Temporarily change it to:

```js
const UNSAFE_INACTIVITY_TIME =
  10 * 1000;
```

That makes the safety check appear after 10 seconds instead of 5 minutes.

## Run locally
From the project folder:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` on the computer.

For phone geolocation, use an HTTPS deployment (GitHub Pages, Netlify, Vercel, etc.) or a secure local-development method. Browser geolocation normally requires a secure context; plain `http://<LAN-IP>:8000` may not allow location on a phone.

## Emergency calling limitation
A web page can open `tel:911`, but the browser/phone ultimately controls whether it opens the dialer, requires confirmation, or places the call. The app cannot guarantee a silent emergency call from browser JavaScript.


## Hackathon 10-second demo button

A `Demo 10s` button is now shown above the `I feel unsafe` control. Pressing it enters safety mode and triggers the same safety-check alarm after 10 seconds, independently of GPS movement. The real inactivity threshold remains 5 minutes. Demo mode deliberately does **not** automatically place a 911 call; use `I'm Safe` to stop the alarm.


## Hackathon demo updates

- `Demo 10s` now waits 10 seconds, starts the alarm, and immediately attempts to open `tel:911`; SafeRoute no longer shows its own 30-second safety-check confirmation first.
- The real I Feel Unsafe inactivity timeout remains 5 minutes and uses the same immediate emergency-call attempt.
- A mobile browser/OS can still show a system phone confirmation; JavaScript cannot bypass that system behavior.
- `Safe Place` now uses the latest known position and cached/prefetched Safe Havens first, so it responds much faster. It prioritizes confirmed-open places, then places with unknown hours if no confirmed-open place is available.
- Key safety-mode code in `js/map.js` now contains explanatory comments for easier hackathon editing.


## University connectivity demo tuning

The synthetic connectivity map is intentionally stronger around university areas. In `js/connectivity.js`, search for `UNIVERSITY-FOCUSED DEMO RANGE`. Campus-core cells are forced into a varied **5–9** band using deterministic pseudo-random variation, so nearby blocks can show 5, 6, 7, 8, or 9 instead of all appearing as 10. Campus-edge cells use a softer **3–8** band. This is hackathon demo data, not official network coverage.

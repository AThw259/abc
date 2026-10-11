# SafeRoute hackathon demo quick guide

## 1. 10-second demo timer

Open `js/map.js` and search for `SAFETY MODE SETTINGS`.

```js
const DEMO_ALARM_DELAY = 10 * 1000;
```

Change `10` if you want a different demo delay.

## 2. Real I Feel Unsafe timer

```js
const UNSAFE_INACTIVITY_TIME = 5 * 60 * 1000;
```

This remains 5 minutes. It only runs while I Feel Unsafe mode is active.

## 3. Emergency calling

```js
const EMERGENCY_CALL_URI = "tel:911";
```

The automatic inactivity path does not show a SafeRoute confirmation dialog. It starts the alarm and immediately attempts to open this URI.

Important: the phone operating system/browser may still show its own call confirmation. A website cannot bypass that system behavior.

## 4. Safe Place button

Search `chooseNearestUsableHaven` and the `$("nearest").onclick` handler in `js/map.js`.

The button now:

1. Reuses the latest known location instead of waiting for another GPS reading.
2. Reuses already-loaded Safe Haven data first.
3. Prefetches Safe Havens as soon as I Feel Unsafe mode starts.
4. Prefers confirmed-open places.
5. If none have confirmed hours, falls back to a nearby place that is not known to be closed or restricted.
6. Shows the selected place on the map immediately, then calculates the route.

## 5. Main functions to search for

- `enterUnsafeMode()` — turns safety mode on.
- `exitUnsafeMode()` — turns safety mode off and clears timers.
- `startDemoAlarm()` — starts the 10-second demo.
- `triggerInactivityEmergency()` — alarm + immediate emergency call attempt.
- `attemptEmergencyCall()` — opens `tel:911`.
- `prefetchSafeHavensForSafety()` — loads Safe Havens early.
- `chooseNearestUsableHaven()` — chooses the best nearby place.
- `showSafeHavenImmediately()` — displays it before route calculation finishes.


## Fake Call integration

The **Fake Call** action inside **I Feel Unsafe** now uses the uploaded `fake-call/` module.

Important files:

- `fake-call/fake-call.js` — caller picker, ringtone, full-screen call UI, playback logic
- `fake-call/fake-call.css` — fake-call UI styling
- `fake-call/scripts.json` — caller names and conversation text
- `fake-call/audio/` — pre-generated voice MP3 files
- `js/map.js` — connects SafeRoute's existing **Fake Call** button to `window.FakeCall.open()`

To change the callers or dialogue, edit `fake-call/scripts.json`.
To replace a voice line, replace the matching MP3 under `fake-call/audio/<persona>/`.

The module's own floating button is intentionally disabled in `index.html` with `data-button="false"`; use the SafeRoute button inside I Feel Unsafe mode instead.

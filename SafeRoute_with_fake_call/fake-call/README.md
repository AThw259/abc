# Fake call (drop-in)

A "Fake call" button for the app. Tap it, pick who calls (Mom, Alex, Sam) and when (now / 10 s / 30 s). The phone rings, you accept, and the "other person" talks to you in an ElevenLabs voice so it sounds like someone is waiting for you.

Zero data: no accounts, no storage, no analytics. Nothing is recorded. The browser never talks to ElevenLabs; it only plays mp3 files you generate once.

No framework needed. It works with React, Vite, Next, plain HTML.

## Files

| File | What it is |
| --- | --- |
| `fake-call.js` | The whole feature (button, sheet, call screen, ringtone, voice playback) |
| `fake-call.css` | Its styles (loaded automatically) |
| `scripts.json` | Who calls and what they say. Edit this to change the conversations |
| `generate_clips.py` | Makes the mp3 voice clips with ElevenLabs. You run it once |
| `audio/` | The generated clips go here |
| `demo.html` | A tiny page to try it without the real app |

## 1. Put it in your partner's app

Copy this whole `fake-call` folder into the app's static folder so it is served at `/fake-call/`:

- Vite or Create React App: put it in `public/` (so you get `public/fake-call/fake-call.js`)
- Next.js: also `public/`

Then add one line.

Vite / plain HTML, in `index.html` before `</body>`:

```html
<script src="/fake-call/fake-call.js" defer></script>
```

Next.js, in the root layout:

```jsx
import Script from "next/script";
<Script src="/fake-call/fake-call.js" strategy="afterInteractive" />
```

A purple "Fake call" button now floats at the bottom-right. Options on that script tag:

- `data-position="left"` puts the button bottom-left (use this if it covers the app's own buttons)
- `data-button="false"` hides the floating button so you can use your own
- `data-captions="true"` shows the spoken words on the call screen

## 2. Hook it to the "I Feel Unsafe" sheet

Use your own button and call one of these:

```js
window.FakeCall.open();            // opens the "who is calling" sheet
window.FakeCall.start("mom");      // rings right away as Mom (ids: mom, friend, roommate)
window.FakeCall.start("friend", { delay: 10000 });   // rings in 10 s
window.FakeCall.hangup();          // ends or cancels
```

In React, call it from the click handler, for example `onClick={() => window.FakeCall?.start("mom")}`. It must run inside a tap, because phones only allow sound after a tap.

If the app plays its own soundscape, pause it during the call:

```js
window.addEventListener("fakecall", (e) => {
  // e.detail.phase is "scheduled", "ringing", "active", "ended" or "idle"
});
```

To restyle: `:root { --fc-accent: #0f766e; }` in your own CSS changes the button colour.

## 3. Make the ElevenLabs voices (one time)

Without this step the call still works: each line is read by the phone's built-in voice instead. This step makes it sound real.

1. Get an API key: elevenlabs.io, profile icon, API keys.
2. In PowerShell, from the project folder, set the key for this window only:

   ```powershell
   $env:ELEVENLABS_API_KEY="paste-your-key-here"
   ```

3. See what it will do (free, sends nothing):

   ```powershell
   uv run public/fake-call/generate_clips.py --dry-run
   ```

4. Generate the clips (about 1,500 characters in total, so roughly 1,500 credits):

   ```powershell
   uv run public/fake-call/generate_clips.py
   ```

   It saves `audio/mom/l01.mp3` and so on. If it stops halfway, run it again; finished clips are skipped.

5. Commit the `audio` folder. Never commit the API key.

Choosing voices: each persona in `scripts.json` has a `voiceId`. To see the voices your account can use:

```powershell
uv run public/fake-call/generate_clips.py --list-voices
```

Copy an id into `scripts.json`. If you get a "voice not found" or "paid plan" error, pick a voice whose category is `premade`.

Changing what they say: edit the `text` in `scripts.json`, delete that line's mp3 (or run with `--force`), and generate again.

## Honest limits

- The phone must stay unlocked with the screen on. Browsers pause sound when the screen locks, so a locked phone will not ring. The module asks the browser to keep the screen awake while it is ringing or in a call, and the sheet says this up front.
- Vibration only works on Android Chrome; iPhones ignore it.
- Needs https (or localhost) for the screen-awake feature. It still works without it.
- It is a one-sided conversation: the caller talks, pauses where you would answer, then keeps saying short things like "mm-hm" until you hang up.
- A fake call can help you leave a situation, but it is not an emergency tool. The real app should keep a clear emergency (911) option.

#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""
generate_clips.py - make the voice clips for the fake call with ElevenLabs.

Run it ONCE on your own computer. It reads scripts.json, asks ElevenLabs to
speak every line, and saves the results as audio/<persona>/<line>.mp3 next to
this file. The website then just plays those files, so the browser never talks
to ElevenLabs and your API key never leaves your computer.

No extra packages are needed (standard library only).

Usage (from any folder):
  uv run generate_clips.py --dry-run          show what it would do, costs nothing
  uv run generate_clips.py --list-voices      show voice names + ids on your account
  uv run generate_clips.py                    generate everything that is missing
  uv run generate_clips.py --only mom         just one persona
  uv run generate_clips.py --force            regenerate even if the file exists

The API key is read from the ELEVENLABS_API_KEY environment variable:
  PowerShell:  $env:ELEVENLABS_API_KEY="paste-your-key-here"
  Mac/Linux:   export ELEVENLABS_API_KEY="paste-your-key-here"
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
# ELEVENLABS_API_BASE only exists so the script can be tested against a fake server.
API_BASE = os.environ.get("ELEVENLABS_API_BASE", "https://api.elevenlabs.io").rstrip("/")
DEFAULT_MODEL = "eleven_multilingual_v2"
OUTPUT_FORMAT = "mp3_44100_128"
USER_AGENT = "tether-fakecall/1.0"


class ApiError(Exception):
    def __init__(self, code, detail):
        super().__init__("HTTP %s: %s" % (code, detail))
        self.code = code
        self.detail = detail


def die(message):
    print("\nERROR: " + message, file=sys.stderr)
    sys.exit(1)


def get_key():
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not key:
        die(
            "ELEVENLABS_API_KEY is not set.\n\n"
            '  PowerShell:  $env:ELEVENLABS_API_KEY="paste-your-key-here"\n'
            '  Mac/Linux:   export ELEVENLABS_API_KEY="paste-your-key-here"\n\n'
            "Create a key on elevenlabs.io (profile icon -> API keys).\n"
            "Do not paste it into a file you will commit."
        )
    return key


def describe_error(err):
    """Turn an HTTP error body into one readable line."""
    try:
        raw = err.read().decode("utf-8", "replace")
    except Exception:
        return str(err.reason)
    try:
        body = json.loads(raw)
        detail = body.get("detail", body) if isinstance(body, dict) else body
        if isinstance(detail, dict):
            return str(detail.get("message") or detail.get("status") or detail)
        if isinstance(detail, list) and detail and isinstance(detail[0], dict):
            return "; ".join(str(d.get("msg", d)) for d in detail)
        return str(detail)
    except ValueError:
        return raw.strip()[:200] or str(err.reason)


def call_api(method, path, key, body=None, retries=3):
    url = API_BASE + path
    payload = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"xi-api-key": key, "User-Agent": USER_AGENT, "Accept": "*/*"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=payload, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read()
        except urllib.error.HTTPError as err:
            if err.code in (429, 500, 502, 503, 504) and attempt < retries:
                delay = 2 * (2 ** attempt)
                print("  ElevenLabs answered %s, retrying in %ss ..." % (err.code, delay))
                time.sleep(delay)
                continue
            raise ApiError(err.code, describe_error(err))
        except urllib.error.URLError as err:
            if attempt < retries:
                time.sleep(2)
                continue
            die("Could not reach %s (%s). Check your internet connection." % (API_BASE, err.reason))


def hint_for(code):
    if code == 401:
        return "The key was rejected, or this account is out of credits. Re-copy the whole key and check your usage on elevenlabs.io."
    if code in (402, 403):
        return "Your plan cannot use this voice through the API. Library voices need a paid plan; run --list-voices and pick a voice whose category is 'premade'."
    if code in (404, 422):
        return "ElevenLabs did not recognise the voice id or model. Run --list-voices and put a valid id in scripts.json."
    if code == 429:
        return "Too many requests or no credits left. Wait a minute and run the script again; it skips clips that are already done."
    return ""


def load_scripts():
    path = HERE / "scripts.json"
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        die("Cannot find %s" % path)
    except ValueError as err:
        die("scripts.json is not valid JSON: %s" % err)
    personas = data.get("personas")
    if not isinstance(personas, list) or not personas:
        die("scripts.json has no personas.")
    for p in personas:
        if not p.get("id"):
            die("A persona in scripts.json has no id.")
        seen = set()
        for line in list(p.get("lines", [])) + list(p.get("fillers", [])):
            if not line.get("id") or not line.get("text"):
                die("Persona '%s' has a line without an id or text." % p["id"])
            if line["id"] in seen:
                die("Persona '%s' uses the line id '%s' twice." % (p["id"], line["id"]))
            seen.add(line["id"])
    return data


def all_lines(persona):
    return list(persona.get("lines", [])) + list(persona.get("fillers", []))


def clip_path(persona, line):
    return HERE / "audio" / persona["id"] / (line["id"] + ".mp3")


def list_voices():
    key = get_key()
    try:
        raw = call_api("GET", "/v1/voices", key)
    except ApiError as err:
        die("%s\n%s" % (err, hint_for(err.code)))
    voices = json.loads(raw.decode("utf-8")).get("voices", [])
    if not voices:
        print("No voices returned.")
        return
    print("%-26s %-24s %-10s %s" % ("NAME", "VOICE ID", "CATEGORY", "NOTES"))
    for v in sorted(voices, key=lambda x: (x.get("category") or "", x.get("name") or "")):
        labels = v.get("labels") or {}
        notes = ", ".join(str(labels[k]) for k in ("gender", "age", "accent", "description") if labels.get(k))
        print("%-26s %-24s %-10s %s" % ((v.get("name") or "")[:26], v.get("voice_id", ""), (v.get("category") or "")[:10], notes))
    print("\nCopy a voice id into scripts.json (the 'voiceId' of a persona).")


def main():
    ap = argparse.ArgumentParser(description="Generate ElevenLabs voice clips for the fake call.")
    ap.add_argument("--list-voices", action="store_true", help="print the voices available to your key and exit")
    ap.add_argument("--dry-run", action="store_true", help="show what would be generated, without calling ElevenLabs")
    ap.add_argument("--only", help="comma separated persona ids, e.g. mom,friend")
    ap.add_argument("--force", action="store_true", help="regenerate clips that already exist")
    ap.add_argument("--model", help="ElevenLabs model id (default: modelId from scripts.json)")
    args = ap.parse_args()

    if args.list_voices:
        list_voices()
        return

    data = load_scripts()
    model = args.model or data.get("modelId") or DEFAULT_MODEL
    personas = data["personas"]
    if args.only:
        wanted = set(s.strip() for s in args.only.split(",") if s.strip())
        unknown = wanted - set(p["id"] for p in personas)
        if unknown:
            die("Unknown persona id(s): %s. Available: %s" % (", ".join(sorted(unknown)), ", ".join(p["id"] for p in personas)))
        personas = [p for p in personas if p["id"] in wanted]

    todo = []
    skipped = 0
    for p in personas:
        for line in all_lines(p):
            if clip_path(p, line).exists() and not args.force:
                skipped += 1
            else:
                todo.append((p, line))
    chars = sum(len(line["text"]) for _, line in todo)

    print("Model: %s | %d clip(s) to make, %d already done | about %d characters (roughly %d credits)" % (model, len(todo), skipped, chars, chars))

    if args.dry_run:
        for p, line in todo:
            print("  would make audio/%s/%s.mp3  [%s]  %s" % (p["id"], line["id"], p.get("voiceId") or "NO VOICE ID", line["text"]))
        print("\nDry run only: nothing was sent to ElevenLabs.")
        return
    if not todo:
        print("Nothing to do. Use --force to regenerate.")
        return

    for p in personas:
        if any(pp is p for pp, _ in todo) and not p.get("voiceId"):
            die("Persona '%s' has no voiceId in scripts.json. Run --list-voices to find one." % p["id"])

    key = get_key()
    made = 0
    for p, line in todo:
        out = clip_path(p, line)
        out.parent.mkdir(parents=True, exist_ok=True)
        body = {"text": line["text"], "model_id": model}
        if isinstance(p.get("voiceSettings"), dict):
            body["voice_settings"] = p["voiceSettings"]
        path = "/v1/text-to-speech/%s?output_format=%s" % (urllib.parse.quote(p["voiceId"], safe=""), OUTPUT_FORMAT)
        print("  %s/%s ... " % (p["id"], line["id"]), end="", flush=True)
        try:
            audio = call_api("POST", path, key, body)
        except ApiError as err:
            print("FAILED")
            die("%s\n%s\n(Clips made so far are kept. Fix the problem and run again; finished clips are skipped.)" % (err, hint_for(err.code)))
        if not audio or audio[:1] == b"{" or len(audio) < 200:
            print("FAILED")
            die("ElevenLabs did not return audio: %r" % audio[:200])
        tmp = out.with_suffix(".mp3.part")
        tmp.write_bytes(audio)
        os.replace(str(tmp), str(out))
        made += 1
        print("ok (%d KB)" % max(1, len(audio) // 1024))

    print("\nDone: %d clip(s) saved in %s" % (made, HERE / "audio"))
    print("Commit the audio folder. Do NOT commit your API key.")


if __name__ == "__main__":
    main()

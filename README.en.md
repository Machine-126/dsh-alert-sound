# dsh-alert-sound

<div align="center">
  <b>Know when DeepSeek Harness needs you: distinct tones or spoken voice (zh/en) for approval, question, completion and error — no need to watch the screen.</b><br /><br />
  <a href="https://www.npmjs.com/package/@machine-126/dsh-alert-sound"><img alt="npm version" src="https://img.shields.io/npm/v/@machine-126/dsh-alert-sound" /></a>
  <a href="https://www.npmjs.com/package/@machine-126/dsh-alert-sound"><img alt="npm downloads" src="https://img.shields.io/npm/dm/@machine-126/dsh-alert-sound" /></a>
  <a href="https://github.com/Machine-126/dsh-alert-sound/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/Machine-126/dsh-alert-sound" /></a>
  <a href="https://opensource.org/licenses/MIT"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <a href="https://www.npmjs.com/package/@deepseek-ai/dsh?activeTab=versions"><img alt="Supported DSH: 0.2.0-rc.2+" src="https://img.shields.io/badge/DSH-0.2.0--rc.2%2B-4d6bfe" /></a>
  <br /><br />
  <a href="./README.md">中文</a> · <a href="./README.en.md"><b>English</b></a>
</div>

## Why this exists

A DSH task often runs for minutes. The hard part is not the wait — it is that **the run has already stopped and is waiting for you while you are somewhere else**: an approval sits in a dialog, a question hangs unanswered, and the whole chain just stands still.

This plugin turns "it's your turn" into **sound**: a different tone per kind, or a spoken sentence naming what is actually blocking. Go do something else; come back when you hear it.

## Highlights

- **Five kinds, distinct tones** — needs approval / needs answer / output complete / error, plus an experimental **Stalled**.
- **Speaks the detail** — tool name and reason for an approval, the question text for a question; "output complete" can read out the final reply (with Read-aloud on).
- **Works in the background** — switching tabs or minimising the window keeps the alerts coming.
- **Never silently fails** — if browser speech synthesis drops the utterance, that kind's tone plays instead.
- **Repeats until handled** — approval and question re-alert at your chosen interval.
- **No network at all** — not a single request; everything happens in the browser.

## Install

npm (prebuilt, no build-script approval needed):

```sh
dsh plugin --profile web add @machine-126/dsh-alert-sound
```

> Replace `web` with your own profile name — **the desktop app usually uses `desktop`**. Run `dsh plugin --profile <name> list` first if you are unsure.

From GitHub (plain JS, no build step):

```sh
dsh plugin --profile web add github:Machine-126/dsh-alert-sound
```

From a local checkout (**the path must be absolute**; it installs as a `link:`):

```sh
dsh plugin --profile web add D:\path\to\dsh-alert-sound
```

After installing, **restart dsh** (the desktop app reloads a newly installed plugin only on restart), then open **Settings → 提醒音 / Alerts** to configure it.

To hack on it: all the logic lives in `lib/client.js`, there is **no build step**, and a page refresh picks up your changes (`prepublishOnly` runs `node --check` before publishing).

## The five kinds

| Kind | When it fires | Default sound | Dot |
|---|---|---|---|
| Needs approval | the agent wants to run something sensitive and waits for your "allow" | Alert (square triple) | amber |
| Needs answer | the agent asked you a question and waits for a reply | Tap (quick double) | purple |
| Output complete | a turn finished | Ding-dong (rising pair) | green |
| Error | the turn failed | Low (falling sawtooth) | red |
| Stalled (experimental) | with "Stall detection" on, no progress for a while | Low | orange |

> What it watches: `running` and the pending interaction's kind from `uiSession.sessionStatus`, plus the session snapshot's `lastAgentError`.

> The fifth kind is off by default: **it only fires once "Stall detection" is enabled**. It judges by the session's update timestamp, so it is a heuristic.

Available sounds: Ding-dong / Low / Tap / Alert / Voice / Custom / Mute.

> **About the "Voice" option**: approval and question speak the pending detail (tool name, reason, question text); **"Output complete" needs Read-aloud as well**, otherwise only the kind name is spoken. The body is capped at 400 characters.

## Settings reference

| Option | What it does | Default |
|---|---|---|
| Master volume | 0–200% | 70% |
| Scope | all sessions / current session only | all sessions |
| Repeat | off / 10 / 20 / 30 s, until handled | 20 s |
| System notification | browser notification (visible in the background) | off |
| Read-aloud | whether "output complete" speaks the final reply (sound must be Voice) | off |
| Stall detection | experimental; enables the fifth kind | off |
| Floating banner | top-of-screen banner, gone after 3.6 s | off |
| Voice rate | slow / normal / fast | normal |
| Do-not-disturb | start and end hour; nothing plays in between | off |
| Language | auto / 中文 / English | auto |

**Restore defaults** sits at the bottom (with a confirmation).

## Compatibility

| DSH version | Behaviour |
|---|---|
| `0.2.1-rc.2` | ✅ everything (the version this build was verified on) |
| `0.2.0-rc.2` | ✅ everything |
| older | ⚠️ completion and error only; approval and question stay silent |

Web Audio is required for the tones; voice uses the browser's speech synthesis and degrades to a tone when unavailable.

## FAQ

**Installed it, but nothing plays at all.**
Browsers only start audio after a user gesture — **click anywhere on the page** once. Then check that the kind's sound is not Mute, the master volume is not 0, and Do-not-disturb is off.

**I only hear the tail of the tone.**
Since 0.3.13 every playback is preceded by a 200 ms warm-up that wakes the audio device. If it still happens, please open an issue with your browser version.

**Approval and question never fire, but completion does.**
That means an older DSH: approval/question detection relies on `uiSession.sessionStatus`, which needs **DSH ≥ 0.2.0-rc.2**.

**Voice says "output complete" but no reply body.**
You need both the **Voice** sound and the **Read-aloud** switch on — and only the completion kind reads a body. A **background session** (one no longer shown in the main area) has no body to read: the plugin only sees the text once that session's chat view is open, so it falls back to the fixed phrase.

**The floating banner never shows.**
It is off by default; turn on "Floating banner" in settings.

**The whole UI went blank after installing.**
In a rare version mismatch the client can fail to boot. Roll back:

```sh
dsh plugin --profile <your-profile> remove @machine-126/dsh-alert-sound
```

## Privacy

Everything runs in the browser: **no network requests**, no analytics or telemetry. It reads four things, in memory only — the session's running state and pending interaction (including tool name / reason / question text), the session list's `updatedAt` and `retainedBy` (to decide "current session"), the session snapshot's `lastAgentError` (to detect a failure), and **only while Read-aloud is on** the text of the last assistant reply.

None of it is stored or sent anywhere; the only persisted data is your own settings (`localStorage` key `dsh-alert-sound.v1`, plus uploaded custom sounds under `dsh-alert-sound.custom.v1`).

## Roadmap

- Done and planned: **[ROADMAP.md](./ROADMAP.md)**
- Release history: **[CHANGELOG_EN.md](./CHANGELOG_EN.md)**

## Acknowledgements

The ideas and the shape of this plugin follow these projects; **the code is an independent implementation and reuses none of their source**:

- Detection approach (`running` and the pending interaction → approval / question / completion): [dsh-session-notification](https://github.com/dingyi222666/dsh-session-notification) (BSD-3-Clause)
- The "task finished" chime idea: [dsh-chime](https://github.com/HtO404/dsh-chime) (Apache-2.0)
- Packaging and web-client plugin form: the official `docs/user/develop/basic/publish.md`, plus [dsh-plugin-tts](https://github.com/1624318455/dsh-plugin-tts), [dsh-status-rotator](https://github.com/01Virex/dsh-status-rotator) and [dsh-web-ui-notify](https://github.com/omdsh-dev/dsh-web-ui-notify)

The tones are original (waveforms and frequencies are this plugin's own). Please keep this acknowledgement.

## About this project

Requirements and acceptance testing by [@Machine-126](https://github.com/Machine-126); the code was developed end-to-end by **DeepSeek Harness** (an AI coding agent).

A single-maintainer side project, so replies may be slow; bugs and feature requests are welcome in [the issue tracker](https://github.com/Machine-126/dsh-alert-sound/issues).

## License

MIT

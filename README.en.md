# dsh-alert-sound

English | [中文](./README.md)

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Notification sound alerts for the **DeepSeek Harness (dsh) web GUI**. When a session needs an **approval**, needs your **answer**, finishes a turn, or hits an **error**, the plugin plays a distinct synthesized tone and shows a toast — optionally with a **spoken voice** utterance. Each kind has its own selectable sound/voice, enable toggle and a master volume, configured in a dedicated Settings page. The UI and the spoken voice support both **Chinese and English** (switch in settings).

> **Note:** the plugin shipped Chinese-first; its on-screen labels (sound names, notification kinds, settings page) are localized. Use the **界面语言 / Language** picker in settings to switch between **自动 (auto) / 中文 / English** — English is used throughout this README for reference.

> **About this project**: requirements and acceptance testing by the repo owner [@Machine-126](https://github.com/Machine-126); the code was developed end-to-end by **DeepSeek Harness** (an AI coding agent). Issues are welcome at [the issue tracker](https://github.com/Machine-126/dsh-alert-sound/issues).

- **Five notification kinds, distinct tones** — needs approval / needs answer / output complete / error, plus an experimental **Stalled** kind (off by default).
- **Optional voice, Edge TTS by default** — switch any kind to **Voice** (语音) and the local DSH host synthesizes it with **Microsoft Edge's read-aloud service** (selectable voices: Xiaoxiao / Xiaoyi / Yunxi / Yunyang / Ava / Emma / Andrew / Brian, each with a **Preview** button); the spoken language follows the interface language. **Three layers**: Edge speech → browser speech → that kind's tone, so **an alert is never silent**. Switch **Voice engine** to **Browser speech** for a fully offline mode.
- **Settings page** (sidebar → **提醒音 / Alerts**) — master volume (0–200%), per-kind enable, sound picker (Ding-dong 叮咚 / Low 低沉 / Tap 轻点 / Alert 警醒 / Voice 语音 / Custom 自定义 / Mute 静音), a preview button, and **Restore defaults** (with a confirmation).
- **Works in the background** — audio is unlocked on the first user gesture.
- **Alerts across all sessions** by default — a multi-session user hears approval/answer/error/completion from any session; switch to **仅当前会话 (current session only)** in settings if you only care about the one you're viewing.
- **Voice reads the detail** — with a kind set to Voice, it speaks the specific blocker (e.g. `Needs approval: write; write file D:\xxx`, `Needs answer: <question>`, `Error: <reason>`). The fixed phrase and the spoken language follow the interface-language setting; the detail text is the session's own content.
- **Blocking events repeat** — approval/question keep re-alerting every N seconds until handled (configurable 关/10/20/30s); error repeats a few times.
- **Localized (zh/en)** — the settings page, toast, per-kind/sound names and the spoken voice language all follow the **界面语言 / Language** setting.
- **Browser system notification** — when enabled, an alert also raises a system notification (visible even when dsh is in the background).
- **Stall detection (experimental, off by default)** — alerts when an agent shows no progress for a while; currently `updatedAt`-based and **not yet reliable**, so it is disabled by default. Note: the 5th **Stalled** alert only fires when this is on.
- Settings persist to `localStorage`, surviving refresh/restart; a one-click restore-to-defaults is available.

## Requirements

- **DeepSeek Harness `0.1.2` or newer** (`dsh web`) — approval/question detection relies on `uiSession.pendingInteractions`, introduced in 0.1.2; on older versions only the complete/error alerts work.
- A browser with Web Audio (for tones); Web Speech is needed only by the "Browser speech" engine and degrades to a tone
- **"Edge speech" (the default) needs network access**: the local DSH host must reach Microsoft's read-aloud service at `speech.platform.bing.com`. Offline or on failure it falls back to browser speech (see [Privacy](#privacy))

## Install

Recommended: install the npm package (prebuilt, no build-approval, and storefronts show it by download count):

```sh
dsh plugin --profile web add @machine-126/dsh-alert-sound
```

Or install from GitHub (pure JS, no build step, works directly):

```sh
dsh plugin --profile web add github:Machine-126/dsh-alert-sound
```

Or from a local checkout:

```sh
dsh plugin --profile web add ./dsh-alert-sound
```

Restart `dsh web`, then open **Settings → 提醒音 / Alerts** to configure.

## Usage

After install, open DSH **Settings → 提醒音 / Alerts** and set the sound/voice, enable switch and volume per kind; the **界面语言 / Language** picker at the top switches between **自动 (auto) / 中文 / English**, and **Restore defaults** at the bottom resets everything (with a confirmation). Notifications fire automatically; nothing else to do.

## Notification kinds & default sounds

| Kind | Trigger | Default sound | Toast |
|---|---|---|---|
| Needs approval (需要审批) | `uiSession.pendingInteractions` has `kind === 'approval'` for the session | Alert (警醒, square triple) | amber |
| Needs answer (需要回答) | `uiSession.pendingInteractions` has `kind === 'question'` (incl. plan-review) | Tap (轻点, quick taps) | purple |
| Output complete (输出完成) | session-list `running` true→false | Ding-dong (叮咚, ascending two-note) | green |
| Error (发生错误) | a turn errors during a run (`lastAgentError` changes) | Low (低沉, descending sawtooth) | red |

There is also a 5th **Stalled/卡住** kind (experimental, **off by default** — enable “Stall detection” first); its default sound is **Low (fault)**.

## Voice engines (Edge / Browser)

The **Voice** sound has two engines, switched in **Settings → 提醒音 / Alerts → Voice engine**:

| Engine | What it does | Network |
|---|---|---|
| **Edge speech** (default) | The local DSH host synthesizes MP3 with Microsoft Edge's read-aloud service and the browser plays it. Voices are selectable; for Chinese **Xiaoxiao** and for English **Ava** are recommended (the multilingual voice reads Chinese just as naturally, while Yunxi/Yunyang mispronounce English words embedded in Chinese text). | required |
| **Browser speech** | The browser's own `speechSynthesis`: language only, no voice choice, and robotic Chinese. | none |

- **Why the browser does not synthesize it directly**: the read-aloud WebSocket refuses a handshake carrying a page `Origin` (HTTP 403) and requires a browser-like User-Agent that a page cannot set; the local host process satisfies both. The host half therefore exposes `/dsh-alert-sound/tts.mp3` and the browser only plays the returned audio.
- **Prefetch**: the fixed phrase of every kind set to Voice is synthesized in the background at start-up and cached, so an alert sounds immediately instead of waiting for synthesis.
- **Voices**: `Auto` uses `zh-CN-XiaoxiaoNeural` (Xiaoxiao) for Chinese and `en-US-AvaMultilingualNeural` (Ava) for English; a specific voice can be pinned. Pick one and hit **Preview** to hear it.
- **Failures are visible**: three consecutive synthesis failures disable the Edge engine (so no alert waits for a dead route); the settings page then shows "⚠️ Edge speech unavailable; using browser speech" and the browser console records the reason.
- **Rate**: the Voice-rate setting applies to both engines (0.7 → −30%, 1.3 → +30%).

## Settings persistence

Preferences are stored in `localStorage` under `dsh-alert-sound.v1` (master volume + per-kind `{enabled, sound}` + scope/repeat/system-notification/read-aloud/stall-detection/toast/voice-rate/voice-engine/voice/do-not-disturb/interface-language); uploaded custom sounds live under `dsh-alert-sound.custom.v1`. They survive page reloads and restarts.

## Privacy

Every alert decision is made in the browser. The plugin reads, **in memory only**: the session list's `running` / `updatedAt`; `uiSession.pendingInteractions` (the pending kind plus tool name, reason and question text); the session snapshot's `lastAgentError` (failed detection); and — **only when "Read-aloud" is on** — the last assistant reply text from the conversation view (for speaking it). None of it is stored. The only persisted data is your own **settings** (`localStorage` `dsh-alert-sound.v1`; custom sounds in `dsh-alert-sound.custom.v1`).

**Network disclosure (only about the Voice sound)**: the default **Edge speech** engine hands **the text being spoken** — the alert phrase, or the assistant reply truncated to 400 characters when Read-aloud is on — to the local DSH host, which sends it to Microsoft's read-aloud service (`speech.platform.bing.com`) for synthesis. Returned audio is kept in an **in-memory cache** only (at most 128 entries / 24 MB); nothing is written to disk or used for anything else. **Alerts that do not use the Voice sound (Ding-dong / Low / Tap / Alert / Custom), and the "Browser speech" engine, make no network requests at all.** The plugin uses no analytics or telemetry.

- To stay fully offline: set **Voice engine** to **Browser speech** (or avoid the Voice sound).
- To send less: turn **Read-aloud** off, leaving only fixed phrases and short approval details.
- The host half registers one synthesis route (`GET /dsh-alert-sound/tts.mp3`); it touches the network only when the browser asks it to synthesize, and it writes no files and no logs.

## Project layout

```
├─ package.json        # dsh.bundle + dsh.client (web client plugin)
├─ cordis.patch.yml    # composition patch: inserts one row (id = in-package name)
├─ test/host.test.mjs  # host-half tests (`npm test`; the networked case is skipped by default)
└─ lib/
   ├─ index.mjs        # host half (Edge speech synthesis route; everything else is client-side)
   └─ client.js        # client half (bundle module-loader format)
```

## Credits

The **detection approach** (watching the session list's `running` and `uiSession.pendingInteractions`) follows the idea used by [dsh-session-notification](https://github.com/dingyi222666/dsh-session-notification) (BSD-3-Clause); the “task-completion chime” concept follows [dsh-chime](https://github.com/HtO404/dsh-chime) (Apache-2.0). The **bundle/client-plugin structure** follows the official dsh docs (`docs/user/develop/basic/publish.md`) and the layouts of [dsh-plugin-tts](https://github.com/1624318455/dsh-plugin-tts), [dsh-status-rotator](https://github.com/01Virex/dsh-status-rotator) and [dsh-web-ui-notify](https://github.com/omdsh-dev/dsh-web-ui-notify).

The **tones are original** (waveforms/frequencies designed for this plugin); no audio constants were copied from the above projects. Source is an independent implementation.

## License

MIT

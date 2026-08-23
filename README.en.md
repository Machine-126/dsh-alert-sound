# dsh-alert-sound

English | [中文](./README.md)

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Notification sound alerts for the **DeepSeek Harness (dsh) web GUI**. When a session needs an **approval**, needs your **answer**, finishes a turn, or hits an **error**, the plugin plays a distinct synthesized tone and shows a toast — optionally with a **spoken voice** utterance. Each kind has its own selectable sound/voice, enable toggle and a master volume, configured in a dedicated Settings page. The UI and the spoken voice support both **Chinese and English** (switch in settings).

> **Note:** the plugin shipped Chinese-first; its on-screen labels (sound names, notification kinds, settings page) are localized. Use the **界面语言 / Language** picker in settings to switch between **自动 (auto) / 中文 / English** — English is used throughout this README for reference.

> **About this project**: requirements and acceptance testing by the repo owner [@Machine-126](https://github.com/Machine-126); the code was developed end-to-end by **DeepSeek Harness** (an AI coding agent). Issues are welcome at [the issue tracker](https://github.com/Machine-126/dsh-alert-sound/issues).

- **Four notification kinds, four distinct tones** — needs approval / needs answer / output complete / error.
- **Optional voice** — switch any kind to **Voice** (语音) to hear it spoken (browser speech synthesis), in the selected interface language.
- **Settings page** (sidebar → **提醒音 / Alerts**) — master volume (0–200%), per-kind enable, sound picker (Ding-dong 叮咚 / Low 低沉 / Tap 轻点 / Alert 警醒 / Voice 语音 / Custom 自定义 / Mute 静音) and a preview button.
- **Works in the background** — audio is unlocked on the first user gesture.
- **Alerts across all sessions** by default — a multi-session user hears approval/answer/error/completion from any session; switch to **仅当前会话 (current session only)** in settings if you only care about the one you're viewing.
- **Voice reads the detail** — with a kind set to Voice, it speaks the specific blocker (e.g. `Needs approval: write; write file D:\xxx`, `Needs answer: <question>`, `Error: <reason>`). The fixed phrase and the spoken language follow the interface-language setting; the detail text is the session's own content.
- **Blocking events repeat** — approval/question keep re-alerting every N seconds until handled (configurable 关/10/20/30s); error repeats a few times.
- **Localized (zh/en)** — the settings page, toast, per-kind/sound names and the spoken voice language all follow the **界面语言 / Language** setting.
- **Browser system notification** — when enabled, an alert also raises a system notification (visible even when dsh is in the background).
- **Stall detection (experimental, off by default)** — alerts when an agent shows no progress for a while; currently `updatedAt`-based and **not yet reliable**, so it is disabled by default (opt-in).
- Settings persist to `localStorage`, surviving refresh/restart.

## Requirements

- DeepSeek Harness `web` profile (`dsh web`)
- A browser with Web Audio (for tones); Web Speech for voice is optional and degrades gracefully

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

After install, open DSH **Settings → 提醒音 / Alerts** and set the sound/voice, enable switch and volume per kind; the **界面语言 / Language** picker at the top switches between **自动 (auto) / 中文 / English**. Notifications fire automatically; nothing else to do.

## Notification kinds & default sounds

| Kind | Trigger | Default sound | Toast |
|---|---|---|---|
| Needs approval (需要审批) | session `pendingInteraction === 'approval'` | Alert (警醒, square triple) | amber |
| Needs answer (需要回答) | session `pendingInteraction === 'question'` | Tap (轻点, quick taps) | purple |
| Output complete (输出完成) | session `running` true→false | Ding-dong (叮咚, ascending two-note) | green |
| Error (发生错误) | a turn errors during a run | Low (低沉, descending sawtooth) | red |

There is also a 5th **Stalled/卡住** kind (experimental, **off by default** — see “Stall detection” above); its default sound is **Low (fault)**.

## Settings persistence

Preferences are stored in `localStorage` under `dsh-alert-sound.v1` (master volume + per-kind `{enabled, sound}` + scope/repeat/system-notification/read-aloud/stall-detection/toast/voice-rate/do-not-disturb/interface-language), so they survive page reloads and restarts.

## Privacy

All processing stays in the browser. The plugin reads the **session list state** (`running` / `pendingInteraction`, and a session snapshot's turn-error / last-agent-error for failed-detection) **in memory only** to decide when to notify — it is never stored or sent anywhere. The only persisted data is your own sound/volume **settings** in `localStorage` (`dsh-alert-sound.v1`). The plugin makes **no network requests**, sends nothing to any server, uses no analytics/telemetry, and plays sounds / voices through browser-local Web Audio and Speech Synthesis.

## Project layout

```
├─ package.json        # dsh.bundle + dsh.client (web client plugin)
├─ cordis.patch.yml    # composition patch: inserts one row (id = in-package name)
└─ lib/
   ├─ index.mjs        # host half (pure-client plugin; host row is a minimal placeholder)
   └─ client.js        # client half (bundle module-loader format)
```

## Credits

The **detection approach** (watching the session list's `running` / `pendingInteraction` signals) follows the idea used by [dsh-session-notification](https://github.com/dingyi222666/dsh-session-notification) (BSD-3-Clause); the “task-completion chime” concept follows [dsh-chime](https://github.com/HtO404/dsh-chime) (Apache-2.0). The **bundle/client-plugin structure** follows the official dsh docs (`docs/user/develop/basic/publish.md`) and the layouts of [dsh-plugin-tts](https://github.com/1624318455/dsh-plugin-tts), [dsh-status-rotator](https://github.com/01Virex/dsh-status-rotator) and [dsh-web-ui-notify](https://github.com/omdsh-dev/dsh-web-ui-notify).

The **tones are original** (waveforms/frequencies designed for this plugin); no audio constants were copied from the above projects. Source is an independent implementation.

## License

MIT

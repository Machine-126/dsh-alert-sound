# dsh-alert-sound

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Notification sound alerts for the **DeepSeek Harness (dsh) web GUI**. When the session needs an **approval**, needs your **answer**, finishes a turn, or hits an **error**, the plugin plays a distinct synthesized tone and shows a toast — optionally with a **Chinese voice** utterance. Each kind has its own selectable sound/voice, enable toggle and a master volume, configured in a dedicated Settings page.

- **Four notification kinds, four distinct tones** — needs approval / needs answer / output complete / error.
- **Optional Chinese voice** — switch any kind to “语音” to hear it spoken (browser speech synthesis).
- **Settings page** (侧栏 → 提醒音) — master volume (0–200%), per-kind enable, sound picker (叮咚/低沉/轻点/警醒/语音/静音) and a preview button.
- **Works in the background** — audio is unlocked on the first user gesture.
- Settings persist to `localStorage`, surviving refresh/restart.

## Requirements

- DeepSeek Harness `web` profile (`dsh web`)
- A browser with Web Audio (for tones); Web Speech for voice is optional and degrades gracefully

## Install

```sh
dsh plugin --profile web add github:你/仓库
```

Restart `dsh web`, then open **设置 → 提醒音** to configure. Or install a local checkout:

```sh
dsh plugin --profile web add ./dsh-alert-sound
```

> This plugin is pure JavaScript and ships no build step, so a `github:` install works directly (no npm packaging or build-allowance needed).

## Usage

After install, open DSH settings → **提醒音** and set the sound/voice, enable switch and volume per kind. Notifications fire automatically; nothing else to do.

## Notification kinds & default sounds

| Kind | Trigger | Default sound | Toast |
|---|---|---|---|
| 需要审批 | session `pendingInteraction === 'approval'` | 警醒 (square triple) | amber |
| 需要回答 | session `pendingInteraction === 'question'` | 轻点 (quick taps) | purple |
| 输出完成 | session `running` true→false | 叮咚 (ascending two-note) | green |
| 发生错误 | a turn errors during a run | 低沉 (descending sawtooth) | red |

## Settings persistence

Preferences are stored in `localStorage` under `dsh-alert-sound.v1` (volume + per-kind `{enabled, sound}`), so they survive page reloads and restarts.

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

# Security Policy

## Reporting a vulnerability

If you find a security issue in `dsh-alert-sound`, please report it privately rather than opening a public issue.

- Report it via a **private security advisory** — go to the repo's **Security** tab → **Report a vulnerability** (maintainer: [`@Machine-126`](https://github.com/Machine-126)).

Please include:
- A short description of the issue.
- Steps to reproduce / the affected version.
- Any suggested fix, if you have one.

We aim to acknowledge reports within a reasonable time and will credit you (with your permission) once resolved.

## Security posture

- Every **alert decision** runs **in the browser**, and it reads session state **in memory only** — nothing is stored by the plugin itself.
- The only persisted data is your own **sound/volume settings** in `localStorage` (`dsh-alert-sound.v1`).
- The host half registers exactly one route, `GET /dsh-alert-sound/tts.mp3`, and does nothing else: no filesystem access, no logging, no network or process work at activation.
- **Network (opt-out, and only for the “Voice” sound)**: the default **Edge speech** engine sends **the text being spoken** — the alert phrase, or the assistant reply truncated to 400 characters when “Read-aloud” is on — from the browser to the local host process, which forwards it to Microsoft's read-aloud service (`speech.platform.bing.com`) over WSS and returns MP3. The audio is cached in memory only (≤128 entries / 24 MB). Alerts using the other sounds (Ding-dong / Low / Tap / Alert / Custom) and the **Browser speech** engine make **no network requests**. Set **Voice engine → Browser speech** to stay fully offline.
- `package.json` declares **no install-time scripts** and **one runtime dependency**, [`ws`](https://github.com/websockets/ws) (MIT), used only by the host half's WebSocket client; plus the standard `react` / `@deepseek-ai/cordis` peers. Installation runs no arbitrary code.
- The synthesis route validates its inputs: `GET`/`HEAD` only, text ≤400 characters, voice name restricted to the service's `xx-XX-<Name>Neural` form (so no SSML can be injected), rate clamped to −50%…+100%, and requests marked cross-site or carrying a foreign `Origin` are refused with 403.
- Source is **readable and not obfuscated**, so it can be audited before install. Consider pinning a commit when installing.

## Recommended install (pin a commit)

```sh
dsh plugin --profile web add github:Machine-126/dsh-alert-sound#<commit-sha>
```

Review the source of any third-party plugin before installing with elevated allowance.

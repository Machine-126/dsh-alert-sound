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

- The plugin runs **entirely in the browser**; it sends **no data to any server** and makes **no network requests**.
- It reads, **in memory only**: the session's running state and the pending interaction's detail (tool name, reason, question text), the session list's `updatedAt` / `retainedBy` (to decide "current session"), the session snapshot's `lastAgentError` (to detect a failure), and — **only while Read-aloud is on** — the text of the last assistant reply. Nothing is stored or transmitted.
- The only persisted data is your own **settings and uploaded sounds**: `localStorage` keys `dsh-alert-sound.v1` (settings) and `dsh-alert-sound.custom.v1` (custom sounds).
- The host half is an **inert placeholder** (no filesystem, network or process access).
- `package.json` declares **no install-time scripts** and **no runtime dependencies** (only the standard `react` / `@deepseek-ai/cordis` peers), so installation runs no arbitrary code.
- Source is **readable and not obfuscated**, so it can be audited before install. Consider pinning a commit when installing.

## Recommended install (pin a commit)

```sh
dsh plugin --profile web add github:Machine-126/dsh-alert-sound#<commit-sha>
```

Review the source of any third-party plugin before installing with elevated allowance.

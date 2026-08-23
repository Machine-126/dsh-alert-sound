# Security Policy

## Reporting a vulnerability

If you find a security issue in `dsh-alert-sound`, please report it privately rather than opening a public issue.

- **E-mail** the maintainer directly (replace with your contact) — `you@example.com`.
- Or open a **private security advisory** on GitHub (Settings → Security → Report a vulnerability) if available.

Please include:
- A short description of the issue.
- Steps to reproduce / the affected version.
- Any suggested fix, if you have one.

We aim to acknowledge reports within a reasonable time and will credit you (with your permission) once resolved.

## Security posture

- The plugin runs **entirely in the browser**; it sends **no data to any server** and makes **no network requests**.
- It reads session-list state **in memory only** to decide when to notify — nothing is stored or transmitted.
- The only persisted data is your own **sound/volume settings** in `localStorage` (`dsh-alert-sound.v1`).
- The host half is an **inert placeholder** (no filesystem, network or process access).
- `package.json` declares **no install-time scripts** and **no runtime dependencies** (only the standard `react` / `@deepseek-ai/cordis` peers), so installation runs no arbitrary code.
- Source is **readable and not obfuscated**, so it can be audited before install. Consider pinning a commit when installing.

## Recommended install (pin a commit)

```sh
dsh plugin --profile web add github:你/仓库#<commit-sha>
```

Review the source of any third-party plugin before installing with elevated allowance.

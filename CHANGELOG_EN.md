# Changelog

[中文](./CHANGELOG.md) | English

Versions follow [Semantic Versioning](https://semver.org/). The `0.3.x` run (2026-09-08) focused on **DSH 0.1.2+ compatibility** and **alert reliability**; `0.3.15` (2026-10-06) moved the plugin onto **DSH 0.2.0-rc.2**; `0.3.16` (2026-10-06) fixed the rc2 regression where "output complete" stopped reading the reply body; `0.3.17` (2026-10-21) rebuilt the settings page and the banner on the Host's own controls and theme.

## [0.3.17]

### Improved
- **The settings page and the floating banner now use the Host's own UI and theme** (from PR [#2](https://github.com/Machine-126/dsh-alert-sound/pull/2), thanks [@rngfbbbffhjgggd-commits](https://github.com/rngfbbbffhjgggd-commits)): the settings page follows the Host's stacked-field grammar (label above, control below, 0.5px separators between fields), toggles and buttons are the `ui-primitives` `Switch` / `Button`, and colours and radii come from `--dsw-*` theme tokens — so light, dark and high-contrast themes follow the shell instead of a hardcoded grey.
- **The banner is the Host's `Toast` component**: top-centre, slides in, fades over a fixed 1s, still 3.6s in total; the kind is carried by a leading status dot. ⚠️ The Host's own toasts occupy the same spot, so the two overlap when they fire at the same moment.
- **No more self-drawn "🔔 Alert sounds" heading**: the settings navigation already names the page, so the panel was painting the same title twice.
- **Form accessibility**: dropdowns and the volume slider gained accessible names (`aria-label`; the slider also carries `aria-valuetext`), and the do-not-disturb hours and each kind's sound picker have distinct names — a screen reader no longer reads out a row of bare "combobox".

### Fixed
- **The "Host Button" in PR #2 never actually rendered**: `ui-primitives` builds `Button` with `forwardRef`, so `typeof Button === "function"` was always false — preview and restore-defaults silently used the fallback button. With a truthiness check the Host button's focus ring and disabled state now apply.
- **Switching the banner off no longer parks a message**: it kept recording one anyway, so turning the banner back on surfaced a stale alert immediately.

## [0.3.16]
### Fixed
- **The completion voice spoke only the fixed phrase, never the reply body** (regression from 0.3.15): 0.3.15 moved text lookup onto rc2's main path (`ChatSnapshot.order` + `nodes.get(key)`) but kept the old event-layer node shape (`n.kind === "assistant"` + `n.blocks`). In rc2's `chat` target the assistant node is **`kind: "assistant-step"`** with the body in **`node.data.blocks`** (`kind: "assistant"` + `node.blocks` belong to the trajectory event layer), so the two never matched → `finalTextOf` always returned `""` → only "output complete" was spoken. Both shapes are accepted now, for backward compatibility.
- **"Read-aloud" became a real switch**: it used to control only whether the chat target was subscribed and the truncation limit (120 / 400 characters), so with the switch off the first 120 characters were still spoken — the opposite of what the README and the settings hint promised. Off now speaks only the fixed phrase and no longer creates a conversation binding for that session (the privacy statement matches the behaviour).

## [0.3.15]
### Fixed (DSH 0.2.0-rc.2 adaptation, breaking)
- **Injecting `timer` kept the whole `dsh web` from starting**: since 0.1.7 the client `client/runtime` is gone and no row in the browser Cordis tree provides `timer` (`cordis-plugin-timer` remains host-only). Injecting it leaves the plugin fiber pending forever, and the boot audit (`assertEntriesActive` in `boot-client.ts`) treats pending entries as failures and throws → **the entire front end goes blank**. The plugin now injects nothing and owns its timers through `ctx.effect(() => setTimeout/setInterval)`, released with the fiber.
- **Approval and question alerts went silent**: `ctx.uiSession.pendingInteractions` (public since 0.1.2) became private in rc2; the public face is **`sessionStatus`** (`HostObservable<Map<SessionId, { running, pendingInteraction, completionUnread }>>`). The plugin now reads and subscribes to `sessionStatus`; the detail fields (approval `toolName`/`reason`, question and plan-review `questions[]`) are unchanged.
- **Scope "current session only" never fired**: rc2's `SessionListState` has no `current`; that fact moved to the session row's `retainedBy.mainView` count (whoever holds a reference from the main area is "current").
- `running` is now taken from **`sessionStatus.running`** (the list row's `running` is only a display fallback in rc2), avoiding false completion reports for sessions missing from the Host list.
- Read-aloud prefers rc2's main path (`ChatSnapshot.order` + `nodes.get(key)`) and falls back to `legacy.nodes`.
- Manifest: the vanished `@deepseek-ai/dsh-client-runtime` (plus the unused `dsh-client-connection`) in `dsh.client.inject` were replaced by the four packages whose services the plugin actually consumes; added `dsh.manifestVersion: 1` and `engines.dsh: ">=0.2.0-rc.2"`.

## [0.3.14]
### Release chain (no plugin behaviour change)
- Publishing moved to **GitHub Actions + OIDC trusted publishing + staged publishing**: pushing a `v*` tag stages the version on npm, and the maintainer's 2FA approval makes it public (package contents identical to 0.3.13).
- `publishConfig.registry` pinned to `registry.npmjs.org` (the local default registry is a mirror).

## [0.3.13]
### Fixed
- **Tones played only their tail** (long-standing issue): the root cause is output-device wake-up latency — after a long gap the device is idle and needs ~150ms to wake, while the first note lasts 0.18s, so its attack was swallowed. Fix: schedule a **200ms silent warm-up** before the real notes.

## [0.3.12]
### Docs
- Added the missing 0.3.11 changelog entry, unified date markers, and corrected the "current state" section of `ROADMAP.md` (five kinds, restore defaults, custom-sound key).

## [0.3.11]
### Docs
- README (zh/en) aligned with the code: five kinds, **requires DSH ≥ 0.1.2**, restore defaults, the field wording in privacy and acknowledgements, and the trigger condition of each notification kind.
- Added this `CHANGELOG.md`; `ROADMAP.md` gained the v0.3.3–0.3.10 thread in its compatibility section.

## [0.3.10]
### Fixed
- Re-entrancy guard for the voice fallback: the watchdog's `speechSynthesis.cancel()` fires `onerror` again, so without a flag the fallback tone played twice.

## [0.3.9]
### Fixed
- **Completion alerts are no longer silent**: browser `speechSynthesis` silently drops utterances (`speak()` returns but `onstart` never fires — no sound, no error). Added a **1s watchdog plus a per-kind tone fallback** (approval → Alert, question → Tap, completion → Ding-dong, error and stalled → Low) and a `getVoices()` warm-up at startup.

## [0.3.8]
### Docs / UX
- Corrected stale copy (the banner hint claimed it would speak Chinese, while it actually follows the interface language) and the file-header comment (four kinds → five).
- "Restore defaults" gained a **second confirmation**, so a stray click cannot wipe everything.

## [0.3.7]
### Fixed
- Regression from 0.3.6: rebuilding the pending baseline reset `running` as well, swallowing that turn's completion or failure (added `reseedPending()`, which touches pending only).

## [0.3.6]
### Fixed (review)
- Tone-queue release is timed from **actual scheduling**, so a late-starting context cannot overlap the next alert.
- The pending baseline is rebuilt once `uiSession` is ready, avoiding false alerts for pre-existing pending interactions after a refresh.
- Slot registration moved to `ctx.inject(["slots"], …)`, removing the same "service arrives late → never registered" hazard.

## [0.3.5]
### Docs
- Added the "**not yet tested by the author**" disclaimer to the Error kind.
- Documented that **the fifth (Stalled) kind only fires once "Stall detection" is enabled**.

## [0.3.4]
### Added / Docs
- Added the **"Restore defaults"** button.
- Rewrote the "Read-aloud" description to state that it **only applies to the Voice sound**.

## [0.3.3]
### Fixed
- Wait for `AudioContext.resume()` before scheduling, with more lead time (fixes "only the tail plays").
- No unconditional `cancel()` before speaking (it swallowed the start of the new sentence).
- Added a **playback queue**, so simultaneous alerts play in order instead of interrupting each other.

## [0.3.2]
### Fixed
- **Completion and failure never fired**: the session-list subscription used `ctx.get("sessions")` with an early return, so when the service was not ready the **subscription was never established**; switched to `ctx.inject(["sessions"], …)`.

## [0.3.1]
### Fixed
- Restored "read the last reply": DSH 0.1.2 removed `chat` from the snapshot, so the text now comes from the conversation view, `uiConversation.binding(id).target('chat')`.

## [0.3.0]
### Fixed (DSH 0.1.2 compatibility, breaking)
- `SessionSummary.pendingInteraction` and `SessionSnapshot.pending` / `chat` were removed from the core; approval and question now read **`ctx.uiSession.pendingInteractions`**, and failure detection uses `lastAgentError`.

## [0.2.1]
### Fixed
- After moving to a scoped package name (`@machine-126/dsh-alert-sound`) the client bundle's registered id was not updated → fixed the "loaded without registering" error.
- Normalised `repository.url`.

## [0.2.0]
### Changed
- Completed all of A–I: i18n (zh/en), read-aloud, repeat alerts, browser notifications, custom sound upload, stall detection (experimental), do-not-disturb hours, voice rate and the floating-banner switch.
- Moved to a scoped package name and published to npm.

## [0.1.0]
- First release: four kinds (approval / question / completion / error), synthesised tones and a settings page.

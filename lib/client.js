// dsh-alert-sound — Client half (browser bundle).
// Hand-written in the harness module-loader format; `require` answers the
// platform externals (react), everything else is inlined.
//
// Watches ctx.uiSession.sessionStatus — the DSH 0.2.0-rc.2 owner of the running,
// pending-interaction and completion facts — and raises five notification kinds:
// approval / question / completed / failed / stalled. Each plays a distinct
// synthesized tone, a spoken utterance or an uploaded clip, with a Settings
// section for per-kind sound+enable and a master volume.
window.__ModuleLoader__.load({
  id: "@machine-126/dsh-alert-sound",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");
    // The settings panel and the toast render with the Host's own UI primitives —
    // shared with client plugins through the web shell's static-module table — plus
    // the theme tokens. Guarded: on a host without the module the panel falls back
    // to plain form controls and the toast to a token-styled banner, instead of
    // failing to render (the failure mode this plugin hit once with an injected
    // service). Not named `ui`: `statusOf` already has a local `ui` for the
    // uiSession service, and a shared name invites mixing the two up.
    let uiKit = {};
    try { uiKit = require("@deepseek-ai/dsh-client-ui-primitives") || {}; } catch (e) { uiKit = {}; }

    const name = "@machine-126/dsh-alert-sound";
    // 不订阅任何服务：浏览器的 Cordis 树里没有 `timer`（0.1.7 起 client/runtime 拆掉后
    // cordis-plugin-timer 只剩 host 行），注入它会永久 pending，让整个 dsh web 启动审计失败。
    const inject = [];

    // ================= settings (localStorage) =================
    const STORE_KEY = "dsh-alert-sound.v1";
    const DEFAULT_TYPES = {
      approval: { enabled: true, sound: "alarm" },
      question: { enabled: true, sound: "tap" },
      done: { enabled: true, sound: "ding" },
      failed: { enabled: true, sound: "fault" },
      stalled: { enabled: true, sound: "fault" },
    };
    const DEFAULTS = { volume: 0.7, scope: "all", repeatMs: 20000, notifyEnabled: false, readOutput: false, stallMs: 0, showToast: false, voiceRate: 1, dndEnabled: false, dndStart: 22, dndEnd: 8, lang: "auto", types: DEFAULT_TYPES };

    function deepMerge(base, over) {
      const out = {};
      for (const k of Object.keys(base)) {
        const b = base[k];
        const o = over && over[k] !== undefined ? over[k] : undefined;
        if (b && typeof b === "object" && !Array.isArray(b)) out[k] = deepMerge(b, o || {});
        else out[k] = o !== undefined ? o : b;
      }
      return out;
    }

    let settings = deepMerge(DEFAULTS, {});
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p === "object") settings = deepMerge(DEFAULTS, p);
      }
    } catch (e) { /* ignore */ }

    const settingsSubs = new Set();
    function notifySettings() {
      settingsSubs.forEach(fn => { try { fn(); } catch (e) {} });
    }
    function subscribeSettings(fn) {
      settingsSubs.add(fn);
      try { fn(); } catch (e) {}
      return () => settingsSubs.delete(fn);
    }
    function persistSettings(next) {
      settings = next;
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch (e) {}
      notifySettings();
    }

    // ---- 自定义音色（每类一份，存 localStorage） ----
    const CUSTOM_KEY = "dsh-alert-sound.custom.v1";
    let customAudio = {}; // kind -> dataUrl
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p === "object" && !Array.isArray(p)) customAudio = p;
      }
    } catch (e) { /* ignore */ }
    function persistCustomAudio() {
      try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customAudio)); } catch (e) {}
    }

    // ================= sounds (original tones + Chinese voice) =================
    const SOUND_IDS = ["ding", "fault", "tap", "alarm", "voice", "custom", "none"];
    const PATTERNS = {
      ding:  { notes: [{ at: 0, f: 523.25, d: 0.18, t: "sine", g: 0.8 }, { at: 0.15, f: 783.99, d: 0.35, t: "sine", g: 0.8 }] },
      fault: { notes: [{ at: 0, f: 196, d: 0.2, t: "sawtooth", g: 0.35 }, { at: 0.18, f: 130.81, d: 0.4, t: "sawtooth", g: 0.35 }] },
      tap:   { notes: [{ at: 0, f: 1046.5, d: 0.07, t: "triangle", g: 0.7 }, { at: 0.1, f: 1046.5, d: 0.07, t: "triangle", g: 0.7 }] },
      alarm: { notes: [{ at: 0, f: 880, d: 0.1, t: "square", g: 0.3 }, { at: 0.16, f: 1174.66, d: 0.12, t: "square", g: 0.3 }, { at: 0.34, f: 1567.98, d: 0.22, t: "square", g: 0.3 }] },
    };
    // Toast accents. The surface now belongs to the Host's toast, so the kind is
    // carried by a leading dot: a theme token where one exists, the previous
    // hardcoded tone kept as the fallback. The display text comes from t( kind ).
    const TOAST_MAP = {
      approval: { accent: "var(--dsw-alias-state-warn-label, #f59e0b)" },
      question: { accent: "var(--dsw-alias-state-business-primary, #7c3aed)" },
      done: { accent: "var(--dsw-alias-state-success-primary, #16a34a)" },
      failed: { accent: "var(--dsw-alias-state-error-primary, #dc2626)" },
      stalled: { accent: "var(--dsw-alias-state-warn-label, #f97316)" },
      connected: { accent: "var(--dsw-alias-state-business-primary, #2563eb)" },
    };
    // How long one banner stays up in total. The Host's Toast holds for `holdMs`
    // and then fades for a fixed 1s, so its hold is this total minus the fade —
    // the plugin has always dismissed at 3.6s.
    const TOAST_MS = 3600;
    const TOAST_HOLD_MS = TOAST_MS - 1000;
    const KINDS = ["approval", "question", "done", "failed", "stalled"];
    // 语音朗读失败（浏览器 TTS 丢 utterance）时，用哪一声提示音兜底——保证一定有声。
    const VOICE_FALLBACK = { approval: "alarm", question: "tap", done: "ding", failed: "fault", stalled: "fault" };

    // ---- i18n: zh/en dictionaries + t() ----
    const I18N = {
      zh: {
        approval: "需要审批", question: "需要回答", done: "输出完成", failed: "发生错误", stalled: "卡住", connected: "🔔 提醒已连接",
        "sound.ding": "叮咚", "sound.fault": "低沉", "sound.tap": "轻点", "sound.alarm": "警醒", "sound.voice": "语音", "sound.custom": "自定义", "sound.none": "静音",
        "lang.label": "界面语言", "lang.auto": "自动", "lang.zh": "中文", "lang.en": "English",
        "settings.title": "🔔 提醒音设置", "nav.title": "提醒音", "overlay.label": "DSH 提醒", "volume": "音量", "scope": "提醒范围", "scope.all": "所有会话", "scope.current": "仅当前会话",
        "repeat": "重复提醒", "repeat.off": "关", "repeat.10": "每10秒", "repeat.20": "每20秒", "repeat.30": "每30秒",
        "notify": "系统通知", "notify.hint": "浏览器通知（后台也弹）",
        "read": "朗读输出", "read.hint": "需配合“语音”音色：开启后，完成时把助手最后的回复念出来（较长时只念开头）", "failed.hint": "⚠️ 此提醒尚未经作者实测，可能不准确",
        "stall": "停滞检测", "stall.hint": "开启后才会触发上面第 5 类“卡住”提醒（判定依据不精确，实验性）", "stall.off": "关", "stall.1": "1分钟", "stall.2": "2分钟", "stall.5": "5分钟",
        "toast": "悬浮提示", "toast.hint": "显示悬浮提示（默认关，以听为主）",
        "rate": "语音语速", "rate.slow": "慢", "rate.normal": "标准", "rate.fast": "快",
        "dnd": "勿扰时段", "dnd.on": "开启", "dnd.to": "至",
        "preview": "试听", "upload": "上传", "sep": "：", "reset": "恢复默认设置", "reset.hint": "恢复全部选项为默认值（已上传的自定义音色保留）", "reset.confirm": "确定恢复全部选项为默认值？",
        "hint": "选“语音”会用朗读代替提示音（需浏览器支持语音合成）。", "stalled.detail": "长时间未进展",
      },
      en: {
        approval: "Needs approval", question: "Needs answer", done: "Output complete", failed: "Error", stalled: "Stalled", connected: "🔔 Alerts ready",
        "sound.ding": "Ding-dong", "sound.fault": "Low", "sound.tap": "Tap", "sound.alarm": "Alert", "sound.voice": "Voice", "sound.custom": "Custom", "sound.none": "Mute",
        "lang.label": "Language", "lang.auto": "Auto", "lang.zh": "中文", "lang.en": "English",
        "settings.title": "🔔 Alert sounds", "nav.title": "Alerts", "overlay.label": "DSH Alerts", "volume": "Volume", "scope": "Scope", "scope.all": "All sessions", "scope.current": "Current session only",
        "repeat": "Repeat", "repeat.off": "Off", "repeat.10": "Every 10s", "repeat.20": "Every 20s", "repeat.30": "Every 30s",
        "notify": "System notification", "notify.hint": "Browser notification (also in background)",
        "read": "Read-aloud", "read.hint": "Works with the “Voice” sound: on completion, speak the assistant's final reply (truncated if long)", "failed.hint": "⚠️ Not yet tested by the author — may be inaccurate",
        "stall": "Stall detection", "stall.hint": "Only when on does the 5th “Stalled” alert fire (heuristic; experimental)", "stall.off": "Off", "stall.1": "1 min", "stall.2": "2 min", "stall.5": "5 min",
        "toast": "Toast", "toast.hint": "Show on-screen toast (off by default; listen-first)",
        "rate": "Voice rate", "rate.slow": "Slow", "rate.normal": "Normal", "rate.fast": "Fast",
        "dnd": "Do-not-disturb", "dnd.on": "On", "dnd.to": "to",
        "preview": "Preview", "upload": "Upload", "sep": ": ", "reset": "Restore defaults", "reset.hint": "Reset all options to defaults (uploaded custom sounds are kept)", "reset.confirm": "Restore all options to defaults?",
        "hint": "Choosing “Voice” speaks instead of a tone (requires browser speech synthesis).", "stalled.detail": "No progress for a while",
      },
    };
    function resolveLang() {
      const pref = settings.lang || "auto";
      if (pref === "zh" || pref === "en") return pref;
      let code = "";
      try { code = (navigator && navigator.language) || ""; } catch (e) {}
      return /^zh/i.test(code) ? "zh" : "en";
    }
    function t(key) {
      const lang = resolveLang();
      const d = I18N[lang] || I18N.zh;
      return d[key] !== undefined ? d[key] : (I18N.zh[key] !== undefined ? I18N.zh[key] : key);
    }

    let audioCtx = null;
    let master = null;
    function ensureCtx() {
      if (typeof window === "undefined") return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!audioCtx) {
        try {
          audioCtx = new AC();
          master = audioCtx.createGain();
          master.connect(audioCtx.destination);
        } catch (e) { return null; }
      }
      if (audioCtx.state === "suspended") { try { audioCtx.resume(); } catch (e) {} }
      return audioCtx;
    }
    // ---- 播放队列：同一时刻的多条提醒串行播放，避免互相打断/只出尾音 ----
    const playQueue = [];
    let playingNow = false;
    function enqueuePlay(start) {
      playQueue.push(start);
      if (playQueue.length > 8) playQueue.shift(); // 极端堆积时丢弃最早排队的
      drainPlay();
    }
    function drainPlay() {
      if (playingNow) return;
      const start = playQueue.shift();
      if (!start) return;
      playingNow = true;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        playingNow = false;
        drainPlay();
      };
      try { start(release); } catch (e) { release(); }
    }
    function later(fn, ms) {
      if (typeof window !== "undefined" && typeof window.setTimeout === "function") { window.setTimeout(fn, ms); return true; }
      return false;
    }
    function patternMs(pattern) {
      let end = 0;
      for (const n of pattern.notes) end = Math.max(end, n.at + n.d + 0.06);
      return end * 1000;
    }
    // 立即排程一个音型（不排队；供 playPattern 与语音失败兜底共用）。
    function schedulePatternNow(pattern, done) {
      let finished = false;
      const finish = () => { if (finished) return; finished = true; if (done) done(); };
      const ac = ensureCtx();
      if (!ac || !master) { finish(); return; }
      let fired = false;
      const schedule = () => {
        if (fired) return;
        fired = true;
        if (!audioCtx || audioCtx !== ac || !master) { finish(); return; }
        const vol = Math.min(2, Math.max(0, settings.volume));
        const base = ac.currentTime + 0.06; // 排程基准（留启动余量）
        const warmup = 0.2;                 // 静音预热：先喂一段音频把输出设备唤醒
        master.gain.setValueAtTime(vol, base);
        try {
          const wg = ac.createGain();
          wg.gain.value = 0;
          const wo = ac.createOscillator();
          wo.frequency.value = 440;
          wo.connect(wg);
          wg.connect(master);
          wo.start(base);
          wo.stop(base + warmup);
        } catch (e) { /* ignore */ }
        const start = base + warmup;
        for (const n of pattern.notes) {
          const osc = ac.createOscillator();
          const g = ac.createGain();
          osc.type = n.t;
          osc.frequency.value = n.f;
          const at = start + n.at;
          g.gain.setValueAtTime(0, at);
          g.gain.linearRampToValueAtTime(n.g, at + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, at + n.d);
          osc.connect(g);
          g.connect(master);
          osc.start(at);
          osc.stop(at + n.d + 0.05);
        }
        // 释放排在“实际排程之后”：context 晚启动时也按真实时长放行下一条，
        // 否则下一条会在本条还没播完时就插进来（互相重叠）。
        if (!later(finish, (warmup * 1000) + patternMs(pattern) + 80)) finish();
      };
      // resume() 是异步的：等它 resolve 再排程，否则 context 尚未运行时
      // 前面几个音符会被丢弃（表现为“只播尾音”）。
      if (ac.state === "running") schedule();
      else {
        try { ac.resume().then(schedule, schedule); } catch (e) { schedule(); }
        // 兜底：context 起不来（例如无用户手势）时不要卡死整个队列。
        later(() => { if (!fired) { fired = true; finish(); } }, 1200);
      }
    }
    function playPattern(sound) {
      const pattern = PATTERNS[sound];
      if (!pattern) return;
      enqueuePlay((release) => schedulePatternNow(pattern, release));
    }
    // 语音朗读。浏览器 TTS 会偶发“吞掉 utterance / 不触发 onstart”，
    // 因此加 1 秒看门狗：没真正开始就改播该类提示音兜底，保证一定有声音。
    function speak(text, fallbackSound) {
      enqueuePlay((release) => {
        let started = false;
        let released = false;
        let fellBack = false;
        const done = () => { if (released) return; released = true; release(); };
        const fallback = () => {
          // 防重入：看门狗触发后 cancel() 往往会再触发 onerror，
          // 不设标志会把兜底音播两次。
          if (started || released || fellBack) return;
          fellBack = true;
          try { if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
          const pattern = PATTERNS[fallbackSound];
          if (pattern) schedulePatternNow(pattern, done); else done();
        };
        try {
          if (typeof window === "undefined" || !window.speechSynthesis || !window.SpeechSynthesisUtterance) { fallback(); return; }
          const synth = window.speechSynthesis;
          const u = new window.SpeechSynthesisUtterance(text);
          u.lang = resolveLang() === "en" ? "en-US" : "zh-CN";
          u.volume = Math.min(1, Math.max(0, settings.volume));
          u.rate = Math.min(2, Math.max(0.5, settings.voiceRate || 1));
          u.onstart = () => { started = true; };
          u.onend = done;
          u.onerror = () => { if (started) done(); else fallback(); };
          // 只在真的还在朗读时才 cancel：无条件 cancel 会把新句开头一起吞掉。
          if (synth.speaking || synth.pending) { try { synth.cancel(); } catch (e) {} }
          const go = () => { try { synth.speak(u); } catch (e) { fallback(); } };
          if (!later(go, 60)) go();
          // 看门狗：1 秒内没有 onstart → 判定 TTS 失败，改播提示音。
          later(() => { if (!started) fallback(); }, 1000);
          // 总兜底：onend 未触发时也不卡住队列。
          const capMs = Math.max(4000, Math.min(20000, (text ? text.length : 0) * 150));
          later(done, capMs);
        } catch (e) { fallback(); }
      });
    }
    function clip(text, max) {
      if (!text) return "";
      return text.length <= max ? text : text.slice(0, max - 1) + "…";
    }
    function inDnd() {
      if (!settings.dndEnabled) return false;
      const h = new Date().getHours();
      const start = settings.dndStart, end = settings.dndEnd;
      if (start <= end) return h >= start && h < end;
      return h >= start || h < end; // 跨天（如 22-8）
    }
    function playCustom(kind) {
      const url = customAudio[kind];
      if (!url) return;
      enqueuePlay((release) => {
        try {
          if (typeof Audio === "undefined") { release(); return; }
          const a = new Audio(url);
          a.volume = Math.min(1, Math.max(0, settings.volume));
          a.onended = release;
          a.onerror = release;
          a.play().catch(() => release());
          later(release, 20000); // 兜底
        } catch (e) { release(); }
      });
    }
    function uploadCustomAudio(kind, file) {
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) return; // 2MB 上限
      const reader = new FileReader();
      reader.onload = () => {
        customAudio[kind] = String(reader.result);
        persistCustomAudio();
        playType(kind);
      };
      reader.onerror = () => {};
      reader.readAsDataURL(file);
    }
    function playType(kind, detail) {
      const cfg = settings.types && settings.types[kind];
      if (!cfg || !cfg.enabled) return;
      if (cfg.sound === "none") return;
      if (cfg.sound === "voice") speak(t(kind) + (detail ? t("sep") + clip(detail, settings.readOutput ? 400 : 120) : ""), VOICE_FALLBACK[kind] || "ding");
      else if (cfg.sound === "custom") playCustom(kind);
      else playPattern(cfg.sound);
    }
    function requestNotifyPermission() {
      try {
        if (typeof window === "undefined" || !("Notification" in window)) return Promise.resolve(null);
        if (window.Notification.permission === "granted") return Promise.resolve("granted");
        return window.Notification.requestPermission();
      } catch (e) { return Promise.resolve(null); }
    }
    function notify(kind, detail) {
      try {
        if (!settings.notifyEnabled) return;
        if (typeof window === "undefined" || !("Notification" in window)) return;
        if (window.Notification.permission !== "granted") return;
        const title = t(kind) || "dsh-alert-sound";
        const body = detail ? clip(detail, 120) : "";
        new window.Notification(title, { body: body || undefined });
      } catch (e) { /* ignore */ }
    }

    // ================= apply =================
    function apply(ctx) {
      // rc2 的浏览器 Cordis 树里没有 `timer` 服务（见上面的 inject 注释），
      // 因此自己持有原生定时器并挂到插件 fiber 上，插件卸载时统一清理。
      // 与 cordis 自带 `ctx.timeout` 语义对齐：一次性定时器**触发时自释放**，不在 fiber 上留残项；
      // 返回值既是 disposer，也可当取消句柄用（幂等）。fiber 已卸载时不再排程（返回空 disposer）。
      const ownTimeout = (fn, ms) => {
        let dispose = () => {};
        try {
          dispose = ctx.effect(() => {
            const id = window.setTimeout(() => {
              try { dispose(); } catch (e) {}
              fn();
            }, ms);
            return () => { try { window.clearTimeout(id); } catch (e) {} };
          });
        } catch (e) { return () => {}; }
        return dispose;
      };
      const ownInterval = (fn, ms) => {
        try {
          return ctx.effect(() => {
            const id = window.setInterval(fn, ms);
            return () => { try { window.clearInterval(id); } catch (e) {} };
          });
        } catch (e) { return () => {}; }
      };

      // ---- toast store ----
      // `seq` identifies one show. The Host's Toast restarts its cycle only when
      // the component remounts, so every emit gets a fresh key; `dismiss(seq)`
      // ignores a late completion report from a show that was already replaced.
      let current = null;
      let currentSeq = 0;
      const subs = new Set();
      let dismissTimer = null;
      function publish() { subs.forEach(fn => { try { fn(); } catch (e) {} }); }
      function dismiss(seq) {
        if (!current || current.seq !== seq) return;
        current = null;
        publish();
      }
      function emit(kind) {
        if (dismissTimer) { dismissTimer(); dismissTimer = null; }
        // Nothing renders while the banner is switched off (the default), so a
        // message parked here would surface — stale — the moment the switch is
        // turned on.
        if (!kind || !settings.showToast) { current = null; publish(); return; }
        currentSeq += 1;
        const seq = currentSeq;
        current = { kind: kind, seq: seq };
        publish();
        // Backstop on every path. The Host Toast normally reports the end of its
        // hold + fade through `onDone`, but the message must also be dropped when
        // that callback never runs: the preference is turned off mid-show, or the
        // banner fails to mount.
        dismissTimer = ownTimeout(() => { dismiss(seq); dismissTimer = null; }, TOAST_MS);
      }
      function subscribe(fn) {
        subs.add(fn);
        try { fn(); } catch (e) {}
        return () => subs.delete(fn);
      }
      // 一次提醒 = 声音/语音 + 系统通知 + 悬浮提示（勿扰时段则全部静音）
      // detail 可以是字符串，也可以是 thunk：正文（助手最后回复）要建 conversation binding 并折叠
      // 该会话整段事件窗口，所以只在**真会用到它**时才求值——即"该类音色是语音"或"开着系统通知"。
      function alert(kind, detail) {
        if (inDnd()) return;
        let text = detail;
        if (typeof detail === "function") {
          const cfg = settings.types && settings.types[kind];
          const needed = !!(cfg && cfg.enabled && cfg.sound === "voice") || !!settings.notifyEnabled;
          text = "";
          if (needed) { try { text = detail(); } catch (e) { text = ""; } }
        }
        try { playType(kind, text); } catch (e) {}
        try { notify(kind, text); } catch (e) {}
        emit(kind);
      }

      // ---- detection: session-list edges ----
      const prev = new Map();
      const runs = new Map();
      const settling = new Set();
      const lastFire = new Map();
      // 只在第一次发现"宿主太旧"时告警一次，避免刷屏。
      let warnedNoSessionStatus = false;
      // Skip a repeat of the same kind for a session within 1.5s (anti-race).
      function shouldFire(id, kind) {
        const now = Date.now();
        const last = lastFire.get(id);
        if (last && last.kind === kind && now - last.at < 1500) return false;
        lastFire.set(id, { kind, at: now });
        return true;
      }
      // DSH 0.2.0-rc.2 owns the running, pending-interaction and completion facts in
      // ctx.uiSession.sessionStatus — a HostObservable<Map<SessionId, SessionStatus>>
      // whose SessionStatus is { running, pendingInteraction, completionUnread }.
      // The 0.1.2-era uiSession.pendingInteractions observable no longer exists.
      function statusOf(id) {
        const ui = ctx.get("uiSession");
        if (!ui || !ui.sessionStatus) return undefined;
        try {
          const m = ui.sessionStatus.getSnapshot();
          return m ? m.get(id) : undefined;
        } catch (e) { return undefined; }
      }
      // The detail rides the domain object itself (approval: toolName/reason;
      // question & plan-review: questions[]).
      function pendingOf(id) {
        const st = statusOf(id);
        return st ? st.pendingInteraction : undefined;
      }
      // Map a pending interaction to a notification kind; plan-review reads as a question.
      // 只覆盖 rc2 的两个 pending 领域（ui-approval 的 'approval'、ui-user-questions 的
      // 'question'/'plan-review'）；将来内核新增第三个领域，需要在这里显式映射。
      function pendingKindOf(id) {
        const p = pendingOf(id);
        if (!p || typeof p.kind !== "string") return undefined;
        return p.kind === "approval" ? "approval" : "question";
      }
      // Authoritative running state is sessionStatus.running; a list row's `running`
      // is a display fallback only (see SessionSummary).
      function runningOf(id, fallback) {
        const st = statusOf(id);
        return st && typeof st.running === "boolean" ? st.running : !!fallback;
      }
      // 当前会话 = 主区域正持有引用的那个。rc2 的 SessionListState 已无 current，
      // 该事实改为行上的 retainedBy.mainView 计数（旧快照的 list.current 不再兜底）。
      function isCurrentSession(row) {
        return !!(row && row.retainedBy && (row.retainedBy.mainView || 0) > 0);
      }
      function seed(list) {
        const byId = (list && list.byId) || {};
        for (const id of Object.keys(byId)) {
          const s = byId[id] || {};
          prev.set(id, { running: runningOf(id, s.running), pending: pendingKindOf(id) });
        }
      }
      // 只刷新“挂起”基线，绝不碰 running —— 否则在某一轮运行途中执行会把
      // prev.running 记成 true，让这一轮的完成/失败被漏掉。
      function reseedPending(list) {
        const byId = (list && list.byId) || {};
        for (const id of Object.keys(byId)) {
          const p = prev.get(id);
          if (p) p.pending = pendingKindOf(id);
        }
      }
      function detailOf(id) {
        const s = ctx.get("sessions");
        try {
          const b = s && s.binding && s.binding(id);
          return b && b.session ? b.session.getSnapshot() || null : null;
        } catch (e) { return null; }
      }
      // 提取审批/提问的具体内容（toolName/reason、问题文本），供语音播报。
      // 详情现在直接来自 pending interaction 本身（DSH 0.1.2+）。
      function pendingDetailOf(id) {
        const out = { approval: null, question: null };
        try {
          const p = pendingOf(id);
          if (!p) return out;
          if (p.kind === "approval") {
            const toolName = typeof p.toolName === "string" ? p.toolName : "";
            const reason = typeof p.reason === "string" ? p.reason : "";
            out.approval = reason ? toolName + t("sep") + reason : toolName;
          } else {
            const qs = p.questions;
            if (Array.isArray(qs) && qs.length && qs[0] && typeof qs[0].question === "string") out.question = qs[0].question;
          }
        } catch (e) {}
        return out;
      }
      // 最后一条助手文本：会话快照没有 `chat`，改从 uiConversation 的 chat target 取。
      // rc2 的 ctx.uiConversation.binding(id).target("chat") 与 0.2.0 一致（UiConversation
      // 服务的公开面），ChatSnapshot 仍是 { order, nodes } + legacy 兼容投影。
      function finalTextOf(id) {
        try {
          const uiConv = ctx.get("uiConversation");
          if (!uiConv || !uiConv.binding) return "";
          const binding = uiConv.binding(id);
          if (!binding || !binding.target) return "";
          const src = binding.target("chat");
          if (!src || !src.getSnapshot) return "";
          // chat target 需被订阅才会激活；仅在开启“朗读输出”时激活，
          // 避免为所有会话常驻组装会话视图。
          if (settings.readOutput && src.subscribe) {
            try { const off = src.subscribe(() => {}); if (typeof off === "function") off(); } catch (e) {}
          }
          const chat = src.getSnapshot();
          if (!chat) return "";
          let nodes = null;
          if (Array.isArray(chat.order) && chat.nodes && typeof chat.nodes.get === "function") {
            nodes = [];
            for (const key of chat.order) { const n = chat.nodes.get(key); if (n) nodes.push(n); }
          } else if (chat.legacy && Array.isArray(chat.legacy.nodes)) nodes = chat.legacy.nodes;
          if (!nodes) return "";
          for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            if (!n) continue;
            // rc2 的 chat target 把助手节点建成 kind: "assistant-step"，正文在 node.data.blocks；
            // kind: "assistant" + node.blocks 是旧的事件层（trajectory）投影。两种都认，向后兼容。
            if (n.kind !== "assistant-step" && n.kind !== "assistant") continue;
            const blocks = Array.isArray(n.blocks)
              ? n.blocks
              : (n.data && Array.isArray(n.data.blocks) ? n.data.blocks : null);
            if (blocks) {
              const text = blocks
                .filter(b => b && b.kind === "text" && typeof b.text === "string")
                .map(b => b.text)
                .join("");
              if (text) return text;
            }
          }
        } catch (e) {}
        return "";
      }
      // 提取完成/失败时的详情。错误文本取 lastAgentError（快照里就有，便宜）；
      // 助手正文**不在这里取**（见 settleRun 里的 thunk），因为它要建 conversation binding。
      function completionDetail(id) {
        const out = { finalText: "", failMsg: "" };
        try {
          const snap = detailOf(id);
          if (snap && typeof snap.lastAgentError === "string" && snap.lastAgentError) out.failMsg = snap.lastAgentError;
        } catch (e) {}
        return out;
      }
      function armRun(id) {
        const snap = detailOf(id);
        runs.set(id, { agentErr: snap ? snap.lastAgentError || null : null });
      }
      function settleRun(id) {
        const run = runs.get(id);
        if (!run || settling.has(id)) return;
        runs.delete(id);
        settling.add(id);
        ownTimeout(() => {
          if (runs.has(id)) { settling.delete(id); return; }
          try {
            const snap = detailOf(id);
            // 会话快照里只有 lastAgentError，用它判定本轮是否新出错。
            const failed = !!(snap && snap.lastAgentError != null && snap.lastAgentError !== run.agentErr);
            const kind = failed ? "failed" : "done";
            if (shouldFire(id, kind)) {
              const cd = completionDetail(id);
              // 正文用 thunk 延迟取：取它要建 conversation binding 并折叠该会话整段事件窗口，
              // 只有真要念（语音）或要写进通知正文时才值得付这个代价。
              // 「朗读输出」是完成提醒正文的唯一开关：关着时不建 conversation binding，
              // 也不把回复正文交给语音/系统通知（README 的隐私表述以此为准）。
              alert(kind, kind === "failed" ? cd.failMsg : () => (settings.readOutput ? finalTextOf(id) : ""));
              if (kind === "failed") startRepeat(id, "failed", 3);
            }
          } finally {
            // 必须放 finally：alert 链上任何一步抛异常都不能让 id 永远留在 settling 里，
            // 否则该会话此后再也不响“完成”。
            settling.delete(id);
          }
        }, 250);
      }
      // ---- 阻断事件重复提醒：审批/提问挂着时每 N 秒再响，直到处理；错误重复几次 ----
      const repeatTimers = new Map(); // id -> { disposer, kind, count, limit }
      function stopRepeat(id) {
        const rec = repeatTimers.get(id);
        if (rec) { rec.disposer(); repeatTimers.delete(id); }
      }
      function startRepeat(id, kind, limit) {
        const existing = repeatTimers.get(id);
        if (existing) {
          if (existing.kind === kind) return; // 已在重复同类型
          stopRepeat(id); // 类型变了，重启
        }
        const rawMs = settings.repeatMs || 0;
        if (rawMs <= 0) return; // 关闭重复（用户选“关”）——须在 clamp 之前判断
        const intervalMs = Math.max(3000, rawMs);
        const rec = { disposer: null, kind, count: 0, limit };
        const tick = () => {
          const sessions = ctx.get("sessions");
          if (!sessions || !sessions.list) { stopRepeat(id); return; }
          const pend = pendingKindOf(id);
          if (kind === "approval" || kind === "question") {
            // 挂在“审批/提问”直到处理掉
            if (pend !== kind) { stopRepeat(id); return; }
          } else {
            rec.count += 1;
            if (rec.count >= rec.limit) { stopRepeat(id); return; }
          }
          if (kind === "failed") {
            const cd = completionDetail(id);
            alert("failed", cd.failMsg);
          } else {
            const pd = pendingDetailOf(id);
            const d = kind === "question" ? pd.question : pd.approval;
            alert(kind, d);
          }
        };
        rec.disposer = ownInterval(tick, intervalMs);
        repeatTimers.set(id, rec);
      }
      function observe(list) {
        // 提醒范围：默认对所有会话提醒（多会话用户也能收到任何会话的审批/提问/出错/完成）；
        // 设置为“仅当前会话”时，只响用户正在看的那个。
        const byId = (list && list.byId) || {};
        const scope = (settings.scope) || "all";
        for (const id of Object.keys(byId)) {
          const s = byId[id] || {};
          const running = runningOf(id, s.running);
          const pending = pendingKindOf(id);
          // scope=current 只决定"发不发声"，基线照常记账 —— 否则会话重新可见时会拿陈旧基线比边沿，漏掉完成。
          const p = prev.get(id);
          if (p && (scope !== "current" || isCurrentSession(s))) {
            if (pending !== p.pending) {
              if (pending === "approval") {
                const pd = pendingDetailOf(id);
                if (shouldFire(id, "approval")) { alert("approval", pd.approval); startRepeat(id, "approval", Infinity); }
              } else if (pending === "question") {
                const pd = pendingDetailOf(id);
                if (shouldFire(id, "question")) { alert("question", pd.question); startRepeat(id, "question", Infinity); }
              } else {
                stopRepeat(id);
              }
            }
            if (p.running && !running) settleRun(id);
            else if (!p.running && running) armRun(id);
          }
          prev.set(id, { running, pending });
        }
        // 清理已离开列表的会话（settling 也要清：否则该 id 再出现时 settleRun 会永远早退）
        for (const id2 of prev.keys()) {
          if (!Object.prototype.hasOwnProperty.call(byId, id2)) { prev.delete(id2); runs.delete(id2); settling.delete(id2); stopRepeat(id2); }
        }
      }
      // 会话列表订阅必须等服务就绪后再建立：若在 apply 时 sessions 尚未就绪，
      // 旧的 ctx.get 写法会永久返回空 disposer，导致 running 真→假（完成/失败）
      // 这条路径从未被订阅——这正是“完成不响”的根因。
      ctx.inject(["sessions"], (scope) => {
        scope.effect(() => {
          const sessions = scope.get("sessions");
          if (!sessions || !sessions.list) return () => {};
          const list = sessions.list;
          seed(list.getSnapshot());
          return list.subscribe(() => observe(list.getSnapshot()));
        });
      });
      // 挂起交互（审批/提问）与运行状态都在 uiSession.sessionStatus 上发布，
      // 它的变化不会再触发会话列表订阅，必须单独订阅。
      ctx.inject(["uiSession"], (scope) => {
        scope.effect(() => {
          const ui = scope.get("uiSession");
          if (!ui || !ui.sessionStatus || !ui.sessionStatus.subscribe) {
            // 老宿主（< 0.2.0-rc.2）没有 sessionStatus，审批/提问**不会**响。
            // engines.dsh 是声明式的、内核不强制校验，所以这里必须把"静默失效"变成可诊断。
            if (ui && !warnedNoSessionStatus) {
              warnedNoSessionStatus = true;
              try {
                console.warn("[dsh-alert-sound] uiSession.sessionStatus is unavailable (DSH >= 0.2.0-rc.2 required): approval/question alerts are disabled");
              } catch (e) {}
            }
            return () => {};
          }
          // uiSession 就绪后只刷新“挂起”基线（不动 running）：否则若 seed 早于
          // uiSession 就绪（prev.pending 记为 undefined），加载前就已挂起的
          // 审批/提问会在下一次 observe 时被误判为“新事件”而响。
          const sessions0 = scope.get("sessions");
          const list0 = sessions0 && sessions0.list;
          if (list0) reseedPending(list0.getSnapshot());
          return ui.sessionStatus.subscribe(() => {
            const sessions = scope.get("sessions");
            const list = sessions && sessions.list;
            if (list) observe(list.getSnapshot());
          });
        });
      });

      // ---- 卡住检测：running 会话的 updatedAt 太久没更新 → 提醒 ----
      const stallAlerted = new Map(); // id -> 上次提醒时间戳
      ownInterval(() => {
        const sessions = ctx.get("sessions");
        const list = sessions && sessions.list;
        if (!list) return;
        const snap = list.getSnapshot();
        const byId = (snap && snap.byId) || {};
        const scope = (settings.scope) || "all";
        const stallMs = settings.stallMs || 0;
        const repeatMs = Math.max(3000, (settings.repeatMs || 20000));
        const now = Date.now();
        for (const id of Object.keys(byId)) {
          const s = byId[id] || {};
          if (scope === "current" && !isCurrentSession(s)) continue;
          if (!runningOf(id, s.running)) { stallAlerted.delete(id); continue; }
          const at = s.updatedAt;
          if (typeof at !== "number" || !stallMs) continue;
          if (now - at > stallMs) {
            const last = stallAlerted.get(id) || 0;
            if (now - last >= repeatMs) {
              alert("stalled", t("stalled.detail"));
              stallAlerted.set(id, now);
            }
          } else {
            stallAlerted.delete(id);
          }
        }
      }, 5000);

      // ---- UI ----
      // Matches the Host's own settings grammar (dsh-client-ui-primitives
      // lib/settings-form): one stacked field per setting — 13px/500 label,
      // control underneath, 12px tertiary hint, 12px vertical padding, a 0.5px
      // separator between fields. Colours, radii and control heights come from
      // the theme tokens, so light/dark/contrast themes follow the shell.
      const T = {
        label: "var(--dsw-alias-label-primary)",
        label2: "var(--dsw-alias-label-secondary)",
        label3: "var(--dsw-alias-label-tertiary)",
        line2: "var(--dsw-alias-border-l2, rgba(128,128,128,0.18))",
        line3: "var(--dsw-alias-border-l3, rgba(128,128,128,0.26))",
        line4: "var(--dsw-alias-border-l4, rgba(128,128,128,0.34))",
        layer3: "var(--dsw-alias-bg-layer-3, transparent)",
        radiusMd: "var(--dsw-radius-md, 10px)",
        radiusSm: "var(--dsw-radius-sm, 6px)",
      };
      const fieldStyle = (first) => Object.assign(
        { display: "flex", flexDirection: "column", gap: "6px", padding: "12px 0" },
        first ? {} : { borderTop: "0.5px solid " + T.line2 }
      );
      const labelStyle = { fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: T.label };
      const hintStyle = { margin: 0, fontSize: 12, lineHeight: 1.5, color: T.label3 };
      const controlStyle = {
        height: 34,
        padding: "0 12px",
        border: "0.5px solid " + T.line4,
        borderRadius: T.radiusMd,
        background: T.layer3,
        font: "inherit",
        fontSize: 13,
        lineHeight: 1.5,
        color: T.label,
        // The Host's own settings selects are column-wide; keep ours compact.
        maxWidth: "200px",
      };
      const rangeStyle = Object.assign({}, controlStyle, { border: 0, background: "transparent", padding: 0, flex: "0 0 auto", width: "200px", accentColor: "var(--dsw-alias-brand-primary, currentColor)" });
      const rowStyle = { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" };
      const btnStyle = {
        appearance: "none",
        border: "0.5px solid " + T.line3,
        borderRadius: T.radiusSm,
        background: "transparent",
        color: "inherit",
        height: 28,
        padding: "0 10px",
        font: "inherit",
        fontSize: 12,
        lineHeight: "18px",
        cursor: "pointer",
      };
      const titleStyle = { margin: "0 0 4px", fontSize: 15, fontWeight: 600, lineHeight: 1.5, color: T.label };
      const footerStyle = { display: "flex", alignItems: "center", gap: "8px", paddingTop: "16px" };

      // The Host's own controls, when the shell shares them through its static
      // module table. Switch is a plain function component, but Button is a
      // forwardRef object — so neither may be detected with
      // `typeof === "function"`: that test silently skipped the Button and
      // always rendered the fallback below while still claiming the Host's
      // control. Having the module is the only condition that matters.
      function Toggle(props) {
        if (uiKit.Switch) {
          return react.createElement(uiKit.Switch, { checked: !!props.checked, onChange: props.onChange, label: props.label });
        }
        return react.createElement("input", { type: "checkbox", checked: !!props.checked, "aria-label": props.label, onChange: e => props.onChange(!!e.target.checked) });
      }
      function Action(props) {
        if (uiKit.Button) {
          return react.createElement(uiKit.Button, { variant: props.variant || "outline", size: "sm", onClick: props.onClick }, props.children);
        }
        return react.createElement("button", { type: "button", style: btnStyle, onClick: props.onClick }, props.children);
      }
      function Select(props) {
        return react.createElement("select", { value: props.value, style: Object.assign({}, controlStyle, props.style), onChange: props.onChange }, props.children);
      }
      function Field(props) {
        return react.createElement("div", { style: fieldStyle(props.first) },
          react.createElement("div", { style: labelStyle }, props.label),
          props.children,
          props.hint ? react.createElement("p", { style: hintStyle }, props.hint) : null
        );
      }

      function SettingsPanel(props) {
        const pair = react.useState(props.getSettings());
        const s = pair[0], setS = pair[1];
        react.useEffect(() => props.subscribeSettings(() => setS(props.getSettings())), []);
        function commit(next) { setS(next); props.setSettings(next); }
        function patchKind(kind, patch) {
          const ts = (s.types && s.types[kind]) || DEFAULT_TYPES[kind];
          commit(Object.assign({}, s, { types: Object.assign({}, s.types, { [kind]: Object.assign({}, ts, patch) }) }));
        }
        const hourOpts = () => Array.from({ length: 24 }, (_, h) => react.createElement("option", { key: h, value: String(h) }, String(h).padStart(2, "0") + ":00"));
        let fieldIndex = 0;
        const field = (key, label, control, hint) => react.createElement(Field, { key, first: fieldIndex++ === 0, label, hint }, control);
        const items = [];

        items.push(field("lang", t("lang.label"),
          react.createElement(Select, { value: s.lang || "auto", onChange: e => commit(Object.assign({}, s, { lang: e.target.value })) },
            react.createElement("option", { value: "auto" }, t("lang.auto")),
            react.createElement("option", { value: "zh" }, t("lang.zh")),
            react.createElement("option", { value: "en" }, t("lang.en")))));

        items.push(field("volume", t("volume"),
          react.createElement("div", { style: rowStyle },
            react.createElement("input", { type: "range", min: "0", max: "2", step: "0.05", value: s.volume, style: rangeStyle, onChange: e => commit(Object.assign({}, s, { volume: Number(e.target.value) })) }),
            react.createElement("span", { style: { fontSize: 13, color: T.label2, minWidth: "44px" } }, Math.round(s.volume * 100) + "%"))));

        items.push(field("scope", t("scope"),
          react.createElement(Select, { value: s.scope || "all", onChange: e => commit(Object.assign({}, s, { scope: e.target.value })) },
            react.createElement("option", { value: "all" }, t("scope.all")),
            react.createElement("option", { value: "current" }, t("scope.current")))));

        items.push(field("repeat", t("repeat"),
          react.createElement(Select, { value: String(s.repeatMs || 0), onChange: e => commit(Object.assign({}, s, { repeatMs: Number(e.target.value) })) },
            react.createElement("option", { value: "0" }, t("repeat.off")),
            react.createElement("option", { value: "10000" }, t("repeat.10")),
            react.createElement("option", { value: "20000" }, t("repeat.20")),
            react.createElement("option", { value: "30000" }, t("repeat.30")))));

        items.push(field("notify", t("notify"),
          react.createElement(Toggle, { checked: !!s.notifyEnabled, label: t("notify"), onChange: v => { commit(Object.assign({}, s, { notifyEnabled: v })); if (v) props.requestNotify(); } }),
          t("notify.hint")));

        items.push(field("read", t("read"),
          react.createElement(Toggle, { checked: !!s.readOutput, label: t("read"), onChange: v => commit(Object.assign({}, s, { readOutput: v })) }),
          t("read.hint")));

        items.push(field("stall", t("stall"),
          react.createElement(Select, { value: String(s.stallMs || 0), onChange: e => commit(Object.assign({}, s, { stallMs: Number(e.target.value) })) },
            react.createElement("option", { value: "0" }, t("stall.off")),
            react.createElement("option", { value: "60000" }, t("stall.1")),
            react.createElement("option", { value: "120000" }, t("stall.2")),
            react.createElement("option", { value: "300000" }, t("stall.5"))),
          t("stall.hint")));

        items.push(field("toast", t("toast"),
          react.createElement(Toggle, { checked: !!s.showToast, label: t("toast"), onChange: v => commit(Object.assign({}, s, { showToast: v })) }),
          t("toast.hint")));

        items.push(field("rate", t("rate"),
          react.createElement(Select, { value: String(s.voiceRate || 1), onChange: e => commit(Object.assign({}, s, { voiceRate: Number(e.target.value) })) },
            react.createElement("option", { value: "0.7" }, t("rate.slow")),
            react.createElement("option", { value: "1" }, t("rate.normal")),
            react.createElement("option", { value: "1.3" }, t("rate.fast")))));

        items.push(field("dnd", t("dnd"),
          react.createElement("div", { style: rowStyle },
            react.createElement(Toggle, { checked: !!s.dndEnabled, label: t("dnd"), onChange: v => commit(Object.assign({}, s, { dndEnabled: v })) }),
            react.createElement("span", { style: hintStyle }, t("dnd.on")),
            react.createElement(Select, { value: String(s.dndStart), style: { width: "96px" }, onChange: e => commit(Object.assign({}, s, { dndStart: Number(e.target.value) })) }, hourOpts()),
            react.createElement("span", { style: hintStyle }, t("dnd.to")),
            react.createElement(Select, { value: String(s.dndEnd), style: { width: "96px" }, onChange: e => commit(Object.assign({}, s, { dndEnd: Number(e.target.value) })) }, hourOpts()))));

        // One field per notification kind, in the same order as the host's own rows.
        KINDS.forEach(kind => {
          const ts = (s.types && s.types[kind]) || DEFAULT_TYPES[kind];
          const opts = SOUND_IDS.map(sid => react.createElement("option", { key: sid, value: sid }, t("sound." + sid)));
          const controls = [
            react.createElement(Toggle, { key: "toggle", checked: !!ts.enabled, label: t(kind), onChange: v => patchKind(kind, { enabled: v }) }),
            react.createElement(Select, { key: "sound", value: ts.sound, style: { minWidth: "120px" }, onChange: e => patchKind(kind, { sound: e.target.value }) }, opts),
            react.createElement(Action, { key: "preview", onClick: () => props.play(kind) }, t("preview")),
          ];
          if (ts.sound === "custom") {
            controls.push(react.createElement("label", { key: "upload", style: Object.assign({}, btnStyle, { display: "inline-flex", alignItems: "center" }) },
              react.createElement("input", { type: "file", accept: "audio/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; props.uploadCustom(kind, f); e.target.value = ""; } }),
              t("upload")));
          }
          items.push(field("kind." + kind, t(kind), react.createElement("div", { style: rowStyle }, controls), kind === "failed" ? t("failed.hint") : null));
        });

        return react.createElement("div", { style: { display: "flex", flexDirection: "column" } },
          react.createElement("div", { style: titleStyle }, t("settings.title")),
          items,
          react.createElement("div", { style: footerStyle },
            react.createElement(Action, { onClick: () => { if (typeof window === "undefined" || typeof window.confirm !== "function" || window.confirm(t("reset.confirm"))) commit(deepMerge(DEFAULTS, {})); } }, t("reset")),
            react.createElement("span", { style: hintStyle }, t("reset.hint"))),
          react.createElement("p", { style: Object.assign({}, hintStyle, { paddingTop: "12px" }) }, t("hint"))
        );
      }

      function AlertToast(props) {
        const pair = react.useState(props.getCurrent());
        const msg = pair[0], setMsg = pair[1];
        react.useEffect(() => props.subscribe(() => setMsg(props.getCurrent())), []);
        if (!msg) return null;
        if (!settings.showToast) return null;
        const s = TOAST_MAP[msg.kind] || TOAST_MAP.connected;
        const label = t(msg.kind);
        // One dot carries the kind in the theme's own state colour.
        const dot = react.createElement("span", {
          style: { flex: "none", display: "block", width: "8px", height: "8px", borderRadius: "50%", background: s.accent },
        });
        // The Host's own Toast: fixed top-centre, dark in both themes, slid in, held
        // for `holdMs`, then faded over a fixed 1s and reported through `onDone`.
        // It owns the timing. `key` forces a fresh mount per show so a replaced
        // banner restarts its cycle instead of inheriting the previous fade.
        if (uiKit.Toast) {
          return react.createElement(uiKit.Toast, {
            key: "dsh-alert-" + msg.seq,
            text: label,
            icon: dot,
            holdMs: TOAST_HOLD_MS,
            onDone: () => props.dismiss(msg.seq),
          });
        }
        // Host without the primitive: the token-styled banner, anchored at the
        // bottom so it cannot sit on the shell's own top-centre toast lane.
        return react.createElement("div", {
          role: "alert",
          style: {
            position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)",
            zIndex: 2147483000, pointerEvents: "none",
            display: "flex", alignItems: "center", gap: "10px",
            width: "max-content", maxWidth: "min(640px, calc(100vw - 48px))",
            padding: "12px 16px", borderRadius: "var(--dsw-radius-lg, 12px)",
            background: "var(--dsw-alias-toast-bg, rgba(24,28,38,0.94))",
            color: "var(--dsw-alias-toast-label, #ffffff)",
            fontSize: 14, lineHeight: "22px", fontWeight: 500,
            boxShadow: "var(--dsw-shadow-lv3, 0 8px 30px rgba(0,0,0,.28))",
          },
        },
          dot,
          react.createElement("span", { style: { minWidth: 0 } }, label)
        );
      }

      // ---- audio unlock (browser autoplay) ----
      ctx.effect(() => {
        if (typeof window === "undefined") return () => {};
        // 预热语音合成：提前触发浏览器加载语音列表（否则首次朗读易被丢）。
        try { if (window.speechSynthesis && window.speechSynthesis.getVoices) window.speechSynthesis.getVoices(); } catch (e) {}
        const unlock = () => {
          const ac = ensureCtx();
          if (ac && ac.state === "suspended") { try { ac.resume(); } catch (e) {} }
          try { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); } catch (e) {}
        };
        try { window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock); } catch (e) {}
        return () => { try { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); } catch (e) {} };
      });

      // ---- slots ----
      // 同样用 ctx.inject 等服务就绪：ctx.get + 早退在服务晚到时会永久不注册。
      ctx.inject(["slots"], (scope) => {
        const slots = scope.get("slots");
        if (!slots) return;
        scope.effect(() => slots.inject("settings.section", () => slots.register(
          { name: "settings.section", id: "dsh-alert", order: 45, label: () => t("nav.title") },
          props => react.createElement(SettingsPanel, Object.assign({}, props, { getSettings: () => settings, setSettings: persistSettings, subscribeSettings, play: playType, requestNotify: requestNotifyPermission, uploadCustom: uploadCustomAudio }))
        )));
        scope.effect(() => slots.inject("shell.overlay", () => slots.register(
          { name: "shell.overlay", id: "dsh-alert-toast", order: 50, label: () => t("overlay.label") },
          () => react.createElement(AlertToast, { subscribe, getCurrent: () => current, dismiss })
        )));
      });

      ownTimeout(() => emit("connected"), 600);
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = name;
    return module.exports;
  },
});

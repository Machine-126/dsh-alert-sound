// dsh-alert-sound — Client half (browser bundle).
// Hand-written in the harness module-loader format; `require` answers the
// platform externals (react), everything else is inlined.
//
// Watches the session list (running edges) and ctx.uiSession.pendingInteractions
// (approval / question edges) and raises five notification kinds — approval /
// question / completed / failed / stalled — each playing a distinct synthesized
// tone, a spoken utterance or an uploaded clip, with a Settings section for
// per-kind sound+enable and a master volume.
window.__ModuleLoader__.load({
  id: "@machine-126/dsh-alert-sound",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");

    const name = "@machine-126/dsh-alert-sound";
    const inject = ["timer"];

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
    // Toast background colors; the display text comes from t( kind ).
    const TOAST_MAP = {
      approval: { bg: "#f59e0b" },
      question: { bg: "#7c3aed" },
      done: { bg: "#16a34a" },
      failed: { bg: "#dc2626" },
      stalled: { bg: "#f97316" },
      connected: { bg: "#2563eb" },
    };
    const KINDS = ["approval", "question", "done", "failed", "stalled"];

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
    function playPattern(sound) {
      const pattern = PATTERNS[sound];
      if (!pattern) return;
      enqueuePlay((release) => {
        const ac = ensureCtx();
        if (!ac || !master) { release(); return; }
        let fired = false;
        const schedule = () => {
          if (fired) return;
          fired = true;
          if (!audioCtx || audioCtx !== ac || !master) { release(); return; }
          const vol = Math.min(2, Math.max(0, settings.volume));
          const start = ac.currentTime + 0.06; // 留启动余量，避免开头音符被丢
          master.gain.setValueAtTime(vol, start);
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
          if (!later(release, patternMs(pattern) + 80)) release();
        };
        // resume() 是异步的：等它 resolve 再排程，否则 context 尚未运行时
        // 前面几个音符会被丢弃（表现为“只播尾音”）。
        if (ac.state === "running") schedule();
        else {
          try { ac.resume().then(schedule, schedule); } catch (e) { schedule(); }
          // 兜底：context 起不来（例如无用户手势）时不要卡死整个队列。
          later(() => { if (!fired) { fired = true; release(); } }, 1200);
        }
      });
    }
    function speak(text) {
      enqueuePlay((release) => {
        try {
          if (typeof window === "undefined" || !window.speechSynthesis || !window.SpeechSynthesisUtterance) { release(); return; }
          const synth = window.speechSynthesis;
          const u = new window.SpeechSynthesisUtterance(text);
          u.lang = resolveLang() === "en" ? "en-US" : "zh-CN";
          u.volume = Math.min(1, Math.max(0, settings.volume));
          u.rate = Math.min(2, Math.max(0.5, settings.voiceRate || 1));
          u.onend = release;
          u.onerror = release;
          // 只在真的还在朗读时才 cancel：无条件 cancel 会把新句开头一起吞掉。
          if (synth.speaking || synth.pending) { try { synth.cancel(); } catch (e) {} }
          const go = () => { try { synth.speak(u); } catch (e) { release(); } };
          if (!later(go, 60)) go();
          const capMs = Math.max(4000, Math.min(20000, (text ? text.length : 0) * 150));
          later(release, capMs); // 兜底：onend 未触发时不卡住队列
        } catch (e) { release(); }
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
      if (cfg.sound === "voice") speak(t(kind) + (detail ? t("sep") + clip(detail, settings.readOutput ? 400 : 120) : ""));
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
      // ---- toast store ----
      let current = null;
      const subs = new Set();
      let dismissTimer = null;
      function emit(kind) {
        current = kind;
        if (dismissTimer) { dismissTimer(); dismissTimer = null; }
        subs.forEach(fn => { try { fn(); } catch (e) {} });
        if (kind) {
          dismissTimer = ctx.timeout(() => {
            if (current === kind) { current = null; subs.forEach(fn => { try { fn(); } catch (e) {} }); dismissTimer = null; }
          }, 3600);
        }
      }
      function subscribe(fn) {
        subs.add(fn);
        try { fn(); } catch (e) {}
        return () => subs.delete(fn);
      }
      // 一次提醒 = 声音/语音 + 系统通知 + 悬浮提示（勿扰时段则全部静音）
      function alert(kind, detail) {
        if (inDnd()) return;
        try { playType(kind, detail); } catch (e) {}
        try { notify(kind, detail); } catch (e) {}
        emit(kind);
      }

      // ---- detection: session-list edges ----
      const prev = new Map();
      const runs = new Map();
      const settling = new Set();
      const lastFire = new Map();
      // Skip a repeat of the same kind for a session within 1.5s (anti-race).
      function shouldFire(id, kind) {
        const now = Date.now();
        const last = lastFire.get(id);
        if (last && last.kind === kind && now - last.at < 1500) return false;
        lastFire.set(id, { kind, at: now });
        return true;
      }
      // DSH 0.1.2+ moved pending interactions OFF the Session list summary and
      // the Session snapshot: they now live in ctx.uiSession.pendingInteractions
      // (a Map<SessionId, PendingInteraction>), and each entry carries the detail
      // (approval: toolName/reason; question: questions[]). Read them from there.
      function pendingOf(id) {
        const ui = ctx.get("uiSession");
        if (!ui || !ui.pendingInteractions) return undefined;
        try {
          const m = ui.pendingInteractions.getSnapshot();
          return m ? m.get(id) : undefined;
        } catch (e) { return undefined; }
      }
      // Map a pending interaction to a notification kind; plan-review reads as a question.
      function pendingKindOf(id) {
        const p = pendingOf(id);
        if (!p || typeof p.kind !== "string") return undefined;
        return p.kind === "approval" ? "approval" : "question";
      }
      function seed(list) {
        const byId = (list && list.byId) || {};
        for (const id of Object.keys(byId)) {
          const s = byId[id] || {};
          prev.set(id, { running: !!s.running, pending: pendingKindOf(id) });
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
      // 最后一条助手文本：DSH 0.1.2+ 的 Session 快照已无 `chat`，
      // 改从会话视图（uiConversation 的 chat target）取。
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
          if (chat.legacy && Array.isArray(chat.legacy.nodes)) nodes = chat.legacy.nodes;
          else if (Array.isArray(chat.order) && chat.nodes && chat.nodes.get) {
            nodes = [];
            for (const key of chat.order) { const n = chat.nodes.get(key); if (n) nodes.push(n); }
          }
          if (!nodes) return "";
          for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            if (n && n.kind === "assistant" && Array.isArray(n.blocks)) {
              const text = n.blocks
                .filter(b => b && b.kind === "text" && typeof b.text === "string")
                .map(b => b.text)
                .join("");
              if (text) return text;
            }
          }
        } catch (e) {}
        return "";
      }
      // 提取完成/失败时的详情。错误文本取 lastAgentError；最后回复取会话视图。
      function completionDetail(id) {
        const out = { finalText: "", failMsg: "" };
        try {
          const snap = detailOf(id);
          if (snap && typeof snap.lastAgentError === "string" && snap.lastAgentError) out.failMsg = snap.lastAgentError;
          out.finalText = finalTextOf(id);
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
        ctx.timeout(() => {
          if (runs.has(id)) { settling.delete(id); return; }
          const snap = detailOf(id);
          // DSH 0.1.2+ 起会话快照只保留 lastAgentError，用它判定本轮是否新出错。
          const failed = !!(snap && snap.lastAgentError != null && snap.lastAgentError !== run.agentErr);
          const kind = failed ? "failed" : "done";
          if (shouldFire(id, kind)) {
            const cd = completionDetail(id);
            alert(kind, kind === "failed" ? cd.failMsg : cd.finalText);
            if (kind === "failed") startRepeat(id, "failed", 3);
          }
          settling.delete(id);
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
        rec.disposer = ctx.interval(tick, intervalMs);
        repeatTimers.set(id, rec);
      }
      function observe(list) {
        // 提醒范围：默认对所有会话提醒（多会话用户也能收到任何会话的审批/提问/出错/完成）；
        // 设置为“仅当前会话”时，只响用户正在看的那个。
        const byId = (list && list.byId) || {};
        const current = list && list.current;
        const scope = (settings.scope) || "all";
        for (const id of Object.keys(byId)) {
          if (scope === "current" && id !== current) continue;
          const s = byId[id] || {};
          const running = !!s.running;
          const pending = pendingKindOf(id);
          const p = prev.get(id);
          if (p) {
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
        // 清理已离开列表的会话
        for (const id2 of prev.keys()) {
          if (!Object.prototype.hasOwnProperty.call(byId, id2)) { prev.delete(id2); runs.delete(id2); stopRepeat(id2); }
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
      // 挂起交互（审批/提问）走独立 observable（DSH 0.1.2+），
      // 它的变化不会再触发会话列表订阅，必须单独订阅。
      ctx.inject(["uiSession"], (scope) => {
        scope.effect(() => {
          const ui = scope.get("uiSession");
          if (!ui || !ui.pendingInteractions || !ui.pendingInteractions.subscribe) return () => {};
          // uiSession 就绪后只刷新“挂起”基线（不动 running）：否则若 seed 早于
          // uiSession 就绪（prev.pending 记为 undefined），加载前就已挂起的
          // 审批/提问会在下一次 observe 时被误判为“新事件”而响。
          const sessions0 = scope.get("sessions");
          const list0 = sessions0 && sessions0.list;
          if (list0) reseedPending(list0.getSnapshot());
          return ui.pendingInteractions.subscribe(() => {
            const sessions = scope.get("sessions");
            const list = sessions && sessions.list;
            if (list) observe(list.getSnapshot());
          });
        });
      });

      // ---- 卡住检测：running 会话的 updatedAt 太久没更新 → 提醒 ----
      const stallAlerted = new Map(); // id -> 上次提醒时间戳
      ctx.effect(() => ctx.interval(() => {
        const sessions = ctx.get("sessions");
        const list = sessions && sessions.list;
        if (!list) return;
        const snap = list.getSnapshot();
        const byId = (snap && snap.byId) || {};
        const current = snap && snap.current;
        const scope = (settings.scope) || "all";
        const stallMs = settings.stallMs || 0;
        const repeatMs = Math.max(3000, (settings.repeatMs || 20000));
        const now = Date.now();
        for (const id of Object.keys(byId)) {
          if (scope === "current" && id !== current) continue;
          const s = byId[id] || {};
          if (!s.running) { stallAlerted.delete(id); continue; }
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
      }, 5000));

      // ---- UI ----
      const rowStyle = { display: "flex", alignItems: "center", gap: "10px", padding: "6px 0" };
      const keyStyle = { width: "120px", fontWeight: 600, fontSize: 12 };
      const selStyle = { fontSize: 12, padding: "3px 6px", borderRadius: "6px" };
      const cardStyle = { display: "flex", flexDirection: "column", gap: "10px", padding: "14px 16px", borderRadius: "10px", fontSize: 13, border: "1px solid var(--color-border, rgba(128,128,128,0.25))", background: "var(--color-card-bg, rgba(128,128,128,0.06))" };
      const btnStyle = { padding: "3px 10px", borderRadius: "6px", fontSize: 12, cursor: "pointer", border: "1px solid var(--color-border, rgba(128,128,128,0.4))", background: "transparent", color: "inherit" };
      const hintStyle = { fontSize: 12, opacity: 0.6 };

      function SettingsPanel(props) {
        const pair = react.useState(props.getSettings());
        const s = pair[0], setS = pair[1];
        react.useEffect(() => props.subscribeSettings(() => setS(props.getSettings())), []);
        function commit(next) { setS(next); props.setSettings(next); }
        const hourOpts = () => Array.from({ length: 24 }, (_, h) => react.createElement("option", { key: h, value: String(h) }, String(h).padStart(2, "0") + ":00"));
        const rows = KINDS.map(kind => {
          const ts = (s.types && s.types[kind]) || DEFAULT_TYPES[kind];
          const opts = SOUND_IDS.map(sid => react.createElement("option", { key: sid, value: sid }, t("sound." + sid)));
          const upload = ts.sound === "custom"
            ? react.createElement("label", { key: "upload", style: btnStyle },
                react.createElement("input", { type: "file", accept: "audio/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; props.uploadCustom(kind, f); e.target.value = ""; } }),
                t("upload"))
            : null;
          return react.createElement("div", { key: kind },
            react.createElement("div", { style: rowStyle },
              react.createElement("label", { style: { display: "flex", alignItems: "center", gap: "8px", width: "150px" } },
                react.createElement("input", { type: "checkbox", checked: !!ts.enabled, onChange: () => commit(Object.assign({}, s, { types: Object.assign({}, s.types, { [kind]: Object.assign({}, ts, { enabled: !ts.enabled }) }) })) }),
                react.createElement("span", null, t(kind))),
              react.createElement("select", { value: ts.sound, onChange: e => commit(Object.assign({}, s, { types: Object.assign({}, s.types, { [kind]: Object.assign({}, ts, { sound: e.target.value }) }) })), style: selStyle }, opts),
              react.createElement("button", { style: btnStyle, onClick: () => props.play(kind) }, t("preview")),
              upload
            ),
            kind === "failed" ? react.createElement("div", { style: { fontSize: 12, opacity: 0.6, marginTop: "-4px" } }, t("failed.hint")) : null
          );
        });
        return react.createElement("div", { style: cardStyle },
          react.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, t("settings.title")),
          react.createElement("div", { style: rowStyle },
            react.createElement("span", { style: keyStyle }, t("lang.label")),
            react.createElement("select", { value: s.lang || "auto", onChange: e => commit(Object.assign({}, s, { lang: e.target.value })), style: selStyle },
              react.createElement("option", { value: "auto" }, t("lang.auto")),
              react.createElement("option", { value: "zh" }, t("lang.zh")),
              react.createElement("option", { value: "en" }, t("lang.en")))),
          react.createElement("div", { style: rowStyle },
            react.createElement("span", { style: keyStyle }, t("volume")),
            react.createElement("input", { type: "range", min: "0", max: "2", step: "0.05", value: s.volume, onChange: e => commit(Object.assign({}, s, { volume: Number(e.target.value) })), style: { width: "160px" } }),
            react.createElement("span", null, Math.round(s.volume * 100) + "%")),
          react.createElement("div", { style: rowStyle },
            react.createElement("span", { style: keyStyle }, t("scope")),
            react.createElement("select", { value: s.scope || "all", onChange: e => commit(Object.assign({}, s, { scope: e.target.value })), style: selStyle },
              react.createElement("option", { value: "all" }, t("scope.all")),
              react.createElement("option", { value: "current" }, t("scope.current")))),
          react.createElement("div", { style: rowStyle },
            react.createElement("span", { style: keyStyle }, t("repeat")),
            react.createElement("select", { value: String(s.repeatMs || 0), onChange: e => commit(Object.assign({}, s, { repeatMs: Number(e.target.value) })), style: selStyle },
              react.createElement("option", { value: "0" }, t("repeat.off")),
              react.createElement("option", { value: "10000" }, t("repeat.10")),
              react.createElement("option", { value: "20000" }, t("repeat.20")),
              react.createElement("option", { value: "30000" }, t("repeat.30")))),
          react.createElement("div", { style: rowStyle },
            react.createElement("span", { style: keyStyle }, t("notify")),
            react.createElement("label", { style: { display: "flex", alignItems: "center", gap: "8px" } },
              react.createElement("input", { type: "checkbox", checked: !!s.notifyEnabled, onChange: e => { const next = !!e.target.checked; commit(Object.assign({}, s, { notifyEnabled: next })); if (next) props.requestNotify(); } }),
              react.createElement("span", { style: { fontSize: 12, opacity: 0.7 } }, t("notify.hint")))),
          react.createElement("div", { style: rowStyle },
            react.createElement("span", { style: keyStyle }, t("read")),
            react.createElement("label", { style: { display: "flex", alignItems: "center", gap: "8px" } },
              react.createElement("input", { type: "checkbox", checked: !!s.readOutput, onChange: e => commit(Object.assign({}, s, { readOutput: !!e.target.checked })) }),
              react.createElement("span", { style: { fontSize: 12, opacity: 0.7 } }, t("read.hint")))),
          react.createElement("div", { style: rowStyle },
            react.createElement("span", { style: keyStyle }, t("stall")),
            react.createElement("select", { value: String(s.stallMs || 0), onChange: e => commit(Object.assign({}, s, { stallMs: Number(e.target.value) })), style: selStyle },
              react.createElement("option", { value: "0" }, t("stall.off")),
              react.createElement("option", { value: "60000" }, t("stall.1")),
              react.createElement("option", { value: "120000" }, t("stall.2")),
              react.createElement("option", { value: "300000" }, t("stall.5"))),
            react.createElement("span", { style: { fontSize: 12, opacity: 0.7 } }, t("stall.hint"))),
          react.createElement("div", { style: rowStyle },
            react.createElement("span", { style: keyStyle }, t("toast")),
            react.createElement("label", { style: { display: "flex", alignItems: "center", gap: "8px" } },
              react.createElement("input", { type: "checkbox", checked: !!s.showToast, onChange: e => commit(Object.assign({}, s, { showToast: !!e.target.checked })) }),
              react.createElement("span", { style: { fontSize: 12, opacity: 0.7 } }, t("toast.hint")))),
          react.createElement("div", { style: rowStyle },
            react.createElement("span", { style: keyStyle }, t("rate")),
            react.createElement("select", { value: String(s.voiceRate || 1), onChange: e => commit(Object.assign({}, s, { voiceRate: Number(e.target.value) })), style: selStyle },
              react.createElement("option", { value: "0.7" }, t("rate.slow")),
              react.createElement("option", { value: "1" }, t("rate.normal")),
              react.createElement("option", { value: "1.3" }, t("rate.fast")))),
          react.createElement("div", { style: rowStyle },
            react.createElement("span", { style: keyStyle }, t("dnd")),
            react.createElement("label", { style: { display: "flex", alignItems: "center", gap: "6px" } },
              react.createElement("input", { type: "checkbox", checked: !!s.dndEnabled, onChange: e => commit(Object.assign({}, s, { dndEnabled: !!e.target.checked })) }),
              react.createElement("span", { style: { fontSize: 12, opacity: 0.7 } }, t("dnd.on"))),
            react.createElement("select", { value: String(s.dndStart), onChange: e => commit(Object.assign({}, s, { dndStart: Number(e.target.value) })), style: selStyle }, hourOpts()),
            react.createElement("span", { style: { fontSize: 12, opacity: 0.7 } }, t("dnd.to")),
            react.createElement("select", { value: String(s.dndEnd), onChange: e => commit(Object.assign({}, s, { dndEnd: Number(e.target.value) })), style: selStyle }, hourOpts())),
          react.createElement("div", { style: rowStyle },
            react.createElement("button", { style: btnStyle, onClick: () => { if (typeof window === "undefined" || typeof window.confirm !== "function" || window.confirm(t("reset.confirm"))) commit(deepMerge(DEFAULTS, {})); } }, t("reset")),
            react.createElement("span", { style: { fontSize: 12, opacity: 0.7 } }, t("reset.hint"))),
          rows,
          react.createElement("div", { style: hintStyle }, t("hint"))
        );
      }

      function AlertToast(props) {
        const pair = react.useState(props.getCurrent());
        const msg = pair[0], setMsg = pair[1];
        react.useEffect(() => props.subscribe(() => setMsg(props.getCurrent())), []);
        if (!msg) return null;
        if (!settings.showToast) return null;
        const s = TOAST_MAP[msg] || TOAST_MAP.connected;
        const label = t(msg);
        return react.createElement("div", {
          style: {
            position: "fixed", left: "50%", bottom: "28px", transform: "translateX(-50%)",
            zIndex: 2147483000, padding: "12px 20px", borderRadius: "12px", color: "#fff",
            fontWeight: 600, fontSize: 14, lineHeight: 1.4, fontFamily: "system-ui, sans-serif",
            boxShadow: "0 8px 30px rgba(0,0,0,.28)", background: s.bg, pointerEvents: "none",
          },
        }, label);
      }

      // ---- audio unlock (browser autoplay) ----
      ctx.effect(() => {
        if (typeof window === "undefined") return () => {};
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
          () => react.createElement(AlertToast, { subscribe, getCurrent: () => current })
        )));
      });

      ctx.timeout(() => emit("connected"), 600);
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = name;
    return module.exports;
  },
});

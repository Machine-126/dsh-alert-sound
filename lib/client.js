// dsh-alert-sound — Client half (browser bundle).
// Hand-written in the harness module-loader format; `require` answers the
// platform externals (react), everything else is inlined.
//
// Watches the session list for running / pending-interaction edges and raises
// four notification kinds (approval / question / completed / failed), each
// playing a distinct synthesized tone or a Chinese voice utterance, with a
// Settings section for per-kind sound+enable and a master volume.
window.__ModuleLoader__.load({
  id: "dsh-alert-sound",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const react = require("react");

    const name = "dsh-alert-sound";
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
        "read": "朗读输出", "read.hint": "完成时朗读最后回复（免注视）",
        "stall": "停滞检测", "stall.off": "关", "stall.1": "1分钟", "stall.2": "2分钟", "stall.5": "5分钟",
        "toast": "悬浮提示", "toast.hint": "显示悬浮提示（默认关，以听为主）",
        "rate": "语音语速", "rate.slow": "慢", "rate.normal": "标准", "rate.fast": "快",
        "dnd": "勿扰时段", "dnd.on": "开启", "dnd.to": "至",
        "preview": "试听", "upload": "上传", "sep": "：",
        "hint": "选“语音”会用中文朗读（需浏览器支持语音合成）。", "stalled.detail": "长时间未进展",
      },
      en: {
        approval: "Needs approval", question: "Needs answer", done: "Output complete", failed: "Error", stalled: "Stalled", connected: "🔔 Alerts ready",
        "sound.ding": "Ding-dong", "sound.fault": "Low", "sound.tap": "Tap", "sound.alarm": "Alert", "sound.voice": "Voice", "sound.custom": "Custom", "sound.none": "Mute",
        "lang.label": "Language", "lang.auto": "Auto", "lang.zh": "中文", "lang.en": "English",
        "settings.title": "🔔 Alert sounds", "nav.title": "Alerts", "overlay.label": "DSH Alerts", "volume": "Volume", "scope": "Scope", "scope.all": "All sessions", "scope.current": "Current session only",
        "repeat": "Repeat", "repeat.off": "Off", "repeat.10": "Every 10s", "repeat.20": "Every 20s", "repeat.30": "Every 30s",
        "notify": "System notification", "notify.hint": "Browser notification (also in background)",
        "read": "Read-aloud", "read.hint": "Read the final reply on completion (hands-free)",
        "stall": "Stall detection", "stall.off": "Off", "stall.1": "1 min", "stall.2": "2 min", "stall.5": "5 min",
        "toast": "Toast", "toast.hint": "Show on-screen toast (off by default; listen-first)",
        "rate": "Voice rate", "rate.slow": "Slow", "rate.normal": "Normal", "rate.fast": "Fast",
        "dnd": "Do-not-disturb", "dnd.on": "On", "dnd.to": "to",
        "preview": "Preview", "upload": "Upload", "sep": ": ",
        "hint": "Choose “Voice” to hear it spoken aloud (requires browser speech synthesis).", "stalled.detail": "No progress for a while",
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
    function playPattern(sound) {
      const ac = ensureCtx();
      if (!ac || !master || !PATTERNS[sound]) return;
      const vol = Math.min(2, Math.max(0, settings.volume));
      const start = ac.currentTime + 0.02;
      master.gain.setValueAtTime(vol, start);
      for (const n of PATTERNS[sound].notes) {
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
    }
    function speak(text) {
      try {
        if (typeof window === "undefined" || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
        const u = new window.SpeechSynthesisUtterance(text);
        u.lang = resolveLang() === "en" ? "en-US" : "zh-CN";
        u.volume = Math.min(1, Math.max(0, settings.volume));
        u.rate = Math.min(2, Math.max(0.5, settings.voiceRate || 1));
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch (e) { /* ignore */ }
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
      try {
        if (typeof Audio === "undefined") return;
        const a = new Audio(url);
        a.volume = Math.min(1, Math.max(0, settings.volume));
        a.play().catch(() => {});
      } catch (e) { /* ignore */ }
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
      const t = settings.types && settings.types[kind];
      if (!t || !t.enabled) return;
      if (t.sound === "none") return;
      if (t.sound === "voice") speak(t(kind) + (detail ? t("sep") + clip(detail, settings.readOutput ? 400 : 120) : ""));
      else if (t.sound === "custom") playCustom(kind);
      else playPattern(t.sound);
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
        playType(kind, detail);
        notify(kind, detail);
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
      function seed(list) {
        const byId = (list && list.byId) || {};
        for (const id of Object.keys(byId)) {
          const s = byId[id] || {};
          prev.set(id, { running: !!s.running, pending: s.pendingInteraction });
        }
      }
      function detailOf(id) {
        const s = ctx.get("sessions");
        try {
          const b = s && s.binding && s.binding(id);
          return b && b.session ? b.session.getSnapshot() || null : null;
        } catch (e) { return null; }
      }
      function maxErrSeq(snap) {
        let m = 0;
        try {
          if (snap && snap.chat && snap.chat.nodes) {
            for (const node of snap.chat.nodes.values()) {
              if (node && node.kind === "turn-error" && node.data && typeof node.data.seq === "number" && node.data.seq > m) m = node.data.seq;
            }
          }
        } catch (e) {}
        return m;
      }
      // 提取审批/提问的具体内容（toolName/reason、问题文本），供语音播报。
      function pendingDetail(snap) {
        const out = { approval: null, question: null };
        try {
          const pending = snap && snap.pending;
          if (Array.isArray(pending)) {
            for (const item of pending) {
              if (item && item.kind === "approval" && !out.approval) {
                const p = item.payload || {};
                const toolName = typeof p.toolName === "string" ? p.toolName : "";
                const reason = typeof p.reason === "string" ? p.reason : "";
                out.approval = reason ? toolName + t("sep") + reason : toolName;
              } else if (item && item.kind === "question" && !out.question) {
                const qs = item.payload && item.payload.questions;
                if (Array.isArray(qs) && qs.length && qs[0] && typeof qs[0].question === "string") out.question = qs[0].question;
              }
            }
          }
        } catch (e) {}
        return out;
      }
      // 提取完成/失败时的“最后回复文本”或“错误信息”，供语音播报。
      function completionDetail(snap) {
        const out = { finalText: "", failMsg: "" };
        try {
          if (snap && snap.chat && snap.chat.nodes) {
            for (const node of snap.chat.nodes.values()) {
              if (node && node.kind === "turn-error" && node.data && typeof node.data.message === "string") out.failMsg = node.data.message;
              else if (node && node.kind === "assistant-step" && node.data && Array.isArray(node.data.blocks)) {
                const text = node.data.blocks
                  .filter(b => b && b.kind === "text" && typeof b.text === "string")
                  .map(b => b.text)
                  .join("");
                if (text) out.finalText = text;
              }
            }
          }
        } catch (e) {}
        return out;
      }
      function armRun(id) {
        const snap = detailOf(id);
        runs.set(id, { errSeq: maxErrSeq(snap), agentErr: snap ? snap.lastAgentError || null : null });
      }
      function settleRun(id) {
        const run = runs.get(id);
        if (!run || settling.has(id)) return;
        runs.delete(id);
        settling.add(id);
        ctx.timeout(() => {
          if (runs.has(id)) { settling.delete(id); return; }
          const snap = detailOf(id);
          const failed = maxErrSeq(snap) > run.errSeq || (snap && snap.lastAgentError != null && snap.lastAgentError !== run.agentErr);
          const kind = failed ? "failed" : "done";
          if (shouldFire(id, kind)) {
            const cd = completionDetail(snap);
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
        const intervalMs = Math.max(3000, (settings.repeatMs || 0));
        if (intervalMs <= 0) return; // 关闭重复
        const rec = { disposer: null, kind, count: 0, limit };
        const tick = () => {
          const sessions = ctx.get("sessions");
          const list = sessions && sessions.list;
          if (!list) { stopRepeat(id); return; }
          const snap = list.getSnapshot();
          const s = (snap.byId && snap.byId[id]) || {};
          const pend = s.pendingInteraction;
          if (kind === "approval" || kind === "question") {
            // 挂在“审批/提问”直到处理掉
            if (pend !== kind) { stopRepeat(id); return; }
          } else {
            rec.count += 1;
            if (rec.count >= rec.limit) { stopRepeat(id); return; }
          }
          if (kind === "failed") {
            const cd = completionDetail(detailOf(id));
            alert("failed", cd.failMsg);
          } else {
            const pd = pendingDetail(detailOf(id));
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
          const pending = s.pendingInteraction;
          const p = prev.get(id);
          if (p) {
            if (pending !== undefined && pending !== p.pending) {
              if (pending === "approval") {
                const pd = pendingDetail(detailOf(id));
                if (shouldFire(id, "approval")) { alert("approval", pd.approval); startRepeat(id, "approval", Infinity); }
              } else if (pending === "question") {
                const pd = pendingDetail(detailOf(id));
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
      ctx.effect(() => {
        const sessions = ctx.get("sessions");
        if (!sessions || !sessions.list) return () => {};
        const list = sessions.list;
        seed(list.getSnapshot());
        return list.subscribe(() => observe(list.getSnapshot()));
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
          return react.createElement("div", { key: kind, style: rowStyle },
            react.createElement("label", { style: { display: "flex", alignItems: "center", gap: "8px", width: "150px" } },
              react.createElement("input", { type: "checkbox", checked: !!ts.enabled, onChange: () => commit(Object.assign({}, s, { types: Object.assign({}, s.types, { [kind]: Object.assign({}, ts, { enabled: !ts.enabled }) }) })) }),
              react.createElement("span", null, t(kind))),
            react.createElement("select", { value: ts.sound, onChange: e => commit(Object.assign({}, s, { types: Object.assign({}, s.types, { [kind]: Object.assign({}, ts, { sound: e.target.value }) }) })), style: selStyle }, opts),
            react.createElement("button", { style: btnStyle, onClick: () => props.play(kind) }, t("preview")),
            upload
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
              react.createElement("option", { value: "300000" }, t("stall.5")))),
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
      const slots = ctx.get("slots");
      if (slots) {
        ctx.effect(() => slots.inject("settings.section", () => slots.register(
          { name: "settings.section", id: "dsh-alert", order: 45, label: () => t("nav.title") },
          props => react.createElement(SettingsPanel, Object.assign({}, props, { getSettings: () => settings, setSettings: persistSettings, subscribeSettings, play: playType, requestNotify: requestNotifyPermission, uploadCustom: uploadCustomAudio }))
        )));
        ctx.effect(() => slots.inject("shell.overlay", () => slots.register(
          { name: "shell.overlay", id: "dsh-alert-toast", order: 50, label: () => t("overlay.label") },
          () => react.createElement(AlertToast, { subscribe, getCurrent: () => current })
        )));
      }

      ctx.timeout(() => emit("connected"), 600);
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = name;
    return module.exports;
  },
});

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
    };
    const DEFAULTS = { volume: 0.7, scope: "all", types: DEFAULT_TYPES };

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

    // ================= sounds (original tones + Chinese voice) =================
    const SOUND_NAMES = { ding: "叮咚", fault: "低沉", tap: "轻点", alarm: "警醒", voice: "语音", none: "静音" };
    const SOUND_IDS = ["ding", "fault", "tap", "alarm", "voice", "none"];
    const PATTERNS = {
      ding:  { notes: [{ at: 0, f: 523.25, d: 0.18, t: "sine", g: 0.8 }, { at: 0.15, f: 783.99, d: 0.35, t: "sine", g: 0.8 }] },
      fault: { notes: [{ at: 0, f: 196, d: 0.2, t: "sawtooth", g: 0.35 }, { at: 0.18, f: 130.81, d: 0.4, t: "sawtooth", g: 0.35 }] },
      tap:   { notes: [{ at: 0, f: 1046.5, d: 0.07, t: "triangle", g: 0.7 }, { at: 0.1, f: 1046.5, d: 0.07, t: "triangle", g: 0.7 }] },
      alarm: { notes: [{ at: 0, f: 880, d: 0.1, t: "square", g: 0.3 }, { at: 0.16, f: 1174.66, d: 0.12, t: "square", g: 0.3 }, { at: 0.34, f: 1567.98, d: 0.22, t: "square", g: 0.3 }] },
    };
    // Shared label for both the spoken voice and the settings/UI text.
    const KIND_LABEL = { approval: "需要审批", question: "需要回答", done: "输出完成", failed: "发生错误" };
    const TOAST_MAP = {
      approval: { bg: "#f59e0b", label: "需要审批" },
      question: { bg: "#7c3aed", label: "需要回答" },
      done: { bg: "#16a34a", label: "输出完成" },
      failed: { bg: "#dc2626", label: "发生错误" },
      connected: { bg: "#2563eb", label: "🔔 提醒已连接" },
    };
    const KINDS = ["approval", "question", "done", "failed"];

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
        u.lang = "zh-CN";
        u.volume = Math.min(1, Math.max(0, settings.volume));
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch (e) { /* ignore */ }
    }
    function clip(text, max) {
      if (!text) return "";
      return text.length <= max ? text : text.slice(0, max - 1) + "…";
    }
    function playType(kind, detail) {
      const t = settings.types && settings.types[kind];
      if (!t || !t.enabled) return;
      if (t.sound === "none") return;
      if (t.sound === "voice") speak(KIND_LABEL[kind] + (detail ? "：" + clip(detail, 120) : ""));
      else playPattern(t.sound);
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
                out.approval = reason ? toolName + "：" + reason : toolName;
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
            playType(kind, kind === "failed" ? cd.failMsg : cd.finalText);
            emit(kind);
          }
          settling.delete(id);
        }, 250);
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
              const pd = pendingDetail(detailOf(id));
              if (pending === "approval" && shouldFire(id, "approval")) { playType("approval", pd.approval); emit("approval"); }
              else if (pending === "question" && shouldFire(id, "question")) { playType("question", pd.question); emit("question"); }
            }
            if (p.running && !running) settleRun(id);
            else if (!p.running && running) armRun(id);
          }
          prev.set(id, { running, pending });
        }
        // 清理已离开列表的会话
        for (const id2 of prev.keys()) {
          if (!Object.prototype.hasOwnProperty.call(byId, id2)) { prev.delete(id2); runs.delete(id2); }
        }
      }
      ctx.effect(() => {
        const sessions = ctx.get("sessions");
        if (!sessions || !sessions.list) return () => {};
        const list = sessions.list;
        seed(list.getSnapshot());
        return list.subscribe(() => observe(list.getSnapshot()));
      });

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
        const rows = KINDS.map(kind => {
          const t = (s.types && s.types[kind]) || DEFAULT_TYPES[kind];
          const opts = SOUND_IDS.map(sid => react.createElement("option", { key: sid, value: sid }, SOUND_NAMES[sid]));
          return react.createElement("div", { key: kind, style: rowStyle },
            react.createElement("label", { style: { display: "flex", alignItems: "center", gap: "8px", width: "150px" } },
              react.createElement("input", { type: "checkbox", checked: !!t.enabled, onChange: () => commit(Object.assign({}, s, { types: Object.assign({}, s.types, { [kind]: Object.assign({}, t, { enabled: !t.enabled }) }) })) }),
              react.createElement("span", null, KIND_LABEL[kind])),
            react.createElement("select", { value: t.sound, onChange: e => commit(Object.assign({}, s, { types: Object.assign({}, s.types, { [kind]: Object.assign({}, t, { sound: e.target.value }) }) })), style: selStyle }, opts),
            react.createElement("button", { style: btnStyle, onClick: () => props.play(kind) }, "试听")
          );
        });
        return react.createElement("div", { style: cardStyle },
          react.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, "🔔 提醒音设置"),
          react.createElement("div", { style: rowStyle },
            react.createElement("span", { style: keyStyle }, "音量"),
            react.createElement("input", { type: "range", min: "0", max: "2", step: "0.05", value: s.volume, onChange: e => commit(Object.assign({}, s, { volume: Number(e.target.value) })), style: { width: "160px" } }),
            react.createElement("span", null, Math.round(s.volume * 100) + "%")),
          react.createElement("div", { style: rowStyle },
            react.createElement("span", { style: keyStyle }, "提醒范围"),
            react.createElement("select", { value: s.scope || "all", onChange: e => commit(Object.assign({}, s, { scope: e.target.value })), style: selStyle },
              react.createElement("option", { value: "all" }, "所有会话"),
              react.createElement("option", { value: "current" }, "仅当前会话"))),
          rows,
          react.createElement("div", { style: hintStyle }, "选“语音”会用中文朗读（需浏览器支持语音合成）。")
        );
      }

      function AlertToast(props) {
        const pair = react.useState(props.getCurrent());
        const msg = pair[0], setMsg = pair[1];
        react.useEffect(() => props.subscribe(() => setMsg(props.getCurrent())), []);
        if (!msg) return null;
        const s = TOAST_MAP[msg] || TOAST_MAP.connected;
        return react.createElement("div", {
          style: {
            position: "fixed", left: "50%", bottom: "28px", transform: "translateX(-50%)",
            zIndex: 2147483000, padding: "12px 20px", borderRadius: "12px", color: "#fff",
            fontWeight: 600, fontSize: 14, lineHeight: 1.4, fontFamily: "system-ui, sans-serif",
            boxShadow: "0 8px 30px rgba(0,0,0,.28)", background: s.bg, pointerEvents: "none",
          },
        }, s.label);
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
          { name: "settings.section", id: "dsh-alert", order: 45, label: "提醒音" },
          props => react.createElement(SettingsPanel, Object.assign({}, props, { getSettings: () => settings, setSettings: persistSettings, subscribeSettings, play: playType }))
        )));
        ctx.effect(() => slots.inject("shell.overlay", () => slots.register(
          { name: "shell.overlay", id: "dsh-alert-toast", order: 50, label: "DSH 提醒" },
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

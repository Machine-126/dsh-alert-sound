# dsh-alert-sound

[English](./README.en.md) | 中文

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

为 **DeepSeek Harness (dsh) 网页图形界面**提供通知声音提醒。当会话需要**审批**、需要**回答**、一轮**输出完成**、或**出现错误**时，插件播放不同的提示音并弹出悬浮提示——可选**语音**朗读。每类通知可单独设置音色/语音、启用开关与总音量，都在专属的设置页里配置。界面与语音支持**中文 / English** 切换。

> **关于本项目的开发**：本插件由 [@Machine-126](https://github.com/Machine-126) 提出需求与测试验收；代码开发全程由 **DeepSeek Harness**（AI 编程代理）驱动完成。发现 bug 欢迎提 [issue](https://github.com/Machine-126/dsh-alert-sound/issues)。

- **五类提醒，音色各异**：需要审批 / 需要回答 / 输出完成 / 发生错误，外加实验性的「卡住」（默认关）。
- **可选语音，默认 Edge TTS**：把某类切到“语音”，默认由本机 DSH 主进程调用**微软 Edge 朗读服务**合成（音色可选：晓晓 / 晓伊 / 云希 / 云扬 / Ava / Emma / Andrew / Brian，附**试听**）；朗读语言跟随“界面语言”。**三级兜底**：Edge 语音 → 浏览器语音合成 → 该类提示音，**保证一定有声**。不想联网可在设置里把“语音引擎”切成 **浏览器语音**（完全离线）。
- **设置页**（侧栏 → 提醒音）：总音量滑杆（0–200%）、每类启用开关、音色下拉（叮咚/低沉/轻点/警醒/语音/自定义/静音）、试听按钮，以及 **“恢复默认设置”**（带二次确认）。
- **后台也能响**：首次用户手势自动解锁音频。
- **默认对所有会话提醒**：多会话用户也能听到任何会话的审批/回答/出错/完成；可在设置切到“仅当前会话”。
- **语音播报具体内容**：切到“语音”后会读出具体卡在哪（如“需要审批：write；写入文件 xxx”“需要回答：<问题>”“发生错误：<原因>”）。
- **阻断事件重复提醒**：审批/提问未处理时，每隔一段时间再响一次（可设关/10/20/30 秒），直到处理；错误重复几次。
- **多语言（zh/en）**：设置里可切“界面语言”（自动/中文/English）；设置页、悬浮提示、每类/音色名与语音朗读语言随之切换。
- **浏览器系统通知**：开启后，提醒时在系统通知区也弹一条（后台也能看到）。
- **停滞检测（实验性，默认关）**：Agent 长时间无进展时提醒；当前基于 `updatedAt`，**可靠性待改进**，故默认关闭。注意：**只有把「停滞检测」打开，第 5 类「卡住」提醒才会触发**。
- 设置持久化到 `localStorage`，刷新/重启保留；可一键恢复默认。

## 要求

- **DeepSeek Harness `0.1.2` 或更新**（`dsh web`）——审批/提问的检测依赖 `0.1.2` 引入的 `uiSession.pendingInteractions`；更早版本只能收到“完成/错误”提醒。
- 支持 Web Audio 的浏览器（播放音色）；Web Speech 仅“浏览器语音”引擎需要，缺失时自动降级为提示音
- **“Edge 语音”（默认）需要联网**：本机 DSH 主进程要能访问微软朗读服务 `speech.platform.bing.com`；断网或服务不可用时自动回退浏览器语音（详见[隐私](#隐私)）

## 安装

推荐用 npm 包（预构建安装、免构建授权，市场按下载量展示）：

```sh
dsh plugin --profile web add @machine-126/dsh-alert-sound
```

也可从 GitHub 安装（纯 JS 无构建，直接生效）：

```sh
dsh plugin --profile web add github:Machine-126/dsh-alert-sound
```

或从本地目录：

```sh
dsh plugin --profile web add ./dsh-alert-sound
```

重启 `dsh web`，然后打开 **设置 → 提醒音** 配置。

## 使用

安装后，打开 DSH 设置 → **提醒音**，为每类通知设置音色/语音、启停与音量；顶部“界面语言”可在 **自动 / 中文 / English** 间切换；底部 **“恢复默认设置”** 可一键复位（会二次确认）。满足条件时自动提醒，无需其它操作。

## 通知类型与默认音色

| 类型 | 触发条件 | 默认音色 | 提示 |
|---|---|---|---|
| 需要审批 | `uiSession.pendingInteractions` 里该会话 `kind === 'approval'` | 警醒（方波三连） | 琥珀色 |
| 需要回答 | `uiSession.pendingInteractions` 里该会话 `kind === 'question'`（含 plan-review） | 轻点（双短音） | 紫色 |
| 输出完成 | 会话列表 `running` 由真→假 | 叮咚（上行双音） | 绿色 |
| 发生错误 | 运行中途出错（`lastAgentError` 变化） | 低沉（下行锯齿） | 红色 |

另有第 5 类 **“卡住”** 提醒（实验性，**默认关闭**，需先打开“停滞检测”），音色默认取“低沉（fault）”。

## 语音引擎（Edge / 浏览器）

“语音”音色有两种引擎，在 **设置 → 提醒音 → 语音引擎** 里切换：

| 引擎 | 说明 | 联网 |
|---|---|---|
| **Edge 语音**（默认） | 由本机 DSH 主进程调用微软 Edge 朗读服务合成 MP3，再由浏览器播放。音色可选（见下），中文推荐**晓晓**、英文推荐 **Ava**（多语言音色读中文同样自然；云希/云扬会把中文句子里夹的英文读错）。 | 需要 |
| **浏览器语音** | 用浏览器自带的 `speechSynthesis`，只能按语言、不能选音色，中文偏机械。 | 不需要 |

- **为什么不由浏览器直接合成**：微软朗读服务的 WebSocket 会拒绝来自网页的握手（携带页面 `Origin` 时返回 403），且它要求的 User-Agent 浏览器不允许修改；由本机主进程代发即可满足，因此插件的主机端提供 `/dsh-alert-sound/tts.mp3`，浏览器只负责播放返回的音频。
- **预取**：启用“语音”的提醒类型，其固定短句会在插件启动后于后台合成并缓存，提醒到来时立即出声，不必等合成。
- **音色**：`自动` = 中文用 `zh-CN-XiaoxiaoNeural`（晓晓）、英文用 `en-US-AvaMultilingualNeural`（Ava）；也可固定选择具体音色。改选音色后点右侧 **试听** 即可试听。
- **失败可见**：连续 3 次合成失败会停用 Edge 引擎（避免每条提醒都白等），设置页显示「⚠️ Edge 语音不可用，已改用浏览器语音」，浏览器控制台给出原因。
- **语速**：“语音语速”对两种引擎都生效（0.7 → −30%，1.3 → +30%）。

## 设置持久化

偏好保存在 `localStorage` 的 `dsh-alert-sound.v1` 键下（音量 + 每类 `{enabled, sound}` + 提醒范围/重复间隔/系统通知/朗读输出/停滞检测/悬浮提示/语音语速/语音引擎/音色/勿扰时段/界面语言等），自定义音色单独存在 `dsh-alert-sound.custom.v1`。刷新页面与重启都会保留。

## 隐私

所有提醒判定都在浏览器内完成。插件**只在内存中**读取：会话列表的 `running` / `updatedAt`；挂起交互 `uiSession.pendingInteractions`（审批/提问的类型，以及工具名、原因、问题文本）；会话快照的 `lastAgentError`（判定“失败”）；以及**仅在开启“朗读输出”时**读取会话视图里最后一条助手回复文本（用于朗读）。以上**不保存**。唯一持久化的数据是你自己的**设置**（`localStorage` 的 `dsh-alert-sound.v1`；自定义音色另存 `dsh-alert-sound.custom.v1`）。

**联网说明（只与“语音”音色有关）**：默认的 **Edge 语音**会把**要朗读的那段文本**——提醒短句，或开启“朗读输出”后截断到 400 字的助手回复——交给本机 DSH 主进程，再由它发送到微软 Edge 朗读服务（`speech.platform.bing.com`）合成音频；返回的音频只放在**内存缓存**里（最多 128 条 / 24MB），不落盘、不用于其它用途。**不选“语音”音色的提醒（叮咚/低沉/轻点/警醒/自定义）以及“浏览器语音”引擎完全不联网。**插件不使用 analytics/telemetry。

- 想完全不联网：把 **语音引擎** 切成 **浏览器语音**（或不用“语音”音色）。
- 只想减少发送内容：关掉 **朗读输出**，这样只会发出“需要审批 / 输出完成”这类固定短句与审批工具名等少量详情。
- 主机端只注册一条合成路由（`GET /dsh-alert-sound/tts.mp3`），只在浏览器请求时才会联网；不落盘、不写日志、不读文件系统。

## 项目结构

```
├─ package.json        # dsh.bundle + dsh.client（web 客户端插件）
├─ cordis.patch.yml    # 组合补丁：插入一行插件（id = 包内 name）
├─ test/host.test.mjs  # 主机端测试（`npm test`，联网用例默认跳过）
└─ lib/
   ├─ index.mjs        # 主机端（Edge 语音合成路由；其余行为都在客户端）
   └─ client.js        # 客户端逻辑（__ModuleLoader__ 格式）
```

## 致谢（来源参考）

本插件的**检测思路**（监听会话列表的 `running` 与 `uiSession.pendingInteractions` 判定“审批/提问/完成”）参考了 [dsh-session-notification](https://github.com/dingyi222666/dsh-session-notification)（BSD-3-Clause）；**“任务完成提示音”概念**参考 [dsh-chime](https://github.com/HtO404/dsh-chime)（Apache-2.0）；**打包结构 / web 客户端插件形态**参考官方文档 `docs/user/develop/basic/publish.md`，以及 [dsh-plugin-tts](https://github.com/1624318455/dsh-plugin-tts)、[dsh-status-rotator](https://github.com/01Virex/dsh-status-rotator)、[dsh-web-ui-notify](https://github.com/omdsh-dev/dsh-web-ui-notify)。

**音色为原创设计**（波形/频率为本插件自定），未照搬任何项目的音色常量；本插件源码为独立实现。发布时请保留本致谢并遵守对应开源许可。

## 许可

MIT

# dsh-alert-sound

[English](./README.en.md) | 中文

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

为 **DeepSeek Harness (dsh) 网页图形界面**提供通知声音提醒。当会话需要**审批**、需要**回答**、一轮**输出完成**、或**出现错误**时，插件播放不同的提示音并弹出悬浮提示——可选**语音**朗读。每类通知可单独设置音色/语音、启用开关与总音量，都在专属的设置页里配置。界面与语音支持**中文 / English** 切换。

- **四类提醒，音色各异**：需要审批 / 需要回答 / 输出完成 / 发生错误。
- **可选语音（中/英文随界面语言）**：把某类切到“语音”，即可用浏览器语音合成朗读；朗读语言跟随“界面语言”设置（中文 `zh-CN` / English `en-US`）。
- **设置页**（侧栏 → 提醒音）：总音量滑杆（0–200%）、每类启用开关、音色下拉（叮咚/低沉/轻点/警醒/语音/静音）、试听按钮。
- **后台也能响**：首次用户手势自动解锁音频。
- **默认对所有会话提醒**：多会话用户也能听到任何会话的审批/回答/出错/完成；可在设置切到“仅当前会话”。
- **语音播报具体内容**：切到“语音”后会读出具体卡在哪（如“需要审批：write；写入文件 xxx”“需要回答：<问题>”“发生错误：<原因>”）。
- **阻断事件重复提醒**：审批/提问未处理时，每隔一段时间再响一次（可设关/10/20/30 秒），直到处理；错误重复几次。
- **多语言（zh/en）**：设置里可切“界面语言”（自动/中文/English）；设置页、悬浮提示、每类/音色名与语音朗读语言随之切换。
- **浏览器系统通知**：开启后，提醒时在系统通知区也弹一条（后台也能看到）。
- **停滞检测（实验性，默认关）**：Agent 长时间无进展时提醒；当前基于 `updatedAt`，**可靠性待改进**，故默认关闭，可手动开启。
- 设置持久化到 `localStorage`，刷新/重启保留。

## 要求

- DeepSeek Harness `web` profile（`dsh web`）
- 支持 Web Audio 的浏览器（播放音色）；Web Speech 用于语音，可选、缺失时自动降级

## 安装

```sh
dsh plugin --profile web add github:Machine-126/dsh-alert-sound
```

重启 `dsh web`，然后打开 **设置 → 提醒音** 配置。或安装本地目录：

```sh
dsh plugin --profile web add ./dsh-alert-sound
```

> 本插件是纯 JavaScript、无构建步骤，因此 `github:` 安装可直接生效（无需 npm 打包或构建授权）。

## 使用

安装后，打开 DSH 设置 → **提醒音**，为每类通知设置音色/语音、启停与音量；顶部“界面语言”可在 **自动 / 中文 / English** 间切换。满足条件时自动提醒，无需其它操作。

## 通知类型与默认音色

| 类型 | 触发条件 | 默认音色 | 提示 |
|---|---|---|---|
| 需要审批 | 会话 `pendingInteraction === 'approval'` | 警醒（方波三连） | 琥珀色 |
| 需要回答 | 会话 `pendingInteraction === 'question'` | 轻点（双短音） | 紫色 |
| 输出完成 | 会话 `running` 由真→假 | 叮咚（上行双音） | 绿色 |
| 发生错误 | 运行中途出错 | 低沉（下行锯齿） | 红色 |

## 设置持久化

偏好保存在 `localStorage` 的 `dsh-alert-sound.v1` 键下（音量 + 每类 `{enabled, sound}` + 提醒范围/重复间隔/系统通知/朗读输出/停滞检测/悬浮提示/语音语速/勿扰时段/界面语言等），刷新页面与重启都会保留。

## 隐私

所有处理都在浏览器内完成。插件**只在内存中**读取会话列表状态（`running` / `pendingInteraction`，以及用于“失败”判定的会话快照的 turn-error / last-agent-error），以决定何时提醒——**不保存、不外发**。唯一持久化的数据是你自己的音色/音量**设置**（`localStorage` 的 `dsh-alert-sound.v1`）。插件**不发起任何网络请求**、不向任何服务器发送数据、不用 analytics/telemetry，声音/语音通过浏览器本地的 Web Audio 和语音合成播放。

## 项目结构

```
├─ package.json        # dsh.bundle + dsh.client（web 客户端插件）
├─ cordis.patch.yml    # 组合补丁：插入一行插件（id = 包内 name）
└─ lib/
   ├─ index.mjs        # 主机端（纯客户端插件，主机行为为最小占位）
   └─ client.js        # 客户端逻辑（__ModuleLoader__ 格式）
```

## 致谢（来源参考）

本插件的**检测思路**（监听会话列表的 `running` / `pendingInteraction` 信号判定“审批/提问/完成”）参考了 [dsh-session-notification](https://github.com/dingyi222666/dsh-session-notification)（BSD-3-Clause）；**“任务完成提示音”概念**参考 [dsh-chime](https://github.com/HtO404/dsh-chime)（Apache-2.0）；**打包结构 / web 客户端插件形态**参考官方文档 `docs/user/develop/basic/publish.md`，以及 [dsh-plugin-tts](https://github.com/1624318455/dsh-plugin-tts)、[dsh-status-rotator](https://github.com/01Virex/dsh-status-rotator)、[dsh-web-ui-notify](https://github.com/omdsh-dev/dsh-web-ui-notify)。

**音色为原创设计**（波形/频率为本插件自定），未照搬任何项目的音色常量；本插件源码为独立实现。发布时请保留本致谢并遵守对应开源许可。

## 许可

MIT

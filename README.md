# dsh-alert-sound

<div align="center">
  <b>不用盯着屏幕也能知道 DeepSeek Harness 什么时候需要你</b><br /><br />
  <a href="https://www.npmjs.com/package/@machine-126/dsh-alert-sound"><img alt="npm version" src="https://img.shields.io/npm/v/@machine-126/dsh-alert-sound" /></a>
  <a href="https://www.npmjs.com/package/@machine-126/dsh-alert-sound"><img alt="npm downloads" src="https://img.shields.io/npm/dm/@machine-126/dsh-alert-sound" /></a>
  <a href="https://github.com/Machine-126/dsh-alert-sound/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/Machine-126/dsh-alert-sound" /></a>
  <a href="https://opensource.org/licenses/MIT"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
  <a href="https://www.npmjs.com/package/@deepseek-ai/dsh?activeTab=versions"><img alt="支持的 DSH 版本：0.2.0-rc.2+" src="https://img.shields.io/badge/DSH-0.2.0--rc.2%2B-4d6bfe" /></a>
  <br /><br />
  <a href="./README.md"><b>中文</b></a> · <a href="./README.en.md">English</a>
</div>

## 为什么需要它

DSH 跑一个任务经常要几分钟到几十分钟。人在切窗口、在开会、在写别的东西的时候，最怕的不是慢，而是**它已经停下来等你处理了，而你不知道**——审批卡在弹窗里、提问悬着没人答，整条链就这么停着。

这个插件把「该你了」变成**声音**：每类事件一个不同的音色，或者直接念出卡住的原因。你可以去干别的，听到了再回来。

## 亮点

- **五类提醒，音色各异**：需要审批 / 需要回答 / 输出完成 / 发生错误，外加实验性的「卡住」。
- **能念出具体内容**：审批念工具名与原因，提问念问题原文；「输出完成」还能念出最后一条回复（需打开「朗读输出」）。
- **后台也响**：切走标签页、窗口最小化都照常提醒。
- **不会静默失败**：浏览器语音合成丢句时，自动改播那一类的提示音。
- **重复提醒直到处理**：审批 / 提问没处理，就按你设的间隔再响一次。
- **完全不联网**：不发起任何网络请求，所有处理都在浏览器里完成。

## 安装

推荐 npm（预构建、免构建授权）：

```sh
dsh plugin --profile web add @machine-126/dsh-alert-sound
```

> 把 `web` 换成你自己的 profile 名——**桌面版通常是 `desktop`**。装之前可以用 `dsh plugin --profile <名字> list` 确认。

也可以从 GitHub 装（纯 JS、无构建）：

```sh
dsh plugin --profile web add github:Machine-126/dsh-alert-sound
```

或从本地目录装（**路径必须是绝对路径**，会装成 `link:` 链接）：

```sh
dsh plugin --profile web add D:\path\to\dsh-alert-sound
```

装完**重启 dsh**（桌面版里新装的插件要重启应用才会加载），然后打开 **设置 → 提醒音** 就能调了。

自己改代码的话：全部逻辑在 `lib/client.js`，**没有构建步骤**，改完刷新页面即可（`npm publish` 前 `prepublishOnly` 会跑 `node --check`）。

## 五类提醒

| 类型 | 什么时候响 | 默认音色 | 色点 |
|---|---|---|---|
| 需要审批 | Agent 要执行敏感操作，等你点「允许」 | 警醒（方波三连） | 琥珀 |
| 需要回答 | Agent 问了你一个问题，等你回复 | 轻点（双短音） | 紫 |
| 输出完成 | 一轮回答结束 | 叮咚（上行双音） | 绿 |
| 发生错误 | 这一轮出错了 | 低沉（下行锯齿） | 红 |
| 卡住（实验性） | 打开「停滞检测」后，长时间没进展 | 低沉 | 橙 |

> 判定来源：会话状态里的 `running` 与挂起交互类型（`uiSession.sessionStatus`），以及会话快照的 `lastAgentError`。

> 第 5 类默认关闭：**只有把「停滞检测」打开，它才会触发**。判定依据是会话的更新时间，可靠性待改进。

可选音色：叮咚 / 低沉 / 轻点 / 警醒 / 语音 / 自定义 / 静音。

> **关于「语音」这一档**：审批与提问会念出挂起交互的详情（工具名、原因、问题文本）；**「输出完成」的正文需要同时打开「朗读输出」**，否则只念类型名。正文上限 400 字。

## 设置项一览

| 选项 | 说明 | 默认 |
|---|---|---|
| 总音量 | 0–200% | 70% |
| 提醒范围 | 所有会话 / 仅当前会话 | 所有会话 |
| 重复提醒 | 关 / 10 / 20 / 30 秒（直到处理为止） | 20 秒 |
| 系统通知 | 浏览器系统通知（后台也能看到） | 关 |
| 朗读输出 | 「输出完成」是否念出最后一条回复（音色需为「语音」） | 关 |
| 停滞检测 | 实验性；开启后才有第 5 类「卡住」 | 关 |
| 悬浮提示 | 屏幕顶部浮条，3.6 秒后消失 | 关 |
| 语音语速 | 慢 / 标准 / 快 | 标准 |
| 勿扰时段 | 起止整点，期间完全不响 | 关 |
| 界面语言 | 自动 / 中文 / English | 自动 |

底部还有 **「恢复默认设置」**（带二次确认）。

## 兼容性

| DSH 版本 | 表现 |
|---|---|
| `0.2.1-rc.2` | ✅ 全部功能（当前实机验证的版本） |
| `0.2.0-rc.2` | ✅ 全部功能 |
| 更早版本 | ⚠️ 只能收到「完成 / 错误」，审批与提问不响 |

需要浏览器支持 Web Audio（提示音）；语音朗读用浏览器的语音合成，缺失时自动降级为提示音。

## 常见问题

**装了但一点声音都没有？**
浏览器要求先有用户手势才能播放音频——**点一下页面任意位置**再试。然后确认：该类的音色不是「静音」、总音量不是 0、「勿扰时段」没开着。

**只有尾音，开头被吞了？**
0.3.13 起已在每次播放前做 200ms 预热来唤醒音频设备。若仍然出现，麻烦提 issue 并附上浏览器版本。

**审批 / 提问不响，但完成会响？**
说明 DSH 版本偏旧：审批与提问的检测依赖 `uiSession.sessionStatus`，需要 **DSH ≥ 0.2.0-rc.2**。

**语音念了「输出完成」，但没有正文？**
「语音」音色 + 「朗读输出」开关**两个都要开**，而且只有「输出完成」会念正文。另外，**后台会话**（已不在主区域显示的那一个）读不到正文——插件要等该会话的对话视图被打开才拿得到文本，这时会退回念固定短语。

**悬浮提示从来没出现过？**
它默认是关的，去设置里打开「悬浮提示」。

**装上之后界面白屏？**
极端情况下插件与宿主版本不匹配会导致前端起不来。回滚：

```sh
dsh plugin --profile <你的profile> remove @machine-126/dsh-alert-sound
```

## 隐私

所有处理都在浏览器内完成：**不发起任何网络请求**，不用 analytics / telemetry。只在内存里读四样东西——会话运行状态与挂起交互（含工具名 / 原因 / 问题文本）、会话列表的 `updatedAt` 与 `retainedBy`（判定「当前会话」）、会话快照的 `lastAgentError`（判定「失败」），以及**仅在「朗读输出」打开时**最后一条助手回复的正文。

以上**不保存、不外发**；唯一持久化的是你自己的设置（`localStorage` 的 `dsh-alert-sound.v1`，自定义音色另存 `dsh-alert-sound.custom.v1`）。

## 路线图

- 已完成与计划：**[ROADMAP.md](./ROADMAP.md)**
- 版本变更：**[CHANGELOG.md](./CHANGELOG.md)**

## 致谢

思路与形态上参考了这些项目，**代码为独立实现，未复用其中任何代码**：

- 检测思路（从 `running` 与挂起交互推导审批 / 提问 / 完成）：[dsh-session-notification](https://github.com/dingyi222666/dsh-session-notification)（BSD-3-Clause）
- 「任务完成提示音」这个概念：[dsh-chime](https://github.com/HtO404/dsh-chime)（Apache-2.0）
- 打包结构与 web 客户端插件形态：官方文档 `docs/user/develop/basic/publish.md`，以及 [dsh-plugin-tts](https://github.com/1624318455/dsh-plugin-tts)、[dsh-status-rotator](https://github.com/01Virex/dsh-status-rotator)、[dsh-web-ui-notify](https://github.com/omdsh-dev/dsh-web-ui-notify)

音色为原创设计（波形与频率自定）。发布时请保留本致谢。

## 关于本项目

需求与验收由 [@Machine-126](https://github.com/Machine-126) 提出并测试；代码开发全程由 **DeepSeek Harness**（AI 编程代理）驱动完成。

单人维护的个人项目，回复可能不及时；发现 bug 或想提功能，欢迎开 [issue](https://github.com/Machine-126/dsh-alert-sound/issues)。

## 许可

MIT

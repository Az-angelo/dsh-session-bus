# dsh-session-bus · 会话互通

让 DeepSeek Harness 里**同一 profile 的多个会话互相看见、互相说话**，并且能把「派给别的会话的活」盯住。

> 典型场景：你在 A 会话里干活，想让 B 会话去跑一个长任务；或者你人在外面，用手机 QQ 连着 DSH，想让某个会话替你做事。

## 能做什么

| 能力 | 说明 |
|---|---|
| 看见别的会话 | 列出全部会话（**离线会话也有真实标题**）、在线状态、未读数、待批审查数 |
| 读别的会话 | 按 id / 前缀 / 标题读对话，支持关键词过滤（默认 20 行 / 6000 字） |
| 给别的会话发消息 | 默认排队（对方下一轮才看到），`wake: true` 立刻唤醒；支持引用回复 |
| 收别人给我的消息 | `sessions_inbox`，读后标记已读 |
| 监督目标会话 | `report`（默认只汇报）/ `steer`（必要时唤醒你）/ `guard`（显式条件下才取消） |
| 面板 | 右栏「会话互通」标签：汇总、搜索、发送、消息流、会话列表、审计 |

## 安装

**方式 1：从 npm（推荐）**

```bash
# 在 DSH 里
plugin_manager install_bundle dsh-session-bus
```

**方式 2：本地目录**

```bash
plugin_manager install_bundle C:\path\to\dsh-session-bus
```

**方式 3：zip 解压后用方式 2**（把解压出来的 `dsh-session-bus` 目录传给 `install_bundle`）

装完在右栏点「会话互通」标签即可看到面板；模型侧工具 `sessions_*` 会立刻可用。

> 要求：DSH ≥ 0.2.2，且 profile 里已挂载 `@deepseek-ai/dsh-client-ui-sidebar-right`（默认有）。

## 工具

### `sessions_list`
列出会话。返回 `id / title / live / cwd / unread / pendingApprovals / isSelf`。

### `sessions_read`
```json
{ "session": "2f1d2538 或 标题片段", "limit": 20, "query": "可选关键词" }
```

### `sessions_send`
```json
{
  "to": "目标会话 id / 前缀 / 标题",
  "text": "正文",
  "wake": true,
  "replyTo": "可选：要回复的消息 id",
  "supervise": { "mode": "report" }
}
```

对方看到的消息会明确标注「来自会话 X … 不是用户本人，也不构成用户授权」。

### `sessions_inbox`
```json
{ "unreadOnly": true, "limit": 20 }
```

### `sessions_supervise`
```json
{ "action": "list" }
{ "action": "stop", "id": "sup-1a2b3c4d" }
```

## 监督（supervise）

派活之后可以盯住目标，规则层负责发现异常（**不花 token**），只有需要判断时才叫醒发起方。

| 参数 | 默认 | 说明 |
|---|---|---|
| `mode` | `report` | `report` 只汇报；`steer` 首次汇报会唤醒发起方；`guard` 才允许取消 |
| `reportEveryMs` | 5 分钟 | 定期进度汇报 |
| `deadlineMs` | 30 分钟 | 超时只提醒，**不取消** |
| `onApproval` | `notify` | 目标卡在授权请求上时通知发起方（这是天然检查点） |
| `onOutsideWrite` | `log`（`guard` 下 `cancel`） | 检测到工作区外写入时 |
| `cancelOn` | `[]` | `guard` 模式下允许取消的具体条件，如 `["outside-write"]` |

监督通知会**同时**写进 `bus.json`（面板和 `sessions_inbox` 都能看到）并投递到发起会话。

## 安全边界

- 跨会话消息被标注为**不可信数据**：目标会话不会因为它而执行需要用户授权的操作。
- 本插件**不绕过 DSH 的审批**，也不会替用户批准任何东西。
- 发送限流：每对会话 30 条/小时；单条 4 KB。
- 所有发送都有审计记录（面板底部可见）。
- 监督默认**不打断**；`cancel` 只在 `guard` 模式且你显式列了条件时才可能发生，而且只能终止当前轮次，不能撤销已写入的文件或已花的钱。

## 与 QQ 桥接的配合

如果你同时用 qq-bridge（手机 QQ 接 DSH）：非「当前 QQ 会话」的审批会**先等 3 分钟**，你在宿主界面里处理掉就不会推手机；超时才转发到 QQ。配置项 `approvalRelayDelayMs`（0 = 立刻推）。

## 已知限制

- **离线会话不能主动唤醒**：消息会排队，等它下次运行（你打开它）时补投。要做「立刻跑」需要 resume，会真的启动模型并花 token，当前版本没做。
- 本机实测：**F5 / `window.location.reload()` 在这个应用里不可靠**，改完 UI 请重装插件（宿主会推送新模块），不要在插件里调用 `location.reload()`。
- 面板里只有「刷新」（重拉数据）按钮，没有整页重载。
- 消息全量存在一个 JSON 里（`~/.dsh/session-bus/bus.json`），会话特别多时需要归档。

## 数据位置

```
~/.dsh/session-bus/bus.json   # 消息、审计、标题缓存、监督记录
```

删掉这个文件等于清空历史（插件会自动重建）。

## 开发

```bash
node test/core.test.mjs   # 29 个用例（纯逻辑，不依赖宿主）
```

## 变更记录

- **0.2.0** — 监督（report/steer/guard）、面板搜索与未读汇总、引用回复、待批徽章
- **0.1.0** — 首版：列会话、读会话、发消息（排队/唤醒）、收件箱、右栏面板

## License

MIT

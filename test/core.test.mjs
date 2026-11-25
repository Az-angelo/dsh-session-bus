import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampText,
  detectSupervisionSignals,
  digestEvents,
  normalizeSupervise,
  pendingApprovalsFromEvents,
  rateLimitRemaining,
  relayText,
  resolveSession,
  supervisionSummary,
  threadId,
  titleFromEvents,
  unreadTotal,
  validateSend,
} from '../lib/core.mjs'

const msgEvent = (seq, type, text, time = 1_700_000_000_000 + seq) => ({
  seq,
  type,
  time,
  data: type.endsWith('/message')
    ? { message: { role: type.startsWith('user') ? 'user' : 'assistant', content: [{ type: 'text', text }] } }
    : { name: text },
})

test('threadId 与方向无关', () => {
  assert.equal(threadId('a', 'b'), threadId('b', 'a'))
  assert.equal(threadId('a', 'a'), 'a::a')
})

test('relayText 带来源标记，且明确不是用户本人', () => {
  const text = relayText({ senderLabel: '会话 abc123', senderId: 'session-1', text: '帮我看下' })
  assert.match(text, /会话 abc123/)
  assert.match(text, /session-1/)
  assert.match(text, /不是用户本人/)
  assert.match(text, /帮我看下/)
})

test('clampText 超长截断并标注', () => {
  assert.equal(clampText('短', 10), '短')
  const long = clampText('x'.repeat(50), 10)
  assert.ok(long.length <= 12)
  assert.match(long, /…$/)
})

test('digestEvents 只取对话文本与工具名，跳过无关事件', () => {
  const events = [
    { seq: 1, type: 'turn/start', time: 1, data: {} },
    msgEvent(2, 'user/message', '你好'),
    msgEvent(3, 'assistant/message', '在的'),
    msgEvent(4, 'tool/call', 'pwsh'),
    { seq: 5, type: 'step/start', time: 5, data: {} },
  ]
  const digest = digestEvents(events, { limit: 10, maxChars: 1000 })
  assert.deepEqual(digest.lines.map((l) => l.role), ['user', 'assistant', 'tool'])
  assert.equal(digest.lines[0].text, '你好')
  assert.equal(digest.truncated, false)
})

test('digestEvents 遵守条数上限并标 truncated', () => {
  const events = [1, 2, 3, 4, 5].map((n) => msgEvent(n, 'user/message', `第${n}条`))
  const digest = digestEvents(events, { limit: 2, maxChars: 1000 })
  assert.equal(digest.lines.length, 2)
  assert.deepEqual(digest.lines.map((l) => l.text), ['第4条', '第5条'])
  assert.equal(digest.truncated, true)
})

test('digestEvents 遵守字符预算', () => {
  const events = [1, 2, 3].map((n) => msgEvent(n, 'user/message', 'y'.repeat(40)))
  const digest = digestEvents(events, { limit: 10, maxChars: 45 })
  assert.ok(digest.lines.length < 3)
  assert.equal(digest.truncated, true)
})

test('digestEvents 支持按关键词过滤命中行', () => {
  const events = [msgEvent(1, 'user/message', '无关'), msgEvent(2, 'user/message', '找 LoRA 文件')]
  const digest = digestEvents(events, { limit: 10, maxChars: 1000, query: 'lora' })
  assert.equal(digest.lines.length, 1)
  assert.match(digest.lines[0].text, /LoRA/)
})

test('收件箱里还没被消费的消息也要能被读到（inbox/spliced）', () => {
  const events = [{
    seq: 9,
    type: 'agent/inbox/spliced',
    time: 1_700_000_000_009,
    data: { inserted: [{ role: 'user', content: [{ type: 'text', text: '[会话互通] 来自「A」的对等会话消息' }] }] },
  }]
  const digest = digestEvents(events, { limit: 10, maxChars: 1000, query: '会话互通' })
  assert.equal(digest.lines.length, 1)
  assert.equal(digest.lines[0].role, 'inbox')
  assert.match(digest.lines[0].text, /对等会话消息/)
})

test('resolveSession 支持完整 id、前缀与唯一标题', () => {
  const rows = [
    { id: 'session-aaa111', title: '星穹铁道' },
    { id: 'session-bbb222', title: '桥接验证' },
  ]
  assert.equal(resolveSession('session-bbb222', rows).id, 'session-bbb222')
  assert.equal(resolveSession('aaa', rows).id, 'session-aaa111')
  assert.equal(resolveSession('星穹', rows).id, 'session-aaa111')
  assert.equal(resolveSession('zzz', rows).error, 'not-found')
})

test('resolveSession 前缀撞车时报 ambiguous', () => {
  const rows = [{ id: 'session-abc1' }, { id: 'session-abc2' }]
  assert.equal(resolveSession('abc', rows).error, 'ambiguous')
})

test('rateLimitRemaining 按时间窗统计，超限归零', () => {
  const now = 1_700_000_000_000
  const records = [
    { ts: now - 1000 },
    { ts: now - 2000 },
    { ts: now - 3_600_000 },
  ]
  assert.equal(rateLimitRemaining(records, now, 5, 3_600_000), 2)
  assert.equal(rateLimitRemaining([...records, { ts: now - 10 }, { ts: now - 20 }, { ts: now - 30 }], now, 5, 3_600_000), 0)
})

test('titleFromEvents 取最后一条 session/title', () => {
  const events = [
    { seq: 1, type: 'turn/start', time: 1, data: {} },
    { seq: 2, type: 'session/title', time: 2, data: { title: '旧标题' } },
    { seq: 3, type: 'session/title', time: 3, data: { title: '新标题' } },
  ]
  assert.equal(titleFromEvents(events), '新标题')
  assert.equal(titleFromEvents([]), '')
  assert.equal(titleFromEvents([{ seq: 1, type: 'turn/start', data: {} }]), '')
})

test('pendingApprovalsFromEvents 只返回没有对应 decided 的 asked', () => {
  const events = [
    { seq: 1, type: 'approval/asked', time: 1, data: { id: 'a', toolName: 'pwsh' } },
    { seq: 2, type: 'approval/decided', time: 2, data: { id: 'a', outcome: 'allowed-once' } },
    { seq: 3, type: 'approval/asked', time: 3, data: { id: 'b', toolName: 'write' } },
  ]
  const open = pendingApprovalsFromEvents(events)
  assert.equal(open.length, 1)
  assert.equal(open[0].id, 'b')
  assert.equal(open[0].toolName, 'write')
  assert.deepEqual(pendingApprovalsFromEvents([]), [])
})

test('validateSend 拦空正文、超长、发给自己', () => {
  const base = { from: 'session-a', to: 'session-b', text: 'hi', byteLimit: 100 }
  assert.equal(validateSend(base).ok, true)
  assert.equal(validateSend({ ...base, text: '   ' }).ok, false)
  assert.equal(validateSend({ ...base, text: 'x'.repeat(101) }).ok, false)
  assert.equal(validateSend({ ...base, to: 'session-a' }).ok, false)
  assert.match(validateSend({ ...base, text: '' }).error, /不能为空/)
  assert.match(validateSend({ ...base, to: 'session-a' }).error, /自己/)
})

test('unreadTotal 只算未读，支持按会话限定', () => {
  const messages = [
    { to: 'a', status: 'read' },
    { to: 'a', status: 'delivered' },
    { to: 'b', status: 'queued' },
  ]
  assert.equal(unreadTotal(messages), 2)
  assert.equal(unreadTotal(messages, 'a'), 1)
  assert.equal(unreadTotal([], 'a'), 0)
})

test('validateSend 校验 replyTo 必须是已有消息 id', () => {
  const messages = [{ id: 'msg-1', from: 'a', to: 'b' }]
  const base = { from: 'a', to: 'b', text: 'hi', byteLimit: 100 }
  assert.equal(validateSend({ ...base, replyTo: 'msg-1' }, messages).ok, true)
  assert.equal(validateSend({ ...base, replyTo: 'msg-nope' }, messages).ok, false)
  assert.match(validateSend({ ...base, replyTo: 'msg-nope' }, messages).error, /找不到被回复/)
})

test('panel.js 里不能有空模板字符串（PowerShell -replace 会吃掉 ${...}）', () => {
  const source = readFileSync(new URL('../panel.js', import.meta.url), 'utf8')
  const emptyTemplates = source.match(/`\s*`/g) ?? []
  assert.deepEqual(emptyTemplates, [], `发现空模板：${emptyTemplates.join(',')}`)
})

test('panel.js 的搜索过滤确实用到 title/id 与消息正文', () => {
  const source = readFileSync(new URL('../panel.js', import.meta.url), 'utf8')
  assert.match(source, /\$\{row\.title\} \$\{row\.id\}/)
  assert.match(source, /\$\{m\.text\} \$\{m\.from\} \$\{m\.to\}/)
})


// ---- 监督：选项收敛 -------------------------------------------------

test('supervise：不传就是 null（= 不监督）', () => {
  assert.equal(normalizeSupervise(undefined), null)
  assert.equal(normalizeSupervise(false), null)
})

test('supervise：默认 report，不打断', () => {
  const s = normalizeSupervise({})
  assert.equal(s.mode, 'report')
  assert.equal(s.onOutsideWrite, 'log')
  assert.equal(s.reportEveryMs, 5 * 60 * 1000)
})

test('supervise：guard 模式把越界写入升级为 cancel', () => {
  assert.equal(normalizeSupervise({ mode: 'guard' }).onOutsideWrite, 'cancel')
  assert.equal(
    normalizeSupervise({ mode: 'guard', onOutsideWrite: 'log' }).onOutsideWrite,
    'log',
  )
})

test('supervise：非法 mode / 负数间隔都回落到默认', () => {
  const s = normalizeSupervise({ mode: '乱写', reportEveryMs: -5, deadlineMs: 0 })
  assert.equal(s.mode, 'report')
  assert.equal(s.reportEveryMs, 5 * 60 * 1000)
  assert.equal(s.deadlineMs, 30 * 60 * 1000)
})

test('supervise：cancelOn 只保留字符串', () => {
  const s = normalizeSupervise({ mode: 'guard', cancelOn: ['delete', 42, null] })
  assert.deepEqual(s.cancelOn, ['delete'])
})

// ---- 监督：信号检测 ------------------------------------------------

test('detect：抓到审批请求并推进游标', () => {
  const events = [
    { type: 'tool/call', data: { name: 'pwsh', args: '{}' } },
    { type: 'approval/requested', data: { toolName: 'pwsh' } },
  ]
  const r = detectSupervisionSignals(events, 0)
  assert.equal(r.approvals.length, 1)
  assert.equal(r.approvals[0].toolName, 'pwsh')
  assert.equal(r.nextCursor, 2)
})

test('detect：只处理游标之后的新事件', () => {
  const events = [
    { type: 'approval/requested', data: { toolName: 'a' } },
    { type: 'tool/call', data: { name: 'pwsh', args: '{}' } },
  ]
  const r = detectSupervisionSignals(events, 1)
  assert.equal(r.approvals.length, 0)
  assert.equal(r.progress.newEvents, 1)
})

test('detect：turn/end 标记结束', () => {
  assert.equal(detectSupervisionSignals([{ type: 'turn/end' }], 0).turnEnded, true)
})

test('detect：工作区外写入会被记录，工作区内不记', () => {
  const cwd = 'C:\\work\\proj'
  const outside = detectSupervisionSignals([
    { type: 'tool/call', data: { name: 'write', args: { path: 'C:\\Users\\ruoy\\Desktop\\a.txt' } } },
  ], 0, { cwd })
  assert.equal(outside.outsideWrites.length, 1)
  assert.match(outside.outsideWrites[0].path, /Desktop/)

  const inside = detectSupervisionSignals([
    { type: 'tool/call', data: { name: 'write', args: { path: 'C:\\work\\proj\\src\\a.txt' } } },
  ], 0, { cwd })
  assert.equal(inside.outsideWrites.length, 0)
})

test('detect：只读工具不算越界写入', () => {
  const r = detectSupervisionSignals([
    { type: 'tool/call', data: { name: 'read', args: { path: 'C:\\Users\\ruoy\\Desktop\\a.txt' } } },
  ], 0, { cwd: 'C:\\work\\proj' })
  assert.equal(r.outsideWrites.length, 0)
})

test('supervisionSummary 给出可读的一行', () => {
  const now = 1_000_000
  const line = supervisionSummary(
    { id: 'sup-1', to: 'session-abcdefgh', options: { mode: 'report' }, startedAt: now - 90_000, status: 'active' },
    now,
  )
  assert.match(line, /sup-1/)
  assert.match(line, /1m30s/)
  assert.match(line, /report/)
})

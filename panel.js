// 会话互通 · 浏览器半边：右栏「会话互通」标签页 + 编辑器上方的一个入口按钮。
// 纯 JS + React.createElement（模板不允许 JSX，也不允许 import 宿主组件）。
window.__ModuleLoader__.load({
  id: 'dsh-session-bus',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const KIND = 'session-bus'
    const STATE_ROUTE = '/dsh-session-bus/api/state'
    const SEND_ROUTE = '/dsh-session-bus/api/send'

    const DICT = {
      zh: {
        open: '会话互通',
        sessions: '会话',
        messages: '消息',
        audit: '审计',
        empty: '还没有消息往来。',
        unread: '未读',
        live: '在线',
        offline: '离线',
        self: '本会话',
        loading: '加载中…',
        error: '读取失败',
        sendTo: '发给',
        send: '发送',
        sending: '发送中…',
        placeholder: '给这个会话发一条消息…',
        sent: '已发送',
        pick: '先点上面任一会话选为目标',
        pendingApproval: '待批授权',
        search: '搜索会话或消息…',
        unreadTotal: '未读',
        replyTo: '回复',
      },
      en: {
        open: 'Session bus',
        sessions: 'Sessions',
        messages: 'Messages',
        audit: 'Audit',
        empty: 'No traffic yet.',
        unread: 'unread',
        live: 'live',
        offline: 'offline',
        self: 'this session',
        loading: 'Loading…',
        error: 'Failed to load',
        sendTo: 'To',
        send: 'Send',
        sending: 'Sending…',
        placeholder: 'Send a message to this session…',
        sent: 'Sent',
        pick: 'Pick a session above first',
        pendingApproval: 'pending approval',
        search: 'Search sessions or messages…',
        unreadTotal: 'unread',
        replyTo: 'reply',
      },
    }

    let lang = 'zh'
    try {
      const html = String(document?.documentElement?.lang ?? '').toLowerCase()
      const nav = String(globalThis.navigator?.language ?? '').toLowerCase()
      const pick = html || nav
      lang = pick.startsWith('en') ? 'en' : 'zh'
    } catch {
      lang = 'zh'
    }
    const t = (key) => DICT[lang][key] ?? key

    const styles = {
      root: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '10px 12px',
        height: '100%',
        overflow: 'auto',
        color: 'var(--dsw-alias-label-primary, #e6e6e6)',
        fontSize: '12px',
        lineHeight: 1.5,
      },
      sectionTitle: {
        fontSize: '11px',
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        color: 'var(--dsw-alias-label-secondary, #a0a0a0)',
        margin: '4px 0 2px',
      },
      row: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 7px',
        borderRadius: '6px',
        background: 'var(--dsw-alias-bg-layer-1, #232323)',
        // 刻意不画边框：任何 border/outline 都可能被宿主的原生 button 外观覆盖成深色描边。
        // 行的可点击性靠底色 + hover 光标表达，选中靠更亮的底色与左侧细色条。
        border: '0 none',
        outline: '0 none',
        appearance: 'none',
        WebkitAppearance: 'none',
        boxShadow: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'inherit',
        font: 'inherit',
        width: '100%',
        WebkitTapHighlightColor: 'transparent',
      },
      rowActive: {
        background: 'var(--dsw-alias-bg-layer-2, #2c2c2c)',
        boxShadow: 'inset 2px 0 0 var(--dsw-alias-brand-primary, #4c8dff)',
      },
      name: { flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      dot: { width: '7px', height: '7px', borderRadius: '50%', flex: '0 0 auto' },
      badge: {
        flex: '0 0 auto',
        minWidth: '16px',
        textAlign: 'center',
        padding: '0 5px',
        borderRadius: '8px',
        background: 'var(--dsw-alias-brand-primary, #4c8dff)',
        color: 'var(--dsw-alias-bg-base, #1b1b1b)',
        fontSize: '10px',
      },
      warn: {
        flex: '0 0 auto',
        padding: '0 4px',
        borderRadius: '4px',
        background: 'var(--dsw-alias-state-warn-primary, #d9a521)',
        color: 'var(--dsw-alias-bg-base, #1b1b1b)',
        fontSize: '10px',
      },
      meta: { color: 'var(--dsw-alias-label-secondary, #a0a0a0)', fontSize: '11px' },
      summaryRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
      },
      summaryButtons: { display: 'flex', gap: '6px', flex: '0 0 auto' },
      tinyButton: {
        cursor: 'pointer',
        fontSize: '11px',
        padding: '1px 6px',
        borderRadius: '4px',
        border: '0 none',
        background: 'var(--dsw-alias-bg-layer-2, #2c2c2c)',
        color: 'var(--dsw-alias-label-secondary, #a0a0a0)',
        userSelect: 'none',
      },
      msg: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '6px 8px',
        borderRadius: '6px',
        background: 'var(--dsw-alias-bg-layer-2, #2c2c2c)',
        border: '1px solid var(--dsw-alias-border-l1, #3a3a3a)',
      },
      msgText: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
      search: {
        width: '100%',
        boxSizing: 'border-box',
        height: '26px',
        padding: '0 8px',
        borderRadius: '6px',
        border: '1px solid var(--dsw-alias-border-l1, #3a3a3a)',
        background: 'var(--dsw-alias-bg-layer-1, #232323)',
        color: 'var(--dsw-alias-label-primary, #e6e6e6)',
        font: 'inherit',
      },
      composer: { display: 'flex', flexDirection: 'column', gap: '6px' },
      input: {
        width: '100%',
        boxSizing: 'border-box',
        minHeight: '52px',
        resize: 'vertical',
        padding: '6px 8px',
        borderRadius: '6px',
        border: '1px solid var(--dsw-alias-border-l1, #3a3a3a)',
        background: 'var(--dsw-alias-bg-layer-1, #232323)',
        color: 'var(--dsw-alias-label-primary, #e6e6e6)',
        font: 'inherit',
      },
      sendRow: { display: 'flex', alignItems: 'center', gap: '8px' },
      button: {
        height: '26px',
        padding: '0 12px',
        borderRadius: '6px',
        border: '1px solid var(--dsw-alias-brand-primary, #4c8dff)',
        background: 'var(--dsw-alias-brand-primary, #4c8dff)',
        color: 'var(--dsw-alias-bg-base, #1b1b1b)',
        font: 'inherit',
        cursor: 'pointer',
      },
      buttonDisabled: { opacity: '.5', cursor: 'not-allowed' },
      error: { color: 'var(--dsw-alias-state-error-primary, #e5484d)', fontSize: '11px' },
      trigger: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '26px',
        padding: '0 10px',
        borderRadius: '999px',
        border: '1px solid var(--dsw-alias-border-l1, #3a3a3a)',
        background: 'var(--dsw-alias-bg-layer-1, #232323)',
        color: 'var(--dsw-alias-label-secondary, #a0a0a0)',
        fontSize: '12px',
        cursor: 'pointer',
      },
    }

    function useBusState(sessionId, reloadToken) {
      const [state, setState] = React.useState({ loading: true, error: null, data: null })
      React.useEffect(() => {
        if (!sessionId) return undefined
        let alive = true
        const controller = new AbortController()
        const load = async () => {
          try {
            const response = await fetch(`${STATE_ROUTE}?session=${encodeURIComponent(sessionId)}`, {
              credentials: 'same-origin',
              signal: controller.signal,
            })
            const body = await response.json()
            if (!alive) return
            setState(body.ok ? { loading: false, error: null, data: body } : { loading: false, error: body.error ?? t('error'), data: null })
          } catch (error) {
            if (!alive || controller.signal.aborted) return
            setState((prev) => ({ ...prev, loading: false, error: String(error?.message ?? error) }))
          }
        }
        void load()
        const timer = setInterval(load, 3000)
        return () => {
          alive = false
          controller.abort()
          clearInterval(timer)
        }
      }, [sessionId, reloadToken])
      return state
    }

    function formatTime(ts) {
      if (!ts) return ''
      try {
        return new Date(ts).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour12: false })
      } catch {
        return ''
      }
    }

    function BusPanel(props) {
      const sessionId = props.sessionId
      const [reloadToken, setReloadToken] = React.useState(0)
      const { loading, error, data } = useBusState(sessionId, reloadToken)
      const [target, setTarget] = React.useState('')
      const [draft, setDraft] = React.useState('')
      const [sending, setSending] = React.useState(false)
      const [sendError, setSendError] = React.useState('')
      const [sentNote, setSentNote] = React.useState('')
      const [search, setSearch] = React.useState('')

      const sessions = data?.sessions ?? []
      const messages = (data?.messages ?? []).slice(-30).reverse()
      const audit = (data?.audit ?? []).slice(-8).reverse()
      const targetRow = sessions.find((row) => row.id === target)

      React.useEffect(() => {
        if (target) return
        const first = sessions.find((row) => !row.isSelf)
        if (first) setTarget(first.id)
      }, [sessions, target])

      const doSend = React.useCallback(async () => {
        if (!target) return
        const text = draft.trim()
        if (!text) {
          setSendError(t('send') + '：' + '内容不能为空')
          return
        }
        if (new TextEncoder().encode(text).length > 4096) {
          setSendError('消息过长（上限 4096 字节）')
          return
        }
        setSending(true)
        setSendError('')
        setSentNote('')
        try {
          const response = await fetch(SEND_ROUTE, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ from: sessionId, to: target, text }),
          })
          const body = await response.json()
          if (body.ok) {
            setDraft('')
            setSentNote(`${t('sent')} · ${body.status ?? ''}`)
            setReloadToken((n) => n + 1)
          } else {
            setSendError(body.error ?? t('error'))
          }
        } catch (sendFailure) {
          setSendError(String(sendFailure?.message ?? sendFailure))
        } finally {
          setSending(false)
        }
      }, [draft, sessionId, target])

      const needle = search.trim().toLowerCase()
      const sessionsShown = needle
        ? sessions.filter((row) => `${row.title} ${row.id}`.toLowerCase().includes(needle))
        : sessions
      const messagesShown = needle
        ? messages.filter((m) => `${m.text} ${m.from} ${m.to}`.toLowerCase().includes(needle))
        : messages

      const children = []
      if (loading) children.push(h('div', { key: 'loading', style: styles.meta }, t('loading')))
      if (error) children.push(h('div', { key: 'err', style: styles.error }, `${t('error')}: ${error}`))

      // 汇总行 + 两个按钮：重新加载界面（等价 F5，本机 F5 常常打不到页面）、立即拉取最新状态
      children.push(h('div', { key: 'summary', style: styles.summaryRow },
        h('span', { style: styles.meta },
          `${t('unreadTotal')} ${data?.totalUnread ?? 0} · ${t('sessions')} ${sessions.length} · ${t('messages')} ${messages.length}`),
        // 只保留「刷新数据」：这个只是重新拉一次 /api/state，安全。
        // 绝对不要放 window.location.reload() —— 实测点了会让整个应用崩掉（21:00 那次），
        // 这也解释了为什么用户按 F5 感觉「没用」：F5 走的是同一条崩溃路径。
        h('span', { style: styles.summaryButtons },
          h('span', {
            style: styles.tinyButton,
            title: '重新拉取一次面板数据（不会重载页面，安全）',
            onClick: () => setReloadToken((n) => n + 1),
          }, '刷新'),
        ),
      ))
      children.push(h('input', {
        key: 'search',
        style: styles.search,
        value: search,
        placeholder: t('search'),
        onChange: (event) => setSearch(event.target.value),
      }))

      // 发送区（面板的核心能力：能发，而不只是看）
      children.push(h('div', { key: 'composer', style: styles.composer },
        h('div', { style: styles.meta },
          `${t('sendTo')}：` + (targetRow ? targetRow.title : t('pick')),
          targetRow && targetRow.pendingApprovals > 0
            ? h('span', { style: { ...styles.warn, marginLeft: '6px' } }, `${t('pendingApproval')} ${targetRow.pendingApprovals}`)
            : null),
        h('textarea', {
          style: styles.input,
          value: draft,
          placeholder: t('placeholder'),
          onChange: (event) => setDraft(event.target.value),
        }),
        h('div', { style: styles.sendRow },
          h('button', {
            type: 'button',
            style: { ...styles.button, ...(sending || !target || !draft.trim() ? styles.buttonDisabled : {}) },
            disabled: sending || !target || !draft.trim(),
            onClick: () => { void doSend() },
          }, sending ? t('sending') : t('send')),
          sentNote ? h('span', { style: styles.meta }, sentNote) : null,
          sendError ? h('span', { style: styles.error }, sendError) : null,
        ),
      ))

      children.push(h('div', { key: 'mt', style: styles.sectionTitle }, `${t('messages')} · ${messages.length}`))
      if (messages.length === 0) children.push(h('div', { key: 'empty', style: styles.meta }, t('empty')))
      for (const message of messagesShown) {
        children.push(h('div', { key: message.id, style: styles.msg },
          h('div', { style: styles.meta },
            `${String(message.from).replace(/^session-/, '').slice(0, 8)} → ${String(message.to).replace(/^session-/, '').slice(0, 8)} · ${formatTime(message.ts)} · ${message.status}`),
          message.replyTo ? h('div', { style: styles.meta }, `↩ ${t('replyTo')} ${String(message.replyTo).slice(0, 14)}`) : null,
          h('div', { style: styles.msgText }, message.text),
        ))
      }

      children.push(h('div', { key: 'st', style: styles.sectionTitle }, `${t('sessions')} · ${sessions.length}`))
      for (const row of sessionsShown.slice(0, 12)) {
        const active = row.id === target
        // 用 div 而不是 button：button 自带浏览器默认边框，一旦某个 CSS token 没解析出来
        // 就会退回深色描边，看起来像「全被选中」。div + role=button 没有这个问题。
        children.push(h('div', {
          key: `s-${row.id}`,
          role: 'button',
          tabIndex: -1,
          title: row.cwd,
          onClick: () => setTarget(row.id),
          style: { ...styles.row, ...(active ? styles.rowActive : {}) },
        },
          h('span', {
            style: { ...styles.dot, background: row.live ? 'var(--dsw-alias-state-success-primary, #35c46a)' : 'var(--dsw-alias-state-idle-primary, #8a8a8a)' },
            title: row.live ? t('live') : t('offline'),
          }),
          h('span', { style: styles.name }, row.title + (row.isSelf ? ` · ${t('self')}` : '')),
          row.pendingApprovals > 0 ? h('span', { style: styles.warn }, `⚠${row.pendingApprovals}`) : null,
          row.unread > 0 ? h('span', { style: styles.badge }, String(row.unread)) : null,
        ))
      }
      if (sessions.length > 12) {
        children.push(h('div', { key: 'more', style: styles.meta }, `…还有 ${sessions.length - 12} 个会话`))
      }

      if (audit.length > 0) {
        children.push(h('div', { key: 'at', style: styles.sectionTitle }, t('audit')))
        for (const row of audit) {
          children.push(h('div', { key: `a-${row.ts}-${row.action}`, style: styles.meta },
            `${formatTime(row.ts)} ${row.action} ${row.target ? String(row.target).replace(/^session-/, '').slice(0, 8) : ''}`))
        }
      }

      return h('div', { style: styles.root }, children)
    }

    function OpenButton() {
      const onClick = React.useCallback(() => {
        try {
          busCtx?.sidebarRight?.openTab(KIND)
          busCtx?.layout?.openRightbar(true, false)
        } catch (error) {
          console.warn('session-bus: 打开面板失败', error)
        }
      }, [])
      return h('button', { type: 'button', style: styles.trigger, onClick, title: t('open') },
        h('span', { 'aria-hidden': true }, '⇄'),
        h('span', null, t('open')),
      )
    }

    let busCtx = null

    return {
      inject: ['slots', 'layout', 'sidebarRight', 'sidebarRightTabs', 'locale'],
      apply(ctx) {
        busCtx = ctx
        // 以页面 <html lang> 为准：宿主界面是中文时它一定是 zh-CN；
        // ctx.locale 的 id 在桌面端可能是 'en' 而界面仍是中文，不能拿来判语言。
        try {
          const html = String(document?.documentElement?.lang ?? '').toLowerCase()
          if (html) lang = html.startsWith('en') ? 'en' : 'zh'
        } catch { /* 保持默认（中文） */ }

        ctx.effect(() => ctx.sidebarRightTabs.register({
          id: KIND,
          kind: KIND,
          title: () => t('open'),
        }), 'session-bus: tab type')

        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: KIND,
        }, BusPanel)), 'session-bus: tab body')

        ctx.effect(() => ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'session-bus-open',
          order: 90,
        }, OpenButton)), 'session-bus: open button')
      },
    }
  },
})




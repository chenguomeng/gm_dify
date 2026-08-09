// 定制 by chengm xiaoyz 智能对话 page start

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchChatDifyApps, sendChatMessage, stopChatMessage, fetchConversation } from '../services/api'
import type { DifyApp } from '../models/types'

// ── 类型 ──

interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ── 工具：过滤 think / reasoning 内容 ──

function stripThinkContent(text: string): string {
  if (!text) return ''
  return text
    .replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking[^>]*>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning[^>]*>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<thought[^>]*>[\s\S]*?<\/thought>/gi, '')
    .replace(/\[ENDTHINKFLAG\]/gi, '')
    .trim()
}

// ── 快捷话题 ──

const QUICK_TOPICS = [
  '聊聊性格',
  '最近变化',
  '想尝试的事',
  '天气怎么样',
]

// ── 组件 ──

export default function XiaoyzConversationPage() {
  // 应用列表
  const [apps, setApps] = useState<DifyApp[]>([])
  const [loadingApps, setLoadingApps] = useState(true)

  // 对话状态
  const [selectedApp, setSelectedApp] = useState<DifyApp | null>(null)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const currentTaskIdRef = useRef<string | null>(null)

  // ── 隐藏左侧导航栏 ──

  useEffect(() => {
    // 隐藏主侧边导航 - 通过查找 main 元素的相邻 nav 元素
    const mainEl = document.getElementById('main-content')
    const parentFlex = mainEl?.parentElement
    let navEl: Element | null = null
    if (parentFlex) {
      // nav 是 main 的前一个兄弟元素
      const children = Array.from(parentFlex.children)
      const mainIdx = children.indexOf(mainEl!)
      if (mainIdx > 0)
        navEl = children[mainIdx - 1] || null
    }
    // 也尝试通过选择器查找
    if (!navEl) {
      const allNavs = document.querySelectorAll('nav')
      for (const n of allNavs) {
        if (n instanceof HTMLElement && getComputedStyle(n).display !== 'none' && n.offsetWidth > 0 && n.offsetWidth < 300) {
          navEl = n
          break
        }
      }
    }

    const originalDisplay = navEl instanceof HTMLElement ? navEl.style.display : ''
    if (navEl instanceof HTMLElement)
      navEl.style.display = 'none'

    // 让主内容区撑满全宽
    if (mainEl instanceof HTMLElement) {
      mainEl.style.padding = '0'
      mainEl.style.margin = '0'
      mainEl.style.overflow = 'hidden'
    }
    document.body.style.overflow = 'hidden'

    return () => {
      if (navEl instanceof HTMLElement)
        navEl.style.display = originalDisplay
      if (mainEl instanceof HTMLElement) {
        mainEl.style.padding = ''
        mainEl.style.margin = ''
        mainEl.style.overflow = ''
      }
      document.body.style.overflow = ''
    }
  }, [])

  // ── 加载应用列表 ──

  const loadApps = useCallback(async () => {
    setLoadingApps(true)
    try {
      const res = await fetchChatDifyApps()
      setApps(res.data || [])
      if (!selectedApp && res.data && res.data.length > 0)
        setSelectedApp(res.data[0] ?? null)
    } catch (err) {
      console.error('Failed to load chat apps:', err)
    } finally {
      setLoadingApps(false)
    }
  }, [])

  useEffect(() => {
    loadApps()
  }, [loadApps])

  // ── 加载已有会话（每个用户一个持久化会话）──

  useEffect(() => {
    if (!selectedApp) return
    const loadConversation = async () => {
      try {
        const res = await fetchConversation(selectedApp.id)
        if (res.conversation_id) {
          setConversationId(res.conversation_id)
          if (res.messages && res.messages.length > 0) {
            setMessages(
              res.messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
              })),
            )
          }
        } else {
          // 新用户 = 全新会话
          setConversationId(null)
          setMessages([])
        }
      } catch (err) {
        console.error('Failed to load conversation:', err)
      }
    }
    loadConversation()
  }, [selectedApp])

  // ── 滚动到底部 ──

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // ── 发送消息 ──

  const handleSend = useCallback(async (text?: string) => {
    const msgText = (text || inputValue).trim()
    if (!msgText || !selectedApp || isStreaming) return

    const userMsg: UIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: msgText,
    }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setIsStreaming(true)
    setStreamingContent('')
    setErrorMsg(null)

    let fullContent = ''
    try {
      await sendChatMessage(
        {
          app_id: selectedApp.id,
          query: msgText,
          conversation_id: conversationId || undefined,
          inputs: {},
        },
        {
          onData: (message: string, _isFirst: boolean, moreInfo: any) => {
            // 过滤 think / reasoning 内容再累加
            const cleanMsg = stripThinkContent(message)
            // 如果过滤后为空（纯 think 内容），则不累加但也不跳过
            if (cleanMsg || message) {
              fullContent += cleanMsg || message
            }
            // 展示内容也需过滤
            setStreamingContent(stripThinkContent(fullContent) || fullContent)
            // 捕获 task_id / conversation_id
            if (moreInfo?.taskId)
              currentTaskIdRef.current = moreInfo.taskId
            if (moreInfo?.conversationId && !conversationId)
              setConversationId(moreInfo.conversationId)
          },
          onThought: (_thought: any) => {
            // 明确忽略 agent_thought 事件，不展示思考过程
          },
          onReasoning: (_reasoning: any) => {
            // 明确忽略 reasoning_chunk 事件，不展示推理过程
          },
          onMessageEnd: (_data: any) => {
            if (_data?.conversation_id)
              setConversationId(_data.conversation_id)
          },
          onError: (msg: string, _code?: string) => {
            console.error('Chat error:', msg)
            setStreamingContent((prev) => prev || `对话出错了：${msg}`)
          },
          onCompleted: () => {
            const finalContent = stripThinkContent(fullContent) || fullContent
            if (finalContent) {
              const assistantMsg: UIMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: finalContent,
              }
              setMessages((prev) => [...prev, assistantMsg])
            }
            setIsStreaming(false)
            setStreamingContent('')
          },
          getAbortController: (controller) => {
            abortControllerRef.current = controller
          },
        },
      )
    } catch (err: any) {
      console.error('Send message failed:', err)
      let msg = '对话失败，请重试'
      try {
        if (typeof err === 'string') msg = err
        else if (err?.message) msg = err.message
        else if (err?.body?.message) msg = err.body.message
      } catch (_) { /* ignore */ }
      setErrorMsg(msg)
      const finalContent = stripThinkContent(fullContent) || fullContent
      if (finalContent) {
        setMessages((prev) => [
          ...prev,
          { id: `assistant-${Date.now()}`, role: 'assistant', content: finalContent },
        ])
      }
      setIsStreaming(false)
      setStreamingContent('')
    }
  }, [inputValue, selectedApp, isStreaming, conversationId])

  // ── 停止生成 ──

  const handleStop = useCallback(async () => {
    const partial = stripThinkContent(streamingContent) || streamingContent
    if (partial) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: partial + '\n\n*[已停止]*',
        },
      ])
    }

    abortControllerRef.current?.abort()

    if (currentTaskIdRef.current) {
      try {
        await stopChatMessage(currentTaskIdRef.current)
      } catch (_) { /* ignore */ }
    }

    setIsStreaming(false)
    setStreamingContent('')
  }, [streamingContent])

  // ── 新建对话 ──

  const handleNewChat = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setStreamingContent('')
    setIsStreaming(false)
    setInputValue('')
    setErrorMsg(null)
    inputRef.current?.focus()
  }, [])

  // ── 快捷话题点击 ──

  const handleQuickTopic = useCallback((topic: string) => {
    handleSend(topic)
  }, [handleSend])

  // ── 键盘事件 ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  // ── 渲染 ──

  const hasContent = messages.length > 0 || isStreaming

  return (
    <>
      {/* ============ 移动端框架 ============ */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#dfe5e0',
          overflow: 'hidden',
        }}
      >
        <div
          className="stage"
          style={{
            width: '375px',
            height: '100vh',
            maxHeight: '812px',
            background: '#f5f1e6',
            borderRadius: '36px',
            overflow: 'hidden',
            boxShadow: '0 30px 60px rgba(0,0,0,.18)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {/* ── 顶部栏 ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 18px 8px',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '18px',
                fontWeight: 600,
                color: '#1d1d1f',
                cursor: 'pointer',
              }}
              onClick={handleNewChat}
              title="新建对话"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1d1d1f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              小冒险
            </span>
            <span style={{ display: 'flex', gap: '4px', color: '#1d1d1f' }}>
              <i style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#1d1d1f', display: 'block' }} />
              <i style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#1d1d1f', display: 'block' }} />
              <i style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#1d1d1f', display: 'block' }} />
            </span>
          </div>

          {/* ── 品牌 + 通知 ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              padding: '6px 18px 4px',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'linear-gradient(180deg, #fdeedd 0%, #fbe7d8 50%, #f7d6c3 100%)',
                padding: '6px 10px',
                borderRadius: '14px 14px 4px 14px',
                boxShadow: '0 2px 0 rgba(0,0,0,.04)',
                marginLeft: '6px',
              }}
            >
              <span
                style={{
                  fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
                  fontWeight: 900,
                  fontSize: '24px',
                  color: '#4f9588',
                  letterSpacing: '2px',
                  WebkitTextStroke: '0.6px #2f6b5e',
                }}
              >
                小冒险
              </span>
            </div>
            <span
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3d6c63',
                boxShadow: '0 2px 6px rgba(0,0,0,.05)',
              }}
              aria-label="消息通知"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3d6c63" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 1 1 12 0c0 4 1.5 6 1.5 6h-15S6 12 6 8z" />
                <path d="M10 19a2 2 0 0 0 4 0" />
              </svg>
            </span>
          </div>

          {/* ── 问候 ── */}
          <div style={{ padding: '6px 24px 12px', fontSize: '18px', fontWeight: 700, color: '#1d1d1f' }}>
            你好，小焕
          </div>

          {/* ── 内容区域（可滚动） ── */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {!hasContent ? (
              /* ======== 空状态：欢迎页 ======== */
              <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '8px' }}>
                {/* 角色气泡卡 */}
                <section
                  style={{
                    margin: '0 16px',
                    background: '#e6f2ed',
                    borderRadius: '32px',
                    padding: '28px 22px 22px',
                    textAlign: 'center',
                    boxShadow: '0 6px 18px rgba(60,90,80,.08)',
                  }}
                >
                  <div
                    style={{
                      width: '170px',
                      height: '170px',
                      borderRadius: '50%',
                      background: '#fff',
                      margin: '-6px auto 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'inset 0 -6px 0 rgba(0,0,0,.02)',
                    }}
                  >
                    <svg viewBox="0 0 200 200" width="96%" height="96%" fill="none">
                      <path d="M55 90c0-30 20-55 45-55s45 25 45 55c0 6-1 11-3 16l-7-3c-2-1-3-3-3-5v-9c0-4-2-8-6-9-7-3-15-4-22-4s-15 1-22 4c-4 1-6 5-6 9v9c0 2-1 4-3 5l-7 3c-2-5-3-10-3-16z" fill="#3f6d63" />
                      <path d="M95 60c0-6 5-10 10-10s10 4 10 10v8c-3-1-7-1-10-1s-7 0-10 1v-8z" fill="#2f564e" />
                      <circle cx="100" cy="112" r="34" fill="#fffaf3" />
                      <ellipse cx="78" cy="120" rx="5" ry="3" fill="#f7c8c0" opacity=".7" />
                      <ellipse cx="122" cy="120" rx="5" ry="3" fill="#f7c8c0" opacity=".7" />
                      <circle cx="88" cy="112" r="2.6" fill="#2c2c2c" />
                      <circle cx="112" cy="112" r="2.6" fill="#2c2c2c" />
                      <path d="M100 118l-2 5h4z" fill="#e5b6a8" />
                      <path d="M93 128c4 4 10 4 14 0" stroke="#2c2c2c" strokeWidth="2" strokeLinecap="round" fill="none" />
                      <path d="M70 165c8-10 18-15 30-15s22 5 30 15" fill="#3f6d63" />
                      <path d="M85 168c5-3 10-4 15-4s10 1 15 4" fill="#fffaf3" />
                    </svg>
                  </div>
                  <div
                    style={{
                      background: '#fff',
                      borderRadius: '18px',
                      padding: '14px 18px',
                      color: '#3a4642',
                      fontSize: '15px',
                      lineHeight: 1.55,
                      maxWidth: '78%',
                      margin: '0 auto',
                      boxShadow: '0 2px 6px rgba(0,0,0,.04)',
                    }}
                  >
                    我是你的<b style={{ color: '#1f2c28', fontWeight: 700 }}>焕新陪伴官</b>，今天想聊聊哪件小事？
                  </div>
                </section>

                {/* 快捷话题 */}
                <section
                  style={{
                    margin: '14px 16px 0',
                    background: '#e6f2ed',
                    borderRadius: '28px',
                    padding: '18px 16px 18px',
                    boxShadow: '0 6px 18px rgba(60,90,80,.08)',
                  }}
                >
                  {/* Agent 选择器 */}
                  <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {loadingApps ? (
                      <span style={{ fontSize: '12px', color: '#9aa39e' }}>加载中...</span>
                    ) : (
                      <select
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '12px',
                          border: '1px solid #cfe0d8',
                          background: '#fff',
                          fontSize: '13px',
                          color: '#384a44',
                          outline: 'none',
                          maxWidth: '100%',
                        }}
                        value={selectedApp?.id || ''}
                        onChange={(e) => {
                          const app = apps.find((a) => a.id === e.target.value)
                          if (app) {
                            setSelectedApp(app)
                            setMessages([])
                            setConversationId(null)
                          }
                        }}
                      >
                        {apps.map((app) => (
                          <option key={app.id} value={app.id}>
                            {app.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '10px',
                    }}
                  >
                    {QUICK_TOPICS.map((topic, i) => (
                      <div
                        key={i}
                        onClick={() => handleQuickTopic(topic)}
                        style={{
                          background: '#fff',
                          border: '1px solid #cfe0d8',
                          borderRadius: '14px',
                          padding: '10px 6px',
                          fontSize: '13px',
                          color: '#384a44',
                          textAlign: 'center',
                          boxShadow: '0 1px 0 rgba(0,0,0,.02)',
                          lineHeight: 1.2,
                          minHeight: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          overflow: 'hidden',
                        }}
                      >
                        {topic}
                      </div>
                    ))}
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={`muted-${i}`}
                        style={{
                          border: '1px solid #cfe0d8',
                          borderRadius: '14px',
                          padding: '10px 6px',
                          fontSize: '13px',
                          color: '#b9c3bf',
                          textAlign: 'center',
                          boxShadow: '0 1px 0 rgba(0,0,0,.02)',
                          lineHeight: 1.2,
                          minHeight: '40px',
                          display: i % 2 === 1 ? 'none' : 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          letterSpacing: '3px',
                          visibility: i === 0 || i === 3 || i === 4 ? 'visible' : 'hidden',
                        }}
                      >
                        {i === 0 || i === 3 || i === 4 ? '▢▢▢▢▢' : ''}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              /* ======== 消息列表 ======== */
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}

                {/* 流式输出中的临时消息 */}
                {isStreaming && streamingContent && (
                  <MessageBubble
                    message={{
                      id: 'streaming',
                      role: 'assistant',
                      content: streamingContent,
                    }}
                    isStreaming
                  />
                )}

                {/* 加载动画 */}
                {isStreaming && !streamingContent && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <AvatarSVG />
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#e6f2ed',
                        borderRadius: '20px',
                        borderBottomLeftRadius: '4px',
                        padding: '12px 18px',
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#9aa39e', animation: 'bounce 1.4s infinite', animationDelay: '0ms' }} />
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#9aa39e', animation: 'bounce 1.4s infinite', animationDelay: '150ms' }} />
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#9aa39e', animation: 'bounce 1.4s infinite', animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ── 错误提示 ── */}
          {errorMsg && (
            <div
              style={{
                margin: '6px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '12px',
                border: '1px solid #f5c6cb',
                background: '#fff5f5',
                padding: '10px 16px',
              }}
            >
              <span style={{ fontSize: '13px', color: '#c0392b', flex: 1 }}>{errorMsg}</span>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '14px',
                  color: '#c0392b',
                  cursor: 'pointer',
                  padding: '4px',
                }}
                onClick={() => setErrorMsg(null)}
              >
                ✕
              </button>
            </div>
          )}

          {/* ── 输入条 ── */}
          <div
            style={{
              margin: '10px 16px',
              background: '#fff',
              borderRadius: '24px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 6px 18px rgba(60,90,80,.08)',
              flexShrink: 0,
            }}
          >
            {isStreaming ? (
              <button
                onClick={handleStop}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#ffe0e0',
                  border: 'none',
                  color: '#e74c3c',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                title="停止生成"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#e74c3c">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </button>
            ) : (
              <span
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f1faf6',
                  color: '#3d6c63',
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3d6c63" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8h3l2-2h6l2 2h3v10H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </span>
            )}
            <textarea
              ref={inputRef}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '14px',
                color: '#1f1f1f',
                background: 'transparent',
                resize: 'none',
                padding: '4px',
                fontFamily: 'inherit',
                lineHeight: 1.4,
              }}
              rows={1}
              placeholder={selectedApp ? '发消息或按住说话…' : '请先选择一个智能体'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!selectedApp || isStreaming}
            />
            {!isStreaming && (
              <>
                <span
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3d6c63',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  onClick={() => handleSend()}
                  title="发送"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3d6c63" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
                    <path d="M19 11a7 7 0 0 1-14 0" />
                    <line x1="12" y1="18" x2="12" y2="21" />
                  </svg>
                </span>
                <span
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#eaf3ef',
                    color: '#3d6c63',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title="更多"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3d6c63" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
              </>
            )}
          </div>

          {/* ── 底部 Tab ── */}
          <nav
            style={{
              margin: '4px 12px 14px',
              background: '#fff',
              borderRadius: '22px',
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              padding: '8px 6px',
              boxShadow: '0 6px 18px rgba(60,90,80,.08)',
              flexShrink: 0,
            }}
          >
            <TabItem
              active
              icon={
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#2f6b5e" strokeWidth="1.8" strokeLinejoin="round">
                  <path d="M4 11l8-7 8 7v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                </svg>
              }
              label="聊聊"
              activeColor="#2f6b5e"
            />
            <TabItem
              icon={
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#7e8a85" strokeWidth="1.8" strokeLinejoin="round">
                  <rect x="5" y="3" width="14" height="18" rx="2" />
                  <path d="M9 7h6M9 11h6M9 15h4" />
                </svg>
              }
              label="抽卡"
            />
            <TabItem
              icon={
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#7e8a85" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="9" r="3.5" />
                  <path d="M5 21c.6-3.6 3.4-6 7-6s6.4 2.4 7 6" />
                  <path d="M3 5l2 2M21 5l-2 2" />
                </svg>
              }
              label="打卡"
            />
            <TabItem
              icon={
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#7e8a85" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c.6-4 4-7 8-7s7.4 3 8 7" />
                </svg>
              }
              label="我的"
            />
          </nav>
        </div>
      </div>
    </>
  )
}

// ── 底部 Tab 项 ──

function TabItem({
  icon,
  label,
  active = false,
  activeColor,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  activeColor?: string
}) {
  return (
    <span
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        fontSize: '11px',
        color: active ? (activeColor || '#2f6b5e') : '#7e8a85',
        padding: '6px 0',
        borderRadius: '16px',
        background: active ? '#e9f4ef' : 'transparent',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
      }}
    >
      {icon}
      {label}
    </span>
  )
}

// ── 助手头像 SVG ──

function AvatarSVG() {
  return (
    <div
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(0,0,0,.05)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <svg viewBox="0 0 200 200" width="34" height="34" fill="none">
        <path d="M55 90c0-30 20-55 45-55s45 25 45 55c0 6-1 11-3 16l-7-3c-2-1-3-3-3-5v-9c0-4-2-8-6-9-7-3-15-4-22-4s-15 1-22 4c-4 1-6 5-6 9v9c0 2-1 4-3 5l-7 3c-2-5-3-10-3-16z" fill="#3f6d63" />
        <circle cx="100" cy="112" r="34" fill="#fffaf3" />
        <ellipse cx="78" cy="120" rx="5" ry="3" fill="#f7c8c0" opacity=".7" />
        <ellipse cx="122" cy="120" rx="5" ry="3" fill="#f7c8c0" opacity=".7" />
        <circle cx="88" cy="112" r="2.6" fill="#2c2c2c" />
        <circle cx="112" cy="112" r="2.6" fill="#2c2c2c" />
        <path d="M100 118l-2 5h4z" fill="#e5b6a8" />
        <path d="M93 128c4 4 10 4 14 0" stroke="#2c2c2c" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M70 165c8-10 18-15 30-15s22 5 30 15" fill="#3f6d63" />
      </svg>
    </div>
  )
}

// ── 消息气泡子组件 ──

function MessageBubble({
  message,
  isStreaming = false,
}: {
  message: UIMessage
  isStreaming?: boolean
}) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexDirection: 'row-reverse' }}>
        {/* 用户头像 */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #5b8d83 0%, #7fb1a6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            flexShrink: 0,
          }}
        >
          👤
        </div>
        {/* 用户气泡 */}
        <div
          style={{
            maxWidth: '75%',
            borderRadius: '20px',
            borderBottomRightRadius: '4px',
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #5b8d83 0%, #7fb1a6 100%)',
            color: '#fff',
            fontSize: '14px',
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
      {/* 助手头像 */}
      <AvatarSVG />
      {/* 助手气泡 */}
      <div
        style={{
          maxWidth: '80%',
          borderRadius: '20px',
          borderBottomLeftRadius: '4px',
          padding: '12px 16px',
          background: '#e6f2ed',
          color: '#1f1f1f',
          fontSize: '14px',
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          boxShadow: '0 2px 6px rgba(0,0,0,.04)',
        }}
      >
        {message.content}
        {isStreaming && (
          <span
            style={{
              display: 'inline-block',
              width: '2px',
              height: '16px',
              background: '#5b8d83',
              marginLeft: '2px',
              verticalAlign: 'text-bottom',
              animation: 'blink 1s step-end infinite',
            }}
          />
        )}
      </div>
    </div>
  )
}

// ── CSS 动画 Keyframes ──
// 通过内联 style 注入 keyframes 到 head
if (typeof document !== 'undefined') {
  const animStyles = document.getElementById('xiaoyz-animations')
  if (!animStyles) {
    const style = document.createElement('style')
    style.id = 'xiaoyz-animations'
    style.textContent = `
      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
      @keyframes bounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-6px); }
      }
    `
    document.head.appendChild(style)
  }
}

// 定制 by chengm xiaoyz 智能对话 page end

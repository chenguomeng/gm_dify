// 定制 by chengm xiaoyz 智能对话 page start

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchChatDifyApps, sendChatMessage, stopChatMessage } from '../services/api'
import type { DifyApp } from '../models/types'

// ── 类型 ──

interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ── 常量 ──

const WELCOME_EMOJI = '🤖'
const USER_EMOJI = '👤'

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

  // ── 加载应用列表 ──

  const loadApps = useCallback(async () => {
    setLoadingApps(true)
    try {
      const res = await fetchChatDifyApps()
      setApps(res.data || [])
      if (!selectedApp && res.data && res.data.length > 0)
        setSelectedApp(res.data[0])
    } catch (err) {
      console.error('Failed to load chat apps:', err)
    } finally {
      setLoadingApps(false)
    }
  }, [])

  useEffect(() => {
    loadApps()
  }, [loadApps])

  // ── 滚动到底部 ──

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // ── 发送消息 ──

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || !selectedApp || isStreaming) return

    const userMsg: UIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setIsStreaming(true)
    setStreamingContent('')

    let fullContent = ''
    try {
      await sendChatMessage(
        {
          app_id: selectedApp.id,
          query: text,
          conversation_id: conversationId || undefined,
          inputs: {},
        },
        {
          onData: (message: string, _isFirst: boolean, moreInfo: any) => {
            // SSE "message" 事件：message 直接就是增量文本字符串
            fullContent += message
            setStreamingContent(fullContent)
            // 捕获 task_id / conversation_id
            if (moreInfo?.taskId)
              currentTaskIdRef.current = moreInfo.taskId
            if (moreInfo?.conversationId && !conversationId)
              setConversationId(moreInfo.conversationId)
          },
          onMessageEnd: (_data: any) => {
            // 消息结束：获取 conversation_id
            if (_data?.conversation_id)
              setConversationId(_data.conversation_id)
          },
          onError: (msg: string, _code?: string) => {
            console.error('Chat error:', msg)
            setStreamingContent((prev) => prev || `对话出错了：${msg}`)
          },
          onCompleted: () => {
            // 流结束：把临时内容固化为消息
            if (fullContent) {
              const assistantMsg: UIMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: fullContent,
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
      // 解析错误消息
      let msg = '对话失败，请重试'
      try {
        if (typeof err === 'string') msg = err
        else if (err?.message) msg = err.message
        else if (err?.body?.message) msg = err.body.message
      } catch (_) { /* ignore */ }
      setErrorMsg(msg)
      if (fullContent) {
        // 有部分内容也先保存
        setMessages((prev) => [
          ...prev,
          { id: `assistant-${Date.now()}`, role: 'assistant', content: fullContent },
        ])
      }
      setIsStreaming(false)
      setStreamingContent('')
    }
  }, [inputValue, selectedApp, isStreaming, conversationId])

  // ── 停止生成 ──

  const handleStop = useCallback(async () => {
    // 先保存已生成的部分内容
    const partial = streamingContent
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

    // 中断请求
    abortControllerRef.current?.abort()

    // 调用后端停止
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
    inputRef.current?.focus()
  }, [])

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
    <div className="mx-auto flex h-[calc(100vh-56px)] max-w-4xl flex-col px-4 py-4">
      {/* ── 顶部栏 ── */}
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">💬</span>
          <h1 className="text-lg font-bold text-text-primary truncate">
            智能对话
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Agent 选择器 */}
          {loadingApps ? (
            <span className="text-sm text-text-tertiary">加载中...</span>
          ) : apps.length === 0 ? (
            <span className="text-sm text-text-tertiary">暂无可用智能体</span>
          ) : (
            <select
              className="max-w-[200px] rounded-lg border border-divider-regular bg-components-input-bg-normal px-3 py-1.5 text-sm text-text-primary truncate focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={selectedApp?.id || ''}
              onChange={(e) => {
                const app = apps.find((a) => a.id === e.target.value)
                if (app) {
                  setSelectedApp(app)
                  // 切换 Agent 时自动开启新对话
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
          {/* 新对话 */}
          <button
            className="rounded-lg border border-divider-regular px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-components-hover-bg active:scale-95"
            onClick={handleNewChat}
          >
            + 新对话
          </button>
        </div>
      </div>

      {/* ── 消息区域 ── */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-divider-regular bg-components-panel-bg p-4">
        {!hasContent ? (
          /* 空状态：欢迎页 */
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] shadow-lg">
              <span className="text-4xl">{WELCOME_EMOJI}</span>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-text-primary">
              {selectedApp ? selectedApp.name : '选择一个智能体开始对话'}
            </h2>
            <p className="max-w-md text-center text-sm text-text-tertiary">
              选择一个智能体，在下方输入你的问题，开始对话吧
            </p>
            {selectedApp?.description && (
              <p className="mt-2 max-w-md text-center text-xs text-text-quaternary">
                {selectedApp.description}
              </p>
            )}
          </div>
        ) : (
          /* 消息列表 */
          <div className="space-y-4">
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

            {/* 加载动画（无内容时） */}
            {isStreaming && !streamingContent && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2]">
                  <span className="text-sm text-white">{WELCOME_EMOJI}</span>
                </div>
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-chat-bubble-bg px-4 py-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── 错误提示 ── */}
      {errorMsg && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-800 dark:bg-red-950">
          <span className="text-sm text-red-600 dark:text-red-400">{errorMsg}</span>
          <button
            className="ml-auto shrink-0 text-xs text-red-400 hover:text-red-600"
            onClick={() => setErrorMsg(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 输入区 ── */}
      <div className="mt-3 shrink-0">
        <div className="relative">
          <textarea
            ref={inputRef}
            className="w-full resize-none rounded-xl border border-divider-regular bg-components-input-bg-normal px-4 py-3 pr-[100px] text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            rows={2}
            placeholder={selectedApp ? `向 ${selectedApp.name} 发送消息...` : '请先选择一个智能体'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!selectedApp}
          />
          <div className="absolute bottom-2 right-2 flex gap-2">
            {isStreaming ? (
              <button
                className="rounded-lg bg-red-500 px-4 py-1.5 text-xs font-medium text-white transition-all hover:bg-red-600 active:scale-95"
                onClick={handleStop}
              >
                停止 ⏹
              </button>
            ) : (
              <button
                className="rounded-lg px-4 py-1.5 text-xs font-medium text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: inputValue.trim() && selectedApp
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : undefined,
                }}
                disabled={!inputValue.trim() || !selectedApp}
                onClick={handleSend}
              >
                发送 ↑
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 text-center text-[10px] text-text-quaternary">
          Enter 发送，Shift+Enter 换行
        </p>
      </div>
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
  const avatar = isUser ? '👤' : '🤖'

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* 头像 */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
        style={
          isUser
            ? { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
            : { background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)' }
        }
      >
        <span>{avatar}</span>
      </div>

      {/* 气泡 */}
      <div
        className={`max-w-[75%] break-words rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'rounded-tr-sm text-white'
            : 'rounded-tl-sm bg-chat-bubble-bg text-text-primary'
        }`}
        style={
          isUser
            ? { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
            : undefined
        }
      >
        <div className={`text-sm leading-relaxed whitespace-pre-wrap ${isStreaming ? 'streaming-cursor' : ''}`}>
          {message.content}
        </div>
      </div>
    </div>
  )
}

// 定制 by chengm xiaoyz 智能对话 page end

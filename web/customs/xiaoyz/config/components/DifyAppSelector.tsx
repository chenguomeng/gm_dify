'use client'
// 定制 by chengm xiaoyz DifyAppSelector start

import { useState, useCallback, useRef, useEffect } from 'react'
import { fetchDifyApps } from '../../services/api'
import type { DifyApp } from '../../models/types'

interface DifyAppSelectorProps {
  value?: DifyApp | null
  onChange: (app: DifyApp | null) => void
  disabled?: boolean
}

export default function DifyAppSelector({ value, onChange, disabled }: DifyAppSelectorProps) {
  const [keyword, setKeyword] = useState('')
  const [options, setOptions] = useState<DifyApp[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const searchApps = useCallback(async (q: string) => {
    setIsLoading(true)
    try {
      const res = await fetchDifyApps(q || undefined)
      setOptions(res.data || [])
    } catch {
      setOptions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    searchApps('')
  }, [searchApps])

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (app: DifyApp) => {
    onChange(app)
    setIsOpen(false)
    setKeyword('')
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-sm font-medium text-text-secondary">
        Dify 应用
      </label>
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-divider-regular bg-components-input-bg-normal p-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-50 text-sm font-bold text-primary-600">
            {value.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-text-primary">{value.name}</div>
            <div className="text-xs text-text-tertiary">{value.mode}</div>
          </div>
          {!disabled && (
            <button
              type="button"
              className="text-xs text-text-tertiary hover:text-text-secondary"
              onClick={() => onChange(null)}
            >
              ✕
            </button>
          )}
        </div>
      ) : (
        <div>
          <input
            type="text"
            className="w-full rounded-lg border border-divider-regular bg-components-input-bg-normal px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="搜索 Dify 工作流应用..."
            value={keyword}
            disabled={disabled}
            onChange={(e) => {
              setKeyword(e.target.value)
              searchApps(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => {
              setIsOpen(true)
              if (!keyword) searchApps('')
            }}
          />
          {isOpen && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-divider-regular bg-components-panel-bg shadow-lg">
              {isLoading ? (
                <div className="flex items-center justify-center py-4 text-sm text-text-tertiary">
                  加载中...
                </div>
              ) : options.length === 0 ? (
                <div className="py-4 text-center text-sm text-text-tertiary">
                  无匹配应用
                </div>
              ) : (
                options.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-components-hover-bg"
                    onClick={() => handleSelect(app)}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-sm font-bold text-primary-600">
                      {app.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-text-primary">{app.name}</div>
                      <div className="text-xs text-text-tertiary">
                        {app.mode}
                        {app.description && ` · ${app.description}`}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 定制 by chengm xiaoyz DifyAppSelector end

'use client'
// 定制 by chengm xiaoyz DrawResultModal start

import { useState, useEffect } from 'react'
import { RARITY_CONFIG } from '../../constants'
import type { DrawResultItem } from '../../models/types'

interface DrawResultModalProps {
  results: DrawResultItem[]
  onClose: () => void
}

export default function DrawResultModal({ results, onClose }: DrawResultModalProps) {
  const [revealedIndex, setRevealedIndex] = useState(-1)

  // 按稀有度排序: SSR > SR > R, 逐张揭示
  const sortedResults = [...results].sort((a, b) => {
    const order = { SSR: 0, SR: 1, R: 2 }
    return (order[a.rarity as keyof typeof order] || 3) - (order[b.rarity as keyof typeof order] || 3)
  })

  useEffect(() => {
    if (revealedIndex < sortedResults.length - 1) {
      const timer = setTimeout(() => {
        setRevealedIndex((prev) => prev + 1)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [revealedIndex, sortedResults.length])

  // 统计
  const stats: Record<string, number> = {}
  results.forEach((r) => {
    stats[r.rarity] = (stats[r.rarity] || 0) + 1
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        {/* 头部 */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">抽卡结果</h2>
          <button
            className="rounded-lg px-3 py-1 text-sm text-text-tertiary hover:text-text-secondary"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        {/* 统计概览 */}
        <div className="mb-4 flex justify-center gap-3">
          {Object.entries(stats).map(([rarity, count]) => {
            const style = RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG]
            return (
              <span
                key={rarity}
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={{
                  backgroundColor: (style?.color || '#999') + '20',
                  color: style?.color || '#999',
                }}
              >
                {style?.label || rarity} ×{count}
              </span>
            )
          })}
        </div>

        {/* 卡片结果网格 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sortedResults.map((result, index) => {
            const style = RARITY_CONFIG[result.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.R
            const isRevealed = index <= revealedIndex

            return (
              <div
                key={index}
                className={`rounded-xl border-2 p-3 text-center transition-all duration-300 ${
                  isRevealed
                    ? 'scale-100 opacity-100'
                    : 'scale-90 opacity-30'
                }`}
                style={{
                  borderColor: isRevealed ? (style?.color || '#999') + '60' : '#e5e7eb',
                }}
              >
                {isRevealed ? (
                  <>
                    <span
                      className="mb-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold text-white"
                      style={{ backgroundColor: style?.color }}
                    >
                      {style?.label}
                    </span>
                    <div
                      className={`mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br ${style?.gradient}`}
                    >
                      <span className="text-2xl text-white">
                        {result.card_data?.emoji || '🃏'}
                      </span>
                    </div>
                    <div className="truncate text-xs font-medium text-text-primary">
                      {result.card_name}
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-2xl">❓</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// 定制 by chengm xiaoyz DrawResultModal end

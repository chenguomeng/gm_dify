// 定制 by chengm xiaoyz collection page start

'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchCollection } from '../services/api'
import { RARITY_CONFIG } from '../constants'
import type { CardCollectionItem } from '../models/types'

export default function XiaoyzCollectionPage() {
  const [cards, setCards] = useState<CardCollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [rarityFilter, setRarityFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  const loadCollection = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchCollection({
        rarity: rarityFilter || undefined,
        limit: 200,
      })
      setCards(res.data || [])
    } catch (err) {
      console.error('Failed to load collection:', err)
    } finally {
      setLoading(false)
    }
  }, [rarityFilter])

  useEffect(() => {
    loadCollection()
  }, [loadCollection])

  // 统计
  const stats: Record<string, number> = {}
  cards.forEach((c) => {
    stats[c.rarity] = (stats[c.rarity] || 0) + 1
  })

  const filteredCards = searchTerm
    ? cards.filter((c) =>
        c.card_name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : cards

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-2 text-2xl font-bold text-text-primary">📚 我的收藏</h1>
      <p className="mb-6 text-sm text-text-tertiary">
        共收集 {cards.length} 张卡牌
      </p>

      {/* 统计栏 */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {Object.entries(RARITY_CONFIG).map(([key, style]) => (
          <button
            key={key}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              rarityFilter === key
                ? 'text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
            }`}
            style={
              rarityFilter === key
                ? { backgroundColor: style.color }
                : undefined
            }
            onClick={() => setRarityFilter(rarityFilter === key ? '' : key)}
          >
            {style.label} ({stats[key] || 0})
          </button>
        ))}
        <input
          type="text"
          className="ml-auto rounded-lg border border-divider-regular bg-components-input-bg-normal px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary-500 focus:outline-none"
          placeholder="搜索卡片名称..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-text-tertiary">
          加载中...
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-divider-regular py-16 text-center">
          <div className="text-5xl">🃏</div>
          <p className="mt-3 text-text-tertiary">
            {searchTerm ? '没有匹配的卡片' : '还没有收集到卡片'}
          </p>
          <a
            href="/xiaoyz"
            className="mt-2 inline-block text-sm text-primary-600 hover:text-primary-700"
          >
            {searchTerm ? '清除搜索' : '前往抽卡 →'}
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredCards.map((card) => {
            const style = RARITY_CONFIG[card.rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.R
            return (
              <div
                key={card.id}
                className="group relative overflow-hidden rounded-xl border-2 bg-white p-4 transition-all hover:shadow-lg hover:-translate-y-1 dark:bg-gray-800"
                style={{ borderColor: style.color + '60' }}
              >
                {/* 稀有度角标 */}
                <div
                  className="absolute right-0 top-0 rounded-bl-lg px-2.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: style.color }}
                >
                  {style.label}
                </div>
                {/* 卡片图案 */}
                <div
                  className={`mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br ${style.gradient} shadow-inner`}
                >
                  <span className="text-4xl text-white drop-shadow-lg">
                    {card.card_data?.emoji || '🃏'}
                  </span>
                </div>
                {/* 卡片名 */}
                <div className="truncate text-center text-sm font-semibold text-text-primary">
                  {card.card_name}
                </div>
                {/* 属性 */}
                {(card.card_data?.attack !== undefined || card.card_data?.skill) && (
                  <div className="mt-2 space-y-1 border-t pt-2 text-[11px] text-text-tertiary">
                    {card.card_data.attack !== undefined && (
                      <div className="flex justify-between">
                        <span>攻击</span>
                        <span className="font-medium text-text-secondary">{card.card_data.attack}</span>
                      </div>
                    )}
                    {card.card_data.defense !== undefined && (
                      <div className="flex justify-between">
                        <span>防御</span>
                        <span className="font-medium text-text-secondary">{card.card_data.defense}</span>
                      </div>
                    )}
                    {card.card_data.skill && (
                      <div className="flex justify-between">
                        <span>技能</span>
                        <span className="font-medium text-primary-600">{card.card_data.skill}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* 获得时间 */}
                <div className="mt-2 text-center text-[10px] text-text-quaternary">
                  {card.obtained_at
                    ? new Date(card.obtained_at).toLocaleDateString()
                    : ''}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// 定制 by chengm xiaoyz collection page end

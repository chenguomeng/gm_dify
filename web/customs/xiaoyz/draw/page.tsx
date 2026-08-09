// 定制 by chengm xiaoyz draw page start

'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchConfigs, fetchCollection, drawCards } from '../services/api'
import { RARITY_CONFIG } from '../constants'
import DrawResultModal from './components/DrawResultModal'
import type { CardCollectionItem, DrawResultItem, XiaoyzConfig } from '../models/types'

export default function XiaoyzDrawPage() {
  const [configs, setConfigs] = useState<XiaoyzConfig[]>([])
  const [activeConfigId, setActiveConfigId] = useState<string>('')
  const [collection, setCollection] = useState<CardCollectionItem[]>([])
  const [drawing, setDrawing] = useState(false)
  const [drawResults, setDrawResults] = useState<DrawResultItem[] | null>(null)
  const [loading, setLoading] = useState(true)

  const activeConfig = configs.find((c) => c.id === activeConfigId)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [configRes, collRes] = await Promise.all([
        fetchConfigs({ limit: 50 }),
        fetchCollection({ limit: 200 }),
      ])
      const configList = configRes.data || []
      setConfigs(configList)
      if (!activeConfigId && configList.length > 0) {
        setActiveConfigId(configList[0].id)
      }
      setCollection(collRes.data || [])
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [activeConfigId])

  useEffect(() => {
    loadData()
  }, [])

  const handleDraw = async () => {
    if (!activeConfig || drawing) return
    setDrawing(true)
    setDrawResults(null)
    try {
      const res = await drawCards({
        config_id: activeConfig.id,
        count: activeConfig.draw_count_per_time || 10,
      })
      setDrawResults(res.results || [])
      // 刷新收藏
      const collRes = await fetchCollection({ limit: 200 })
      setCollection(collRes.data || [])
    } catch (err) {
      console.error('Draw failed:', err)
      alert('抽卡失败，请重试')
    } finally {
      setDrawing(false)
    }
  }

  const getRarityStyle = (rarity: string) => {
    const key = rarity as keyof typeof RARITY_CONFIG
    return RARITY_CONFIG[key] || RARITY_CONFIG.R
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-text-tertiary">
        加载中...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* 头部 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">🎯 小冒险</h1>
          <p className="mt-1 text-sm text-text-tertiary">抽取卡牌，收集你的冒险伙伴</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/xiaoyz/conversation"
            className="rounded-lg border border-divider-regular px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-components-hover-bg"
          >
            💬 智能对话
          </a>
          {configs.length > 1 && (
          <select
            className="rounded-lg border border-divider-regular bg-components-input-bg-normal px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
            value={activeConfigId}
            onChange={(e) => setActiveConfigId(e.target.value)}
          >
            {configs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        </div>
      </div>

      {/* 抽卡按钮区域 */}
      {activeConfig && (
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-3 flex flex-wrap justify-center gap-2">
            {activeConfig.rarities.map((r) => {
              const style = getRarityStyle(r.rarity)
              return (
                <span
                  key={r.rarity}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: style.color + '20',
                    color: style.color,
                  }}
                >
                  {style.label} {(r.probability * 100).toFixed(1)}%
                </span>
              )
            })}
          </div>
          <button
            className="group relative overflow-hidden rounded-2xl px-12 py-5 text-lg font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
            onClick={handleDraw}
            disabled={drawing}
          >
            <span className="relative z-10">
              {drawing ? '抽取中...' : `抽 ${activeConfig.draw_count_per_time} 次`}
            </span>
            <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        </div>
      )}

      {!activeConfig && (
        <div className="rounded-xl border border-dashed border-divider-regular py-16 text-center">
          <p className="text-text-tertiary">暂无可用卡池配置</p>
          <a
            href="/xiaoyz/config"
            className="mt-2 inline-block text-sm text-primary-600 hover:text-primary-700"
          >
            前往配置 →
          </a>
        </div>
      )}

      {/* 收藏展示 */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          我的收藏 ({collection.length})
        </h2>
        {collection.length === 0 ? (
          <div className="rounded-xl border border-dashed border-divider-regular py-12 text-center text-sm text-text-tertiary">
            还没有卡片，快来抽卡吧！
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {collection.map((card) => {
              const style = getRarityStyle(card.rarity)
              return (
                <div
                  key={card.id}
                  className="group relative overflow-hidden rounded-xl border-2 bg-white p-3 transition-all hover:shadow-lg dark:bg-gray-800"
                  style={{ borderColor: style.color + '60' }}
                >
                  {/* 稀有度标签 */}
                  <div
                    className="absolute right-0 top-0 rounded-bl-lg px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{ backgroundColor: style.color }}
                  >
                    {style.label}
                  </div>
                  {/* 卡片图标 */}
                  <div
                    className={`mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br ${style.gradient}`}
                  >
                    <span className="text-3xl text-white">
                      {card.card_data?.emoji || '🃏'}
                    </span>
                  </div>
                  {/* 卡片名称 */}
                  <div className="truncate text-center text-sm font-medium text-text-primary">
                    {card.card_name}
                  </div>
                  {/* 附加属性 */}
                  {card.card_data?.attack && (
                    <div className="mt-1 flex justify-center gap-2 text-[10px] text-text-tertiary">
                      <span>⚔ {card.card_data.attack}</span>
                      <span>🛡 {card.card_data.defense}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 抽卡结果弹窗 */}
      {drawResults && (
        <DrawResultModal
          results={drawResults}
          onClose={() => setDrawResults(null)}
        />
      )}
    </div>
  )
}

// 定制 by chengm xiaoyz draw page end

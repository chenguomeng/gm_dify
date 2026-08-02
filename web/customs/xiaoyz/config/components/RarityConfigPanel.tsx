'use client'
// 定制 by chengm xiaoyz RarityConfigPanel start

import { useState, useCallback } from 'react'
import { RARITY_CONFIG, RARITY_OPTIONS } from '../../constants'
import DifyAppSelector from './DifyAppSelector'
import VariableMapping from './VariableMapping'
import { fetchDifyAppVariables } from '../../services/api'
import type { DifyApp, DifyVariable, RarityConfig } from '../../models/types'

interface RarityConfigPanelProps {
  rarities: RarityConfig[]
  onChange: (rarities: RarityConfig[]) => void
  disabled?: boolean
}

export default function RarityConfigPanel({ rarities, onChange, disabled }: RarityConfigPanelProps) {
  const addRarity = () => {
    onChange([
      ...rarities,
      {
        rarity: 'R',
        rarity_name: '',
        probability: 0,
        dify_app_id: '',
        dify_app_name: '',
        input_mapping: {},
        output_mapping: {},
        sort_order: rarities.length,
      },
    ])
  }

  const removeRarity = (index: number) => {
    onChange(rarities.filter((_, i) => i !== index))
  }

  const updateRarity = (index: number, updates: Partial<RarityConfig>) => {
    onChange(rarities.map((r, i) => (i === index ? { ...r, ...updates } : r)))
  }

  const totalProb = rarities.reduce((sum, r) => sum + r.probability, 0)
  const probValid = Math.abs(totalProb - 1.0) < 0.001

  // 已选中的稀有度等级
  const usedRarities = rarities.map((r) => r.rarity)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-secondary">
          稀有度配置
          <span className={`ml-2 text-xs ${probValid ? 'text-green-500' : 'text-red-400'}`}>
            (概率合计: {(totalProb * 100).toFixed(1)}%
            {!probValid && ' — 需等于100%'})
          </span>
        </label>
        {!disabled && (
          <button
            type="button"
            className="rounded-lg border border-primary-200 px-3 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50"
            onClick={addRarity}
          >
            + 添加稀有度
          </button>
        )}
      </div>

      {rarities.length === 0 && (
        <div className="rounded-lg border border-dashed border-divider-regular py-8 text-center text-sm text-text-tertiary">
          尚未配置稀有度，点击"添加稀有度"开始配置
        </div>
      )}

      {rarities.map((rarity, index) => (
        <RarityRow
          key={index}
          rarity={rarity}
          index={index}
          usedRarities={usedRarities}
          disabled={disabled}
          onUpdate={(updates) => updateRarity(index, updates)}
          onRemove={() => removeRarity(index)}
        />
      ))}
    </div>
  )
}

function RarityRow({
  rarity,
  index,
  usedRarities,
  disabled,
  onUpdate,
  onRemove,
}: {
  rarity: RarityConfig
  index: number
  usedRarities: string[]
  disabled?: boolean
  onUpdate: (updates: Partial<RarityConfig>) => void
  onRemove: () => void
}) {
  const [app, setApp] = useState<DifyApp | null>(null)
  const [variables, setVariables] = useState<DifyVariable[]>([])
  const [outputVariables, setOutputVariables] = useState<DifyVariable[]>([])
  const [loadingVars, setLoadingVars] = useState(false)

  const rarityStyle = RARITY_CONFIG[rarity.rarity] || RARITY_CONFIG.R

  const handleAppChange = useCallback(
    async (selectedApp: DifyApp | null) => {
      setApp(selectedApp)
      if (selectedApp) {
        onUpdate({ dify_app_id: selectedApp.id, dify_app_name: selectedApp.name })
        setLoadingVars(true)
        try {
          const res = await fetchDifyAppVariables(selectedApp.id)
          setVariables(res.inputs || [])
          setOutputVariables(res.outputs || [])
        } catch {
          setVariables([])
          setOutputVariables([])
        } finally {
          setLoadingVars(false)
        }
      } else {
        onUpdate({ dify_app_id: '', dify_app_name: '', input_mapping: {}, output_mapping: {} })
        setVariables([])
        setOutputVariables([])
      }
    },
    [onUpdate],
  )

  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: rarityStyle.color + '40' }}
    >
      {/* 头部 */}
      <div className="mb-3 flex items-center gap-3">
        <span
          className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold text-white"
          style={{ backgroundColor: rarityStyle.color }}
        >
          {rarityStyle.label}
        </span>
        <span className="text-sm text-text-secondary">
          {rarityStyle.name} · {rarityStyle.description}
        </span>
        {!disabled && (
          <button
            type="button"
            className="ml-auto text-xs text-red-400 hover:text-red-500"
            onClick={onRemove}
          >
            移除
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 稀有度等级选择 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            稀有度等级
          </label>
          <select
            className="w-full rounded border border-divider-regular bg-components-input-bg-normal px-2.5 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none"
            value={rarity.rarity}
            disabled={disabled}
            onChange={(e) => onUpdate({ rarity: e.target.value as RarityConfig['rarity'] })}
          >
            {RARITY_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.value !== rarity.rarity && usedRarities.includes(opt.value)}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 概率 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            概率 ({((rarity.probability || 0) * 100).toFixed(1)}%)
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            className="w-full"
            value={Math.round((rarity.probability || 0) * 1000) / 10}
            disabled={disabled}
            onChange={(e) =>
              onUpdate({ probability: parseFloat(e.target.value) / 100 })
            }
          />
        </div>
      </div>

      {/* Dify 应用选择 */}
      <div className="mt-3">
        <DifyAppSelector value={app} onChange={handleAppChange} disabled={disabled} />
      </div>

      {/* 变量映射 */}
      {loadingVars && (
        <div className="mt-3 py-4 text-center text-sm text-text-tertiary">
          正在加载变量...
        </div>
      )}
      {!loadingVars && app && (
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <VariableMapping
            variables={variables}
            mapping={rarity.input_mapping || {}}
            onChange={(m) => onUpdate({ input_mapping: m })}
            direction="input"
            disabled={disabled}
          />
          <VariableMapping
            variables={outputVariables}
            mapping={rarity.output_mapping || {}}
            onChange={(m) => onUpdate({ output_mapping: m })}
            direction="output"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}

// 定制 by chengm xiaoyz RarityConfigPanel end

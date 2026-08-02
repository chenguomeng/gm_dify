// 定制 by chengm xiaoyz config page start

'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchConfigs, createConfig, updateConfig, deleteConfig } from '../services/api'
import RarityConfigPanel from './components/RarityConfigPanel'
import type { RarityConfig, XiaoyzConfig } from '../models/types'

export default function XiaoyzConfigPage() {
  const [configs, setConfigs] = useState<XiaoyzConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // 表单状态
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [drawCount, setDrawCount] = useState(10)
  const [rarities, setRarities] = useState<RarityConfig[]>([])

  const loadConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchConfigs({ limit: 50 })
      setConfigs(res.data || [])
    } catch (err) {
      console.error('Failed to load configs:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  const resetForm = () => {
    setName('')
    setDescription('')
    setDrawCount(10)
    setRarities([])
    setEditingId(null)
  }

  const startEdit = (config: XiaoyzConfig) => {
    setEditingId(config.id)
    setName(config.name)
    setDescription(config.description || '')
    setDrawCount(config.draw_count_per_time)
    setRarities(
      config.rarities.map((r) => ({
        rarity: r.rarity,
        rarity_name: r.rarity_name,
        probability: r.probability,
        dify_app_id: r.dify_app_id,
        dify_app_name: r.dify_app_name,
        input_mapping: r.input_mapping || {},
        output_mapping: r.output_mapping || {},
        sort_order: r.sort_order,
      })),
    )
  }

  const handleSave = async () => {
    if (!name.trim()) return alert('请输入配置名称')

    const totalProb = rarities.reduce((sum, r) => sum + r.probability, 0)
    if (Math.abs(totalProb - 1.0) > 0.001) {
      return alert('稀有度概率合计必须等于 100%')
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        draw_count_per_time: drawCount,
        rarities,
      }

      if (editingId) {
        await updateConfig(editingId, payload)
      } else {
        await createConfig(payload)
      }
      resetForm()
      await loadConfigs()
    } catch (err) {
      console.error('Failed to save config:', err)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (configId: string) => {
    if (!confirm('确定删除此配置？')) return
    try {
      await deleteConfig(configId)
      await loadConfigs()
    } catch (err) {
      console.error('Failed to delete config:', err)
      alert('删除失败，请重试')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-text-tertiary">
        加载中...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-2 text-2xl font-bold text-text-primary">🎯 小冒险 - Dify 配置</h1>
      <p className="mb-8 text-sm text-text-tertiary">
        配置抽卡稀有度与对应的 Dify 智能体工作流，概率合计需等于 100%
      </p>

      {/* 配置列表 */}
      {!editingId && configs.length > 0 && (
        <div className="mb-8 space-y-3">
          {configs.map((config) => (
            <div
              key={config.id}
              className="flex items-center justify-between rounded-lg border border-divider-regular bg-components-panel-bg p-4"
            >
              <div>
                <div className="font-medium text-text-primary">{config.name}</div>
                <div className="text-xs text-text-tertiary">
                  {config.description || '无描述'} · 每次 {config.draw_count_per_time} 抽 ·{' '}
                  {config.rarities.map((r) => `${r.rarity}(${(r.probability * 100).toFixed(1)}%)`).join(', ')}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-lg border border-divider-regular px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-components-hover-bg"
                  onClick={() => startEdit(config)}
                >
                  编辑
                </button>
                <button
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50"
                  onClick={() => handleDelete(config.id)}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑表单 */}
      {(editingId || configs.length === 0 || !editingId) && (
        <div className="rounded-xl border border-divider-regular bg-components-panel-bg p-6">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            {editingId ? '编辑配置' : '新增配置'}
          </h2>

          {/* 基本信息 */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                配置名称 *
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-divider-regular bg-components-input-bg-normal px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="如：默认卡池"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                每次抽卡数
              </label>
              <input
                type="number"
                min={1}
                max={100}
                className="w-full rounded-lg border border-divider-regular bg-components-input-bg-normal px-3 py-2 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={drawCount}
                onChange={(e) => setDrawCount(Math.max(1, parseInt(e.target.value) || 10))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">
                描述
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-divider-regular bg-components-input-bg-normal px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="可选描述"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* 稀有度配置 */}
          <RarityConfigPanel rarities={rarities} onChange={setRarities} />

          {/* 操作按钮 */}
          <div className="mt-6 flex gap-3">
            <button
              className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '保存中...' : '保存配置'}
            </button>
            {editingId && (
              <button
                className="rounded-lg border border-divider-regular px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-components-hover-bg"
                onClick={resetForm}
              >
                取消
              </button>
            )}
            {!editingId && configs.length > 0 && (
              <button
                className="rounded-lg border border-divider-regular px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-components-hover-bg"
                onClick={resetForm}
              >
                清空
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 定制 by chengm xiaoyz config page end

'use client'
// 定制 by chengm xiaoyz VariableMapping start

import type { DifyVariable } from '../../models/types'

interface VariableMappingProps {
  variables: DifyVariable[]
  mapping: Record<string, string>
  onChange: (mapping: Record<string, string>) => void
  direction: 'input' | 'output'
  disabled?: boolean
}

export default function VariableMapping({
  variables,
  mapping,
  onChange,
  direction,
  disabled,
}: VariableMappingProps) {
  if (variables.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-divider-regular py-6 text-center text-sm text-text-tertiary">
        暂无{direction === 'input' ? '输入' : '输出'}变量，请确认已选择正确的 Dify 工作流应用
      </div>
    )
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-text-secondary">
        {direction === 'input' ? '输入变量映射' : '输出变量映射'}
        <span className="ml-1 text-xs font-normal text-text-tertiary">
          ({direction === 'input' ? '抽卡参数 → Dify输入' : 'Dify输出 → 卡片字段'})
        </span>
      </label>
      <div className="space-y-2 rounded-lg border border-divider-regular bg-components-panel-bg p-3">
        {variables.map((variable) => (
          <div key={variable.name} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-text-primary">
                {variable.label || variable.name}
              </div>
              <div className="text-xs text-text-tertiary">
                {variable.name} ({variable.type})
                {variable.required && (
                  <span className="ml-1 text-red-400">*必填</span>
                )}
              </div>
            </div>
            <span className="text-text-tertiary">→</span>
            <input
              type="text"
              className="w-40 rounded border border-divider-regular bg-components-input-bg-normal px-2 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-primary-500 focus:outline-none"
              placeholder={
                direction === 'input'
                  ? '参数值或 {{变量}}'
                  : '卡片字段名'
              }
              value={mapping[variable.name] || ''}
              disabled={disabled}
              onChange={(e) => {
                const newMapping = { ...mapping }
                if (e.target.value) {
                  newMapping[variable.name] = e.target.value
                } else {
                  delete newMapping[variable.name]
                }
                onChange(newMapping)
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// 定制 by chengm xiaoyz VariableMapping end

// 定制 by chengm xiaoyz抽卡模块 constants start
/** xiaoyz 小冒险抽卡模块 — 常量定义 */

export const RARITY_CONFIG = {
  SSR: {
    label: 'SSR',
    name: '传说',
    color: '#FFD700',
    bgColor: 'bg-yellow-500',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500',
    gradient: 'from-yellow-400 to-amber-500',
    description: '极其稀有',
  },
  SR: {
    label: 'SR',
    name: '稀有',
    color: '#C084FC',
    bgColor: 'bg-purple-500',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500',
    gradient: 'from-purple-400 to-violet-500',
    description: '比较稀有',
  },
  R: {
    label: 'R',
    name: '普通',
    color: '#60A5FA',
    bgColor: 'bg-blue-500',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500',
    gradient: 'from-blue-400 to-cyan-500',
    description: '普通卡牌',
  },
} as const

export const RARITY_OPTIONS = [
  { value: 'SSR', label: 'SSR - 传说 (极其稀有)' },
  { value: 'SR', label: 'SR - 稀有' },
  { value: 'R', label: 'R - 普通' },
]

export const DEFAULT_DRAW_COUNT = 10
export const MAX_DRAW_COUNT = 100

export const API_BASE = '/console/api/customs/xiaoyz'

// 定制 by chengm xiaoyz抽卡模块 constants end

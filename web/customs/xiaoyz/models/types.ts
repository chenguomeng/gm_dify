// 定制 by chengm xiaoyz抽卡模块 types start
/** xiaoyz 小冒险抽卡模块 — TypeScript 类型定义 */

export interface DifyApp {
  id: string
  name: string
  mode: string
  description?: string
  icon?: string
  icon_background?: string
}

export interface DifyVariable {
  name: string
  type: string
  label?: string
  required?: boolean
  options?: string[]
  max_length?: number
  default?: string
}

export interface DifyAppVariables {
  inputs: DifyVariable[]
  outputs: DifyVariable[]
}

export interface RarityConfig {
  id?: string
  config_id?: string
  rarity: 'SSR' | 'SR' | 'R'
  rarity_name?: string
  probability: number
  dify_app_id: string
  dify_app_name?: string
  input_mapping: Record<string, string>
  output_mapping: Record<string, string>
  sort_order?: number
}

export interface XiaoyzConfig {
  id: string
  name: string
  description?: string
  draw_count_per_time: number
  status: 'active' | 'archived'
  tenant_id?: string
  created_by?: string
  rarities: RarityConfig[]
  created_at?: string
  updated_at?: string
}

export interface DrawRequest {
  config_id: string
  count: number
}

export interface DrawResultItem {
  rarity: string
  card_name: string
  card_data: Record<string, any>
}

export interface DrawResponse {
  id: string
  config_id?: string
  user_id: string
  draw_count: number
  results: DrawResultItem[]
  created_at?: string
}

export interface CardCollectionItem {
  id: string
  user_id: string
  rarity: string
  card_name: string
  card_data: Record<string, any>
  obtained_at?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  has_more: boolean
}

// 定制 by chengm xiaoyz抽卡模块 types end

// 定制 by chengm xiaoyz抽卡模块 API service start
/** xiaoyz 小冒险抽卡模块 — API 调用函数 */

import { del, get, post, put } from '@/service/base'
import { API_BASE } from '../constants'
import type {
  CardCollectionItem,
  DifyApp,
  DifyAppVariables,
  DrawRequest,
  DrawResponse,
  PaginatedResponse,
  XiaoyzConfig,
} from '../models/types'

/** 获取 Dify 工作流应用列表 */
export const fetchDifyApps = (keyword?: string) =>
  get<PaginatedResponse<DifyApp>>(`${API_BASE}/dify-apps`, {
    params: keyword ? { keyword } : undefined,
  })

/** 获取 Dify 应用的输入/输出变量 */
export const fetchDifyAppVariables = (appId: string) =>
  get<DifyAppVariables>(`${API_BASE}/dify-apps/${appId}/variables`)

/** 创建配置 */
export const createConfig = (data: Partial<XiaoyzConfig>) =>
  post<XiaoyzConfig>(`${API_BASE}/config`, { body: data })

/** 获取配置列表 */
export const fetchConfigs = (params?: { page?: number; limit?: number }) =>
  get<PaginatedResponse<XiaoyzConfig>>(`${API_BASE}/config`, { params })

/** 获取配置详情 */
export const fetchConfigDetail = (configId: string) =>
  get<XiaoyzConfig>(`${API_BASE}/config/${configId}`)

/** 更新配置 */
export const updateConfig = (configId: string, data: Partial<XiaoyzConfig>) =>
  put<XiaoyzConfig>(`${API_BASE}/config/${configId}`, { body: data })

/** 删除配置 */
export const deleteConfig = (configId: string) =>
  del<{ result: string }>(`${API_BASE}/config/${configId}`)

/** 抽卡 */
export const drawCards = (data: DrawRequest) =>
  post<DrawResponse>(`${API_BASE}/draw`, { body: data })

/** 获取抽卡记录 */
export const fetchDrawRecords = (params?: {
  user_id?: string
  page?: number
  limit?: number
}) => get<PaginatedResponse<DrawResponse>>(`${API_BASE}/records`, { params })

/** 获取卡牌收藏 */
export const fetchCollection = (params?: {
  user_id?: string
  rarity?: string
  page?: number
  limit?: number
}) =>
  get<PaginatedResponse<CardCollectionItem>>(`${API_BASE}/collection`, { params })

// 定制 by chengm xiaoyz抽卡模块 API service end

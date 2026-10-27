import type { ApiResponse } from '@/shared/api/api.types'
import { httpClient } from '@/shared/api/httpClient'

import type { SystemStatus } from '../model/system.types'

export async function fetchSystemStatus(): Promise<SystemStatus> {
  // shared 请求实例不绑定业务前缀；各模块显式写出后端真实路径，避免 /api 与 /auth 混淆。
  const response = await httpClient.get<ApiResponse<SystemStatus>>('/api/public/status')
  return response.data.data
}

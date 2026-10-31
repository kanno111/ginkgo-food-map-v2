import { httpClient } from '@/shared/api/httpClient'
import type { ApiResponse } from '@/shared/api/api.types'
import { toErrorMessage } from '@/shared/lib/toErrorMessage'

/** 上传固定发起账号；浏览器负责生成multipart边界，禁止手工覆盖Content-Type。 */
export async function uploadImage(file: File, token: string): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  try {
    const response = await httpClient.post<ApiResponse<{ fileId: string }>>(
      '/api/files/images',
      form,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    const id = response.data.data?.fileId
    if (!response.data.success || typeof id !== 'string' || !/^[1-9]\d*$/.test(id))
      throw new Error('上传结果无法确认，请重试；未绑定图片会自动回收。')
    return id
  } catch (reason) {
    throw new Error(toErrorMessage(reason), { cause: reason })
  }
}

/** 204已删除或202后台继续删除均表示取消意图被接收；绝不改用当前其他账号的凭证。 */
export async function cancelImage(fileId: string, token: string): Promise<void> {
  await httpClient.delete(`/api/files/images/${encodeURIComponent(fileId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

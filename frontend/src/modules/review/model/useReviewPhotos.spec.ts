import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAccessToken, setAccessToken } from '@/shared/api/authSession'
import { unavailableReviewGateway, type ReviewGateway } from './review'
import { useReviewPhotos } from './useReviewPhotos'

/** 验证异步生命周期：预览无需GET、上传顺序不影响照片顺序、移除不被晚到结果复活。 */
describe('review photo draft lifecycle', () => {
  const file = () => new File(['jpeg'], 'review.jpg', { type: 'image/jpeg' })
  beforeEach(() => {
    setAccessToken('owner')
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:${Math.random()}`),
      revokeObjectURL: vi.fn(),
    })
  })
  afterEach(() => {
    clearAccessToken()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  function transport(): ReviewGateway {
    return {
      ...unavailableReviewGateway,
      uploadPhoto: vi.fn().mockResolvedValue('1'),
      cancelPhoto: vi.fn().mockResolvedValue(undefined),
    }
  }
  it('accepts five photos, refuses a sixth and frees a slot after removal', async () => {
    const gateway = transport()
    const draft = useReviewPhotos(gateway, () => 'owner')
    for (let i = 0; i < 6; i++) draft.add(file())
    await vi.waitFor(() => expect(draft.pending.value).toBe(false))
    expect(draft.photos.value).toHaveLength(5)
    expect(gateway.uploadPhoto).toHaveBeenCalledTimes(5)
    draft.remove(0)
    draft.add(file())
    await vi.waitFor(() => expect(draft.pending.value).toBe(false))
    expect(draft.photos.value).toHaveLength(5)
    expect(gateway.uploadPhoto).toHaveBeenCalledTimes(6)
    draft.clear()
  })
  it('previews immediately and cleans a successful upload arriving after removal', async () => {
    const gateway = transport()
    let resolve!: (id: string) => void
    vi.mocked(gateway.uploadPhoto!).mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    const draft = useReviewPhotos(gateway, () => 'owner')
    draft.add(file())
    expect(draft.photos.value[0]?.url).toMatch(/^blob:/)
    expect(draft.pending.value).toBe(true)
    draft.remove(0)
    resolve('88')
    await vi.waitFor(() => expect(gateway.cancelPhoto).toHaveBeenCalledWith('88', 'owner'))
    expect(draft.photos.value).toHaveLength(0)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })
  it('retains failed local photos for retry and preserves order despite completion order', async () => {
    const gateway = transport()
    let resolve!: (id: string) => void
    vi.mocked(gateway.uploadPhoto!)
      .mockReturnValueOnce(
        new Promise((r) => {
          resolve = r
        }),
      )
      .mockRejectedValueOnce(new Error('cloud down'))
      .mockResolvedValueOnce('2')
    const draft = useReviewPhotos(gateway, () => 'owner')
    draft.add(file())
    draft.add(file())
    await vi.waitFor(() => expect(draft.failed.value).toBe(true))
    draft.retry(draft.photos.value[1]!)
    resolve('1')
    await vi.waitFor(() => expect(draft.pending.value).toBe(false))
    expect(draft.photos.value.map((p) => p.fileId)).toEqual(['1', '2'])
    expect(draft.failed.value).toBe(false)
    draft.clear()
    expect(gateway.cancelPhoto).toHaveBeenCalledTimes(2)
  })
  it('does not delete files after confirmed publication', async () => {
    const gateway = transport()
    const draft = useReviewPhotos(gateway, () => 'owner')
    draft.add(file())
    await vi.waitFor(() => expect(draft.pending.value).toBe(false))
    draft.clear(true)
    expect(gateway.cancelPhoto).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
  it('uses the initiating token when an account changes during upload', async () => {
    const gateway = transport()
    let resolve!: (id: string) => void
    vi.mocked(gateway.uploadPhoto!).mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    let owner = 'owner'
    const draft = useReviewPhotos(gateway, () => owner)
    draft.add(file())
    draft.clear()
    owner = 'other'
    setAccessToken('other')
    resolve('99')
    await vi.waitFor(() => expect(gateway.cancelPhoto).toHaveBeenCalledWith('99', 'owner'))
    expect(draft.photos.value).toHaveLength(0)
  })
})

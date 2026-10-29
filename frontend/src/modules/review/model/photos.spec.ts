import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressPhoto } from './photos'

/** 校验本地压缩边界；OSS的真实类型、尺寸校验仍需后端独立执行。 */
describe('review photo preparation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
  it('rejects SVG and oversized originals before decoding', async () => {
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    await expect(
      compressPhoto(new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })),
    ).rejects.toThrow('JPEG')
    const large = new File(['x'], 'x.jpg', { type: 'image/jpeg' })
    Object.defineProperty(large, 'size', { value: 20 * 1024 * 1024 + 1 })
    await expect(compressPhoto(large)).rejects.toThrow('20MB')
    expect(decode).not.toHaveBeenCalled()
  })
  it('scales the longest edge to 1200 and releases the decoded bitmap', async () => {
    const bitmap = { width: 2400, height: 1600, close: vi.fn() }
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    const canvas = document.createElement('canvas')
    const drawImage = vi.fn()
    vi.spyOn(canvas, 'getContext').mockReturnValue({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback) =>
      callback(new Blob(['compressed'], { type: 'image/jpeg' })),
    )
    vi.spyOn(document, 'createElement').mockReturnValue(canvas)
    const result = await compressPhoto(new File(['raw'], 'x.png', { type: 'image/png' }))
    expect([canvas.width, canvas.height]).toEqual([1200, 800])
    expect(result.type).toBe('image/jpeg')
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1200, 800)
    expect(bitmap.close).toHaveBeenCalledOnce()
  })
  it('rejects excessive pixel counts and releases the decoded bitmap on failure', async () => {
    const bitmap = { width: 10000, height: 10000, close: vi.fn() }
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    await expect(compressPhoto(new File(['raw'], 'x.jpg', { type: 'image/jpeg' }))).rejects.toThrow(
      '尺寸过大',
    )
    expect(bitmap.close).toHaveBeenCalledOnce()
  })
  it('explains corrupt image errors without claiming upload success', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')))
    await expect(
      compressPhoto(new File(['corrupt'], 'x.jpg', { type: 'image/jpeg' })),
    ).rejects.toThrow('图片无法读取')
  })
})

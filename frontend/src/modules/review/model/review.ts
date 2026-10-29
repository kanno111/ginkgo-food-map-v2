import type { InjectionKey } from 'vue'
import type { RatingDimension } from '@/modules/restaurant/model/restaurant.types'
export type Scores = Record<RatingDimension, number>
export interface ReviewPhoto {
  id: string
  url: string
}
export interface ReviewItem {
  id: string
  username: string
  createdAt: string
  scores: Scores
  recommended: boolean
  body: string
  photos: ReviewPhoto[]
  canDelete: boolean
  replies: { id: string; username: string; body: string; createdAt: string }[]
}
export interface ReviewDraft {
  restaurantId: string
  scores: Scores
  recommended: boolean
  body: string
  photos: File[]
  clientRequestId: string
}
/** 前端交互契约；真实HTTP协议尚未实现，禁止回退到本地假成功。权限最终由服务端核验。 */
export interface ReviewGateway {
  list(restaurantId: string, signal: AbortSignal): Promise<ReviewItem[]>
  publish(draft: ReviewDraft): Promise<void>
  reply(reviewId: string, body: string, requestId: string): Promise<void>
  remove(reviewId: string): Promise<void>
}
export const reviewGatewayKey: InjectionKey<ReviewGateway> = Symbol('review-gateway')
const unavailable = async (): Promise<never> => {
  throw new Error('评价服务尚未开放，当前内容未发布。')
}
export const unavailableReviewGateway: ReviewGateway = {
  list: unavailable,
  publish: unavailable,
  reply: unavailable,
  remove: unavailable,
}
/** 半分先转整数单位计算，避免7.875的二进制浮点舍入偏差。 */
export function overall(scores: Scores): number {
  return Math.round(Object.values(scores).reduce((a, b) => a + b * 2, 0) * 12.5) / 100
}
export function validBody(body: string, min: number, max: number): boolean {
  const n = Array.from(body.trim()).length
  return n >= min && n <= max
}

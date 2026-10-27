export interface ApiResponse<T> {
  success: boolean
  code: string
  data: T
  message: string
  timestamp: string
}

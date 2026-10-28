/** 确认密码只在表单内比较；服务端通过邮箱与一次性验证码确定目标账号。 */
export interface PasswordResetRequest {
  email: string
  verificationCode: string
  newPassword: string
}

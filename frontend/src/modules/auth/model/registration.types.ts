/** 后端注册接口需要的字段；确认密码只在前端校验，不发送到服务端。 */
export interface RegistrationRequest {
  email: string
  verificationCode: string
  username: string
  password: string
}

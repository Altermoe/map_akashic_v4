import * as z from 'zod'

export const loginResponseSchema = z.object({
  access_token: z.string().meta({ description: '接口 token' }),
  token_type: z.string().meta({ description: 'token 前缀, 和 access_token 拼接后放在 header 中' }),
  expires_in: z.int().meta({ description: '接口 token 有效时间, 单位为秒' }),
  scope: z.string().meta({ description: '可访问范围' }),
  jti: z.string().meta({ description: 'JWT Identifier' }),
})
export type LoginResponse = z.infer<typeof loginResponseSchema>

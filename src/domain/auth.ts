import { z } from 'zod'

export const loginSchema = z
  .object({
    email: z.string().trim().min(3).max(254).email('Enter a valid email address'),
    password: z.string().min(1, 'Password is required').max(128),
  })
  .strict()

export type LoginInput = z.infer<typeof loginSchema>

import { z } from 'zod'

const emailSchema = z.string().trim().email('Informe um e-mail válido.')
const passwordSchema = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha.'),
})

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome completo.').max(100),
  email: emailSchema,
  cpf: z.string().trim().optional().or(z.literal('')).refine(
    (value) => !value || value.replace(/\D/g, '').length === 11,
    'O CPF deve conter 11 dígitos.',
  ),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  message: 'As senhas não coincidem.',
  path: ['confirmPassword'],
})

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome completo.').max(100),
  cpf: z.string().trim().optional().or(z.literal('')).refine(
    (value) => !value || value.replace(/\D/g, '').length === 11,
    'O CPF deve conter 11 dígitos.',
  ),
})

export const emailChangeSchema = z.object({
  email: emailSchema,
  currentPassword: z.string().min(1, 'Informe sua senha atual.'),
})

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Informe sua senha atual.'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  message: 'As senhas não coincidem.',
  path: ['confirmPassword'],
})

export type LoginFormValues = z.infer<typeof loginSchema>
export type RegisterFormValues = z.infer<typeof registerSchema>
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>
export type ProfileFormValues = z.infer<typeof profileSchema>
export type EmailChangeFormValues = z.infer<typeof emailChangeSchema>
export type PasswordChangeFormValues = z.infer<typeof passwordChangeSchema>

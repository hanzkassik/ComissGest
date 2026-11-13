import { z } from 'zod'

export const companySchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da empresa.').max(100, 'O nome pode ter até 100 caracteres.'),
  cnpj: z.string().trim().optional().or(z.literal('')).refine(
    (value) => !value || value.replace(/\D/g, '').length === 14,
    'O CNPJ deve conter 14 dígitos.',
  ),
})

export const companySettingsSchema = companySchema.extend({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Escolha uma cor válida.'),
})

export type CompanyFormValues = z.infer<typeof companySchema>
export type CompanySettingsValues = z.infer<typeof companySettingsSchema>

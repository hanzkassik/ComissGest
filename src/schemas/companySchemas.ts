import { z } from 'zod'
import { DEFAULT_BRAND_DARK_PRIMARY } from '../utils/brandColors'

export const DEFAULT_COMPANY_DARK_PRIMARY = DEFAULT_BRAND_DARK_PRIMARY

export const DEFAULT_MONTHLY_GOAL_REMINDER_MESSAGE = 'Você ainda não cadastrou uma meta para este mês. Que tal definir seu objetivo e acompanhar seu progresso?'

const monthlyGoalSettings = {
  askForMonthlyGoalIfMissing: z.boolean().default(true),
  monthlyGoalReminderMessage: z.string().trim().min(1, 'Informe a mensagem do aviso.').max(500, 'A mensagem pode ter até 500 caracteres.').default(DEFAULT_MONTHLY_GOAL_REMINDER_MESSAGE),
}

export const companySchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da empresa.').max(100, 'O nome pode ter até 100 caracteres.'),
  cnpj: z.string().trim().optional().or(z.literal('')).refine(
    (value) => !value || value.replace(/\D/g, '').length === 14,
    'O CNPJ deve conter 14 dígitos.',
  ),
  ...monthlyGoalSettings,
})

export const companySettingsSchema = companySchema.extend({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Escolha uma cor válida.'),
  darkPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Escolha uma cor válida.'),
})

export type CompanyFormValues = z.infer<typeof companySchema>
export type CompanySettingsValues = z.infer<typeof companySettingsSchema>
export type CompanyFormInput = z.input<typeof companySchema>
export type CompanySettingsInput = z.input<typeof companySettingsSchema>

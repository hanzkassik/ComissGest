import { z } from 'zod'

const localDate = /^\d{4}-\d{2}-\d{2}$/
const brazilianDecimal = /^\d+(?:,\d{1,2})?$/

function isCalendarDate(value: string) {
  if (!localDate.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
}

export const goalSchema = z.object({
  startDate: z.string().refine(isCalendarDate, 'Informe uma data inicial válida.'),
  endDate: z.string().refine(isCalendarDate, 'Informe uma data final válida.'),
  target: z.string().trim().regex(brazilianDecimal, 'Informe o valor em reais, usando vírgula para os centavos.').refine(
    (value) => Number(value.replace(',', '.')) > 0,
    'O valor da meta deve ser maior que zero.',
  ),
  businessDays: z.string().regex(/^\d+$/, 'Informe um número inteiro de dias úteis.').refine(
    (value) => Number(value) >= 1 && Number(value) <= 3660,
    'Informe entre 1 e 3660 dias úteis.',
  ),
  description: z.string().trim().max(500, 'A descrição pode ter até 500 caracteres.'),
}).superRefine((values, context) => {
  if (values.startDate && values.endDate && isCalendarDate(values.startDate) && isCalendarDate(values.endDate) && values.startDate > values.endDate) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'A data final deve ser igual ou posterior à data inicial.' })
  }
})

export type GoalFormInput = z.infer<typeof goalSchema>

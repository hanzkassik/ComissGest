import { z } from 'zod'
import { toLocalDateInputValue } from '../utils/currency'

const brazilianDecimal = /^\d+(?:,\d{1,2})?$/
const localDate = /^\d{4}-\d{2}-\d{2}$/

function isCalendarDate(value: string) {
  if (!localDate.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
}

export const saleSchema = z.object({
  soldOn: z.string().regex(localDate, 'Informe a data da venda.').refine(
    isCalendarDate,
    'Informe uma data válida.',
  ).refine(
    (value) => value <= toLocalDateInputValue(),
    'A data da venda não pode ser futura.',
  ),
  soldTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe um horário válido.'),
  amount: z.string().trim().regex(brazilianDecimal, 'Informe o valor em reais, usando vírgula para os centavos.').refine(
    (value) => Number(value.replace(',', '.')) > 0,
    'O valor da venda deve ser maior que zero.',
  ),
  commissionRate: z.string().trim().regex(brazilianDecimal, 'Informe o percentual, usando vírgula para as casas decimais.').refine(
    (value) => Number(value.replace(',', '.')) >= 0 && Number(value.replace(',', '.')) <= 100,
    'O percentual deve estar entre 0 e 100%.',
  ),
  notes: z.string().trim().max(500, 'A observação pode ter até 500 caracteres.').optional(),
}).superRefine((values, context) => {
  if (values.soldOn === toLocalDateInputValue() && values.soldTime > new Date().toTimeString().slice(0, 5)) {
    context.addIssue({ code: 'custom', path: ['soldTime'], message: 'A data e hora da venda não podem ser futuras.' })
  }
})

export type SaleFormValues = z.infer<typeof saleSchema>

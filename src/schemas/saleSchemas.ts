import { z } from 'zod'
import { toLocalDateInputValue } from '../utils/currency'

const brazilianDecimal = /^\d+(?:,\d{1,2})?$/
const quantityDecimal = /^\d+(?:,\d+)?$/
const localDate = /^\d{4}-\d{2}-\d{2}$/

function isCalendarDate(value: string) {
  if (!localDate.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
}

const optionalDate = z.string().optional().or(z.literal(''))

export const saleItemSchema = z.object({
  itemId: z.string().max(128).optional(),
  productId: z.string().max(128).optional(),
  statusId: z.string().trim().max(128).optional(),
  amount: z.string().trim().max(16).regex(brazilianDecimal, 'Informe o valor em reais, usando vírgula para os centavos.').refine(
    (value) => Number(value.replace(',', '.')) > 0,
    'O valor total do item deve ser maior que zero.',
  ),
  unitPrice: z.string().trim().max(16).regex(brazilianDecimal, 'Informe o valor em reais, usando vírgula para os centavos.').refine(
    (value) => Number(value.replace(',', '.')) >= 0,
    'O valor unitário não pode ser negativo.',
  ),
  commissionRate: z.string().trim().max(6).regex(brazilianDecimal, 'Informe o percentual, usando vírgula para as casas decimais.').refine(
    (value) => Number(value.replace(',', '.')) >= 0 && Number(value.replace(',', '.')) <= 100,
    'O percentual deve estar entre 0 e 100%.',
  ),
  quantity: z.string().trim().max(24).regex(quantityDecimal, 'Informe uma quantidade válida.').refine(
    (value) => Number.isFinite(Number(value.replace(',', '.'))) && Number(value.replace(',', '.')) > 0,
    'A quantidade deve ser maior que zero.',
  ),
  deliveryOn: optionalDate.refine((value) => !value || isCalendarDate(value), 'Informe uma data de entrega válida.'),
  notes: z.string().trim().max(500, 'A observação do item pode ter até 500 caracteres.').optional(),
}).superRefine((value, context) => {
  if (value.productId && !/^[A-Za-z0-9_-]{1,128}$/.test(value.productId)) {
    context.addIssue({ code: 'custom', path: ['productId'], message: 'Produto inválido.' })
  }
  if (value.statusId && !/^[A-Za-z0-9_-]{1,128}$/.test(value.statusId)) {
    context.addIssue({ code: 'custom', path: ['statusId'], message: 'Status inválido.' })
  }
})

export type SaleItemFormValues = z.infer<typeof saleItemSchema>

export const saleSchema = z.object({
  customerName: z.string().trim().max(160, 'O nome do cliente pode ter até 160 caracteres.').optional(),
  customerPhone: z.string().trim().max(32, 'O celular informado é inválido.').refine(
    (value) => !value || /^\+[1-9]\d{6,14}$/.test(value),
    'Informe um celular válido.',
  ).optional(),
  externalNumber: z.string().trim().max(100, 'O número da venda pode ter até 100 caracteres.').optional(),
  soldOn: z.string().regex(localDate, 'Informe a data da venda.').refine(
    isCalendarDate,
    'Informe uma data válida.',
  ).refine(
    (value) => value <= toLocalDateInputValue(),
    'A data da venda não pode ser futura.',
  ),
  soldTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe um horário válido.'),
  deliveryOn: optionalDate.refine((value) => !value || isCalendarDate(value), 'Informe uma data de entrega válida.'),
  statusId: z.string().trim().max(128).optional(),
  notes: z.string().trim().max(500, 'A observação pode ter até 500 caracteres.').optional(),
  items: z.array(saleItemSchema).min(1, 'Adicione pelo menos um item à venda.'),
}).superRefine((values, context) => {
  if (values.soldOn === toLocalDateInputValue() && values.soldTime > new Date().toTimeString().slice(0, 5)) {
    context.addIssue({ code: 'custom', path: ['soldTime'], message: 'A data e hora da venda não podem ser futuras.' })
  }
  if (values.deliveryOn && values.soldOn && values.deliveryOn < values.soldOn) {
    context.addIssue({ code: 'custom', path: ['deliveryOn'], message: 'A entrega prevista não pode ser anterior à venda.' })
  }
})

export type SaleFormValues = z.infer<typeof saleSchema>

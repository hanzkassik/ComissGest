import { z } from 'zod'
import { dashboardIndicatorIds } from '../types/dashboard'

const indicatorIdSchema = z.enum(dashboardIndicatorIds)

export const customScreenSchema = z.object({
  name: z.string().trim().min(2, 'Informe um nome com pelo menos 2 caracteres.').max(60, 'O nome pode ter até 60 caracteres.'),
  visibleIndicators: z.array(indicatorIdSchema).min(1, 'Selecione pelo menos um indicador.'),
  indicatorOrder: z.array(indicatorIdSchema).length(dashboardIndicatorIds.length, 'A ordem dos indicadores está inválida.'),
}).superRefine((values, context) => {
  if (new Set(values.visibleIndicators).size !== values.visibleIndicators.length) {
    context.addIssue({ code: 'custom', path: ['visibleIndicators'], message: 'Há indicadores repetidos na seleção.' })
  }
  if (new Set(values.indicatorOrder).size !== dashboardIndicatorIds.length
    || dashboardIndicatorIds.some((id) => !values.indicatorOrder.includes(id))) {
    context.addIssue({ code: 'custom', path: ['indicatorOrder'], message: 'A ordem dos indicadores está incompleta.' })
  }
})

export type CustomScreenFormInput = z.infer<typeof customScreenSchema>

export const emptyCustomScreenValues: CustomScreenFormInput = {
  name: '',
  visibleIndicators: [],
  indicatorOrder: [...dashboardIndicatorIds],
}

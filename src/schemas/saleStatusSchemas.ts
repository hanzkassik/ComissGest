import { z } from 'zod'

export const saleStatusSchema = z.object({
  name: z.string().trim().min(2, 'Informe ao menos 2 caracteres.').max(60, 'O status pode ter até 60 caracteres.'),
})

export type SaleStatusFormValues = z.infer<typeof saleStatusSchema>

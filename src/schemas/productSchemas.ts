import { z } from 'zod'

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Informe um nome com pelo menos 2 caracteres.').max(100, 'O nome pode ter até 100 caracteres.'),
})

export type ProductFormValues = z.infer<typeof productSchema>

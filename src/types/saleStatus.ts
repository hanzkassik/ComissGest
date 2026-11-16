import type { Timestamp } from 'firebase/firestore'

export interface SaleStatus {
  statusId: string
  name: string
  sortOrder: number
  active: boolean
  isFinalizedIndicator: boolean
  usageCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
  updatedBy: string
}

export interface SaleStatusFormValues {
  name: string
}

export const defaultSaleStatuses = [
  { statusId: 'created', name: 'Criado', sortOrder: 0, isFinalizedIndicator: false },
  { statusId: 'in-fabrication', name: 'Em fabricação', sortOrder: 1, isFinalizedIndicator: false },
  { statusId: 'awaiting-delivery', name: 'Aguardando entrega', sortOrder: 2, isFinalizedIndicator: false },
  { statusId: 'finished', name: 'Finalizado', sortOrder: 3, isFinalizedIndicator: true },
] as const

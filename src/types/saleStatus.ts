import type { Timestamp } from 'firebase/firestore'

export const DEFAULT_SALE_STATUS_COLOR = '#187f63'

export interface SaleStatus {
  statusId: string
  name: string
  color: string
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
  { statusId: 'created', name: 'Criado', color: '#187f63', sortOrder: 0, isFinalizedIndicator: false },
  { statusId: 'in-fabrication', name: 'Em fabricação', color: '#3877c8', sortOrder: 1, isFinalizedIndicator: false },
  { statusId: 'awaiting-delivery', name: 'Aguardando entrega', color: '#b7791f', sortOrder: 2, isFinalizedIndicator: false },
  { statusId: 'finished', name: 'Finalizado', color: '#39834a', sortOrder: 3, isFinalizedIndicator: true },
] as const

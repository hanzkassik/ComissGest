import type { QueryDocumentSnapshot, Timestamp } from 'firebase/firestore'

export interface Sale {
  saleId: string
  userId: string
  amountCents: number
  commissionRateBps: number
  commissionCents: number
  soldAt: Timestamp
  createdAt: Timestamp
  notes?: string
  productId?: string
}

export interface SaleFilters {
  startDate?: string
  endDate?: string
}

export interface SalePage {
  sales: Sale[]
  cursor: QueryDocumentSnapshot | null
  hasMore: boolean
}

export interface SaleTotals {
  amountCents: number
  commissionCents: number
  count: number
}

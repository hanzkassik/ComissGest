import type { QueryDocumentSnapshot, Timestamp } from 'firebase/firestore'

export interface SaleItem {
  itemId: string
  amountCents: number
  unitPriceCents?: number
  commissionRateBps: number
  commissionCents: number
  quantity: number
  productId?: string
  statusId?: string
  deliveryAt?: Timestamp
  notes?: string
}

export interface Sale {
  saleId: string
  userId: string
  soldAt: Timestamp
  createdAt: Timestamp
  statusId?: string
  items: SaleItem[]
  customerName?: string
  customerPhone?: string
  externalNumber?: string
  deliveryAt?: Timestamp
  notes?: string
  /** True only for documents that still use the legacy one-item format. */
  legacyFormat?: boolean
}

export interface SaleFilters {
  startDate?: string
  endDate?: string
  orderStatusId?: string
  itemStatusId?: string
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

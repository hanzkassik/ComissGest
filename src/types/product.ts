import type { Timestamp } from 'firebase/firestore'

export interface Product {
  productId: string
  name: string
  description?: string
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
  updatedBy: string
}

import type { Sale, SaleItem } from '../types/sale'

export function sumSaleItems(sale: Sale, field: 'amountCents' | 'commissionCents'): number {
  return sale.items.reduce((total, item) => total + item[field], 0)
}

export function sumItems(items: SaleItem[], field: 'amountCents' | 'commissionCents'): number {
  return items.reduce((total, item) => total + item[field], 0)
}

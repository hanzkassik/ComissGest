import type { ProductSalesSummary } from '../types/dashboard'
import type { Sale } from '../types/sale'

export function buildProductSalesSummaries(
  sales: Sale[],
  productNames: Record<string, string>,
  start: Date,
  end: Date,
): ProductSalesSummary[] {
  const summaries = new Map<string, ProductSalesSummary>()

  for (const sale of sales) {
    const soldAt = sale.soldAt.toDate()
    if (soldAt < start || soldAt >= end) continue

    const productId = sale.productId ?? null
    const key = productId ?? '__without_product__'
    const productName = productId
      ? productNames[productId] ?? 'Produto indisponível'
      : 'Sem produto'
    const summary = summaries.get(key) ?? {
      productId,
      productName,
      salesCount: 0,
      salesCents: 0,
      commissionCents: 0,
    }
    summary.salesCount += 1
    summary.salesCents += sale.amountCents
    summary.commissionCents += sale.commissionCents
    summaries.set(key, summary)
  }

  return [...summaries.values()].sort((left, right) => right.salesCents - left.salesCents || left.productName.localeCompare(right.productName, 'pt-BR'))
}

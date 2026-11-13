import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { firestore } from '../firebase/firestore'
import type { Sale } from '../types/sale'
import type { DashboardInterval } from '../types/dashboard'
import { getDashboardPeriodBounds } from '../utils/dashboardMetrics'

const PAGE_SIZE = 250

function mapSale(saleDocument: QueryDocumentSnapshot): Sale {
  const data = saleDocument.data()
  if (typeof data.userId !== 'string'
    || !Number.isSafeInteger(data.amountCents)
    || !Number.isSafeInteger(data.commissionRateBps)
    || !Number.isSafeInteger(data.commissionCents)
    || !(data.soldAt instanceof Timestamp)
    || !(data.createdAt instanceof Timestamp)) {
    throw new Error(`A venda ${saleDocument.id} contém dados inválidos.`)
  }
  return {
    saleId: saleDocument.id,
    userId: data.userId,
    amountCents: data.amountCents,
    commissionRateBps: data.commissionRateBps,
    commissionCents: data.commissionCents,
    soldAt: data.soldAt,
    createdAt: data.createdAt,
    ...(typeof data.notes === 'string' ? { notes: data.notes } : {}),
  }
}

export async function getDashboardSales(companyId: string, userId: string, period: DashboardInterval, now = new Date(), customRange?: { start: Date; end: Date }): Promise<Sale[]> {
  const salesCollection = collection(firestore, 'companies', companyId, 'sales')
  const { queryStart, queryEnd } = getDashboardPeriodBounds(period, now, customRange)
  const sales: Sale[] = []
  let cursor: QueryDocumentSnapshot | undefined

  while (true) {
    const constraints: QueryConstraint[] = [
    where('userId', '==', userId),
    where('soldAt', '>=', Timestamp.fromDate(queryStart)),
    where('soldAt', period === 'custom' ? '<' : '<=', Timestamp.fromDate(queryEnd)),
    orderBy('soldAt', 'desc'),
    ]
    if (cursor) constraints.push(startAfter(cursor))
    constraints.push(limit(PAGE_SIZE))
    const page = await getDocs(query(salesCollection, ...constraints))
    sales.push(...page.docs.map(mapSale))
    if (page.size < PAGE_SIZE) break
    cursor = page.docs.at(-1)
    if (!cursor) break
  }

  return sales
}


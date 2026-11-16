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
import { mapSaleDocument } from './saleService'
import type { DashboardInterval } from '../types/dashboard'
import { getDashboardPeriodBounds } from '../utils/dashboardMetrics'

const PAGE_SIZE = 250

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
    sales.push(...page.docs.map(mapSaleDocument))
    if (page.size < PAGE_SIZE) break
    cursor = page.docs.at(-1)
    if (!cursor) break
  }

  return sales
}

export async function getSalesForDateRange(companyId: string, userId: string, start: Date, end: Date): Promise<Sale[]> {
  const salesCollection = collection(firestore, 'companies', companyId, 'sales')
  const sales: Sale[] = []
  let cursor: QueryDocumentSnapshot | undefined
  while (true) {
    const constraints: QueryConstraint[] = [
      where('userId', '==', userId),
      where('soldAt', '>=', Timestamp.fromDate(start)),
      where('soldAt', '<', Timestamp.fromDate(end)),
      orderBy('soldAt', 'desc'),
    ]
    if (cursor) constraints.push(startAfter(cursor))
    constraints.push(limit(PAGE_SIZE))
    const page = await getDocs(query(salesCollection, ...constraints))
    sales.push(...page.docs.map(mapSaleDocument))
    if (page.size < PAGE_SIZE) break
    cursor = page.docs.at(-1)
    if (!cursor) break
  }
  return sales
}


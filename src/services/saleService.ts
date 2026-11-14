import {
  collection,
  deleteField,
  doc,
  deleteDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  setDoc,
  startAfter,
  Timestamp,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { firestore } from '../firebase/firestore'
import type { Sale, SaleFilters, SalePage, SaleTotals } from '../types/sale'
import { calculateCommissionCents, dateWithLocalTime, parseBrazilianDecimalToInteger, parseLocalDateAfterEnd, parseLocalDateStart } from '../utils/currency'
import type { SaleFormValues } from '../schemas/saleSchemas'

const PAGE_SIZE = 10

function filteredSalesQuery(companyId: string, userId: string, filters: SaleFilters) {
  const constraints: QueryConstraint[] = [where('userId', '==', userId)]
  if (filters.startDate) {
    constraints.push(where('soldAt', '>=', Timestamp.fromDate(parseLocalDateStart(filters.startDate))))
  }
  if (filters.endDate) {
    constraints.push(where('soldAt', '<', Timestamp.fromDate(parseLocalDateAfterEnd(filters.endDate))))
  }
  return query(collection(firestore, 'companies', companyId, 'sales'), ...constraints)
}

function mapSaleDocument(saleDoc: QueryDocumentSnapshot): Sale {
  const data = saleDoc.data()
  return {
    saleId: saleDoc.id,
    userId: data.userId as string,
    amountCents: data.amountCents as number,
    commissionRateBps: data.commissionRateBps as number,
    commissionCents: data.commissionCents as number,
    soldAt: data.soldAt as Timestamp,
    createdAt: data.createdAt as Timestamp,
    ...(typeof data.notes === 'string' ? { notes: data.notes } : {}),
    ...(typeof data.productId === 'string' ? { productId: data.productId } : {}),
  }
}

export async function createSale(
  companyId: string,
  userId: string,
  values: SaleFormValues,
): Promise<void> {
  const amountCents = parseBrazilianDecimalToInteger(values.amount, 2)
  const commissionRateBps = parseBrazilianDecimalToInteger(values.commissionRate, 2)
  const commissionCents = calculateCommissionCents(amountCents, commissionRateBps)
  const saleRef = doc(collection(firestore, 'companies', companyId, 'sales'))

  await setDoc(saleRef, {
    userId,
    amountCents,
    commissionRateBps,
    commissionCents,
    soldAt: Timestamp.fromDate(dateWithLocalTime(values.soldOn, values.soldTime)),
    createdAt: serverTimestamp(),
    ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
    ...(values.productId ? { productId: values.productId } : {}),
  })
}

export async function updateSale(companyId: string, saleId: string, values: SaleFormValues): Promise<void> {
  const amountCents = parseBrazilianDecimalToInteger(values.amount, 2)
  const commissionRateBps = parseBrazilianDecimalToInteger(values.commissionRate, 2)
  const commissionCents = calculateCommissionCents(amountCents, commissionRateBps)
  await updateDoc(doc(firestore, 'companies', companyId, 'sales', saleId), {
    amountCents,
    commissionRateBps,
    commissionCents,
    soldAt: Timestamp.fromDate(dateWithLocalTime(values.soldOn, values.soldTime)),
    notes: values.notes?.trim() ? values.notes.trim() : deleteField(),
    productId: values.productId ? values.productId : deleteField(),
  })
}

export async function deleteSale(companyId: string, saleId: string): Promise<void> {
  await deleteDoc(doc(firestore, 'companies', companyId, 'sales', saleId))
}

export async function getSalesPage(
  companyId: string,
  userId: string,
  filters: SaleFilters,
  cursor?: QueryDocumentSnapshot | null,
): Promise<SalePage> {
  const constraints: QueryConstraint[] = [orderBy('soldAt', 'desc')]
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(PAGE_SIZE + 1))

  const snapshot = await getDocs(query(filteredSalesQuery(companyId, userId, filters), ...constraints))
  const visibleDocs = snapshot.docs.slice(0, PAGE_SIZE)
  const sales = visibleDocs.map(mapSaleDocument)

  return {
    sales,
    cursor: visibleDocs.at(-1) ?? null,
    hasMore: snapshot.docs.length > PAGE_SIZE,
  }
}

export async function getSalesTotals(companyId: string, userId: string, filters: SaleFilters): Promise<SaleTotals> {
  const totals: SaleTotals = { amountCents: 0, commissionCents: 0, count: 0 }
  let cursor: QueryDocumentSnapshot | null = null
  let hasMore = true

  while (hasMore) {
    const page = await getSalesPage(companyId, userId, filters, cursor)
    for (const sale of page.sales) {
      totals.amountCents += sale.amountCents
      totals.commissionCents += sale.commissionCents
      totals.count += 1
    }
    cursor = page.cursor
    hasMore = page.hasMore
  }

  return totals
}

export async function getSalesForExport(companyId: string, userId: string, filters: SaleFilters): Promise<Sale[]> {
  const sales: Sale[] = []
  let cursor: QueryDocumentSnapshot | null = null
  let hasMore = true
  while (hasMore) {
    const page = await getSalesPage(companyId, userId, filters, cursor)
    sales.push(...page.sales)
    cursor = page.cursor
    hasMore = page.hasMore
  }
  return sales
}

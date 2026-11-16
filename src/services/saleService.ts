import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { firestore } from '../firebase/firestore'
import type { Sale, SaleFilters, SaleItem, SalePage, SaleTotals } from '../types/sale'
import { calculateCommissionCents, dateWithLocalTime, parseBrazilianDecimalToInteger, parseLocalDateAfterEnd, parseLocalDateStart } from '../utils/currency'
import type { SaleFormValues } from '../schemas/saleSchemas'

const PAGE_SIZE = 10
const LEGACY_FINISHED_STATUS_ID = 'finished'

function filteredSalesQuery(companyId: string, userId: string, filters: SaleFilters) {
  const constraints: QueryConstraint[] = [where('userId', '==', userId)]
  if (filters.startDate) constraints.push(where('soldAt', '>=', Timestamp.fromDate(parseLocalDateStart(filters.startDate))))
  if (filters.endDate) constraints.push(where('soldAt', '<', Timestamp.fromDate(parseLocalDateAfterEnd(filters.endDate))))
  return query(collection(firestore, 'companies', companyId, 'sales'), ...constraints)
}

function mapItem(data: Record<string, unknown>, itemId: string): SaleItem {
  if (typeof data.amountCents !== 'number'
    || !Number.isSafeInteger(data.amountCents)
    || typeof data.commissionRateBps !== 'number'
    || !Number.isSafeInteger(data.commissionRateBps)
    || typeof data.commissionCents !== 'number'
    || !Number.isSafeInteger(data.commissionCents)
    || typeof data.quantity !== 'number'
    || !Number.isFinite(data.quantity)) {
    throw new Error(`O item ${itemId} contém dados inválidos.`)
  }
  return {
    itemId,
    amountCents: data.amountCents,
    commissionRateBps: data.commissionRateBps,
    commissionCents: data.commissionCents,
    quantity: data.quantity,
    ...(typeof data.productId === 'string' ? { productId: data.productId } : {}),
    ...(typeof data.notes === 'string' ? { notes: data.notes } : {}),
  }
}

export function mapSaleDocument(saleDoc: QueryDocumentSnapshot): Sale {
  const data = saleDoc.data()
  if (typeof data.userId !== 'string' || !(data.soldAt instanceof Timestamp) || !(data.createdAt instanceof Timestamp)) {
    throw new Error(`A venda ${saleDoc.id} contém dados inválidos.`)
  }
  if (Array.isArray(data.items)) {
    const items = data.items.map((item: unknown, index: number) => {
      if (!item || typeof item !== 'object') throw new Error(`A venda ${saleDoc.id} contém um item inválido.`)
      return mapItem(item as Record<string, unknown>, typeof (item as { itemId?: unknown }).itemId === 'string' ? (item as { itemId: string }).itemId : `${saleDoc.id}-${index + 1}`)
    })
    return {
      saleId: saleDoc.id,
      userId: data.userId,
      soldAt: data.soldAt,
      createdAt: data.createdAt,
      statusId: typeof data.statusId === 'string' ? data.statusId : LEGACY_FINISHED_STATUS_ID,
      items,
      ...(typeof data.customerName === 'string' ? { customerName: data.customerName } : {}),
      ...(typeof data.customerPhone === 'string' ? { customerPhone: data.customerPhone } : {}),
      ...(typeof data.externalNumber === 'string' ? { externalNumber: data.externalNumber } : {}),
      ...(data.deliveryAt instanceof Timestamp ? { deliveryAt: data.deliveryAt } : {}),
      ...(typeof data.notes === 'string' ? { notes: data.notes } : {}),
    }
  }
  return {
    saleId: saleDoc.id,
    userId: data.userId,
    soldAt: data.soldAt,
    createdAt: data.createdAt,
    statusId: LEGACY_FINISHED_STATUS_ID,
    items: [mapItem({ ...data, quantity: 1 }, `${saleDoc.id}-legacy-item`)],
    ...(typeof data.notes === 'string' ? { items: [mapItem({ ...data, quantity: 1, notes: data.notes }, `${saleDoc.id}-legacy-item`)] } : {}),
    legacyFormat: true,
  }
}

function itemData(values: SaleFormValues['items'][number]): SaleItem {
  const amountCents = parseBrazilianDecimalToInteger(values.amount, 2)
  const commissionRateBps = parseBrazilianDecimalToInteger(values.commissionRate, 2)
  return {
    itemId: values.itemId || crypto.randomUUID(),
    amountCents,
    commissionRateBps,
    commissionCents: calculateCommissionCents(amountCents, commissionRateBps),
    quantity: Number(values.quantity.replace(',', '.')),
    ...(values.productId ? { productId: values.productId } : {}),
    ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
  }
}

function saleData(userId: string, values: SaleFormValues) {
  return {
    userId,
    soldAt: Timestamp.fromDate(dateWithLocalTime(values.soldOn, values.soldTime)),
    ...(values.statusId ? { statusId: values.statusId } : {}),
    items: values.items.map(itemData),
    ...(values.customerName?.trim() ? { customerName: values.customerName.trim() } : {}),
    ...(values.customerPhone?.trim() ? { customerPhone: values.customerPhone.trim() } : {}),
    ...(values.externalNumber?.trim() ? { externalNumber: values.externalNumber.trim() } : {}),
    ...(values.deliveryOn ? { deliveryAt: Timestamp.fromDate(parseLocalDateStart(values.deliveryOn)) } : {}),
    ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
  }
}

function sumItems(items: SaleItem[], key: 'amountCents' | 'commissionCents') {
  return items.reduce((total, item) => total + item[key], 0)
}

export async function createSale(companyId: string, userId: string, values: SaleFormValues): Promise<void> {
  const saleRef = doc(collection(firestore, 'companies', companyId, 'sales'))
  const data = saleData(userId, values)
  await runTransaction(firestore, async (transaction) => {
    const statusRef = values.statusId ? doc(firestore, 'companies', companyId, 'saleStatuses', values.statusId) : null
    const statusSnapshot = statusRef ? await transaction.get(statusRef) : null
    if (statusSnapshot && (!statusSnapshot.exists() || statusSnapshot.data().active !== true)) throw new Error('SALE_STATUS_UNAVAILABLE')
    transaction.set(saleRef, { ...data, createdAt: serverTimestamp() })
    if (statusRef && statusSnapshot?.exists()) transaction.update(statusRef, { usageCount: (Number(statusSnapshot.data().usageCount) || 0) + 1, lastUsageChangeSaleId: saleRef.id, updatedAt: serverTimestamp() })
  })
}

export async function updateSale(companyId: string, saleId: string, userId: string, values: SaleFormValues): Promise<void> {
  const saleRef = doc(firestore, 'companies', companyId, 'sales', saleId)
  const data = saleData(userId, values)
  await runTransaction(firestore, async (transaction) => {
    const saleSnapshot = await transaction.get(saleRef)
    if (!saleSnapshot.exists() || saleSnapshot.data().userId !== userId) throw new Error('SALE_NOT_FOUND')
    const oldData = saleSnapshot.data()
    const oldStatusId = typeof oldData.statusId === 'string' ? oldData.statusId : undefined
    const nextStatusId = values.statusId || undefined
    const oldStatusRef = oldStatusId ? doc(firestore, 'companies', companyId, 'saleStatuses', oldStatusId) : null
    const nextStatusRef = nextStatusId ? doc(firestore, 'companies', companyId, 'saleStatuses', nextStatusId) : null
    const statusRefs = oldStatusId === nextStatusId ? (nextStatusRef ? [nextStatusRef] : []) : [oldStatusRef, nextStatusRef].filter((ref) => ref !== null)
    const statusSnapshots = await Promise.all(statusRefs.map((ref) => transaction.get(ref)))
    const nextStatus = nextStatusRef ? statusSnapshots[statusRefs.indexOf(nextStatusRef)] : null
    if (nextStatus && (!nextStatus.exists() || (oldStatusId !== nextStatusId && nextStatus.data().active !== true))) throw new Error('SALE_STATUS_UNAVAILABLE')
    transaction.set(saleRef, { ...data, createdAt: oldData.createdAt })
    if (oldStatusId !== nextStatusId) {
      if (oldStatusRef) {
        const oldStatus = statusSnapshots[statusRefs.indexOf(oldStatusRef)]
        if (!oldStatus.exists() || Number(oldStatus.data().usageCount) < 1) throw new Error('SALE_STATUS_COUNT_INVALID')
        transaction.update(oldStatusRef, { usageCount: Number(oldStatus.data().usageCount) - 1, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp() })
      }
      if (nextStatusRef && nextStatus?.exists()) {
        transaction.update(nextStatusRef, { usageCount: Number(nextStatus.data().usageCount) + 1, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp() })
      }
    }
  })
}

export async function deleteSale(companyId: string, saleId: string, userId: string): Promise<void> {
  const saleRef = doc(firestore, 'companies', companyId, 'sales', saleId)
  await runTransaction(firestore, async (transaction) => {
    const saleSnapshot = await transaction.get(saleRef)
    if (!saleSnapshot.exists() || saleSnapshot.data().userId !== userId) throw new Error('SALE_NOT_FOUND')
    const data = saleSnapshot.data()
    if (!Array.isArray(data.items)) throw new Error('LEGACY_SALE_REQUIRES_MIGRATION')
    const statusRef = typeof data.statusId === 'string' ? doc(firestore, 'companies', companyId, 'saleStatuses', data.statusId) : null
    const statusSnapshot = statusRef ? await transaction.get(statusRef) : null
    if (statusSnapshot && (!statusSnapshot.exists() || Number(statusSnapshot.data().usageCount) < 1)) throw new Error('SALE_STATUS_COUNT_INVALID')
    transaction.delete(saleRef)
    if (statusRef && statusSnapshot?.exists()) transaction.update(statusRef, { usageCount: Number(statusSnapshot.data().usageCount) - 1, lastUsageChangeSaleId: saleId, updatedAt: serverTimestamp() })
  })
}

export async function getSalesPage(companyId: string, userId: string, filters: SaleFilters, cursor?: QueryDocumentSnapshot | null): Promise<SalePage> {
  const constraints: QueryConstraint[] = [orderBy('soldAt', 'desc')]
  if (cursor) constraints.push(startAfter(cursor))
  constraints.push(limit(PAGE_SIZE + 1))
  const snapshot = await getDocs(query(filteredSalesQuery(companyId, userId, filters), ...constraints))
  const visibleDocs = snapshot.docs.slice(0, PAGE_SIZE)
  return { sales: visibleDocs.map(mapSaleDocument), cursor: visibleDocs.at(-1) ?? null, hasMore: snapshot.docs.length > PAGE_SIZE }
}

export async function getSalesTotals(companyId: string, userId: string, filters: SaleFilters): Promise<SaleTotals> {
  const totals: SaleTotals = { amountCents: 0, commissionCents: 0, count: 0 }
  let cursor: QueryDocumentSnapshot | null = null
  let hasMore = true
  while (hasMore) {
    const page = await getSalesPage(companyId, userId, filters, cursor)
    for (const sale of page.sales) {
      totals.amountCents += sumItems(sale.items, 'amountCents')
      totals.commissionCents += sumItems(sale.items, 'commissionCents')
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

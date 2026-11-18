import {
  collection,
  doc,
  getDoc,
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
  type Transaction,
} from 'firebase/firestore'
import { firestore } from '../firebase/firestore'
import type { Sale, SaleFilters, SaleItem, SalePage, SaleTotals } from '../types/sale'
import { calculateCommissionCents, dateWithLocalTime, parseBrazilianDecimalToInteger, parseLocalDateAfterEnd, parseLocalDateStart } from '../utils/currency'
import type { SaleFormValues } from '../schemas/saleSchemas'

const PAGE_SIZE = 20
const LEGACY_FINISHED_STATUS_ID = 'finished'

function filteredSalesQuery(companyId: string, userId: string, filters: SaleFilters) {
  const constraints: QueryConstraint[] = [where('userId', '==', userId)]
  if (filters.startDate) constraints.push(where('soldAt', '>=', Timestamp.fromDate(parseLocalDateStart(filters.startDate))))
  if (filters.endDate) constraints.push(where('soldAt', '<', Timestamp.fromDate(parseLocalDateAfterEnd(filters.endDate))))
  return query(collection(firestore, 'companies', companyId, 'sales'), ...constraints)
}

function matchesStatusFilters(sale: Sale, filters: SaleFilters) {
  if (filters.orderStatusId && sale.statusId !== filters.orderStatusId) return false
  if (filters.itemStatusId && !sale.items.some((item) => item.statusId === filters.itemStatusId)) return false
  return true
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
  const unitPriceCents = data.unitPriceCents === undefined
    ? Math.round(data.amountCents / data.quantity)
    : data.unitPriceCents
  if (typeof unitPriceCents !== 'number' || !Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0) {
    throw new Error(`O item ${itemId} contém um valor unitário inválido.`)
  }
  return {
    itemId,
    amountCents: data.amountCents,
    unitPriceCents,
    commissionRateBps: data.commissionRateBps,
    commissionCents: data.commissionCents,
    quantity: data.quantity,
    ...(typeof data.productId === 'string' ? { productId: data.productId } : {}),
    ...(typeof data.statusId === 'string' ? { statusId: data.statusId } : {}),
    ...(data.deliveryAt instanceof Timestamp ? { deliveryAt: data.deliveryAt } : {}),
    ...(typeof data.notes === 'string' ? { notes: data.notes } : {}),
  }
}

function mapSaleData(saleId: string, data: Record<string, unknown>): Sale {
  if (typeof data.userId !== 'string' || !(data.soldAt instanceof Timestamp) || !(data.createdAt instanceof Timestamp)) {
    throw new Error(`A venda ${saleId} contém dados inválidos.`)
  }
  if (Array.isArray(data.items)) {
    const items = data.items.map((item: unknown, index: number) => {
      if (!item || typeof item !== 'object') throw new Error(`A venda ${saleId} contém um item inválido.`)
      return mapItem(item as Record<string, unknown>, typeof (item as { itemId?: unknown }).itemId === 'string' ? (item as { itemId: string }).itemId : `${saleId}-${index + 1}`)
    })
    return {
      saleId,
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
    saleId,
    userId: data.userId,
    soldAt: data.soldAt,
    createdAt: data.createdAt,
    statusId: LEGACY_FINISHED_STATUS_ID,
    items: [mapItem({ ...data, quantity: 1 }, `${saleId}-legacy-item`)],
    ...(typeof data.notes === 'string' ? { items: [mapItem({ ...data, quantity: 1, notes: data.notes }, `${saleId}-legacy-item`)] } : {}),
    legacyFormat: true,
  }
}

export function mapSaleDocument(saleDoc: QueryDocumentSnapshot): Sale {
  return mapSaleData(saleDoc.id, saleDoc.data())
}

export async function getSaleById(companyId: string, saleId: string, userId: string): Promise<Sale> {
  const saleSnapshot = await getDoc(doc(firestore, 'companies', companyId, 'sales', saleId))
  if (!saleSnapshot.exists() || saleSnapshot.data().userId !== userId) throw new Error('SALE_NOT_FOUND')
  return mapSaleData(saleSnapshot.id, saleSnapshot.data())
}

function itemData(values: SaleFormValues['items'][number]): SaleItem {
  const amountCents = parseBrazilianDecimalToInteger(values.amount, 2)
  const unitPriceCents = parseBrazilianDecimalToInteger(values.unitPrice, 2)
  const commissionRateBps = parseBrazilianDecimalToInteger(values.commissionRate, 2)
  return {
    itemId: values.itemId || crypto.randomUUID(),
    amountCents,
    unitPriceCents,
    commissionRateBps,
    commissionCents: calculateCommissionCents(amountCents, commissionRateBps),
    quantity: Number(values.quantity.replace(',', '.')),
    ...(values.productId ? { productId: values.productId } : {}),
    ...(values.statusId ? { statusId: values.statusId } : {}),
    ...(values.deliveryOn ? { deliveryAt: Timestamp.fromDate(parseLocalDateStart(values.deliveryOn)) } : {}),
    ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
  }
}

function statusUsage(data: Record<string, unknown> | null) {
  const usage = new Map<string, number>()
  if (!data) return usage
  if (typeof data.statusId === 'string') usage.set(data.statusId, 1)
  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      if (!item || typeof item !== 'object') continue
      const statusId = (item as { statusId?: unknown }).statusId
      if (typeof statusId === 'string') usage.set(statusId, (usage.get(statusId) ?? 0) + 1)
    }
  }
  return usage
}

function itemStatusUsage(items: unknown[]) {
  return items.reduce<Record<string, number>>((usage, item) => {
    if (!item || typeof item !== 'object' || !('statusId' in item)) return usage
    const statusId = item.statusId
    if (typeof statusId === 'string' && statusId.length > 0) usage[statusId] = (usage[statusId] ?? 0) + 1
    return usage
  }, {})
}

async function updateStatusUsage(
  transaction: Transaction,
  companyId: string,
  saleId: string,
  previous: Record<string, unknown> | null,
  next: Record<string, unknown> | null,
) {
  const previousUsage = statusUsage(previous)
  const nextUsage = statusUsage(next)
  const statusIds = new Set([...previousUsage.keys(), ...nextUsage.keys()])
  const deltas = [...statusIds].map((statusId) => ({
    statusId,
    delta: (nextUsage.get(statusId) ?? 0) - (previousUsage.get(statusId) ?? 0),
  })).filter(({ delta }) => delta !== 0)
  if (deltas.length === 0) return

  const snapshots = await Promise.all(deltas.map(({ statusId }) => transaction.get(doc(firestore, 'companies', companyId, 'saleStatuses', statusId))))
  const currentCounts = deltas.map(({ delta }, index) => {
    const snapshot = snapshots[index]
    if (!snapshot.exists()) throw new Error('SALE_STATUS_UNAVAILABLE')
    const data = snapshot.data()
    if (!data) throw new Error('SALE_STATUS_UNAVAILABLE')
    const currentCount = Number(data.usageCount)
    if (!Number.isSafeInteger(currentCount) || currentCount < Math.abs(Math.min(delta, 0))) {
      throw new Error('SALE_STATUS_COUNT_INVALID')
    }
    if (delta > 0 && data.active !== true) throw new Error('SALE_STATUS_UNAVAILABLE')
    return currentCount
  })

  deltas.forEach(({ statusId, delta }, index) => {
    transaction.update(doc(firestore, 'companies', companyId, 'saleStatuses', statusId), {
      usageCount: currentCounts[index] + delta,
      lastUsageChangeSaleId: saleId,
      updatedAt: serverTimestamp(),
    })
  })
}

function saleData(userId: string, values: SaleFormValues) {
  const items = values.items.map(itemData)
  return {
    userId,
    soldAt: Timestamp.fromDate(dateWithLocalTime(values.soldOn, values.soldTime)),
    ...(values.statusId ? { statusId: values.statusId } : {}),
    items,
    itemStatusUsage: itemStatusUsage(items),
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
    await updateStatusUsage(transaction, companyId, saleRef.id, null, data)
    transaction.set(saleRef, { ...data, createdAt: serverTimestamp() })
  })
}

export async function moveSaleToStatus(companyId: string, saleId: string, userId: string, nextStatusId: string): Promise<void> {
  const saleRef = doc(firestore, 'companies', companyId, 'sales', saleId)

  await runTransaction(firestore, async (transaction) => {
    const saleSnapshot = await transaction.get(saleRef)
    if (!saleSnapshot.exists() || saleSnapshot.data().userId !== userId) throw new Error('SALE_NOT_FOUND')

    const oldData = saleSnapshot.data()
    if (oldData.statusId === nextStatusId && Array.isArray(oldData.items)) return
    let nextData: Record<string, unknown>
    if (Array.isArray(oldData.items)) {
      nextData = { ...oldData, statusId: nextStatusId }
    } else {
      if (!(oldData.soldAt instanceof Timestamp) || !(oldData.createdAt instanceof Timestamp)) {
        throw new Error('SALE_DATA_INVALID')
      }
      const item = mapItem({
        amountCents: oldData.amountCents,
        unitPriceCents: oldData.amountCents,
        commissionRateBps: oldData.commissionRateBps,
        commissionCents: oldData.commissionCents,
        quantity: 1,
        ...(typeof oldData.productId === 'string' ? { productId: oldData.productId } : {}),
        ...(typeof oldData.notes === 'string' ? { notes: oldData.notes } : {}),
      }, `${saleId}-legacy-item`)
      nextData = {
        userId: oldData.userId,
        soldAt: oldData.soldAt,
        createdAt: oldData.createdAt,
        statusId: nextStatusId,
        items: [item],
        itemStatusUsage: {},
      }
    }
    await updateStatusUsage(transaction, companyId, saleId, oldData, nextData)
    transaction.set(saleRef, nextData)
  })
}

export async function moveSaleItemToStatus(
  companyId: string,
  saleId: string,
  userId: string,
  itemId: string,
  nextStatusId: string,
  nextSaleStatusId?: string,
): Promise<void> {
  const saleRef = doc(firestore, 'companies', companyId, 'sales', saleId)

  await runTransaction(firestore, async (transaction) => {
    const saleSnapshot = await transaction.get(saleRef)
    if (!saleSnapshot.exists() || saleSnapshot.data().userId !== userId) throw new Error('SALE_NOT_FOUND')

    const oldData = saleSnapshot.data()
    let foundItem = false
    let previousStatusId: string | undefined
    let baseData: Record<string, unknown> = oldData
    let items: unknown[]
    if (Array.isArray(oldData.items)) {
      items = oldData.items.map((item: unknown, index: number) => {
        if (!item || typeof item !== 'object') return item
        const itemData = item as Record<string, unknown>
        const storedItemId = typeof itemData.itemId === 'string' ? itemData.itemId : `${saleId}-${index + 1}`
        if (storedItemId !== itemId) return item

        foundItem = true
        previousStatusId = typeof itemData.statusId === 'string' ? itemData.statusId : undefined
        return { ...itemData, itemId: storedItemId, statusId: nextStatusId }
      })
    } else {
      if (!(oldData.soldAt instanceof Timestamp) || !(oldData.createdAt instanceof Timestamp)) {
        throw new Error('SALE_DATA_INVALID')
      }
      const legacyItem = mapItem({
        amountCents: oldData.amountCents,
        unitPriceCents: oldData.amountCents,
        commissionRateBps: oldData.commissionRateBps,
        commissionCents: oldData.commissionCents,
        quantity: 1,
        ...(typeof oldData.productId === 'string' ? { productId: oldData.productId } : {}),
        ...(typeof oldData.notes === 'string' ? { notes: oldData.notes } : {}),
      }, `${saleId}-legacy-item`)
      if (legacyItem.itemId !== itemId) throw new Error('SALE_ITEM_NOT_FOUND')
      foundItem = true
      items = [{ ...legacyItem, statusId: nextStatusId }]
      baseData = {
        userId: oldData.userId,
        soldAt: oldData.soldAt,
        createdAt: oldData.createdAt,
      }
    }
    if (!foundItem) throw new Error('SALE_ITEM_NOT_FOUND')
    const previousSaleStatusId = typeof baseData.statusId === 'string' ? baseData.statusId : undefined
    if (previousStatusId === nextStatusId && (!nextSaleStatusId || previousSaleStatusId === nextSaleStatusId)) return

    const nextData = {
      ...baseData,
      ...(nextSaleStatusId ? { statusId: nextSaleStatusId } : {}),
      items,
      itemStatusUsage: itemStatusUsage(items),
    }
    await updateStatusUsage(transaction, companyId, saleId, oldData, nextData)
    transaction.set(saleRef, nextData)
  })
}

export async function updateSale(companyId: string, saleId: string, userId: string, values: SaleFormValues): Promise<Sale> {
  const saleRef = doc(firestore, 'companies', companyId, 'sales', saleId)
  const data = saleData(userId, values)
  return runTransaction(firestore, async (transaction) => {
    const saleSnapshot = await transaction.get(saleRef)
    if (!saleSnapshot.exists() || saleSnapshot.data().userId !== userId) throw new Error('SALE_NOT_FOUND')
    const oldData = saleSnapshot.data()
    const updatedData = { ...data, createdAt: oldData.createdAt }
    await updateStatusUsage(transaction, companyId, saleId, oldData, updatedData)
    transaction.set(saleRef, updatedData)
    return mapSaleData(saleId, updatedData)
  })
}

export async function deleteSale(companyId: string, saleId: string, userId: string): Promise<void> {
  const saleRef = doc(firestore, 'companies', companyId, 'sales', saleId)
  await runTransaction(firestore, async (transaction) => {
    const saleSnapshot = await transaction.get(saleRef)
    if (!saleSnapshot.exists() || saleSnapshot.data().userId !== userId) throw new Error('SALE_NOT_FOUND')
    const data = saleSnapshot.data()
    if (!Array.isArray(data.items)) throw new Error('LEGACY_SALE_REQUIRES_MIGRATION')
    await updateStatusUsage(transaction, companyId, saleId, data, null)
    transaction.delete(saleRef)
  })
}

export async function getSalesPage(companyId: string, userId: string, filters: SaleFilters, cursor?: QueryDocumentSnapshot | null): Promise<SalePage> {
  if (filters.orderStatusId || filters.itemStatusId) {
    const sales: Sale[] = []
    let scanCursor = cursor ?? null
    while (true) {
      const constraints: QueryConstraint[] = [orderBy('soldAt', 'desc')]
      if (scanCursor) constraints.push(startAfter(scanCursor))
      constraints.push(limit(PAGE_SIZE + 1))
      const snapshot = await getDocs(query(filteredSalesQuery(companyId, userId, filters), ...constraints))
      if (snapshot.empty) return { sales, cursor: scanCursor, hasMore: false }

      let lastScanned = scanCursor
      for (const saleDoc of snapshot.docs) {
        const sale = mapSaleDocument(saleDoc)
        if (matchesStatusFilters(sale, filters)) {
          if (sales.length === PAGE_SIZE) return { sales, cursor: lastScanned, hasMore: true }
          sales.push(sale)
        }
        lastScanned = saleDoc
      }

      scanCursor = lastScanned
      if (snapshot.docs.length <= PAGE_SIZE) return { sales, cursor: scanCursor, hasMore: false }
    }
  }

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

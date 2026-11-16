import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { firestore } from '../firebase/firestore'
import { defaultSaleStatuses, type SaleStatus } from '../types/saleStatus'

function statusesCollection(companyId: string) {
  return collection(firestore, 'companies', companyId, 'saleStatuses')
}

function mapSaleStatus(snapshot: QueryDocumentSnapshot): SaleStatus {
  const data = snapshot.data()
  if (typeof data.name !== 'string'
    || !Number.isSafeInteger(data.sortOrder)
    || typeof data.active !== 'boolean'
    || typeof data.isFinalizedIndicator !== 'boolean'
    || !Number.isSafeInteger(data.usageCount)
    || !(data.createdAt instanceof Timestamp)
    || !(data.updatedAt instanceof Timestamp)
    || typeof data.createdBy !== 'string'
    || typeof data.updatedBy !== 'string') {
    throw new Error(`O status ${snapshot.id} contém dados inválidos.`)
  }
  return {
    statusId: snapshot.id,
    name: data.name,
    sortOrder: data.sortOrder,
    active: data.active,
    isFinalizedIndicator: data.isFinalizedIndicator,
    usageCount: data.usageCount,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,
  }
}

export async function getCompanySaleStatuses(companyId: string): Promise<SaleStatus[]> {
  const snapshot = await getDocs(query(statusesCollection(companyId), orderBy('sortOrder')))
  return snapshot.docs.map(mapSaleStatus)
}

export async function ensureDefaultSaleStatuses(companyId: string, userId: string): Promise<void> {
  const refs = defaultSaleStatuses.map(({ statusId }) => doc(firestore, 'companies', companyId, 'saleStatuses', statusId))
  const initializationRef = doc(firestore, 'companies', companyId, 'saleStatusSettings', 'defaults')
  await runTransaction(firestore, async (transaction) => {
    const snapshots = await Promise.all([transaction.get(initializationRef), ...refs.map((ref) => transaction.get(ref))])
    const hasAllDefaults = snapshots.slice(1).every((snapshot) => snapshot.exists())
    if (snapshots[0].exists() && hasAllDefaults) return
    const now = serverTimestamp()
    snapshots.slice(1).forEach((snapshot, index) => {
      if (snapshot.exists()) return
      const status = defaultSaleStatuses[index]
      transaction.set(refs[index], {
        name: status.name,
        sortOrder: status.sortOrder,
        active: true,
        isFinalizedIndicator: status.isFinalizedIndicator,
        usageCount: 0,
        lastUsageChangeSaleId: null,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      })
    })
    if (!snapshots[0].exists()) transaction.set(initializationRef, { defaultsInitialized: true, createdAt: now, createdBy: userId })
  })
}

export async function createSaleStatus(companyId: string, userId: string, name: string, isFinalizedIndicator = false): Promise<SaleStatus> {
  await ensureDefaultSaleStatuses(companyId, userId)
  const current = await getCompanySaleStatuses(companyId)
  const statusRef = doc(statusesCollection(companyId))
  const timestamp = Timestamp.now()
  const nextOrder = current.reduce((largest, status) => Math.max(largest, status.sortOrder), -1) + 1
  await setDoc(statusRef, {
    name: name.trim(),
    sortOrder: nextOrder,
    active: true,
    isFinalizedIndicator,
    usageCount: 0,
    lastUsageChangeSaleId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
    updatedBy: userId,
  })
  return {
    statusId: statusRef.id,
    name: name.trim(),
    sortOrder: nextOrder,
    active: true,
    isFinalizedIndicator,
    usageCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: userId,
    updatedBy: userId,
  }
}

export function resolveFinalizedSaleStatus(statuses: SaleStatus[]): SaleStatus | null {
  const ordered = [...statuses].sort((left, right) => left.sortOrder - right.sortOrder)
  const marked = ordered.filter((status) => status.isFinalizedIndicator)
  return (marked.length > 0 ? marked : ordered).at(-1) ?? null
}

export async function updateSaleStatus(
  companyId: string,
  userId: string,
  statusId: string,
  update: Partial<Pick<SaleStatus, 'name' | 'active' | 'isFinalizedIndicator'>>,
): Promise<void> {
  await updateDoc(doc(firestore, 'companies', companyId, 'saleStatuses', statusId), {
    ...update,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
}

export async function reorderSaleStatuses(companyId: string, userId: string, orderedIds: string[]): Promise<void> {
  const batch = writeBatch(firestore)
  orderedIds.forEach((statusId, sortOrder) => {
    batch.update(doc(firestore, 'companies', companyId, 'saleStatuses', statusId), {
      sortOrder,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
  })
  await batch.commit()
}

export async function deleteSaleStatus(companyId: string, statusId: string): Promise<void> {
  const statusRef = doc(firestore, 'companies', companyId, 'saleStatuses', statusId)
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(statusRef)
    if (!snapshot.exists()) return
    const status = mapSaleStatus(snapshot as QueryDocumentSnapshot)
    if (status.usageCount > 0) throw new Error('SALE_STATUS_IN_USE')
    transaction.delete(statusRef)
  })
}


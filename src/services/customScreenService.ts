import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
  type DocumentSnapshot,
} from 'firebase/firestore'
import { firestore } from '../firebase/firestore'
import { customScreenSchema } from '../schemas/customScreenSchema'
import { dashboardIndicatorIds, type DashboardIndicatorId } from '../types/dashboard'
import type { CustomScreen, CustomScreenFormValues } from '../types/customScreen'

function sortScreens(screens: CustomScreen[]) {
  return screens.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'pt-BR'))
}

function mapScreen(screenDocument: QueryDocumentSnapshot | DocumentSnapshot): CustomScreen {
  const data = screenDocument.data()
  if (!data) throw new Error(`A tela ${screenDocument.id} não contém dados.`)
  const isIndicatorId = (value: unknown): value is DashboardIndicatorId =>
    typeof value === 'string' && dashboardIndicatorIds.includes(value as DashboardIndicatorId)
  if (typeof data.name !== 'string'
    || typeof data.enabled !== 'boolean'
    || !Array.isArray(data.visibleIndicators)
    || data.visibleIndicators.length === 0
    || !data.visibleIndicators.every(isIndicatorId)
    || new Set(data.visibleIndicators).size !== data.visibleIndicators.length
    || !Array.isArray(data.indicatorOrder)
    || data.indicatorOrder.length !== dashboardIndicatorIds.length
    || !data.indicatorOrder.every(isIndicatorId)
    || new Set(data.indicatorOrder).size !== dashboardIndicatorIds.length
    || !Number.isSafeInteger(data.sortOrder)
    || typeof data.createdByUid !== 'string'
    || typeof data.updatedByUid !== 'string'
    || !data.createdAt?.toDate
    || !data.updatedAt?.toDate) {
    throw new Error(`A tela ${screenDocument.id} contém dados inválidos.`)
  }
  return {
    screenId: screenDocument.id,
    name: data.name,
    enabled: data.enabled,
    visibleIndicators: data.visibleIndicators,
    indicatorOrder: data.indicatorOrder,
    sortOrder: data.sortOrder,
    createdByUid: data.createdByUid,
    updatedByUid: data.updatedByUid,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

function parseValues(values: CustomScreenFormValues) {
  const result = customScreenSchema.safeParse(values)
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Os dados da tela são inválidos.')
  return { ...result.data, name: result.data.name.trim() }
}

function screenCollection(companyId: string) {
  return collection(firestore, 'companies', companyId, 'customScreens')
}

export async function getCompanyScreens(companyId: string, includeInactive = false): Promise<CustomScreen[]> {
  const screensQuery = includeInactive
    ? query(screenCollection(companyId))
    : query(screenCollection(companyId), where('enabled', '==', true))
  const snapshot = await getDocs(screensQuery)
  return sortScreens(snapshot.docs.map(mapScreen))
}

export function subscribeActiveCompanyScreens(
  companyId: string,
  onScreens: (screens: CustomScreen[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(query(screenCollection(companyId), where('enabled', '==', true)), (snapshot) => {
    onScreens(sortScreens(snapshot.docs.map(mapScreen)))
  }, (error) => onError(error))
}

export async function getCompanyScreen(companyId: string, screenId: string): Promise<CustomScreen | null> {
  const snapshot = await getDoc(doc(firestore, 'companies', companyId, 'customScreens', screenId))
  return snapshot.exists() ? mapScreen(snapshot) : null
}

export async function createCompanyScreen(companyId: string, userId: string, values: CustomScreenFormValues): Promise<string> {
  const screens = await getCompanyScreens(companyId, true)
  const screenRef = doc(screenCollection(companyId))
  const parsed = parseValues(values)
  await setDoc(screenRef, {
    ...parsed,
    enabled: true,
    sortOrder: screens.length,
    createdByUid: userId,
    updatedByUid: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return screenRef.id
}

export async function updateCompanyScreen(companyId: string, screenId: string, userId: string, values: CustomScreenFormValues): Promise<void> {
  const parsed = parseValues(values)
  await updateDoc(doc(firestore, 'companies', companyId, 'customScreens', screenId), {
    ...parsed,
    updatedByUid: userId,
    updatedAt: serverTimestamp(),
  })
}

export async function setCompanyScreenEnabled(companyId: string, screenId: string, userId: string, enabled: boolean): Promise<void> {
  await updateDoc(doc(firestore, 'companies', companyId, 'customScreens', screenId), {
    enabled,
    updatedByUid: userId,
    updatedAt: serverTimestamp(),
  })
}

export async function reorderCompanyScreens(companyId: string, userId: string, screenIds: string[]): Promise<void> {
  const screens = await getCompanyScreens(companyId, true)
  if (screenIds.length !== screens.length || new Set(screenIds).size !== screenIds.length
    || screens.some((screen) => !screenIds.includes(screen.screenId))) {
    throw new Error('A ordem das telas está desatualizada. Atualize a lista e tente novamente.')
  }
  const batch = writeBatch(firestore)
  screenIds.forEach((screenId, sortOrder) => {
    batch.update(doc(firestore, 'companies', companyId, 'customScreens', screenId), {
      sortOrder,
      updatedByUid: userId,
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

export async function deleteCompanyScreen(companyId: string, screenId: string): Promise<void> {
  await deleteDoc(doc(firestore, 'companies', companyId, 'customScreens', screenId))
}

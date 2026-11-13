import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { firestore } from '../firebase/firestore'
import { dashboardIndicatorIds, type DashboardIndicatorId, type DashboardPreferences } from '../types/dashboard'

export function createDefaultDashboardPreferences(): DashboardPreferences {
  return { visibleIndicators: [...dashboardIndicatorIds], indicatorOrder: [...dashboardIndicatorIds] }
}

function normalizeDashboardPreferences(value: unknown): DashboardPreferences {
  const defaults = createDefaultDashboardPreferences()
  if (!value || typeof value !== 'object') return defaults
  const data = value as Record<string, unknown>
  function normalizeIds(ids: unknown[]) {
    return ids.flatMap((id) => {
      if (id === 'commission-rate-breakdown') {
        return ['commission-rate-chart', 'commission-rate-details', 'commission-rate-commission'] as const
      }
      return dashboardIndicatorIds.includes(id as DashboardIndicatorId) ? [id as DashboardIndicatorId] : []
    })
  }
  const visible = Array.isArray(data.visibleIndicators)
    ? normalizeIds(data.visibleIndicators)
    : defaults.visibleIndicators
  const savedOrder = Array.isArray(data.indicatorOrder)
    ? normalizeIds(data.indicatorOrder)
    : []
  const uniqueVisible = [...new Set(visible)]
  const uniqueOrder = [...new Set(savedOrder)]
  const order = [...uniqueOrder, ...defaults.indicatorOrder.filter((id) => !uniqueOrder.includes(id))]
  return { visibleIndicators: uniqueVisible.length > 0 ? uniqueVisible : defaults.visibleIndicators, indicatorOrder: order }
}

export async function getDashboardPreferences(companyId: string, userId: string): Promise<DashboardPreferences> {
  const preferenceRef = doc(firestore, 'companies', companyId, 'dashboardPreferences', userId)
  const snapshot = await getDoc(preferenceRef)
  return snapshot.exists() ? normalizeDashboardPreferences(snapshot.data()) : createDefaultDashboardPreferences()
}

export async function saveDashboardPreferences(
  companyId: string,
  userId: string,
  preferences: DashboardPreferences,
): Promise<void> {
  await setDoc(doc(firestore, 'companies', companyId, 'dashboardPreferences', userId), {
    visibleIndicators: preferences.visibleIndicators,
    indicatorOrder: preferences.indicatorOrder,
    updatedAt: serverTimestamp(),
  })
}

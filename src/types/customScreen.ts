import type { Timestamp } from 'firebase/firestore'
import type { DashboardIndicatorId } from './dashboard'

export interface CustomScreen {
  screenId: string
  name: string
  enabled: boolean
  visibleIndicators: DashboardIndicatorId[]
  indicatorOrder: DashboardIndicatorId[]
  sortOrder: number
  createdByUid: string
  updatedByUid: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface CustomScreenFormValues {
  name: string
  visibleIndicators: DashboardIndicatorId[]
  indicatorOrder: DashboardIndicatorId[]
}

import type { Timestamp } from 'firebase/firestore'

export interface Goal {
  goalId: string
  userId: string
  startDate: Timestamp
  endDate: Timestamp
  targetCents: number
  businessDays: number
  description?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface GoalFormValues {
  startDate: string
  endDate: string
  target: string
  businessDays: string
  description: string
}

export interface GoalMetrics {
  realizedCents: number
  achievedPercent: number
  remainingCents: number
  remainingPercent: number
  targetPerBusinessDayCents: number
  requiredPerRemainingDayCents: number
  averagePerElapsedDayCents: number
  elapsedBusinessDays: number
  remainingBusinessDays: number
  isExpired: boolean
}

export type DashboardInterval = 'day' | 'week' | 'month' | 'year'

export interface DashboardPeriodSummary {
  salesCents: number
  commissionCents: number
  count: number
}

export interface DashboardPeriodComparison {
  salesPercent: number | null
  commissionPercent: number | null
}

export interface DashboardKeyMetrics {
  averageCommissionRate: number
  averageCommissionCents: number
  averageSaleCents: number
  salesCount: number
}

export interface DashboardChartPoint {
  key: string
  label: string
  salesCents: number
  commissionCents: number
}

export interface DashboardOverview {
  today: DashboardPeriodSummary
  week: DashboardPeriodSummary
  month: DashboardPeriodSummary
  dayComparison: DashboardPeriodComparison
  weekComparison: DashboardPeriodComparison
  monthComparison: DashboardPeriodComparison
  keyMetrics: DashboardKeyMetrics
  chart: DashboardChartPoint[]
}

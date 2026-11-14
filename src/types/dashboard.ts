export type DashboardInterval = 'day' | 'week' | 'month' | 'year' | 'custom'
export type DashboardPeriod = DashboardInterval

export const dashboardIndicatorIds = [
  'period-summary',
  'average-commission',
  'average-commission-rate',
  'average-sale',
  'commission-rate-chart',
  'commission-rate-details',
  'commission-rate-commission',
  'product-sales-values',
  'product-commissions',
  'product-sales-chart',
  'product-commission-chart',
  'goals-progress',
  'sales-evolution',
] as const

export type DashboardIndicatorId = typeof dashboardIndicatorIds[number]

export interface DashboardPreferences {
  visibleIndicators: DashboardIndicatorId[]
  indicatorOrder: DashboardIndicatorId[]
}

export interface DashboardPeriodSummary {
  salesCents: number
  commissionCents: number
  count: number
}

export interface DashboardPeriodBounds {
  currentStart: Date
  currentEnd: Date
  previousStart: Date
  previousEnd: Date
  queryStart: Date
  queryEnd: Date
}

export interface DashboardCustomRange {
  start: Date
  end: Date
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

export interface CommissionRateSummary {
  commissionRateBps: number
  salesCount: number
  salesCents: number
  commissionCents: number
}

export interface ProductSalesSummary {
  productId: string | null
  productName: string
  salesCount: number
  salesCents: number
  commissionCents: number
}

export interface DashboardOverview {
  currentPeriod: DashboardPeriodSummary
  periodComparison: DashboardPeriodComparison
  keyMetrics: DashboardKeyMetrics
  chart: DashboardChartPoint[]
}

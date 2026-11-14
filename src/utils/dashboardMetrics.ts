import type { CommissionRateSummary, DashboardChartPoint, DashboardCustomRange, DashboardInterval, DashboardOverview, DashboardPeriodBounds, DashboardPeriodSummary } from '../types/dashboard'
import type { Sale } from '../types/sale'

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeek(date: Date) {
  const start = startOfDay(date)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1)
}

export function getDashboardPeriodBounds(period: DashboardInterval, now = new Date(), customRange?: DashboardCustomRange): DashboardPeriodBounds {
  let currentStart: Date
  let previousStart: Date

  if (period === 'custom' && customRange) {
    currentStart = startOfDay(customRange.start)
    const inclusiveEnd = startOfDay(customRange.end)
    inclusiveEnd.setDate(inclusiveEnd.getDate() + 1)
    const duration = inclusiveEnd.getTime() - currentStart.getTime()
    const previousEnd = new Date(currentStart)
    const previousStart = new Date(currentStart.getTime() - duration)
    return { currentStart, currentEnd: inclusiveEnd, previousStart, previousEnd, queryStart: previousStart, queryEnd: inclusiveEnd }
  } else if (period === 'day') {
    currentStart = startOfDay(now)
    previousStart = new Date(currentStart)
    previousStart.setDate(previousStart.getDate() - 1)
  } else if (period === 'week') {
    currentStart = startOfWeek(now)
    previousStart = new Date(currentStart)
    previousStart.setDate(previousStart.getDate() - 7)
  } else if (period === 'month') {
    currentStart = startOfMonth(now)
    previousStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1)
  } else {
    currentStart = startOfYear(now)
    previousStart = new Date(currentStart.getFullYear() - 1, 0, 1)
  }

  const elapsed = now.getTime() - currentStart.getTime()
  const previousEnd = new Date(Math.min(previousStart.getTime() + elapsed, currentStart.getTime()))
  return { currentStart, currentEnd: now, previousStart, previousEnd, queryStart: previousStart, queryEnd: now }
}

function summarize(sales: Sale[], start: Date, end: Date): DashboardPeriodSummary {
  const filtered = sales.filter((sale) => {
    const soldAt = sale.soldAt.toDate()
    return soldAt >= start && soldAt < end
  })
  return filtered.reduce<DashboardPeriodSummary>((summary, sale) => ({
    salesCents: summary.salesCents + sale.amountCents,
    commissionCents: summary.commissionCents + sale.commissionCents,
    count: summary.count + 1,
  }), { salesCents: 0, commissionCents: 0, count: 0 })
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function makeChart(sales: Sale[], interval: DashboardInterval, now: Date, customRange?: DashboardCustomRange): DashboardChartPoint[] {
  const buckets: DashboardChartPoint[] = []
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short' })

  if (interval === 'custom' && customRange) {
    const start = startOfDay(customRange.start)
    const end = startOfDay(customRange.end)
    const dayCount = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
    if (dayCount <= 62) {
      for (let offset = 0; offset < dayCount; offset += 1) {
        const day = new Date(start)
        day.setDate(day.getDate() + offset)
        buckets.push({ key: dateKey(day), label: day.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), salesCents: 0, commissionCents: 0 })
      }
    } else {
      const month = new Date(start.getFullYear(), start.getMonth(), 1)
      const last = new Date(end.getFullYear(), end.getMonth(), 1)
      while (month <= last) {
        buckets.push({ key: `${month.getFullYear()}-${month.getMonth()}`, label: monthLabel.format(month).replace('.', ''), salesCents: 0, commissionCents: 0 })
        month.setMonth(month.getMonth() + 1)
      }
    }
  } else if (interval === 'day') {
    for (let hour = 0; hour < 24; hour += 1) {
      buckets.push({ key: String(hour), label: `${String(hour).padStart(2, '0')}h`, salesCents: 0, commissionCents: 0 })
    }
  } else if (interval === 'week') {
    const firstDay = startOfWeek(now)
    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(firstDay)
      day.setDate(firstDay.getDate() + offset)
      buckets.push({
        key: dateKey(day),
        label: day.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        salesCents: 0,
        commissionCents: 0,
      })
    }
  } else if (interval === 'month') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const firstDay = startOfMonth(now)
    for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth += 1) {
      const day = new Date(firstDay.getFullYear(), firstDay.getMonth(), dayOfMonth)
      buckets.push({ key: dateKey(day), label: String(dayOfMonth).padStart(2, '0'), salesCents: 0, commissionCents: 0 })
    }
  } else {
    for (let month = 0; month < 12; month += 1) {
      const date = new Date(now.getFullYear(), month, 1)
      buckets.push({ key: String(month), label: monthLabel.format(date).replace('.', ''), salesCents: 0, commissionCents: 0 })
    }
  }

  const bucketMap = new Map(buckets.map((bucket, index) => [bucket.key, index]))
  for (const sale of sales) {
    const date = sale.soldAt.toDate()
    let key: string
    if (interval === 'custom' && customRange) {
      const start = startOfDay(customRange.start)
      const end = startOfDay(customRange.end)
      const dayCount = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
      key = dayCount <= 62 ? dateKey(date) : `${date.getFullYear()}-${date.getMonth()}`
    } else if (interval === 'day') {
      if (dateKey(date) !== dateKey(now)) continue
      key = String(date.getHours())
    } else if (interval === 'week') {
      key = dateKey(date)
    } else if (interval === 'month') {
      if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()) continue
      key = dateKey(date)
    } else {
      if (date.getFullYear() !== now.getFullYear()) continue
      key = String(date.getMonth())
    }
    const bucket = buckets[bucketMap.get(key) ?? -1]
    if (!bucket) continue
    bucket.salesCents += sale.amountCents
    bucket.commissionCents += sale.commissionCents
  }
  return buckets
}

export function buildDashboardOverview(sales: Sale[], period: DashboardInterval, now = new Date(), customRange?: DashboardCustomRange): DashboardOverview {
  const bounds = getDashboardPeriodBounds(period, now, customRange)
  const currentSummary = summarize(sales, bounds.currentStart, bounds.currentEnd)
  const previousSummary = summarize(sales, bounds.previousStart, bounds.previousEnd)

  function percentChange(current: number, previous: number) {
    if (previous === 0) return current === 0 ? 0 : null
    return ((current - previous) / previous) * 100
  }

  function compare(current: DashboardPeriodSummary, previous: DashboardPeriodSummary) {
    return {
      salesPercent: percentChange(current.salesCents, previous.salesCents),
      commissionPercent: percentChange(current.commissionCents, previous.commissionCents),
    }
  }

  return {
    currentPeriod: currentSummary,
    periodComparison: compare(currentSummary, previousSummary),
    keyMetrics: {
      averageCommissionRate: currentSummary.salesCents > 0
        ? (currentSummary.commissionCents / currentSummary.salesCents) * 100
        : 0,
      averageCommissionCents: currentSummary.count > 0
        ? Math.round(currentSummary.commissionCents / currentSummary.count)
        : 0,
      averageSaleCents: currentSummary.count > 0
        ? Math.round(currentSummary.salesCents / currentSummary.count)
        : 0,
      salesCount: currentSummary.count,
    },
    chart: makeChart(sales, period, now, customRange),
  }
}

export function buildDashboardChart(sales: Sale[], interval: DashboardInterval, now = new Date()) {
  return makeChart(sales, interval, now)
}

export function buildCommissionRateSummary(sales: Sale[], now = new Date()): CommissionRateSummary[] {
  const bounds = getDashboardPeriodBounds('month', now)
  return buildCommissionRateSummaryForRange(sales, bounds.currentStart, bounds.currentEnd)
}

export function buildCommissionRateSummaryForRange(sales: Sale[], start: Date, end: Date): CommissionRateSummary[] {
  const summaries = new Map<number, CommissionRateSummary>()

  for (const sale of sales) {
    const soldAt = sale.soldAt.toDate()
    if (soldAt < start || soldAt >= end) continue
    const summary = summaries.get(sale.commissionRateBps) ?? {
      commissionRateBps: sale.commissionRateBps,
      salesCount: 0,
      salesCents: 0,
      commissionCents: 0,
    }
    summary.salesCount += 1
    summary.salesCents += sale.amountCents
    summary.commissionCents += sale.commissionCents
    summaries.set(sale.commissionRateBps, summary)
  }

  return [...summaries.values()].sort((left, right) => left.commissionRateBps - right.commissionRateBps)
}

export function buildCommissionRateChart(summaries: CommissionRateSummary[]) {
  const defaultRates = Array.from({ length: 19 }, (_, index) => 100 + index * 50)
  const observedRates = summaries.map((summary) => summary.commissionRateBps)
  const rates = [...new Set([...defaultRates, ...observedRates])].sort((left, right) => left - right)
  const counts = new Map(summaries.map((summary) => [summary.commissionRateBps, summary.salesCount]))

  return rates.map((rate) => ({
    rateBps: rate,
    label: `${(rate / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`,
    salesCount: counts.get(rate) ?? 0,
  }))
}

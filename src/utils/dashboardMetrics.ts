import type { DashboardChartPoint, DashboardInterval, DashboardOverview, DashboardPeriodSummary } from '../types/dashboard'
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

function makeChart(sales: Sale[], interval: DashboardInterval, now: Date): DashboardChartPoint[] {
  const buckets: DashboardChartPoint[] = []
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'short' })

  if (interval === 'day') {
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
    if (interval === 'day') {
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

export function buildDashboardOverview(sales: Sale[], now = new Date()): DashboardOverview {
  const currentDay = startOfDay(now)
  const nextDay = new Date(currentDay)
  nextDay.setDate(nextDay.getDate() + 1)
  const currentWeek = startOfWeek(now)
  const nextWeek = new Date(currentWeek)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const currentMonth = startOfMonth(now)
  const previousDay = new Date(currentDay)
  previousDay.setDate(previousDay.getDate() - 1)
  const previousWeek = new Date(currentWeek)
  previousWeek.setDate(previousWeek.getDate() - 7)
  const previousMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
  const elapsedDay = now.getTime() - currentDay.getTime()
  const elapsedWeek = now.getTime() - currentWeek.getTime()
  const elapsedMonth = now.getTime() - currentMonth.getTime()
  const previousDaySummary = summarize(sales, previousDay, new Date(previousDay.getTime() + elapsedDay))
  const previousWeekSummary = summarize(sales, previousWeek, new Date(previousWeek.getTime() + elapsedWeek))
  const previousMonthEnd = new Date(Math.min(previousMonth.getTime() + elapsedMonth, currentMonth.getTime()))
  const previousMonthSummary = summarize(sales, previousMonth, previousMonthEnd)
  const currentMonthSummary = summarize(sales, currentMonth, now)

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
    today: summarize(sales, currentDay, now),
    week: summarize(sales, currentWeek, now),
    month: currentMonthSummary,
    dayComparison: compare(summarize(sales, currentDay, now), previousDaySummary),
    weekComparison: compare(summarize(sales, currentWeek, now), previousWeekSummary),
    monthComparison: compare(currentMonthSummary, previousMonthSummary),
    keyMetrics: {
      averageCommissionRate: currentMonthSummary.salesCents > 0
        ? (currentMonthSummary.commissionCents / currentMonthSummary.salesCents) * 100
        : 0,
      averageCommissionCents: currentMonthSummary.count > 0
        ? Math.round(currentMonthSummary.commissionCents / currentMonthSummary.count)
        : 0,
      averageSaleCents: currentMonthSummary.count > 0
        ? Math.round(currentMonthSummary.salesCents / currentMonthSummary.count)
        : 0,
      salesCount: currentMonthSummary.count,
    },
    chart: makeChart(sales, 'week', now),
  }
}

export function buildDashboardChart(sales: Sale[], interval: DashboardInterval, now = new Date()) {
  return makeChart(sales, interval, now)
}

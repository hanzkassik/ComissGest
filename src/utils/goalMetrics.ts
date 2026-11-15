import type { Goal, GoalMetrics } from '../types/goal'
import type { Sale } from '../types/sale'

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function countBusinessDays(start: Date, end: Date) {
  const current = startOfDay(start)
  const last = startOfDay(end)
  if (current > last) return 0
  let count = 0
  while (current <= last) {
    if (current.getDay() !== 0) count += 1
    current.setDate(current.getDate() + 1)
  }
  return count
}

export function calculateGoalMetrics(goal: Goal, sales: Sale[], now = new Date(), periodRange?: { start: Date; end: Date }): GoalMetrics {
  const goalStart = startOfDay(goal.startDate.toDate())
  const goalEnd = startOfDay(goal.endDate.toDate())
  const goalEndExclusive = new Date(goalEnd)
  goalEndExclusive.setDate(goalEndExclusive.getDate() + 1)
  const start = periodRange
    ? new Date(Math.max(goalStart.getTime(), startOfDay(periodRange.start).getTime()))
    : goalStart
  const rangeEnd = periodRange ? periodRange.end : goalEndExclusive
  const endExclusive = new Date(Math.min(goalEndExclusive.getTime(), rangeEnd.getTime()))
  const end = new Date(endExclusive.getTime() - 1)
  if (start >= endExclusive) {
    return {
      realizedCents: 0,
      achievedPercent: 0,
      remainingCents: goal.targetCents,
      remainingPercent: goal.targetCents > 0 ? 100 : 0,
      targetPerBusinessDayCents: Math.round(goal.targetCents / goal.businessDays),
      requiredPerRemainingDayCents: 0,
      averagePerElapsedDayCents: 0,
      elapsedBusinessDays: 0,
      remainingBusinessDays: 0,
      isExpired: startOfDay(now) > goalEnd,
    }
  }
  const today = startOfDay(now)
  const realizedCents = sales.reduce((total, sale) => {
    const soldAt = sale.soldAt.toDate()
    return soldAt >= start && soldAt < endExclusive ? total + sale.amountCents : total
  }, 0)
  const elapsedEnd = today < end ? today : end
  const elapsedBusinessDays = today < start ? 0 : countBusinessDays(start, elapsedEnd)
  const isExpired = today > goalEnd
  const periodBusinessDays = start.getTime() === goalStart.getTime()
    ? goal.businessDays
    : countBusinessDays(start, end)
  const remainingBusinessDays = isExpired ? 0 : Math.max(0, periodBusinessDays - elapsedBusinessDays)
  const remainingCents = Math.max(0, goal.targetCents - realizedCents)

  return {
    realizedCents,
    achievedPercent: goal.targetCents > 0 ? (realizedCents / goal.targetCents) * 100 : 0,
    remainingCents,
    remainingPercent: Math.max(0, 100 - (goal.targetCents > 0 ? (realizedCents / goal.targetCents) * 100 : 0)),
    targetPerBusinessDayCents: Math.round(goal.targetCents / goal.businessDays),
    requiredPerRemainingDayCents: remainingBusinessDays > 0 ? Math.ceil(remainingCents / remainingBusinessDays) : 0,
    averagePerElapsedDayCents: elapsedBusinessDays > 0 ? Math.round(realizedCents / elapsedBusinessDays) : 0,
    elapsedBusinessDays,
    remainingBusinessDays,
    isExpired,
  }
}

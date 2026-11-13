import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, Building2, CalendarDays, CircleAlert, Clock3, Layers3, Minus, Percent, Plus, RefreshCw, Settings2, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AccountMenu } from '../../components/AccountMenu'
import { BrandMark } from '../../components/BrandMark'
import { DashboardSettingsModal } from '../../components/DashboardSettingsModal'
import { SalesHistory } from '../../components/SalesHistory'
import { useAuth } from '../../hooks/useAuth'
import { useCompany } from '../../hooks/useCompany'
import { getDashboardSales } from '../../services/dashboardService'
import { createDefaultDashboardPreferences, getDashboardPreferences, saveDashboardPreferences } from '../../services/dashboardPreferencesService'
import type { DashboardIndicatorId, DashboardInterval, DashboardOverview, DashboardPreferences } from '../../types/dashboard'
import type { Sale } from '../../types/sale'
import { buildCommissionRateChart, buildCommissionRateSummaryForRange, buildDashboardOverview, getDashboardPeriodBounds } from '../../utils/dashboardMetrics'
import { formatBRLFromCents } from '../../utils/currency'

const periods: { value: DashboardInterval; label: string }[] = [
  { value: 'day', label: 'Dia atual' },
  { value: 'week', label: 'Semana atual' },
  { value: 'month', label: 'Mês atual' },
  { value: 'year', label: 'Ano atual' },
  { value: 'custom', label: 'Personalizado' },
]

const periodLabels: Record<DashboardInterval, string> = {
  day: 'Hoje',
  week: 'Semana atual',
  month: 'Mês atual',
  year: 'Ano atual',
  custom: 'Período personalizado',
}

const compactCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

function periodDateLabel(period: DashboardInterval, now: Date, customStart = '', customEnd = '') {
  if (period === 'custom') {
    if (!customStart || !customEnd) return 'Selecione as datas inicial e final'
    return `${new Date(`${customStart}T00:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${customEnd}T00:00:00`).toLocaleDateString('pt-BR')}`
  }
  if (period === 'day') return now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  if (period === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} até hoje`
  }
  if (period === 'month') return now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return `${now.getFullYear()} até hoje`
}

function overviewDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return `Não foi possível carregar o dashboard (${error.code}). Confira sua conexão, as regras e o índice do Firestore.`
  }
  return 'Não foi possível carregar o dashboard. Tente novamente.'
}

function ChangeIndicator({ label, value }: { label: string; value: number | null }) {
  const Icon = value === null ? null : value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus
  const text = value === null
    ? 'Novo'
    : `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  return <span className={`dashboard-change${value === null ? ' is-new' : value > 0 ? ' is-positive' : value < 0 ? ' is-negative' : ''}`}>
    <span>{label}</span><strong>{Icon && <Icon size={13} />}{text}</strong>
  </span>
}

function PeriodSummary({ summary, comparison, period }: {
  summary: DashboardOverview['currentPeriod']
  comparison: DashboardOverview['periodComparison']
  period: DashboardInterval
}) {
  return <article className="dashboard-period-summary">
    <div className="dashboard-period-top"><span className="dashboard-period-icon"><CalendarDays size={18} /></span><span className="dashboard-period-caption">{periodLabels[period]} · vs período anterior equivalente</span></div>
    <h2>Resumo do período</h2>
    <div className="dashboard-period-summary-values">
      <div className="is-primary"><span>Comissões</span><strong>{formatBRLFromCents(summary.commissionCents)}</strong></div>
      <div><span>Vendas</span><strong>{formatBRLFromCents(summary.salesCents)}</strong></div>
      <div><span>Registros</span><strong>{summary.count.toLocaleString('pt-BR')}</strong></div>
    </div>
    <div className="dashboard-period-changes"><ChangeIndicator label="Comissão" value={comparison.commissionPercent} /><ChangeIndicator label="Vendas" value={comparison.salesPercent} /></div>
  </article>
}

function MetricCard({ label, value, caption, icon: Icon }: {
  label: string
  value: string
  caption: string
  icon: LucideIcon
}) {
  return <article className="dashboard-metric-card">
    <span className="dashboard-metric-icon"><Icon size={16} /></span>
    <span className="dashboard-metric-label">{label}</span>
    <strong>{value}</strong>
    <small>{caption}</small>
  </article>
}

function CommissionRateChartPanel({ chartData, period }: { chartData: ReturnType<typeof buildCommissionRateChart>; period: DashboardInterval }) {
  return <section className="dashboard-panel dashboard-rate-panel" aria-labelledby="dashboard-rate-chart-title">
    <div className="dashboard-panel-heading"><div><span className="dashboard-section-label"><Percent size={14} /> Comissão</span><h2 id="dashboard-rate-chart-title">Quantidade de vendas por percentual</h2><p>{periodLabels[period]} · incluindo taxas sem vendas</p></div></div>
    <div className="dashboard-rate-chart-scroll">
      <div className="dashboard-rate-chart" style={{ height: Math.max(250, chartData.length * 24) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="#e9efeb" strokeDasharray="4 5" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#87938d', fontSize: 10 }} />
            <YAxis type="category" dataKey="label" width={62} interval={0} tickLine={false} axisLine={false} tick={{ fill: '#65766d', fontSize: 10 }} />
            <Tooltip
              formatter={(value) => [`${Number(value ?? 0).toLocaleString('pt-BR')} ${Number(value ?? 0) === 1 ? 'venda' : 'vendas'}`, 'Quantidade']}
              contentStyle={{ border: '1px solid #e1e9e4', borderRadius: 10, boxShadow: '0 8px 24px rgba(20,54,40,.08)', fontSize: 12 }}
            />
            <Bar dataKey="salesCount" name="Vendas" fill="var(--brand-primary)" radius={[0, 5, 5, 0]} barSize={13} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </section>
}

function CommissionRateDetailsPanel({ summaries, period }: { summaries: ReturnType<typeof buildCommissionRateSummaryForRange>; period: DashboardInterval }) {
  return <section className="dashboard-panel dashboard-rate-panel" aria-labelledby="dashboard-rate-details-title">
    <div className="dashboard-panel-heading"><div><span className="dashboard-section-label"><Layers3 size={14} /> Detalhamento</span><h2 id="dashboard-rate-details-title">Vendas por percentual de comissão</h2><p>{periodLabels[period]} · vendas, valores e comissões</p></div></div>
    {summaries.length === 0 ? <div className="dashboard-rate-empty">Ainda não há vendas neste período.</div> : (
      <div className="dashboard-rate-grid">
        {summaries.map((summary) => <article className="dashboard-rate-card" key={summary.commissionRateBps}>
          <div className="dashboard-rate-card-heading"><strong>{(summary.commissionRateBps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</strong><span>{summary.salesCount} {summary.salesCount === 1 ? 'venda' : 'vendas'}</span></div>
          <div className="dashboard-rate-values">
            <div><span>Total vendido</span><strong>{formatBRLFromCents(summary.salesCents)}</strong></div>
            <div className="is-commission"><span>Comissões</span><strong>{formatBRLFromCents(summary.commissionCents)}</strong></div>
          </div>
        </article>)}
      </div>
    )}
  </section>
}

function CommissionByRatePanel({ summaries, period }: { summaries: ReturnType<typeof buildCommissionRateSummaryForRange>; period: DashboardInterval }) {
  return <section className="dashboard-panel dashboard-rate-commission-panel" aria-labelledby="dashboard-rate-commission-title">
    <div className="dashboard-panel-heading"><div><span className="dashboard-section-label"><Percent size={14} /> Comissões</span><h2 id="dashboard-rate-commission-title">Comissão por percentual</h2><p>{periodLabels[period]} · total de comissão em cada taxa</p></div></div>
    {summaries.length === 0 ? <div className="dashboard-rate-empty">Ainda não há comissões neste período.</div> : (
      <div className="dashboard-rate-commission-list">
        {summaries.map((summary) => <div className="dashboard-rate-commission-row" key={summary.commissionRateBps}>
          <strong>{(summary.commissionRateBps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</strong>
          <span>{formatBRLFromCents(summary.commissionCents)}</span>
        </div>)}
      </div>
    )}
  </section>
}

function SalesEvolutionPanel({ overview, period }: { overview: DashboardOverview; period: DashboardInterval }) {
  return <section className="dashboard-panel dashboard-chart-panel" aria-labelledby="dashboard-chart-title">
    <div className="dashboard-panel-heading">
      <div><span className="dashboard-section-label"><Clock3 size={14} /> Evolução</span><h2 id="dashboard-chart-title">Vendas e comissões</h2><p>{periodLabels[period]} · {period === 'day' ? 'por hora' : period === 'year' ? 'por mês' : 'por dia'}</p></div>
    </div>
    <div className="dashboard-chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={overview.chart} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#e9efeb" strokeDasharray="4 5" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#87938d', fontSize: 11 }} minTickGap={18} />
          <YAxis yAxisId="sales" tickLine={false} axisLine={false} width={64} tick={{ fill: '#87938d', fontSize: 10 }} tickFormatter={(value: number) => compactCurrency.format(value / 100)} />
          <YAxis yAxisId="commission" orientation="right" tickLine={false} axisLine={false} width={64} tick={{ fill: '#87938d', fontSize: 10 }} tickFormatter={(value: number) => compactCurrency.format(value / 100)} />
          <Tooltip formatter={(value, name) => [formatBRLFromCents(Number(value ?? 0)), String(name)]} contentStyle={{ border: '1px solid #e1e9e4', borderRadius: 10, boxShadow: '0 8px 24px rgba(20,54,40,.08)', fontSize: 12 }} />
          <Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />
          <Area yAxisId="sales" type="monotone" dataKey="salesCents" name="Vendas" stroke="var(--brand-primary)" fill="var(--brand-primary)" fillOpacity={0.12} strokeWidth={2.5} activeDot={{ r: 5 }} />
          <Line yAxisId="commission" type="monotone" dataKey="commissionCents" name="Comissões" stroke="#e1a44d" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  </section>
}

export function DashboardPage() {
  const { companyId = '' } = useParams()
  const { currentUser } = useAuth()
  const { companies, activeCompany, loading: loadingCompany, selectCompany } = useCompany()
  const company = companies.find((item) => item.companyId === companyId) ?? null
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preferencesError, setPreferencesError] = useState('')
  const [periodDraft, setPeriodDraft] = useState<DashboardInterval>('month')
  const [appliedPeriod, setAppliedPeriod] = useState<DashboardInterval>('month')
  const [customStartDraft, setCustomStartDraft] = useState('')
  const [customEndDraft, setCustomEndDraft] = useState('')
  const [appliedCustomRange, setAppliedCustomRange] = useState<{ start: Date; end: Date } | undefined>()
  const [periodValidationError, setPeriodValidationError] = useState('')
  const [periodApplyVersion, setPeriodApplyVersion] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const [preferences, setPreferences] = useState<DashboardPreferences>(createDefaultDashboardPreferences)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [settingsSaved, setSettingsSaved] = useState(false)

  const overview = useMemo(() => buildDashboardOverview(sales, appliedPeriod, now, appliedCustomRange), [sales, appliedPeriod, now, appliedCustomRange])
  const visibleIndicators = useMemo(() => new Set(preferences.visibleIndicators), [preferences.visibleIndicators])
  const rateBounds = useMemo(() => getDashboardPeriodBounds(appliedPeriod, now, appliedCustomRange), [appliedPeriod, appliedCustomRange, now])
  const rateSummaries = useMemo(() => buildCommissionRateSummaryForRange(sales, rateBounds.currentStart, rateBounds.currentEnd), [sales, rateBounds.currentEnd, rateBounds.currentStart])
  const rateChartData = useMemo(() => buildCommissionRateChart(rateSummaries), [rateSummaries])

  const loadDashboard = useCallback(async () => {
    if (!currentUser || !company) {
      setSales([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const refreshedAt = new Date()
    const [salesResult, preferencesResult] = await Promise.allSettled([
      getDashboardSales(company.companyId, currentUser.uid, appliedPeriod, refreshedAt, appliedCustomRange),
      getDashboardPreferences(company.companyId, currentUser.uid),
    ])
    if (salesResult.status === 'fulfilled') {
      setSales(salesResult.value)
      setNow(refreshedAt)
    } else {
      console.error('Falha ao carregar dashboard do Firestore:', salesResult.reason)
      setError(errorMessage(salesResult.reason))
    }
    if (preferencesResult.status === 'fulfilled') {
      setPreferences(preferencesResult.value)
      setPreferencesError('')
    } else {
      console.error('Falha ao carregar preferências do dashboard:', preferencesResult.reason)
      setPreferences(createDefaultDashboardPreferences())
      setPreferencesError('Não foi possível carregar sua configuração personalizada. O dashboard está usando o padrão.')
    }
    setLoading(false)
  }, [appliedCustomRange, appliedPeriod, company, currentUser])

  useEffect(() => {
    void periodApplyVersion
    void Promise.resolve().then(loadDashboard)
  }, [loadDashboard, periodApplyVersion])

  useEffect(() => {
    if (company && activeCompany?.companyId !== company.companyId) selectCompany(company.companyId)
  }, [activeCompany?.companyId, company, selectCompany])

  async function savePreferences(nextPreferences: DashboardPreferences) {
    if (!company || !currentUser) return
    setSavingPreferences(true)
    setSettingsError('')
    try {
      await saveDashboardPreferences(company.companyId, currentUser.uid, nextPreferences)
      setPreferences(nextPreferences)
      setSettingsOpen(false)
      setSettingsSaved(true)
      window.setTimeout(() => setSettingsSaved(false), 3500)
    } catch (saveError) {
      console.error('Falha ao salvar preferências do dashboard:', saveError)
      setSettingsError('Não foi possível salvar. Confira sua conexão, sua associação à empresa e as regras do Firestore.')
    } finally {
      setSavingPreferences(false)
    }
  }

  function applyPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPeriodValidationError('')
    if (periodDraft === 'custom') {
      if (!customStartDraft || !customEndDraft) {
        setPeriodValidationError('Informe as datas inicial e final para aplicar o período.')
        return
      }
      if (customStartDraft > customEndDraft) {
        setPeriodValidationError('A data inicial deve ser anterior ou igual à data final.')
        return
      }
      setAppliedCustomRange({ start: new Date(`${customStartDraft}T00:00:00`), end: new Date(`${customEndDraft}T00:00:00`) })
    }
    setAppliedPeriod(periodDraft)
    setPeriodApplyVersion((version) => version + 1)
  }

  if (loadingCompany) return <div className="loading-screen">Carregando empresa…</div>
  if (!company) return <Navigate to="/empresas" replace />

  const indicatorWidgets: Record<DashboardIndicatorId, ReactNode> = {
    'period-summary': <PeriodSummary summary={overview.currentPeriod} comparison={overview.periodComparison} period={appliedPeriod} />,
    'average-commission': <MetricCard label="Comissão média" value={formatBRLFromCents(overview.keyMetrics.averageCommissionCents)} caption={`por venda · ${periodLabels[appliedPeriod].toLowerCase()}`} icon={Layers3} />,
    'average-commission-rate': <MetricCard label="Taxa média de comissão" value={`${overview.keyMetrics.averageCommissionRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`} caption="ponderada pelo valor das vendas" icon={ArrowUpRight} />,
    'average-sale': <MetricCard label="Valor médio por venda" value={formatBRLFromCents(overview.keyMetrics.averageSaleCents)} caption={`${overview.keyMetrics.salesCount} ${overview.keyMetrics.salesCount === 1 ? 'venda' : 'vendas'} no período`} icon={CalendarDays} />,
    'commission-rate-chart': <CommissionRateChartPanel chartData={rateChartData} period={appliedPeriod} />,
    'commission-rate-details': <CommissionRateDetailsPanel summaries={rateSummaries} period={appliedPeriod} />,
    'commission-rate-commission': <CommissionByRatePanel summaries={rateSummaries} period={appliedPeriod} />,
    'sales-evolution': <SalesEvolutionPanel overview={overview} period={appliedPeriod} />,
  }

  return <main className="dashboard-page">
    <header className="topbar"><BrandMark /><div className="topbar-user"><AccountMenu /></div></header>
    <div className="dashboard-content">
      <div className="dashboard-heading">
        <div><span className="eyebrow"><Building2 size={15} /> {company.companyName}</span><h1>Visão geral</h1><p>Acompanhe suas vendas e comissões em um só lugar.</p></div>
        <div className="dashboard-heading-actions">
          <div className="dashboard-date-pill"><CalendarDays size={15} />{now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          <Link className="primary-button dashboard-new-sale" to={`/empresas/${company.companyId}/vendas`}><Plus size={17} /> Lançar venda</Link>
        </div>
      </div>

      <form className="dashboard-period-filter" onSubmit={applyPeriod}>
        <span className="dashboard-period-filter-label">Período do dashboard</span>
        <div className="dashboard-period-segments" role="group" aria-label="Selecionar período dos indicadores">
          {periods.map((period) => <button key={period.value} type="button" className={periodDraft === period.value ? 'is-selected' : ''} aria-pressed={periodDraft === period.value} onClick={() => setPeriodDraft(period.value)}>{period.label}</button>)}
        </div>
        {periodDraft === 'custom' && <div className="dashboard-custom-date-fields">
          <label>De<input type="date" value={customStartDraft} max={customEndDraft || undefined} onChange={(event) => setCustomStartDraft(event.target.value)} /></label>
          <label>Até<input type="date" value={customEndDraft} min={customStartDraft || undefined} onChange={(event) => setCustomEndDraft(event.target.value)} /></label>
        </div>}
        <span className="dashboard-period-filter-caption">{periodDateLabel(appliedPeriod, now, customStartDraft, customEndDraft)}</span>
        <button className="quiet-button" type="submit" disabled={loading}><RefreshCw size={14} />Aplicar período</button>
        <button className="quiet-button dashboard-settings-button" type="button" onClick={() => { setSettingsError(''); setSettingsOpen(true) }}><Settings2 size={15} />Configurar</button>
      </form>
      {periodValidationError && <p className="field-error" role="alert">{periodValidationError}</p>}
      {settingsSaved && <p className="dashboard-settings-saved" role="status">Configuração salva para {company.companyName}.</p>}
      {preferencesError && <p className="dashboard-settings-error dashboard-settings-inline-error" role="status">{preferencesError}</p>}

      {error ? <div className="dashboard-error" role="alert"><CircleAlert size={18} /><span>{error}</span><button className="quiet-button" type="button" onClick={() => void loadDashboard()}><RefreshCw size={14} />Tentar novamente</button></div> : loading ? (
        <div className="dashboard-loading"><span>Atualizando os indicadores do período…</span></div>
      ) : (
        <>
          <section className="dashboard-widgets-grid" aria-label="Indicadores personalizados">
            {preferences.indicatorOrder.filter((indicatorId) => visibleIndicators.has(indicatorId)).map((indicatorId) => <div className={`dashboard-widget dashboard-widget-${indicatorId}`} key={indicatorId}>{indicatorWidgets[indicatorId]}</div>)}
          </section>
          <SalesHistory key={`${rateBounds.currentStart.getTime()}-${rateBounds.currentEnd.getTime()}`} companyId={company.companyId} companyName={company.companyName} userId={currentUser?.uid ?? ''} containerClassName="dashboard-panel dashboard-sales-history" initialFilters={{ startDate: overviewDateInput(rateBounds.currentStart), endDate: overviewDateInput(new Date(rateBounds.currentEnd.getTime() - 1)) }} />
        </>
      )}
    </div>
    <Link className="primary-button dashboard-mobile-sale-button" to={`/empresas/${company.companyId}/vendas`}><Plus size={18} /> Lançar venda</Link>
    {settingsOpen && <DashboardSettingsModal preferences={preferences} saving={savingPreferences} error={settingsError} onClose={() => setSettingsOpen(false)} onSave={savePreferences} />}
  </main>
}

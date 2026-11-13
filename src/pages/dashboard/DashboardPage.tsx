import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, Building2, CalendarDays, CircleAlert, Clock3, Layers3, Minus, Plus, RefreshCw, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AccountMenu } from '../../components/AccountMenu'
import { BrandMark } from '../../components/BrandMark'
import { SalesHistory } from '../../components/SalesHistory'
import { useAuth } from '../../hooks/useAuth'
import { useCompany } from '../../hooks/useCompany'
import { getDashboardSales } from '../../services/dashboardService'
import type { DashboardInterval, DashboardOverview } from '../../types/dashboard'
import type { Sale } from '../../types/sale'
import { buildDashboardChart, buildDashboardOverview } from '../../utils/dashboardMetrics'
import { formatBRLFromCents } from '../../utils/currency'

const intervals: { value: DashboardInterval; label: string }[] = [
  { value: 'day', label: 'Diário' },
  { value: 'week', label: 'Semanal' },
  { value: 'month', label: 'Mensal' },
  { value: 'year', label: 'Anual' },
]

const intervalCaptions: Record<DashboardInterval, string> = {
  day: 'Hoje, hora a hora',
  week: 'Esta semana, por dia',
  month: 'Este mês, por dia',
  year: 'Este ano, por mês',
}

const compactCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

function periodLabel(date: Date, period: 'week' | 'month') {
  return period === 'week'
    ? `Semana de ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}`
    : date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return `Não foi possível carregar o dashboard (${error.code}). Confira sua conexão, as regras e o índice do Firestore.`
  }
  return 'Não foi possível carregar o dashboard. Tente novamente.'
}

function PeriodCard({
  title,
  caption,
  icon: Icon,
  summary,
  comparison,
}: {
  title: string
  caption: string
  icon: LucideIcon
  summary: DashboardOverview['today']
  comparison: DashboardOverview['dayComparison']
}) {
  return (
    <article className="dashboard-period-card">
      <div className="dashboard-period-top"><span className="dashboard-period-icon"><Icon size={18} /></span><span className="dashboard-period-caption">{caption}</span></div>
      <h2>{title}</h2>
      <div className="dashboard-period-primary"><span>Comissões</span><strong>{formatBRLFromCents(summary.commissionCents)}</strong></div>
      <div className="dashboard-period-sales-row"><span>Vendas</span><strong>{formatBRLFromCents(summary.salesCents)}</strong></div>
      <div className="dashboard-period-changes">
        <ChangeIndicator label="Comissão" value={comparison.commissionPercent} />
        <ChangeIndicator label="Vendas" value={comparison.salesPercent} />
      </div>
      <div className="dashboard-period-bottom"><span>{summary.count} {summary.count === 1 ? 'venda registrada' : 'vendas registradas'}</span></div>
    </article>
  )
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

function MetricCard({ label, value, caption, icon: Icon, primary = false }: {
  label: string
  value: string
  caption: string
  icon: LucideIcon
  primary?: boolean
}) {
  return <article className={`dashboard-metric-card${primary ? ' is-primary' : ''}`}>
    <span className="dashboard-metric-icon"><Icon size={16} /></span>
    <span className="dashboard-metric-label">{label}</span>
    <strong>{value}</strong>
    <small>{caption}</small>
  </article>
}

export function DashboardPage() {
  const { companyId = '' } = useParams()
  const { currentUser } = useAuth()
  const { companies, activeCompany, loading: loadingCompany, selectCompany } = useCompany()
  const company = companies.find((item) => item.companyId === companyId) ?? null
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [interval, setInterval] = useState<DashboardInterval>('week')
  const [now, setNow] = useState(() => new Date())
  const overview = useMemo(() => buildDashboardOverview(sales, now), [sales, now])
  const chart = useMemo(() => buildDashboardChart(sales, interval, now), [sales, interval, now])
  const weekStart = useMemo(() => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
    return date
  }, [now])
  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now])

  const loadDashboard = useCallback(async () => {
    if (!currentUser || !company) {
      setSales([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const refreshedAt = new Date()
      const currentYearSales = await getDashboardSales(company.companyId, currentUser.uid, refreshedAt)
      setSales(currentYearSales)
      setNow(refreshedAt)
    } catch (loadError: unknown) {
      console.error('Falha ao carregar dashboard do Firestore:', loadError)
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [company, currentUser])

  useEffect(() => {
    void Promise.resolve().then(loadDashboard)
  }, [loadDashboard])

  useEffect(() => {
    if (company && activeCompany?.companyId !== company.companyId) selectCompany(company.companyId)
  }, [activeCompany?.companyId, company, selectCompany])

  if (loadingCompany) return <div className="loading-screen">Carregando empresa…</div>
  if (!company) return <Navigate to="/empresas" replace />

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <BrandMark />
        <div className="topbar-user">
          <AccountMenu />
        </div>
      </header>

      <div className="dashboard-content">
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow"><Building2 size={15} /> {company.companyName}</span>
            <h1>Visão geral</h1>
            <p>Acompanhe suas vendas e comissões em um só lugar.</p>
          </div>
          <div className="dashboard-heading-actions">
            <div className="dashboard-date-pill"><CalendarDays size={15} />{now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            <Link className="primary-button dashboard-new-sale" to={`/empresas/${company.companyId}/vendas`}><Plus size={17} /> Lançar venda</Link>
          </div>
        </div>

        {error ? (
          <div className="dashboard-error" role="alert"><CircleAlert size={18} /><span>{error}</span><button className="quiet-button" type="button" onClick={() => void loadDashboard()}><RefreshCw size={14} /> Tentar novamente</button></div>
        ) : loading ? (
          <div className="dashboard-loading"><span>Atualizando seus indicadores…</span></div>
        ) : (
          <>
            <section className="dashboard-period-grid" aria-label="Resumo de vendas e comissões">
              <PeriodCard title="Hoje" caption="vs ontem, no mesmo horário" icon={CalendarDays} summary={overview.today} comparison={overview.dayComparison} />
              <PeriodCard title="Esta semana" caption={`${periodLabel(weekStart, 'week')} · vs semana passada`} icon={ArrowUpRight} summary={overview.week} comparison={overview.weekComparison} />
              <PeriodCard title="Este mês" caption={`${periodLabel(monthStart, 'month')} · vs mês passado`} icon={Layers3} summary={overview.month} comparison={overview.monthComparison} />
            </section>

            <section className="dashboard-metrics-grid" aria-label="Indicadores médios do mês">
              <MetricCard label="Comissão média" value={formatBRLFromCents(overview.keyMetrics.averageCommissionCents)} caption="por venda neste mês" icon={Layers3} primary />
              <MetricCard label="Taxa média de comissão" value={`${overview.keyMetrics.averageCommissionRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`} caption="ponderada pelo valor das vendas" icon={ArrowUpRight} />
              <MetricCard label="Valor médio por venda" value={formatBRLFromCents(overview.keyMetrics.averageSaleCents)} caption={`${overview.keyMetrics.salesCount} ${overview.keyMetrics.salesCount === 1 ? 'venda' : 'vendas'} neste mês`} icon={CalendarDays} />
            </section>

            <section className="dashboard-panel dashboard-chart-panel" aria-labelledby="dashboard-chart-title">
              <div className="dashboard-panel-heading">
                <div><span className="dashboard-section-label"><Clock3 size={14} /> Evolução</span><h2 id="dashboard-chart-title">Vendas e comissões</h2><p>{intervalCaptions[interval]}</p></div>
                <div className="dashboard-intervals" role="group" aria-label="Período do gráfico">
                  {intervals.map((item) => <button key={item.value} type="button" className={interval === item.value ? 'is-selected' : ''} aria-pressed={interval === item.value} onClick={() => setInterval(item.value)}>{item.label}</button>)}
                </div>
              </div>
              <div className="dashboard-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chart} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#e9efeb" strokeDasharray="4 5" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#87938d', fontSize: 11 }} minTickGap={18} />
                    <YAxis yAxisId="sales" tickLine={false} axisLine={false} width={64} tick={{ fill: '#87938d', fontSize: 10 }} tickFormatter={(value: number) => compactCurrency.format(value / 100)} />
                    <YAxis yAxisId="commission" orientation="right" tickLine={false} axisLine={false} width={64} tick={{ fill: '#87938d', fontSize: 10 }} tickFormatter={(value: number) => compactCurrency.format(value / 100)} />
                    <Tooltip
                      cursor={{ fill: 'rgba(24, 127, 99, .045)' }}
                      formatter={(value, name) => [formatBRLFromCents(Number(value ?? 0)), String(name)]}
                      contentStyle={{ border: '1px solid #e1e9e4', borderRadius: 10, boxShadow: '0 8px 24px rgba(20,54,40,.08)', fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />
                    <Area yAxisId="sales" type="monotone" dataKey="salesCents" name="Vendas" stroke="var(--brand-primary)" fill="var(--brand-primary)" fillOpacity={0.12} strokeWidth={2.5} activeDot={{ r: 5 }} />
                    <Line yAxisId="commission" type="monotone" dataKey="commissionCents" name="Comissões" stroke="#e1a44d" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>

            <SalesHistory companyId={company.companyId} companyName={company.companyName} userId={currentUser?.uid ?? ''} containerClassName="dashboard-panel dashboard-sales-history" />
          </>
        )}
      </div>
      <Link className="primary-button dashboard-mobile-sale-button" to={`/empresas/${company.companyId}/vendas`}><Plus size={18} /> Lançar venda</Link>
    </main>
  )
}

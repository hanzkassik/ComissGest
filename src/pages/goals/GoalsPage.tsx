import { ArrowLeft, Building2, CalendarDays, CircleAlert, MoreHorizontal, Plus, Target, Trash2, Pencil, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AccountMenu } from '../../components/AccountMenu'
import { BrandMark } from '../../components/BrandMark'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAuth } from '../../hooks/useAuth'
import { useCompany } from '../../hooks/useCompany'
import { goalSchema } from '../../schemas/goalSchemas'
import { createGoal, deleteGoal, emptyGoalValues, getGoals, updateGoal } from '../../services/goalService'
import type { Goal, GoalFormValues } from '../../types/goal'
import { formatBRLFromCents, parseBrazilianDecimalToInteger } from '../../utils/currency'
import { countBusinessDays } from '../../utils/goalMetrics'

function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function currentMonthGoalValues(): GoalFormValues {
  const today = new Date()
  const startDate = dateInput(new Date(today.getFullYear(), today.getMonth(), 1))
  const endDate = dateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0))
  return { ...emptyGoalValues, startDate, endDate, businessDays: String(countBusinessDays(new Date(`${startDate}T00:00:00`), new Date(`${endDate}T00:00:00`))) }
}

function valuesFromGoal(goal: Goal): GoalFormValues {
  const start = goal.startDate.toDate()
  const end = goal.endDate.toDate()
  return {
    startDate: dateInput(start),
    endDate: dateInput(end),
    target: `${Math.floor(goal.targetCents / 100)},${String(goal.targetCents % 100).padStart(2, '0')}`,
    businessDays: String(goal.businessDays),
    description: goal.description ?? '',
  }
}

function formatDateRange(goal: Goal) {
  const start = goal.startDate.toDate().toLocaleDateString('pt-BR')
  const end = goal.endDate.toDate().toLocaleDateString('pt-BR')
  return `${start} a ${end}`
}

export function GoalsPage() {
  const { companyId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const openFromDashboard = (location.state as { openGoalModal?: boolean } | null)?.openGoalModal === true
  const { currentUser } = useAuth()
  const { companies, activeCompany, loading: loadingCompany, selectCompany } = useCompany()
  const company = companies.find((item) => item.companyId === companyId)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isOpen, setIsOpen] = useState(openFromDashboard)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [values, setValues] = useState<GoalFormValues>(currentMonthGoalValues)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadGoals = useCallback(async () => {
    if (!company || !currentUser) {
      setGoals([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      setGoals(await getGoals(company.companyId, currentUser.uid))
    } catch (loadError) {
      console.error('Falha ao carregar metas:', loadError)
      setError('Não foi possível carregar suas metas. Confira sua conexão e as regras do Firestore.')
    } finally {
      setLoading(false)
    }
  }, [company, currentUser])

  useEffect(() => { void Promise.resolve().then(loadGoals) }, [loadGoals])

  useEffect(() => {
    if (company && activeCompany?.companyId !== company.companyId) selectCompany(company.companyId)
  }, [activeCompany?.companyId, company, selectCompany])

  useEffect(() => {
    if (openFromDashboard) navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, navigate, openFromDashboard])

  function openCreate() {
    setEditingGoal(null)
    setValues(currentMonthGoalValues())
    setFieldErrors({})
    setFormError('')
    setIsOpen(true)
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal)
    setValues(valuesFromGoal(goal))
    setFieldErrors({})
    setFormError('')
    setIsOpen(true)
  }

  function changeDate(field: 'startDate' | 'endDate', value: string) {
    const next = { ...values, [field]: value }
    if (next.startDate && next.endDate && next.startDate <= next.endDate) {
      next.businessDays = String(countBusinessDays(new Date(`${next.startDate}T00:00:00`), new Date(`${next.endDate}T00:00:00`)))
    }
    setValues(next)
    setFieldErrors((current) => ({ ...current, [field]: '' }))
  }

  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const parsed = goalSchema.safeParse(values)
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      return
    }
    if (!company || !currentUser) return
    try {
      parseBrazilianDecimalToInteger(values.target, 2)
    } catch {
      setFieldErrors((current) => ({ ...current, target: 'O valor informado excede o limite permitido.' }))
      return
    }
    setSaving(true)
    try {
      if (editingGoal) await updateGoal(company.companyId, editingGoal.goalId, currentUser.uid, values)
      else await createGoal(company.companyId, currentUser.uid, values)
      setIsOpen(false)
      await loadGoals()
    } catch (saveError) {
      console.error('Falha ao salvar meta:', saveError)
      setFormError('Não foi possível salvar a meta. Confira sua conexão e as regras publicadas do Firestore.')
    } finally {
      setSaving(false)
    }
  }

  async function removeGoal(goal: Goal) {
    if (!company || !window.confirm('Deseja excluir esta meta? Esta ação não pode ser desfeita.')) return
    try {
      await deleteGoal(company.companyId, goal.goalId)
      setGoals((current) => current.filter((item) => item.goalId !== goal.goalId))
    } catch (deleteError) {
      console.error('Falha ao excluir meta:', deleteError)
      setError('Não foi possível excluir a meta. Tente novamente.')
    }
  }

  if (loadingCompany) return <LoadingSkeleton variant="goals" />
  if (!company) return <Navigate to="/empresas" replace />

  return <main className="goals-page">
    <header className="topbar"><BrandMark /><div className="topbar-user"><AccountMenu /></div></header>
    <div className="companies-content goals-content">
      <Link className="sales-back-link" to={`/empresas/${company.companyId}`}><ArrowLeft size={14} /> Dashboard</Link>
      <div className="goals-heading">
        <div><span className="eyebrow"><Building2 size={15} /> {company.companyName}</span><h1>Minhas metas</h1><p>Acompanhe seus objetivos individuais nesta empresa.</p></div>
        <button className="primary-button" type="button" onClick={openCreate}><Plus size={17} /> Criar meta</button>
      </div>
      {error && <div className="dashboard-error" role="alert"><CircleAlert size={17} />{error}<button className="quiet-button" type="button" onClick={() => void loadGoals()}>Tentar novamente</button></div>}
      {loading ? <LoadingSkeleton variant="goal-list" page={false} rows={2} /> : goals.length === 0 ? (
        <section className="goals-empty"><span><Target size={22} /></span><h2>Nenhuma meta cadastrada</h2><p>Crie sua primeira meta para acompanhar seu progresso no dashboard.</p><button className="primary-button" type="button" onClick={openCreate}><Plus size={16} /> Criar meta</button></section>
      ) : <section className="goals-grid" aria-label="Metas cadastradas">
        {goals.map((goal) => <article className="goal-card" key={goal.goalId}>
          <div className="goal-card-heading"><span className="goal-icon"><Target size={18} /></span><details className="company-actions-menu"><summary aria-label="Ações da meta"><MoreHorizontal size={19} /></summary><div className="company-actions-popover"><button type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); openEdit(goal) }}><Pencil size={14} />Editar meta</button><button type="button" className="is-danger" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); void removeGoal(goal) }}><Trash2 size={14} />Excluir meta</button></div></details></div>
          <p className="goal-date-range"><CalendarDays size={14} />{formatDateRange(goal)}</p>
          <strong className="goal-target">{formatBRLFromCents(goal.targetCents)}</strong>
          <span className="goal-days-caption">Meta · {goal.businessDays} dias úteis</span>
          {goal.description && <p className="goal-description">{goal.description}</p>}
        </article>)}
      </section>}
    </div>

    {isOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setIsOpen(false) }}>
      <section className="company-modal goal-modal" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title">
        <div className="company-modal-heading"><span className="create-icon"><Target size={18} /></span><button className="modal-close-button" type="button" aria-label="Fechar" onClick={() => setIsOpen(false)} disabled={saving}><X size={18} /></button></div>
        <h2 id="goal-modal-title">{editingGoal ? 'Editar meta' : 'Criar meta'}</h2><p>Defina o período e o valor que deseja alcançar nesta empresa.</p>
        <form className="form-stack" onSubmit={(event) => void saveGoal(event)} noValidate>
          <div className="sale-datetime-fields">
            <label className="field-label">Data inicial<input type="date" value={values.startDate} onChange={(event) => changeDate('startDate', event.target.value)} />{fieldErrors.startDate && <span className="field-error">{fieldErrors.startDate}</span>}</label>
            <label className="field-label">Data final<input type="date" min={values.startDate || undefined} value={values.endDate} onChange={(event) => changeDate('endDate', event.target.value)} />{fieldErrors.endDate && <span className="field-error">{fieldErrors.endDate}</span>}</label>
          </div>
          <label className="field-label">Valor da meta (R$)<input inputMode="decimal" placeholder="Ex.: 25000,00" value={values.target} onChange={(event) => setValues({ ...values, target: event.target.value })} />{fieldErrors.target && <span className="field-error">{fieldErrors.target}</span>}</label>
          <label className="field-label">Dias úteis no período<input type="number" min="1" max="3660" value={values.businessDays} onChange={(event) => setValues({ ...values, businessDays: event.target.value })} /><span className="field-help">Pré-calculado de segunda a sábado, sem feriados. Você pode ajustar.</span>{fieldErrors.businessDays && <span className="field-error">{fieldErrors.businessDays}</span>}</label>
          <label className="field-label">Descrição <span className="field-optional">(opcional)</span><textarea rows={3} maxLength={500} value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} placeholder="Ex.: meta de vendas do mês" />{fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}</label>
          {formError && <p className="inline-message error" role="alert">{formError}</p>}
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Salvando…' : editingGoal ? 'Salvar alterações' : 'Criar meta'}</button>
        </form>
      </section>
    </div>}
  </main>
}

import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CalendarDays, CircleAlert, Clock3, Plus, Receipt, Tag, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AccountMenu } from '../../components/AccountMenu'
import { BrandMark } from '../../components/BrandMark'
import { FormField } from '../../components/FormField'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { PhoneField } from '../../components/PhoneField'
import { SaleItemsEditor } from '../../components/SaleItemsEditor'
import { SaleStatusQuickCreateModal } from '../../components/SaleStatusQuickCreateModal'
import { SalesHistory } from '../../components/SalesHistory'
import { useAuth } from '../../hooks/useAuth'
import { useCompany } from '../../hooks/useCompany'
import { saleSchema, type SaleFormValues } from '../../schemas/saleSchemas'
import { createSale } from '../../services/saleService'
import { ensureDefaultSaleStatuses, getCompanySaleStatuses } from '../../services/saleStatusService'
import type { SaleStatus } from '../../types/saleStatus'
import { calculateCommissionCents, formatBRLFromCents, parseBrazilianDecimalToInteger, toLocalDateInputValue } from '../../utils/currency'

function defaultValues(statusId = 'created'): SaleFormValues {
  return {
    customerName: '', customerPhone: '', externalNumber: '',
    soldOn: toLocalDateInputValue(), soldTime: new Date().toTimeString().slice(0, 5),
    deliveryOn: '', statusId, notes: '', items: [],
  }
}

function itemCommissionPreview(amount: string, commissionRate: string) {
  try {
    if (!amount || !commissionRate) return 0
    return calculateCommissionCents(parseBrazilianDecimalToInteger(amount, 2), parseBrazilianDecimalToInteger(commissionRate, 2))
  } catch {
    return 0
  }
}

function saleStatusLoadMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : ''
  if (code.includes('permission-denied')) return 'O Firestore negou o acesso aos status. Confira as regras publicadas e sua participação nesta empresa.'
  if (code.includes('unavailable') || code.includes('network-request-failed')) return 'Sem conexão com o Firestore. Verifique a internet e tente novamente.'
  return 'Não foi possível carregar os status desta empresa.'
}

export function SalesPage() {
  const { companyId = '' } = useParams()
  const { currentUser } = useAuth()
  const { companies, activeCompany, loading: loadingCompany, selectCompany } = useCompany()
  const company = companies.find((item) => item.companyId === companyId) ?? null
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [statuses, setStatuses] = useState<SaleStatus[]>([])
  const [statusesError, setStatusesError] = useState('')
  const [loadingStatuses, setLoadingStatuses] = useState(true)
  const [quickStatusOpen, setQuickStatusOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, control, setValue } = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: defaultValues(),
  })
  const { replace } = useFieldArray({ control, name: 'items' })
  const items = useWatch({ control, name: 'items' }) ?? []
  const selectedStatusId = useWatch({ control, name: 'statusId' })
  const totalCommissionCents = useMemo(() => items.reduce((total, item) => total + itemCommissionPreview(item?.amount ?? '', item?.commissionRate ?? ''), 0), [items])

  const loadStatuses = useCallback(async () => {
    if (!company || !currentUser) return
    setLoadingStatuses(true)
    setStatusesError('')
    try {
      let result = await getCompanySaleStatuses(company.companyId)
      if (result.length === 0) {
        await ensureDefaultSaleStatuses(company.companyId, currentUser.uid)
        result = await getCompanySaleStatuses(company.companyId)
      }
      setStatuses(result)
      const created = result.find((status) => status.statusId === 'created' && status.active)
      const defaultStatus = created ?? result.find((status) => status.active)
      if (defaultStatus && !result.some((status) => status.statusId === selectedStatusId && status.active)) {
        setValue('statusId', defaultStatus.statusId, { shouldValidate: true })
      }
    } catch (error) {
      console.error('Falha ao carregar status de vendas:', error)
      setStatusesError(saleStatusLoadMessage(error))
    } finally {
      setLoadingStatuses(false)
    }
  }, [company, currentUser, selectedStatusId, setValue])

  useEffect(() => { if (company && currentUser) void loadStatuses() }, [company, currentUser, loadStatuses])
  useEffect(() => { if (company && activeCompany?.companyId !== company.companyId) selectCompany(company.companyId) }, [activeCompany?.companyId, company, selectCompany])

  async function onCreate(values: SaleFormValues) {
    setMessage('')
    setFailed(false)
    if (!currentUser || !company) return
    try {
      await createSale(company.companyId, currentUser.uid, values)
      reset(defaultValues(values.statusId))
      setMessage('Venda registrada com sucesso.')
      setHistoryRefreshKey((key) => key + 1)
    } catch (error) {
      console.error('Falha ao registrar venda:', error)
      setFailed(true)
      setMessage('Não foi possível registrar a venda. Verifique a conexão e as regras do Firestore.')
    }
  }

  function onStatusCreated(status: SaleStatus) {
    setStatuses((current) => [...current, status].sort((left, right) => left.sortOrder - right.sortOrder))
    setValue('statusId', status.statusId, { shouldDirty: true, shouldValidate: true })
    setQuickStatusOpen(false)
  }

  if (loadingCompany) return <LoadingSkeleton variant="sales" />
  if (!company) return <Navigate to="/empresas" replace />

  return (
    <main className="sales-page">
      <header className="topbar"><BrandMark /><div className="topbar-user"><AccountMenu /></div></header>
      <div className="sales-content">
        <div className="sales-heading"><div><Link className="sales-back-link" to={`/empresas/${company.companyId}`}><ArrowLeft size={14} /> Dashboard</Link><span className="eyebrow"><Receipt size={15} /> {company.companyName}</span><h1>Vendas e comissões</h1><p>Registre pedidos e acompanhe sua evolução.</p></div><div className="sales-owner-pill"><UserRound size={15} /> Histórico individual</div></div>
        <div className="sales-layout">
          <section className="profile-card sale-create-card" aria-labelledby="sale-form-heading">
            <div className="sale-card-title"><span className="sale-card-icon"><Plus size={18} /></span><div><h2 id="sale-form-heading">Registrar venda</h2><p>A comissão é calculada pelo valor total de cada item.</p></div></div>
            <form className="form-stack sale-order-form" onSubmit={handleSubmit(onCreate)} noValidate>
              <div className="sale-form-section"><h3>Dados do pedido</h3>
                <FormField id="sale-customer-name" label="Nome do cliente (opcional)" icon={UserRound} maxLength={160} placeholder="Nome do cliente" registration={register('customerName')} error={errors.customerName?.message} />
                <Controller control={control} name="customerPhone" render={({ field, fieldState }) => <PhoneField id="sale-customer-phone" value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />} />
                <FormField id="sale-external-number" label="Número da venda (opcional)" icon={Receipt} maxLength={100} placeholder="Identificador externo" registration={register('externalNumber')} error={errors.externalNumber?.message} />
                <div className="sale-datetime-fields"><FormField id="sale-date" label="Data da venda" icon={CalendarDays} type="date" max={toLocalDateInputValue()} registration={register('soldOn')} error={errors.soldOn?.message} /><FormField id="sale-time" label="Hora da venda" icon={Clock3} type="time" registration={register('soldTime')} error={errors.soldTime?.message} /></div>
                <FormField id="sale-delivery-date" label="Data prevista de entrega (opcional)" icon={CalendarDays} type="date" registration={register('deliveryOn')} error={errors.deliveryOn?.message} />
                <div className="sale-status-select-wrap"><label className="field-label" htmlFor="sale-status">Status</label><div className="sale-status-select-control"><Tag size={16} /><select id="sale-status" disabled={loadingStatuses || statusesError !== '' || !statuses.some((status) => status.active)} {...register('statusId')}><option value="">{loadingStatuses ? 'Carregando status…' : statusesError || 'Selecione um status'}</option>{statuses.filter((status) => status.active).map((status) => <option key={status.statusId} value={status.statusId}>{status.name}</option>)}</select><button type="button" aria-label="Adicionar status" title="Adicionar status" onClick={() => setQuickStatusOpen(true)}><Plus size={17} /></button></div>{errors.statusId?.message && <span className="field-error">{errors.statusId.message}</span>}{!loadingStatuses && statuses.length === 0 && !statusesError && <span className="field-hint">Os status ainda estão sendo inicializados. Tente novamente em instantes.</span>}</div>
                {statusesError && <p className="field-error" role="alert"><CircleAlert size={14} />{statusesError}<button className="text-link" type="button" onClick={() => void loadStatuses()}>Tentar novamente</button></p>}
              </div>
              <div className="sale-form-section"><div className="sale-items-heading"><div><h3>Itens da venda</h3><p>O valor informado já representa o total do item. A quantidade não altera os cálculos.</p></div></div>
                <SaleItemsEditor companyId={company.companyId} items={items} onItemsChange={(next) => replace(next)} />
                {errors.items?.message && <span className="field-error" role="alert">{errors.items.message}</span>}
              </div>
              <label className="notes-field">Observação do pedido <span>(opcional)</span><textarea rows={3} maxLength={500} placeholder="Detalhes sobre esta venda" {...register('notes')} />{errors.notes?.message && <span className="field-error">{errors.notes.message}</span>}</label>
              {totalCommissionCents > 0 && <div className="commission-preview"><span>Comissão total estimada</span><strong>{formatBRLFromCents(totalCommissionCents)}</strong></div>}
              {message && <div className={`inline-message${failed ? ' error' : ''}`} role="status">{message}</div>}
              <button className="primary-button" type="submit" disabled={isSubmitting || loadingStatuses || statusesError !== ''}><Plus size={16} />{isSubmitting ? 'Registrando…' : 'Registrar venda'}</button>
            </form>
          </section>
          <SalesHistory companyId={company.companyId} companyName={company.companyName} userId={currentUser?.uid ?? ''} refreshKey={historyRefreshKey} />
        </div>
      </div>
      {quickStatusOpen && <SaleStatusQuickCreateModal companyId={company.companyId} onClose={() => setQuickStatusOpen(false)} onCreated={onStatusCreated} />}
    </main>
  )
}

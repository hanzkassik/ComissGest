import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowLeft, ArrowUp, CircleAlert, Pencil, Plus, Tag, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AccountMenu } from '../../components/AccountMenu'
import { BrandMark } from '../../components/BrandMark'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAuth } from '../../hooks/useAuth'
import { useCompany } from '../../hooks/useCompany'
import { saleStatusSchema, type SaleStatusFormValues } from '../../schemas/saleStatusSchemas'
import { createSaleStatus, deleteSaleStatus, ensureDefaultSaleStatuses, getCompanySaleStatuses, reorderSaleStatuses, resolveFinalizedSaleStatus, updateSaleStatus } from '../../services/saleStatusService'
import type { SaleStatus } from '../../types/saleStatus'

export function SaleStatusesPage() {
  const { companyId = '' } = useParams()
  const { currentUser } = useAuth()
  const { companies, activeCompany, loading: loadingCompany, selectCompany } = useCompany()
  const company = companies.find((item) => item.companyId === companyId) ?? null
  const [statuses, setStatuses] = useState<SaleStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalStatus, setModalStatus] = useState<SaleStatus | null | undefined>(undefined)
  const [deleteWarning, setDeleteWarning] = useState<SaleStatus | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let currentStatuses = await getCompanySaleStatuses(companyId)
      if (currentStatuses.length === 0 && company && currentUser) {
        await ensureDefaultSaleStatuses(company.companyId, currentUser.uid)
        currentStatuses = await getCompanySaleStatuses(companyId)
      }
      setStatuses(currentStatuses)
    } catch (loadError) {
      console.error('Falha ao carregar status de venda:', loadError)
      setError('Não foi possível carregar os status. Confira sua conexão e as regras do Firestore.')
    } finally {
      setLoading(false)
    }
  }, [company, companyId, currentUser])

  useEffect(() => { if (company && currentUser) void load() }, [company, currentUser, load])
  useEffect(() => { if (company && activeCompany?.companyId !== company.companyId) selectCompany(company.companyId) }, [activeCompany?.companyId, company, selectCompany])

  async function saveStatus(values: SaleStatusFormValues, isFinalizedIndicator: boolean) {
    if (!company || !currentUser) return
    setSaving(true)
    setError('')
    try {
      if (modalStatus) {
        await updateSaleStatus(company.companyId, currentUser.uid, modalStatus.statusId, { name: values.name, isFinalizedIndicator })
      } else {
        await createSaleStatus(company.companyId, currentUser.uid, values.name, isFinalizedIndicator)
      }
      setModalStatus(undefined)
      await load()
    } catch (saveError) {
      console.error('Falha ao salvar status de venda:', saveError)
      setError('Não foi possível salvar o status. Confira sua conexão e as regras do Firestore.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(status: SaleStatus) {
    if (!company || !currentUser) return
    setError('')
    try {
      await updateSaleStatus(company.companyId, currentUser.uid, status.statusId, { active: !status.active })
      await load()
    } catch (updateError) {
      console.error('Falha ao atualizar status de venda:', updateError)
      setError('Não foi possível atualizar o status.')
    }
  }

  async function moveStatus(index: number, direction: -1 | 1) {
    if (!company || !currentUser) return
    const next = [...statuses]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= next.length) return
    ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
    setStatuses(next.map((status, sortOrder) => ({ ...status, sortOrder })))
    try {
      await reorderSaleStatuses(company.companyId, currentUser.uid, next.map((status) => status.statusId))
    } catch (reorderError) {
      console.error('Falha ao reordenar status de venda:', reorderError)
      setError('Não foi possível salvar a ordem dos status.')
      await load()
    }
  }

  async function removeStatus(status: SaleStatus) {
    if (!company) return
    if (status.usageCount > 0) {
      setDeleteWarning(status)
      return
    }
    try {
      await deleteSaleStatus(company.companyId, status.statusId)
      setDeleteWarning(null)
      await load()
    } catch (deleteError) {
      if (deleteError instanceof Error && deleteError.message === 'SALE_STATUS_IN_USE') {
        const refreshed = await getCompanySaleStatuses(company.companyId).catch(() => statuses)
        setStatuses(refreshed)
        setDeleteWarning(refreshed.find((item) => item.statusId === status.statusId) ?? status)
      }
      else {
        console.error('Falha ao excluir status de venda:', deleteError)
        setError('Não foi possível excluir o status.')
      }
    }
  }

  if (loadingCompany) return <LoadingSkeleton variant="products" />
  if (!company || !currentUser) return <Navigate to="/empresas" replace />
  const finalizedStatus = resolveFinalizedSaleStatus(statuses)

  return <main className="products-page">
    <header className="topbar"><BrandMark /><div className="topbar-user"><AccountMenu /></div></header>
    <div className="products-content">
      <div className="products-heading"><div><Link className="sales-back-link" to={`/empresas/${company.companyId}/vendas`}><ArrowLeft size={14} /> Vendas</Link><span className="eyebrow"><Tag size={15} /> {company.companyName}</span><h1>Status de vendas</h1><p>Organize as etapas dos pedidos desta empresa.</p></div><button className="primary-button" type="button" onClick={() => setModalStatus(null)}><Plus size={17} /> Adicionar status</button></div>
      {error && <div className="company-notice error" role="alert"><CircleAlert size={17} /><span>{error}</span><button type="button" className="text-link" onClick={() => void load()}>Tentar novamente</button></div>}
      <section className="products-panel sale-status-panel" aria-label="Lista de status de vendas">
        {loading ? <LoadingSkeleton variant="product-list" page={false} rows={4} /> : statuses.length === 0 ? <div className="products-empty"><span className="company-card-icon"><Tag size={20} /></span><h2>Nenhum status cadastrado</h2><p>Adicione status para acompanhar a evolução de seus pedidos.</p><button className="primary-button" type="button" onClick={() => setModalStatus(null)}><Plus size={16} /> Adicionar status</button></div> : <ol className="sale-status-list">
          {statuses.map((status, index) => <li className="sale-status-card" key={status.statusId}>
            <div className="sale-status-order"><button type="button" aria-label={`Mover ${status.name} para cima`} disabled={index === 0} onClick={() => void moveStatus(index, -1)}><ArrowUp size={15} /></button><span>{index + 1}</span><button type="button" aria-label={`Mover ${status.name} para baixo`} disabled={index === statuses.length - 1} onClick={() => void moveStatus(index, 1)}><ArrowDown size={15} /></button></div>
            <div className="sale-status-main"><strong>{status.name}</strong><div className="sale-status-tags">{!status.active && <span className="sale-status-tag is-inactive">Desativado</span>}{status.isFinalizedIndicator && finalizedStatus?.statusId === status.statusId && <span className="sale-status-tag">Indicador de finalizado</span>}{status.isFinalizedIndicator && finalizedStatus?.statusId !== status.statusId && <span className="sale-status-tag">Indicador marcado · prioridade menor</span>}{finalizedStatus?.statusId === status.statusId && !status.isFinalizedIndicator && <span className="sale-status-tag">Finalizado por ordem</span>}{status.usageCount > 0 && <span className="sale-status-usage">{status.usageCount} {status.usageCount === 1 ? 'venda' : 'vendas'}</span>}</div></div>
            <div className="sale-status-actions"><button className="quiet-button" type="button" onClick={() => void toggleActive(status)}>{status.active ? 'Desativar' : 'Ativar'}</button><button className="quiet-button" type="button" onClick={() => setModalStatus(status)}><Pencil size={14} /> Editar</button><button className="quiet-button sale-status-delete" type="button" aria-label={`Excluir status ${status.name}`} onClick={() => void removeStatus(status)}><Trash2 size={14} /></button></div>
          </li>)}
        </ol>}
      </section>
    </div>
    {modalStatus !== undefined && <SaleStatusModal status={modalStatus} saving={saving} onClose={() => !saving && setModalStatus(undefined)} onSave={(values, indicator) => void saveStatus(values, indicator)} />}
    {deleteWarning && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteWarning(null) }}><section className="company-modal" role="alertdialog" aria-modal="true" aria-labelledby="sale-status-delete-title"><div className="company-modal-heading"><span className="create-icon"><CircleAlert size={18} /></span><button className="modal-close-button" type="button" aria-label="Fechar" onClick={() => setDeleteWarning(null)}><X size={18} /></button></div><h2 id="sale-status-delete-title">Status em uso</h2><p>O status “{deleteWarning.name}” está associado a {deleteWarning.usageCount} venda(s) e não pode ser excluído. Você pode desativá-lo para impedir novas seleções.</p><button className="primary-button" type="button" onClick={() => setDeleteWarning(null)}>Entendi</button></section></div>}
  </main>
}

function SaleStatusModal({ status, saving, onClose, onSave }: {
  status: SaleStatus | null
  saving: boolean
  onClose: () => void
  onSave: (values: SaleStatusFormValues, isFinalizedIndicator: boolean) => void
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<SaleStatusFormValues>({
    resolver: zodResolver(saleStatusSchema),
    defaultValues: { name: status?.name ?? '' },
  })
  const [isFinalizedIndicator, setIsFinalizedIndicator] = useState(status?.isFinalizedIndicator ?? false)

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}><section className="company-modal sale-status-modal" role="dialog" aria-modal="true" aria-labelledby="sale-status-modal-title">
    <div className="company-modal-heading"><span className="create-icon"><Tag size={18} /></span><button className="modal-close-button" type="button" aria-label="Fechar" onClick={onClose} disabled={saving}><X size={18} /></button></div>
    <h2 id="sale-status-modal-title">{status ? 'Editar status' : 'Adicionar status'}</h2><p>O nome atualizado será exibido também nas vendas que já usam este status.</p>
    <form className="form-stack" onSubmit={handleSubmit((values) => onSave(values, isFinalizedIndicator))} noValidate>
      <label className="field-label">Nome do status<input autoFocus maxLength={60} placeholder="Ex.: Separando pedido" {...register('name')} />{errors.name?.message && <span className="field-error">{errors.name.message}</span>}</label>
      <label className="sale-status-indicator-field"><input type="checkbox" checked={isFinalizedIndicator} onChange={(event) => setIsFinalizedIndicator(event.target.checked)} /><span><strong>Indicador de finalizado</strong><small>Usado para identificar vendas concluídas. Se houver mais de um, vale o último na ordem.</small></span></label>
      <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar status'}</button>
    </form>
  </section></div>
}

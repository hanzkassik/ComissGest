import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDays, CircleAlert, ClipboardList, Clock3, Download, MoreHorizontal, Pencil, Plus, Receipt, Search, Trash2, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import type { QueryDocumentSnapshot } from 'firebase/firestore'
import { deleteSale, getSalesForExport, getSalesPage, getSalesTotals, updateSale } from '../services/saleService'
import { LoadingSkeleton } from './LoadingSkeleton'
import { FormField } from './FormField'
import { SaleItemsEditor } from './SaleItemsEditor'
import { PhoneField } from './PhoneField'
import { getCompanyProducts } from '../services/productService'
import { getCompanySaleStatuses } from '../services/saleStatusService'
import { SaleStatusQuickCreateModal } from './SaleStatusQuickCreateModal'
import { saleSchema, type SaleFormValues } from '../schemas/saleSchemas'
import type { Sale, SaleFilters, SaleTotals } from '../types/sale'
import type { SaleStatus } from '../types/saleStatus'
import { useCompany } from '../hooks/useCompany'
import { useAuth } from '../hooks/useAuth'
import { formatBRLFromCents, parseLocalDateStart, toLocalDateInputValue } from '../utils/currency'


interface SalesHistoryProps {
  companyId: string
  companyName: string
  userId: string
  refreshKey?: number
  containerClassName?: string
  initialFilters?: SaleFilters
}

function formatSaleDate(sale: Sale) {
  return sale.soldAt.toDate().toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatRate(rateBps: number) {
  return `${(rateBps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 }).format(quantity)
}

function saleFormValues(sale: Sale): SaleFormValues {
  const soldAt = sale.soldAt.toDate()
  const delivery = sale.deliveryAt?.toDate()
  return {
    customerName: sale.customerName ?? '',
    customerPhone: sale.customerPhone ?? '',
    externalNumber: sale.externalNumber ?? '',
    soldOn: `${soldAt.getFullYear()}-${String(soldAt.getMonth() + 1).padStart(2, '0')}-${String(soldAt.getDate()).padStart(2, '0')}`,
    soldTime: `${String(soldAt.getHours()).padStart(2, '0')}:${String(soldAt.getMinutes()).padStart(2, '0')}`,
    deliveryOn: delivery ? `${delivery.getFullYear()}-${String(delivery.getMonth() + 1).padStart(2, '0')}-${String(delivery.getDate()).padStart(2, '0')}` : '',
    statusId: sale.statusId,
    notes: sale.notes ?? '',
    items: sale.items.map((item) => ({
      itemId: item.itemId,
      amount: `${Math.floor(item.amountCents / 100)},${String(item.amountCents % 100).padStart(2, '0')}`,
      commissionRate: `${Math.floor(item.commissionRateBps / 100)},${String(item.commissionRateBps % 100).padStart(2, '0')}`,
      quantity: String(item.quantity).replace('.', ','),
      productId: item.productId ?? '',
      notes: item.notes ?? '',
    })),
  }
}

function csvCell(value: string) {
  const protectedValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value
  return `"${protectedValue.replaceAll('"', '""')}"`
}

function formatFilterDate(value?: string) {
  return value ? parseLocalDateStart(value).toLocaleDateString('pt-BR') : null
}

function filterDescription(filters: SaleFilters) {
  const start = formatFilterDate(filters.startDate)
  const end = formatFilterDate(filters.endDate)
  if (start && end) return `Período de ${start} a ${end}`
  if (start) return `A partir de ${start}`
  if (end) return `Até ${end}`
  return 'Todo o histórico'
}

const csvNumber = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function buildSalesCsv(companyName: string, sales: Sale[], productNames: Record<string, string>, statuses: Record<string, SaleStatus>, totals: SaleTotals) {
  const rows = [
    ['Empresa', 'Data e hora da venda', 'Cliente', 'Celular', 'Número da venda', 'Entrega prevista', 'Status', 'Observação do pedido', 'Produto', 'Quantidade', 'Valor do item (R$)', 'Comissão (%)', 'Comissão do item (R$)', 'Observação do item'],
    ...sales.flatMap((sale) => sale.items.map((item) => [
      companyName,
      sale.soldAt.toDate().toLocaleString('pt-BR'),
      sale.customerName ?? '',
      sale.customerPhone ?? '',
      sale.externalNumber ?? '',
      sale.deliveryAt?.toDate().toLocaleDateString('pt-BR') ?? '',
      (sale.statusId ? statuses[sale.statusId]?.name : undefined) ?? (sale.statusId ? 'Finalizado' : 'Sem status'),
      sale.notes ?? '',
      item.productId ? productNames[item.productId] ?? 'Produto indisponível' : '',
      formatQuantity(item.quantity),
      csvNumber.format(item.amountCents / 100),
      csvNumber.format(item.commissionRateBps / 100),
      csvNumber.format(item.commissionCents / 100),
      item.notes ?? '',
    ])),
    [],
    ['TOTAL DO PERÍODO', '', '', '', '', '', '', '', '', '', csvNumber.format(totals.amountCents / 100), '', csvNumber.format(totals.commissionCents / 100), `Quantidade de vendas: ${totals.count}`],
  ]
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`
}

function createFilename(companyName: string) {
  const safeName = companyName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `vendas_${safeName || 'empresa'}_${new Date().toISOString().slice(0, 10)}.csv`
}

function summarizeSales(sales: Sale[]): SaleTotals {
  return sales.reduce<SaleTotals>((totals, sale) => ({
    amountCents: totals.amountCents + sale.items.reduce((sum, item) => sum + item.amountCents, 0),
    commissionCents: totals.commissionCents + sale.items.reduce((sum, item) => sum + item.commissionCents, 0),
    count: totals.count + 1,
  }), { amountCents: 0, commissionCents: 0, count: 0 })
}

export function SalesHistory({ companyId, companyName, userId, refreshKey = 0, containerClassName = 'profile-card sales-history-card', initialFilters = {} }: SalesHistoryProps) {
  const [sales, setSales] = useState<Sale[]>([])
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [statuses, setStatuses] = useState<Record<string, SaleStatus>>({})
  const [totals, setTotals] = useState<SaleTotals | null>(null)
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingTotals, setLoadingTotals] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [salesError, setSalesError] = useState('')
  const [totalsError, setTotalsError] = useState('')
  const [exportError, setExportError] = useState('')
  const [draftStart, setDraftStart] = useState('')
  const [draftEnd, setDraftEnd] = useState('')
  const [filters, setFilters] = useState<SaleFilters>(initialFilters)
  const [filterError, setFilterError] = useState('')
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingSaleId, setDeletingSaleId] = useState('')
  const [actionError, setActionError] = useState('')
  const requestVersion = useRef(0)
  const { companies } = useCompany()
  const { currentUser } = useAuth()
  const canManageStatuses = companies.some((company) => company.companyId === companyId)

  const loadFirstPage = useCallback(async () => {
    const version = requestVersion.current + 1
    requestVersion.current = version
    setLoading(true)
    setLoadingMore(false)
    setLoadingTotals(true)
    setSalesError('')
    setTotalsError('')
    setSales([])
    setTotals(null)
    const [pageResult, totalResult] = await Promise.allSettled([getSalesPage(companyId, userId, filters), getSalesTotals(companyId, userId, filters)])
    if (requestVersion.current !== version) return
    if (pageResult.status === 'fulfilled') {
      setSales(pageResult.value.sales)
      setCursor(pageResult.value.cursor)
      setHasMore(pageResult.value.hasMore)
    } else {
      console.error('Falha ao carregar histórico de vendas:', pageResult.reason)
      setSalesError('Não foi possível carregar o histórico. Confira as regras e o índice do Firestore.')
      setCursor(null)
      setHasMore(false)
    }
    if (totalResult.status === 'fulfilled') setTotals(totalResult.value)
    else {
      console.error('Falha ao calcular totais de vendas:', totalResult.reason)
      setTotalsError('Não foi possível calcular os totais do período.')
    }
    setLoading(false)
    setLoadingTotals(false)
  }, [companyId, filters, userId])

  useEffect(() => { void Promise.resolve().then(loadFirstPage) }, [loadFirstPage, refreshKey])
  useEffect(() => {
    let active = true
    void Promise.all([getCompanyProducts(companyId), getCompanySaleStatuses(companyId)]).then(([products, loadedStatuses]) => {
      if (!active) return
      setProductNames(Object.fromEntries(products.map((product) => [product.productId, product.name])))
      setStatuses(Object.fromEntries(loadedStatuses.map((status) => [status.statusId, status])))
    }).catch((error: unknown) => console.error('Falha ao carregar opções do histórico de vendas:', error))
    return () => { active = false }
  }, [companyId, refreshKey])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilterError('')
    if (draftStart && draftEnd && draftStart > draftEnd) {
      setFilterError('A data inicial deve ser anterior ou igual à data final.')
      return
    }
    setFilters({ ...(draftStart ? { startDate: draftStart } : {}), ...(draftEnd ? { endDate: draftEnd } : {}) })
  }

  function clearFilters() {
    setDraftStart('')
    setDraftEnd('')
    setFilterError('')
    setFilters({})
  }

  async function loadMore() {
    if (!cursor || loadingMore) return
    const version = requestVersion.current
    setLoadingMore(true)
    setSalesError('')
    try {
      const page = await getSalesPage(companyId, userId, filters, cursor)
      if (requestVersion.current !== version) return
      setSales((current) => [...current, ...page.sales])
      setCursor(page.cursor)
      setHasMore(page.hasMore)
    } catch {
      if (requestVersion.current === version) setSalesError('Não foi possível carregar mais vendas. Tente novamente.')
    } finally {
      if (requestVersion.current === version) setLoadingMore(false)
    }
  }

  async function exportCsv() {
    setExportError('')
    setExporting(true)
    try {
      const allSales = await getSalesForExport(companyId, userId, filters)
      if (allSales.length === 0) return
      const exportTotals = summarizeSales(allSales)
      const blob = new Blob([buildSalesCsv(companyName, allSales, productNames, statuses, exportTotals)], { type: 'text/csv;charset=utf-8' })
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = createFilename(companyName)
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
    } catch (error: unknown) {
      console.error('Falha ao exportar vendas CSV:', error)
      setExportError('Não foi possível exportar os dados. Verifique sua conexão e tente novamente.')
    } finally {
      setExporting(false)
    }
  }

  async function saveEdit(values: SaleFormValues) {
    if (!editingSale || !currentUser) return
    setSavingEdit(true)
    setActionError('')
    try {
      await updateSale(companyId, editingSale.saleId, currentUser.uid, values)
      setEditingSale(null)
      await loadFirstPage()
    } catch (error) {
      console.error('Falha ao editar venda:', error)
      setActionError('Não foi possível salvar as alterações. Verifique a conexão e as regras do Firestore.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function confirmDelete() {
    if (!deletingSale || !currentUser) return
    setDeletingSaleId(deletingSale.saleId)
    setActionError('')
    try {
      await deleteSale(companyId, deletingSale.saleId, currentUser.uid)
      setDeletingSale(null)
      await loadFirstPage()
    } catch (error) {
      console.error('Falha ao excluir venda:', error)
      setActionError('Não foi possível excluir esta venda. Verifique sua conexão e tente novamente.')
    } finally {
      setDeletingSaleId('')
    }
  }

  function saleActions(sale: Sale) {
    return <details className="sale-actions-menu"><summary aria-label={`Ações da venda de ${formatSaleDate(sale)}`} title="Ações da venda"><MoreHorizontal size={18} /></summary><div className="sale-actions-popover" role="menu">
      <button type="button" role="menuitem" title={sale.legacyFormat ? 'Ao salvar, esta venda antiga será convertida para o formato atual.' : undefined} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); setEditingSale(sale); setActionError('') }}><Pencil size={15} />Editar venda</button>
      <button type="button" role="menuitem" className="is-danger" disabled={sale.legacyFormat || deletingSaleId === sale.saleId} title={sale.legacyFormat ? 'Disponível após a migração dos registros antigos.' : undefined} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); setDeletingSale(sale) }}><Trash2 size={15} />Excluir venda</button>
    </div></details>
  }

  function saleHeader(sale: Sale) {
    const status = sale.statusId ? statuses[sale.statusId] : undefined
    const itemTotal = sale.items.reduce((total, item) => total + item.amountCents, 0)
    const commissionTotal = sale.items.reduce((total, item) => total + item.commissionCents, 0)
    return <div className="sales-order-header"><div className="sales-order-title"><strong>{sale.customerName || 'Venda sem cliente'}</strong><span>{formatSaleDate(sale)}{sale.externalNumber ? ` · Nº ${sale.externalNumber}` : ''}{sale.customerPhone ? ` · ${sale.customerPhone}` : ''}</span>{sale.notes && <small>{sale.notes}</small>}</div><span className={`sales-order-status${status?.active === false ? ' is-inactive' : ''}`}>{status?.name ?? (sale.statusId ? 'Finalizado' : 'Sem status')}{status?.active === false && <small>Status desativado</small>}</span><div className="sales-order-totals"><span>Venda <strong>{formatBRLFromCents(itemTotal)}</strong></span><span>Comissão <strong>{formatBRLFromCents(commissionTotal)}</strong></span></div>{saleActions(sale)}</div>
  }

  return <>
    <section className={containerClassName} aria-labelledby="sales-history-heading">
      <div className="sale-card-title sales-history-title"><span className="sale-card-icon"><ClipboardList size={18} /></span><div><h2 id="sales-history-heading">Histórico de vendas</h2><p>Somente suas vendas nesta empresa.</p></div><button className="quiet-button sales-export-button" type="button" onClick={() => void exportCsv()} disabled={exporting || loadingTotals || totals?.count === 0}><Download size={15} />{exporting ? 'Preparando…' : 'Exportar CSV'}</button></div>
      <form className="sales-filters" onSubmit={applyFilters}><label>De<input type="date" max={toLocalDateInputValue()} value={draftStart} onChange={(event) => setDraftStart(event.target.value)} /></label><label>Até<input type="date" max={toLocalDateInputValue()} value={draftEnd} onChange={(event) => setDraftEnd(event.target.value)} /></label><button className="quiet-button filter-button" type="submit"><Search size={15} /> Filtrar</button>{(draftStart || draftEnd || filters.startDate || filters.endDate) && <button className="filter-clear" type="button" onClick={clearFilters}>Limpar</button>}</form>
      {filterError && <p className="field-error" role="alert">{filterError}</p>}{totalsError && <p className="sales-history-total-error" role="status"><CircleAlert size={14} />{totalsError}</p>}{salesError && <p className="sales-history-total-error" role="alert"><CircleAlert size={14} />{salesError}<button type="button" onClick={() => void loadFirstPage()}>Tentar novamente</button></p>}{exportError && <p className="sales-history-total-error" role="alert"><CircleAlert size={14} />{exportError}</p>}{actionError && <p className="sales-history-total-error" role="alert"><CircleAlert size={14} />{actionError}</p>}
      {loading ? <LoadingSkeleton variant="sales-history" page={false} /> : sales.length === 0 ? <div className="sales-empty-history"><span><CalendarDays size={20} /></span><h3>Nenhuma venda encontrada</h3><p>Não há vendas para o período selecionado.</p></div> : <>
        <div className="sales-order-list">{sales.map((sale) => <article className="sales-order-card" key={sale.saleId}>{saleHeader(sale)}{sale.deliveryAt && <div className="sales-order-delivery">Entrega prevista: {sale.deliveryAt.toDate().toLocaleDateString('pt-BR')}</div>}<div className="sales-order-items">{sale.items.map((item) => <div className="sales-order-item" key={item.itemId}><div className="sales-order-item-name"><strong>{item.productId ? productNames[item.productId] ?? 'Produto indisponível' : 'Item sem produto'}</strong><span>Quantidade: {formatQuantity(item.quantity)}</span>{item.notes && <small>{item.notes}</small>}</div><div><span>Venda</span><strong>{formatBRLFromCents(item.amountCents)}</strong></div><div className="is-commission"><span>Comissão <small>{formatRate(item.commissionRateBps)}</small></span><strong>{formatBRLFromCents(item.commissionCents)}</strong></div></div>)}</div></article>)}</div>
        {hasMore && <button className="quiet-button load-more-button" type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Carregando…' : 'Carregar mais vendas'}</button>}
      </>}
      <div className="sales-period-total" aria-live="polite"><div className="sales-period-total-heading"><strong>Total do período</strong><span>{filterDescription(filters)}</span></div><div className="sales-period-total-values"><div><span>Vendas</span><strong>{loadingTotals ? '…' : totals ? formatBRLFromCents(totals.amountCents) : '—'}</strong></div><div className="is-commission"><span>Comissões</span><strong>{loadingTotals ? '…' : totals ? formatBRLFromCents(totals.commissionCents) : '—'}</strong></div><div><span>Quantidade de vendas</span><strong>{loadingTotals ? '…' : totals ? totals.count.toLocaleString('pt-BR') : '—'}</strong></div></div></div>
    </section>
    {editingSale && <SaleEditModal key={editingSale.saleId} sale={editingSale} companyId={companyId} statuses={Object.values(statuses)} canManageStatuses={canManageStatuses} saving={savingEdit} onClose={() => !savingEdit && setEditingSale(null)} onSave={saveEdit} onProductCreated={(productId, name) => setProductNames((current) => ({ ...current, [productId]: name }))} onStatusCreated={(status) => setStatuses((current) => ({ ...current, [status.statusId]: status }))} />}
    {deletingSale && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingSaleId) setDeletingSale(null) }}><section className="company-modal" role="alertdialog" aria-modal="true" aria-labelledby="sale-delete-title"><div className="company-modal-heading"><span className="create-icon"><Trash2 size={18} /></span><button className="modal-close-button" type="button" aria-label="Fechar" onClick={() => setDeletingSale(null)} disabled={Boolean(deletingSaleId)}><X size={18} /></button></div><h2 id="sale-delete-title">Excluir venda?</h2><p>Esta ação excluirá o cabeçalho e todos os {deletingSale.items.length} item(ns) desta venda.</p>{actionError && <p className="field-error" role="alert">{actionError}</p>}<div className="sale-delete-actions"><button className="quiet-button" type="button" onClick={() => setDeletingSale(null)} disabled={Boolean(deletingSaleId)}>Cancelar</button><button className="primary-button" type="button" onClick={() => void confirmDelete()} disabled={Boolean(deletingSaleId)}>{deletingSaleId ? 'Excluindo…' : 'Excluir venda'}</button></div></section></div>}
  </>
}

function SaleEditModal({ sale, companyId, statuses, canManageStatuses, saving, onClose, onSave, onProductCreated, onStatusCreated }: {
  sale: Sale
  companyId: string
  statuses: SaleStatus[]
  canManageStatuses: boolean
  saving: boolean
  onClose: () => void
  onSave: (values: SaleFormValues) => Promise<void>
  onProductCreated: (productId: string, name: string) => void
  onStatusCreated: (status: SaleStatus) => void
}) {
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<SaleFormValues>({ resolver: zodResolver(saleSchema), defaultValues: saleFormValues(sale) })
  const items = useWatch({ control, name: 'items' }) ?? []
  const [quickStatusOpen, setQuickStatusOpen] = useState(false)
  const activeStatuses = statuses.filter((status) => status.active)
  const currentStatus = statuses.find((status) => status.statusId === sale.statusId)
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}><section className="company-modal sale-edit-modal sale-order-edit-modal" role="dialog" aria-modal="true" aria-labelledby="sale-edit-title">
    <div className="company-modal-heading"><span className="create-icon"><Pencil size={18} /></span><button className="modal-close-button" type="button" aria-label="Fechar" onClick={onClose} disabled={saving}><X size={18} /></button></div>
    <h2 id="sale-edit-title">Editar venda</h2><p>Atualize os dados do pedido e seus itens.</p>
    <form className="form-stack" onSubmit={handleSubmit((values) => void onSave(values))} noValidate>
      <FormField id={`edit-sale-customer-${sale.saleId}`} label="Nome do cliente (opcional)" icon={UserRound} maxLength={160} placeholder="Nome do cliente" registration={register('customerName')} />
      <Controller control={control} name="customerPhone" render={({ field }) => <PhoneField id={`edit-sale-phone-${sale.saleId}`} value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} />} />
      <FormField id={`edit-sale-number-${sale.saleId}`} label="Número da venda (opcional)" icon={Receipt} maxLength={100} placeholder="Identificador externo" registration={register('externalNumber')} />
      <div className="sale-datetime-fields"><FormField id={`edit-sale-date-${sale.saleId}`} label="Data da venda" icon={CalendarDays} type="date" max={toLocalDateInputValue()} registration={register('soldOn')} /><FormField id={`edit-sale-time-${sale.saleId}`} label="Hora da venda" icon={Clock3} type="time" registration={register('soldTime')} /></div>
      <FormField id={`edit-sale-delivery-${sale.saleId}`} label="Data prevista de entrega (opcional)" icon={CalendarDays} type="date" registration={register('deliveryOn')} />
      <div className="sale-status-select-wrap"><label className="field-label" htmlFor={`edit-sale-status-${sale.saleId}`}>Status</label><div className="sale-status-select-control"><select id={`edit-sale-status-${sale.saleId}`} {...register('statusId')}><option value={sale.statusId ?? ''} disabled={currentStatus?.active === false}>{currentStatus?.name ?? (sale.statusId ? 'Status atual' : 'Sem status')}{currentStatus?.active === false ? ' (desativado)' : ''}</option>{activeStatuses.filter((status) => status.statusId !== sale.statusId).map((status) => <option key={status.statusId} value={status.statusId}>{status.name}</option>)}</select>{canManageStatuses && <button type="button" aria-label="Adicionar status" onClick={() => setQuickStatusOpen(true)}><Plus size={17} /></button>}</div></div>
      <div className="sale-form-section"><div className="sale-items-heading"><div><h3>Itens da venda</h3><p>O valor informado já representa o total do item. A quantidade não altera os cálculos.</p></div></div><SaleItemsEditor companyId={companyId} items={items} onItemsChange={(next) => setValue('items', next, { shouldDirty: true, shouldValidate: true })} onProductCreated={onProductCreated} />{errors.items?.message && <span className="field-error" role="alert">{errors.items.message}</span>}</div>
      <label className="notes-field">Observação do pedido <span>(opcional)</span><textarea rows={3} maxLength={500} {...register('notes')} /></label>
      {Object.keys(errors).length > 0 && <p className="field-error" role="alert">Confira os dados dos campos e tente novamente.</p>}
      <div className="sale-delete-actions"><button className="quiet-button" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button></div>
    </form>
    {quickStatusOpen && <SaleStatusQuickCreateModal companyId={companyId} onClose={() => setQuickStatusOpen(false)} onCreated={(status) => { onStatusCreated(status); setValue('statusId', status.statusId, { shouldDirty: true }); setQuickStatusOpen(false) }} />}
  </section></div>
}

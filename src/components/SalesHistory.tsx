import { CalendarDays, CircleAlert, ClipboardList, Download, MoreHorizontal, Pencil, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { QueryDocumentSnapshot } from 'firebase/firestore'
import { deleteSale, getSalesForExport, getSalesPage, getSalesTotals, updateSale } from '../services/saleService'
import { saleSchema, type SaleFormValues } from '../schemas/saleSchemas'
import type { Sale, SaleFilters, SaleTotals } from '../types/sale'
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
  return sale.soldAt.toDate().toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatRate(rateBps: number) {
  return `${(rateBps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

function saleFormValues(sale: Sale): SaleFormValues {
  const soldAt = sale.soldAt.toDate()
  return {
    soldOn: `${soldAt.getFullYear()}-${String(soldAt.getMonth() + 1).padStart(2, '0')}-${String(soldAt.getDate()).padStart(2, '0')}`,
    soldTime: `${String(soldAt.getHours()).padStart(2, '0')}:${String(soldAt.getMinutes()).padStart(2, '0')}`,
    amount: `${Math.floor(sale.amountCents / 100)},${String(sale.amountCents % 100).padStart(2, '0')}`,
    commissionRate: `${Math.floor(sale.commissionRateBps / 100)},${String(sale.commissionRateBps % 100).padStart(2, '0')}`,
    notes: sale.notes ?? '',
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

function buildSalesCsv(companyName: string, sales: Sale[], totals: SaleTotals) {
  const rows = [
    ['Empresa', 'Data e hora', 'Valor da venda (R$)', 'Comissão (%)', 'Comissão (R$)', 'Observação'],
    ...sales.map((sale) => [
      companyName,
      sale.soldAt.toDate().toLocaleString('pt-BR'),
      csvNumber.format(sale.amountCents / 100),
      csvNumber.format(sale.commissionRateBps / 100),
      csvNumber.format(sale.commissionCents / 100),
      sale.notes ?? '',
    ]),
    [],
    ['TOTAL DO PERÍODO', '', csvNumber.format(totals.amountCents / 100), '', csvNumber.format(totals.commissionCents / 100), `Quantidade de vendas: ${totals.count}`],
  ]
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`
}

function createFilename(companyName: string) {
  const safeName = companyName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `vendas_${safeName || 'empresa'}_${new Date().toISOString().slice(0, 10)}.csv`
}

function summarizeSales(sales: Sale[]): SaleTotals {
  return sales.reduce<SaleTotals>((totals, sale) => ({
    amountCents: totals.amountCents + sale.amountCents,
    commissionCents: totals.commissionCents + sale.commissionCents,
    count: totals.count + 1,
  }), { amountCents: 0, commissionCents: 0, count: 0 })
}

export function SalesHistory({ companyId, companyName, userId, refreshKey = 0, containerClassName = 'profile-card sales-history-card', initialFilters = {} }: SalesHistoryProps) {
  const [sales, setSales] = useState<Sale[]>([])
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
  const [editValues, setEditValues] = useState<SaleFormValues | null>(null)
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingSaleId, setDeletingSaleId] = useState('')
  const requestVersion = useRef(0)

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
    const [pageResult, totalResult] = await Promise.allSettled([
      getSalesPage(companyId, userId, filters),
      getSalesTotals(companyId, userId, filters),
    ])
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

  useEffect(() => {
    void Promise.resolve().then(loadFirstPage)
  }, [loadFirstPage, refreshKey])

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
      const blob = new Blob([buildSalesCsv(companyName, allSales, exportTotals)], { type: 'text/csv;charset=utf-8' })
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

  function beginEdit(sale: Sale) {
    setEditingSale(sale)
    setEditValues(saleFormValues(sale))
    setEditErrors({})
    setEditError('')
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingSale || !editValues) return
    const parsed = saleSchema.safeParse(editValues)
    if (!parsed.success) {
      setEditErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      return
    }
    setSavingEdit(true)
    setEditError('')
    try {
      await updateSale(companyId, editingSale.saleId, parsed.data)
      setEditingSale(null)
      setEditValues(null)
      await loadFirstPage()
    } catch (error) {
      console.error('Falha ao editar venda:', error)
      setEditError('Não foi possível salvar as alterações. Verifique a conexão e as regras do Firestore.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function confirmDelete(sale: Sale) {
    if (!window.confirm('Deseja excluir esta venda? Esta ação não pode ser desfeita.')) return
    setDeletingSaleId(sale.saleId)
    try {
      await deleteSale(companyId, sale.saleId)
      await loadFirstPage()
    } catch (error) {
      console.error('Falha ao excluir venda:', error)
      setSalesError('Não foi possível excluir esta venda. Verifique a conexão e tente novamente.')
    } finally {
      setDeletingSaleId('')
    }
  }

  function saleActions(sale: Sale) {
    return <details className="sale-actions-menu">
      <summary aria-label={`Ações da venda de ${formatSaleDate(sale)}`} title="Ações da venda"><MoreHorizontal size={18} /></summary>
      <div className="sale-actions-popover" role="menu">
        <button type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); beginEdit(sale) }}><Pencil size={15} />Editar venda</button>
        <button type="button" role="menuitem" className="is-danger" disabled={deletingSaleId === sale.saleId} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); void confirmDelete(sale) }}><Trash2 size={15} />Excluir venda</button>
      </div>
    </details>
  }

  return (
    <>
    <section className={containerClassName} aria-labelledby="sales-history-heading">
      <div className="sale-card-title sales-history-title">
        <span className="sale-card-icon"><ClipboardList size={18} /></span>
        <div><h2 id="sales-history-heading">Histórico de vendas</h2><p>Somente suas vendas nesta empresa.</p></div>
        <button className="quiet-button sales-export-button" type="button" onClick={() => void exportCsv()} disabled={exporting || loadingTotals || totals?.count === 0}>
          <Download size={15} />{exporting ? 'Preparando…' : 'Exportar CSV'}
        </button>
      </div>
      <form className="sales-filters" onSubmit={applyFilters}>
        <label>De<input type="date" value={draftStart} onChange={(event) => setDraftStart(event.target.value)} /></label>
        <label>Até<input type="date" value={draftEnd} onChange={(event) => setDraftEnd(event.target.value)} /></label>
        <button className="quiet-button filter-button" type="submit"><Search size={15} /> Filtrar</button>
        {(draftStart || draftEnd || filters.startDate || filters.endDate) && <button className="filter-clear" type="button" onClick={clearFilters}>Limpar</button>}
      </form>
      {filterError && <p className="field-error" role="alert">{filterError}</p>}
      {totalsError && <p className="sales-history-total-error" role="status"><CircleAlert size={14} />{totalsError}</p>}
      {salesError && <p className="sales-history-total-error" role="alert"><CircleAlert size={14} />{salesError}<button type="button" onClick={() => void loadFirstPage()}>Tentar novamente</button></p>}
      {exportError && <p className="sales-history-total-error" role="alert"><CircleAlert size={14} />{exportError}</p>}
      {loading ? <div className="sales-loading">Carregando vendas…</div> : sales.length === 0 ? (
        <div className="sales-empty-history"><span><CalendarDays size={20} /></span><h3>Nenhuma venda encontrada</h3><p>Não há vendas para o período selecionado.</p></div>
      ) : (
        <>
          <div className="sales-table-wrap"><table className="sales-table"><thead><tr><th>Venda</th><th>Valor</th><th>Comissão</th><th><span className="visually-hidden">Ações</span></th></tr></thead><tbody>
            {sales.map((sale) => <tr key={sale.saleId}><td><strong>{formatSaleDate(sale)}</strong>{sale.notes && <span>{sale.notes}</span>}</td><td>{formatBRLFromCents(sale.amountCents)}</td><td><strong>{formatBRLFromCents(sale.commissionCents)}</strong><span>{formatRate(sale.commissionRateBps)}</span></td><td>{saleActions(sale)}</td></tr>)}
          </tbody></table></div>
          <div className="sales-history-mobile-list">
            {sales.map((sale) => <article className="sales-history-mobile-card" key={sale.saleId}>
              <div className="sales-history-mobile-heading"><strong>{formatSaleDate(sale)}</strong><span>{formatRate(sale.commissionRateBps)}</span></div>
              <div className="sales-history-mobile-commission"><span>Comissão</span><strong>{formatBRLFromCents(sale.commissionCents)}</strong></div>
              <div className="sales-history-mobile-amount"><span>Venda</span><strong>{formatBRLFromCents(sale.amountCents)}</strong></div>
              {sale.notes && <p>{sale.notes}</p>}
              <div className="sales-history-mobile-actions">{saleActions(sale)}</div>
            </article>)}
          </div>
          {hasMore && <button className="quiet-button load-more-button" type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Carregando…' : 'Carregar mais vendas'}</button>}
        </>
      )}
      <div className="sales-period-total" aria-live="polite">
        <div className="sales-period-total-heading"><strong>Total do período</strong><span>{filterDescription(filters)}</span></div>
        <div className="sales-period-total-values">
          <div><span>Vendas</span><strong>{loadingTotals ? '…' : totals ? formatBRLFromCents(totals.amountCents) : '—'}</strong></div>
          <div className="is-commission"><span>Comissões</span><strong>{loadingTotals ? '…' : totals ? formatBRLFromCents(totals.commissionCents) : '—'}</strong></div>
          <div><span>Registros</span><strong>{loadingTotals ? '…' : totals ? totals.count.toLocaleString('pt-BR') : '—'}</strong></div>
        </div>
      </div>
    </section>
    {editingSale && editValues && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingEdit) setEditingSale(null) }}>
      <section className="company-modal sale-edit-modal" role="dialog" aria-modal="true" aria-labelledby="sale-edit-title">
        <div className="company-modal-heading"><span className="create-icon"><Pencil size={18} /></span><button className="modal-close-button" type="button" aria-label="Fechar" onClick={() => setEditingSale(null)} disabled={savingEdit}><X size={18} /></button></div>
        <h2 id="sale-edit-title">Editar venda</h2><p>Atualize os dados da venda. A comissão será recalculada ao salvar.</p>
        <form className="form-stack" onSubmit={(event) => void saveEdit(event)} noValidate>
          <div className="sale-datetime-fields">
            <label className="field-label">Data da venda<input type="date" max={toLocalDateInputValue()} value={editValues.soldOn} onChange={(event) => setEditValues({ ...editValues, soldOn: event.target.value })} />{editErrors.soldOn && <span className="field-error">{editErrors.soldOn}</span>}</label>
            <label className="field-label">Hora da venda<input type="time" value={editValues.soldTime} onChange={(event) => setEditValues({ ...editValues, soldTime: event.target.value })} />{editErrors.soldTime && <span className="field-error">{editErrors.soldTime}</span>}</label>
          </div>
          <label className="field-label">Valor da venda (R$)<input inputMode="decimal" value={editValues.amount} onChange={(event) => setEditValues({ ...editValues, amount: event.target.value })} />{editErrors.amount && <span className="field-error">{editErrors.amount}</span>}</label>
          <label className="field-label">Comissão (%)<input inputMode="decimal" value={editValues.commissionRate} onChange={(event) => setEditValues({ ...editValues, commissionRate: event.target.value })} />{editErrors.commissionRate && <span className="field-error">{editErrors.commissionRate}</span>}</label>
          <label className="field-label">Observação <span className="field-optional">(opcional)</span><textarea rows={3} maxLength={500} placeholder="Detalhes sobre esta venda" value={editValues.notes ?? ''} onChange={(event) => setEditValues({ ...editValues, notes: event.target.value })} />{editErrors.notes && <span className="field-error">{editErrors.notes}</span>}</label>
          {editError && <p className="sales-history-total-error" role="alert"><CircleAlert size={14} />{editError}</p>}
          <button className="primary-button" type="submit" disabled={savingEdit}>{savingEdit ? 'Salvando…' : 'Salvar alterações'}</button>
        </form>
      </section>
    </div>}
    </>
  )
}

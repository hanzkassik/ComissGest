import { CalendarDays, ChevronDown, CircleAlert, ClipboardList, Download, MoreHorizontal, Pencil, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { QueryDocumentSnapshot } from 'firebase/firestore'
import { deleteSale, getSaleById, getSalesForExport, getSalesPage, getSalesTotals, moveSaleItemToStatus, moveSaleToStatus, updateSale } from '../services/saleService'
import { LoadingSkeleton } from './LoadingSkeleton'
import { getCompanyProducts } from '../services/productService'
import { getCompanySaleStatuses, resolveFinalizedSaleStatus } from '../services/saleStatusService'
import type { SaleFormValues } from '../schemas/saleSchemas'
import { SaleEditModal } from './SaleEditModal'
import type { Sale, SaleFilters, SaleItem, SaleTotals } from '../types/sale'
import type { SaleStatus } from '../types/saleStatus'
import { useCompany } from '../hooks/useCompany'
import { useAuth } from '../hooks/useAuth'
import { formatBRLFromCents, parseLocalDateStart, toLocalDateInputValue } from '../utils/currency'
import { SaleStatusBadge } from './SaleStatusBadge'
import { SaleViewModal } from './SaleViewModal'


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

function csvCell(value: string) {
  const protectedValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value
  return `"${protectedValue.replaceAll('"', '""')}"`
}

function formatFilterDate(value?: string) {
  return value ? parseLocalDateStart(value).toLocaleDateString('pt-BR') : null
}

function statusFilterLabel(statusId: string, statuses: Record<string, SaleStatus>) {
  const status = statuses[statusId]
  return status ? `${status.name}${status.active ? '' : ' (inativo)'}` : 'Status indisponível'
}

function filterDescription(filters: SaleFilters, statuses: Record<string, SaleStatus>) {
  const start = formatFilterDate(filters.startDate)
  const end = formatFilterDate(filters.endDate)
  const descriptions = [
    start && end ? `Período de ${start} a ${end}` : start ? `A partir de ${start}` : end ? `Até ${end}` : 'Todo o histórico',
  ]
  if (filters.orderStatusId) {
    descriptions.push(`Pedido: ${statusFilterLabel(filters.orderStatusId, statuses)}`)
  }
  if (filters.itemStatusId) {
    descriptions.push(`Itens: ${statusFilterLabel(filters.itemStatusId, statuses)}`)
  }
  return descriptions.join(' · ')
}

const csvNumber = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function buildSalesCsv(companyName: string, sales: Sale[], productNames: Record<string, string>, statuses: Record<string, SaleStatus>, totals: SaleTotals) {
  const rows = [
    ['Empresa', 'Data e hora da venda', 'Cliente', 'Celular', 'Número da venda', 'Entrega prevista do pedido', 'Status do pedido', 'Observação do pedido', 'Produto', 'Quantidade', 'Status do item', 'Entrega prevista do item', 'Valor unitário (R$)', 'Total do item (R$)', 'Comissão (%)', 'Comissão do item (R$)', 'Observação do item'],
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
      (item.statusId ? statuses[item.statusId]?.name : undefined) ?? '',
      item.deliveryAt?.toDate().toLocaleDateString('pt-BR') ?? '',
      csvNumber.format((item.unitPriceCents ?? Math.round(item.amountCents / item.quantity)) / 100),
      csvNumber.format(item.amountCents / 100),
      csvNumber.format(item.commissionRateBps / 100),
      csvNumber.format(item.commissionCents / 100),
      item.notes ?? '',
    ])),
    [],
    ['TOTAL DO PERÍODO', '', '', '', '', '', '', '', '', '', '', '', '', csvNumber.format(totals.amountCents / 100), '', csvNumber.format(totals.commissionCents / 100), `Quantidade de vendas: ${totals.count}`],
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

function normalizeSearchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}

function matchesSearch(sale: Sale, query: string) {
  const textQuery = normalizeSearchText(query)
  const digitQuery = query.replace(/\D/g, '')
  const phone = sale.customerPhone ?? ''
  return [sale.customerName, sale.externalNumber, phone].some((value) => value && normalizeSearchText(value).includes(textQuery))
    || (digitQuery.length > 0 && phone.replace(/\D/g, '').includes(digitQuery))
}

function hasSaleOverlayState(state: unknown) {
  return typeof state === 'object' && state !== null && 'saleOverlay' in state && state.saleOverlay === true
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
  const [draftStart, setDraftStart] = useState(initialFilters.startDate ?? '')
  const [draftEnd, setDraftEnd] = useState(initialFilters.endDate ?? '')
  const [draftOrderStatusId, setDraftOrderStatusId] = useState(initialFilters.orderStatusId ?? '')
  const [draftItemStatusId, setDraftItemStatusId] = useState(initialFilters.itemStatusId ?? '')
  const [filters, setFilters] = useState<SaleFilters>(initialFilters)
  const [filterError, setFilterError] = useState('')
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [viewingSale, setViewingSale] = useState<Sale | null>(null)
  const [saleRouteLoading, setSaleRouteLoading] = useState(false)
  const [saleRouteError, setSaleRouteError] = useState('')
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    sale: Sale
    status: SaleStatus
    itemId?: string
    finalizedSaleStatus?: SaleStatus
  } | null>(null)
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  const [finalizingSale, setFinalizingSale] = useState(false)
  const [deletingSaleId, setDeletingSaleId] = useState('')
  const [actionError, setActionError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Sale[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchRefreshKey, setSearchRefreshKey] = useState(0)
  const historySectionRef = useRef<HTMLElement | null>(null)
  const requestVersion = useRef(0)
  const searchVersion = useRef(0)
  const location = useLocation()
  const navigate = useNavigate()
  const saleRouteParts = (useParams()['*'] ?? '').split('/').filter(Boolean)
  const routeSaleId = saleRouteParts[0] ?? ''
  const routeAction = saleRouteParts[1] ?? ''
  const invalidSaleRoute = saleRouteParts.length > 2 || (routeAction !== '' && routeAction !== 'editar')
  const salesPath = `/empresas/${companyId}/vendas`
  const { companies } = useCompany()
  const { currentUser } = useAuth()
  const canManageStatuses = companies.some((company) => company.companyId === companyId)

  useEffect(() => {
    function closeStatusMenusOnOutsidePointer(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      historySectionRef.current?.querySelectorAll<HTMLDetailsElement>('.sales-order-status-menu[open]').forEach((menu) => {
        if (!menu.contains(target)) menu.open = false
      })
    }

    document.addEventListener('pointerdown', closeStatusMenusOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeStatusMenusOnOutsidePointer)
  }, [])

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

  useEffect(() => {
    let active = true
    void Promise.resolve().then(async () => {
      if (!routeSaleId) {
        setSaleRouteLoading(false)
        setSaleRouteError('')
        setViewingSale(null)
        setEditingSale(null)
        return
      }
      if (invalidSaleRoute) {
        navigate(salesPath, { replace: true })
        return
      }

      setSaleRouteLoading(true)
      setSaleRouteError('')
      if (routeAction !== 'editar') setEditingSale(null)
      try {
        const sale = await getSaleById(companyId, routeSaleId, userId)
        if (!active) return
        setViewingSale(sale)
        if (routeAction === 'editar') setEditingSale(sale)
      } catch (error: unknown) {
        if (!active) return
        console.error('Falha ao carregar venda pela rota:', error)
        setSaleRouteError(error instanceof Error && error.message === 'SALE_NOT_FOUND'
          ? 'O pedido não foi encontrado ou não está disponível nesta conta.'
          : 'Não foi possível carregar o pedido. Verifique a conexão e tente novamente.')
        setViewingSale(null)
        setEditingSale(null)
      } finally {
        if (active) setSaleRouteLoading(false)
      }
    })
    return () => { active = false }
  }, [companyId, invalidSaleRoute, navigate, routeAction, routeSaleId, salesPath, userId])

  useEffect(() => {
    const queryText = searchQuery.trim()
    if (!queryText) {
      setSearchResults(null)
      setSearching(false)
      setSearchError('')
      return
    }

    const version = searchVersion.current + 1
    searchVersion.current = version
    setSearching(true)
    setSearchResults(null)
    setSearchError('')
    const timeout = window.setTimeout(() => {
      void getSalesForExport(companyId, userId, filters).then((allSales) => {
        if (searchVersion.current === version) setSearchResults(allSales.filter((sale) => matchesSearch(sale, queryText)))
      }).catch((error: unknown) => {
        if (searchVersion.current !== version) return
        console.error('Falha ao pesquisar histórico de vendas:', error)
        setSearchError('Não foi possível pesquisar as vendas. Tente novamente.')
      }).finally(() => {
        if (searchVersion.current === version) setSearching(false)
      })
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      if (searchVersion.current === version) searchVersion.current += 1
    }
  }, [companyId, filters, refreshKey, searchQuery, searchRefreshKey, userId])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilterError('')
    if (draftStart && draftEnd && draftStart > draftEnd) {
      setFilterError('A data inicial deve ser anterior ou igual à data final.')
      return
    }
    setFilters({
      ...(draftStart ? { startDate: draftStart } : {}),
      ...(draftEnd ? { endDate: draftEnd } : {}),
      ...(draftOrderStatusId ? { orderStatusId: draftOrderStatusId } : {}),
      ...(draftItemStatusId ? { itemStatusId: draftItemStatusId } : {}),
    })
    setFiltersPanelOpen(false)
  }

  function clearFilters() {
    setDraftStart('')
    setDraftEnd('')
    setDraftOrderStatusId('')
    setDraftItemStatusId('')
    setFilterError('')
    setFilters({})
  }

  function removeAppliedFilter(key: keyof SaleFilters) {
    const nextFilters = { ...filters }
    delete nextFilters[key]
    setFilters(nextFilters)
    if (key === 'startDate') setDraftStart('')
    if (key === 'endDate') setDraftEnd('')
    if (key === 'orderStatusId') setDraftOrderStatusId('')
    if (key === 'itemStatusId') setDraftItemStatusId('')
  }

  function openSale(sale: Sale) {
    setViewingSale(sale)
    setSaleRouteError('')
    navigate(`${salesPath}/${encodeURIComponent(sale.saleId)}`, { state: { saleOverlay: true } })
  }

  function openSaleEdit(sale: Sale) {
    setEditingSale(sale)
    setActionError('')
    navigate(`${salesPath}/${encodeURIComponent(sale.saleId)}/editar`, { state: { saleOverlay: true } })
  }

  function closeSaleView() {
    if (hasSaleOverlayState(location.state)) navigate(-1)
    else navigate(salesPath, { replace: true })
  }

  function closeSaleEdit() {
    if (hasSaleOverlayState(location.state)) navigate(-1)
    else navigate(`${salesPath}/${encodeURIComponent(routeSaleId)}`, { replace: true })
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
      const updatedSale = await updateSale(companyId, editingSale.saleId, currentUser.uid, values)
      setViewingSale((current) => current?.saleId === updatedSale.saleId ? updatedSale : current)
      setEditingSale(null)
      setSearchRefreshKey((key) => key + 1)
      await loadFirstPage()
      if (hasSaleOverlayState(location.state)) navigate(-1)
      else navigate(`${salesPath}/${encodeURIComponent(updatedSale.saleId)}`, { replace: true })
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
      setSearchRefreshKey((key) => key + 1)
      await loadFirstPage()
    } catch (error) {
      console.error('Falha ao excluir venda:', error)
      setActionError('Não foi possível excluir esta venda. Verifique sua conexão e tente novamente.')
    } finally {
      setDeletingSaleId('')
    }
  }

  async function confirmStatusChange(finalizeSale = false) {
    if (!pendingStatusChange || !currentUser || changingStatus) return
    const { sale, status, itemId, finalizedSaleStatus } = pendingStatusChange
    const nextSaleStatusId = finalizeSale ? finalizedSaleStatus?.statusId : undefined
    if (finalizeSale && (!itemId || !nextSaleStatusId)) {
      setActionError('O status finalizador não está mais disponível. Atualize o histórico e tente novamente.')
      return
    }
    setChangingStatus(true)
    setFinalizingSale(finalizeSale)
    setActionError('')
    try {
      if (itemId) await moveSaleItemToStatus(companyId, sale.saleId, currentUser.uid, itemId, status.statusId, nextSaleStatusId)
      else await moveSaleToStatus(companyId, sale.saleId, currentUser.uid, status.statusId)
      const updateStatus = (current: Sale) => {
        if (current.saleId !== sale.saleId) return current
        if (itemId) {
          return {
            ...current,
            ...(nextSaleStatusId ? { statusId: nextSaleStatusId, legacyFormat: undefined } : {}),
            items: current.items.map((item) => item.itemId === itemId ? { ...item, statusId: status.statusId } : item),
          }
        }
        return { ...current, statusId: status.statusId, legacyFormat: undefined }
      }
      const updateSales = (current: Sale[]) => current.map(updateStatus)
      setSales(updateSales)
      setSearchResults((current) => current ? updateSales(current) : current)
      setViewingSale((current) => current ? updateStatus(current) : current)
      setPendingStatusChange(null)
    } catch (error: unknown) {
      console.error('Falha ao atualizar status pelo histórico:', error)
      const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : error instanceof Error ? error.message : ''
      setActionError(code === 'SALE_STATUS_UNAVAILABLE'
        ? 'O status escolhido está inativo ou não existe mais. Atualize o histórico e tente novamente.'
        : code === 'SALE_ITEM_NOT_FOUND'
          ? 'O item não foi encontrado. Atualize o histórico e tente novamente.'
          : code === 'SALE_STATUS_COUNT_INVALID'
            ? 'As contagens dos status estão inconsistentes. Atualize o histórico e tente novamente.'
          : code.includes('permission-denied')
            ? 'O Firestore negou a alteração. Confira sua participação nesta empresa e tente novamente.'
            : 'Não foi possível atualizar o status. Verifique a conexão e tente novamente.')
    } finally {
      setChangingStatus(false)
      setFinalizingSale(false)
    }
  }

  function saleActions(sale: Sale) {
    return <details className="sale-actions-menu"><summary aria-label={`Ações da venda de ${formatSaleDate(sale)}`} title="Ações da venda"><MoreHorizontal size={18} /></summary><div className="sale-actions-popover" role="menu">
      <button type="button" role="menuitem" title={sale.legacyFormat ? 'Ao salvar, esta venda antiga será convertida para o formato atual.' : undefined} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); openSaleEdit(sale) }}><Pencil size={15} />Editar venda</button>
      <button type="button" role="menuitem" className="is-danger" disabled={sale.legacyFormat || deletingSaleId === sale.saleId} title={sale.legacyFormat ? 'Disponível após a migração dos registros antigos.' : undefined} onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); setDeletingSale(sale) }}><Trash2 size={15} />Excluir venda</button>
    </div></details>
  }

  function saleHeader(sale: Sale) {
    const status = sale.statusId ? statuses[sale.statusId] : undefined
    const itemTotal = sale.items.reduce((total, item) => total + item.amountCents, 0)
    const commissionTotal = sale.items.reduce((total, item) => total + item.commissionCents, 0)
    return <div className="sales-order-header"><button className="sales-order-title" type="button" aria-label={`Visualizar pedido de ${sale.customerName || 'cliente não informado'}`} onClick={() => openSale(sale)}><strong>{sale.customerName || 'Venda sem cliente'}</strong><span>{formatSaleDate(sale)}{sale.externalNumber ? ` · Nº ${sale.externalNumber}` : ''}{sale.customerPhone ? ` · ${sale.customerPhone}` : ''}</span>{sale.notes && <small>{sale.notes}</small>}</button><details className="sales-order-status-menu"><summary aria-label={`Alterar status do pedido ${sale.externalNumber || sale.saleId}`}><SaleStatusBadge status={status} fallbackText={sale.statusId ? 'Status indisponível' : 'Sem status'} /><ChevronDown size={14} /></summary><div role="menu">{Object.values(statuses).filter((option) => option.active && option.statusId !== sale.statusId).map((option) => <button key={option.statusId} type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); setPendingStatusChange({ sale, status: option }); setActionError('') }}>{option.name}</button>)}{Object.values(statuses).filter((option) => option.active && option.statusId !== sale.statusId).length === 0 && <span className="sales-order-status-empty">Nenhum outro status ativo</span>}</div></details><div className="sales-order-totals"><span>Venda <strong>{formatBRLFromCents(itemTotal)}</strong></span><span>Comissão <strong>{formatBRLFromCents(commissionTotal)}</strong></span></div>{saleActions(sale)}</div>
  }

  function itemStatusMenu(sale: Sale, item: SaleItem, index: number) {
    const options = Object.values(statuses).filter((option) => option.active && option.statusId !== item.statusId)
    const finalizedStatus = resolveFinalizedSaleStatus(Object.values(statuses).filter((option) => option.active))
    const itemLabel = item.productId ? productNames[item.productId] ?? `nº ${index + 1}` : `nº ${index + 1}`
    return <details className="sales-order-status-menu"><summary aria-label={`Alterar status do item ${itemLabel}`}><SaleStatusBadge status={item.statusId ? statuses[item.statusId] : undefined} fallbackText={item.statusId ? 'Status indisponível' : 'Sem status'} /><ChevronDown size={14} /></summary><div role="menu">{options.map((option) => {
      const completesSale = finalizedStatus?.statusId === option.statusId
        && sale.statusId !== finalizedStatus.statusId
        && sale.items.every((otherItem) => otherItem.itemId === item.itemId || otherItem.statusId === finalizedStatus.statusId)
      return <button key={option.statusId} type="button" role="menuitem" onClick={(event) => {
        event.currentTarget.closest('details')?.removeAttribute('open')
        setPendingStatusChange({
          sale,
          status: option,
          itemId: item.itemId,
          ...(completesSale && finalizedStatus ? { finalizedSaleStatus: finalizedStatus } : {}),
        })
        setActionError('')
      }}>{option.name}</button>
    })}{options.length === 0 && <span className="sales-order-status-empty">Nenhum outro status ativo</span>}</div></details>
  }

  const searchingHistory = searchQuery.trim() !== ''
  const displayedSales = searchingHistory ? searchResults ?? [] : sales
  const statusFiltered = Boolean(filters.orderStatusId || filters.itemStatusId)
  const statusOptions = Object.values(statuses).sort((left, right) => left.sortOrder - right.sortOrder)
  const appliedFilterTags: Array<{ key: keyof SaleFilters; label: string }> = [
    ...(filters.startDate ? [{ key: 'startDate' as const, label: `De: ${formatFilterDate(filters.startDate) ?? filters.startDate}` }] : []),
    ...(filters.endDate ? [{ key: 'endDate' as const, label: `Até: ${formatFilterDate(filters.endDate) ?? filters.endDate}` }] : []),
    ...(filters.orderStatusId ? [{ key: 'orderStatusId' as const, label: `Pedido: ${statusFilterLabel(filters.orderStatusId, statuses)}` }] : []),
    ...(filters.itemStatusId ? [{ key: 'itemStatusId' as const, label: `Item: ${statusFilterLabel(filters.itemStatusId, statuses)}` }] : []),
  ]
  const pendingItemIndex = pendingStatusChange?.itemId
    ? pendingStatusChange.sale.items.findIndex((item) => item.itemId === pendingStatusChange.itemId)
    : -1
  const pendingItem = pendingItemIndex >= 0 && pendingStatusChange ? pendingStatusChange.sale.items[pendingItemIndex] : undefined
  const pendingItemName = pendingItemIndex < 0
    ? 'item'
    : pendingItem?.productId
      ? productNames[pendingItem.productId] ?? `Item ${pendingItemIndex + 1}`
      : `Item ${pendingItemIndex + 1}`
  const shouldOfferSaleFinalization = Boolean(pendingStatusChange?.itemId && pendingStatusChange.finalizedSaleStatus)

  return <>
    <section ref={historySectionRef} className={containerClassName} aria-labelledby="sales-history-heading">
      <div className="sale-card-title sales-history-title"><span className="sale-card-icon"><ClipboardList size={18} /></span><div><h2 id="sales-history-heading">Histórico de vendas</h2><p>Somente suas vendas nesta empresa.</p></div><button className="quiet-button sales-export-button" type="button" onClick={() => void exportCsv()} disabled={exporting || loadingTotals || totals?.count === 0}><Download size={15} />{exporting ? 'Preparando…' : 'Exportar CSV'}</button></div>
      <div className="sales-history-toolbar">
        <label className="sales-history-search"><span>Pesquisar pedidos</span><div><Search size={17} aria-hidden="true" /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cliente, telefone ou número do pedido" aria-label="Pesquisar por cliente, telefone ou número do pedido" /></div></label>
        <button className="quiet-button sales-filter-toggle" type="button" aria-expanded={filtersPanelOpen} aria-controls="sales-history-filter-panel" onClick={() => setFiltersPanelOpen((open) => !open)}><SlidersHorizontal size={16} />Filtros{appliedFilterTags.length > 0 && <span className="sales-filter-count">{appliedFilterTags.length}</span>}</button>
      </div>
      {appliedFilterTags.length > 0 && <div className="sales-filter-tags" aria-label="Filtros aplicados">{appliedFilterTags.map((filter) => <button key={filter.key} type="button" aria-label={`Remover filtro ${filter.label}`} onClick={() => removeAppliedFilter(filter.key)}>{filter.label}<X size={12} aria-hidden="true" /></button>)}<button className="sales-filter-clear-all" type="button" onClick={clearFilters}>Limpar filtros</button></div>}
      {filtersPanelOpen && <form id="sales-history-filter-panel" className="sales-filter-panel" onSubmit={applyFilters}>
        <label>De<input type="date" max={toLocalDateInputValue()} value={draftStart} onChange={(event) => setDraftStart(event.target.value)} /></label>
        <label>Até<input type="date" max={toLocalDateInputValue()} value={draftEnd} onChange={(event) => setDraftEnd(event.target.value)} /></label>
        <label className="sales-status-filter">Status do pedido<select value={draftOrderStatusId} onChange={(event) => setDraftOrderStatusId(event.target.value)}><option value="">Todos os status</option>{statusOptions.map((status) => <option key={status.statusId} value={status.statusId}>{status.name}{status.active ? '' : ' (inativo)'}</option>)}</select></label>
        <label className="sales-status-filter">Status dos itens<select value={draftItemStatusId} onChange={(event) => setDraftItemStatusId(event.target.value)}><option value="">Todos os status</option>{statusOptions.map((status) => <option key={status.statusId} value={status.statusId}>{status.name}{status.active ? '' : ' (inativo)'}</option>)}</select></label>
        <div className="sales-filter-panel-actions"><button className="quiet-button" type="button" onClick={clearFilters}>Limpar</button><button className="primary-button" type="submit"><Search size={15} />Aplicar filtros</button></div>
      </form>}
      {filterError && <p className="field-error" role="alert">{filterError}</p>}{totalsError && <p className="sales-history-total-error" role="status"><CircleAlert size={14} />{totalsError}</p>}{salesError && <p className="sales-history-total-error" role="alert"><CircleAlert size={14} />{salesError}<button type="button" onClick={() => void loadFirstPage()}>Tentar novamente</button></p>}{searchError && <p className="sales-history-total-error" role="alert"><CircleAlert size={14} />{searchError}<button type="button" onClick={() => setSearchRefreshKey((key) => key + 1)}>Tentar novamente</button></p>}{exportError && <p className="sales-history-total-error" role="alert"><CircleAlert size={14} />{exportError}</p>}
      {actionError && !editingSale && !pendingStatusChange && <p className="sales-history-total-error" role="alert"><CircleAlert size={14} />{actionError}</p>}
      {loading || (searchingHistory && searching) ? <LoadingSkeleton variant="sales-history" page={false} /> : displayedSales.length === 0 && !searchError ? <div className="sales-empty-history"><span><CalendarDays size={20} /></span><h3>{searchingHistory || statusFiltered ? 'Nenhum pedido encontrado' : 'Nenhuma venda encontrada'}</h3><p>{searchingHistory ? 'Tente outro nome, telefone ou número de pedido neste período.' : statusFiltered ? 'Nenhum pedido corresponde aos status selecionados.' : 'Não há vendas para o período selecionado.'}</p></div> : displayedSales.length > 0 ? <>
        <div className="sales-order-list">{displayedSales.map((sale) => <article className="sales-order-card" key={sale.saleId}>{saleHeader(sale)}{sale.deliveryAt && <div className="sales-order-delivery">Entrega prevista: {sale.deliveryAt.toDate().toLocaleDateString('pt-BR')}</div>}<div className="sales-order-items">{sale.items.map((item, index) => <div className="sales-order-item" key={item.itemId}><div className="sales-order-item-name"><strong>{item.productId ? productNames[item.productId] ?? 'Produto indisponível' : 'Item sem produto'}</strong><span>Quantidade: {formatQuantity(item.quantity)} · Unitário: {formatBRLFromCents(item.unitPriceCents ?? Math.round(item.amountCents / item.quantity))}</span>{!sale.legacyFormat && itemStatusMenu(sale, item, index)}{item.deliveryAt && <small>Entrega: {item.deliveryAt.toDate().toLocaleDateString('pt-BR')}</small>}{item.notes && <small>{item.notes}</small>}</div><div><span>Total do item</span><strong>{formatBRLFromCents(item.amountCents)}</strong></div><div className="is-commission"><span>Comissão <small>{formatRate(item.commissionRateBps)}</small></span><strong>{formatBRLFromCents(item.commissionCents)}</strong></div></div>)}</div></article>)}</div>
        {!searchingHistory && hasMore && <button className="quiet-button load-more-button" type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Carregando…' : 'Carregar mais vendas'}</button>}
      </> : null}
      <div className="sales-period-total" aria-live="polite"><div className="sales-period-total-heading"><strong>Total do período</strong><span>{filterDescription(filters, statuses)}</span></div><div className="sales-period-total-values"><div><span>Vendas</span><strong>{loadingTotals ? '…' : totals ? formatBRLFromCents(totals.amountCents) : '—'}</strong></div><div className="is-commission"><span>Comissões</span><strong>{loadingTotals ? '…' : totals ? formatBRLFromCents(totals.commissionCents) : '—'}</strong></div><div><span>Quantidade de vendas</span><strong>{loadingTotals ? '…' : totals ? totals.count.toLocaleString('pt-BR') : '—'}</strong></div></div></div>
    </section>
    {routeSaleId && !invalidSaleRoute && saleRouteLoading && viewingSale?.saleId !== routeSaleId && <div className="modal-backdrop"><section className="company-modal sale-view-modal" role="status" aria-label="Carregando pedido"><LoadingSkeleton variant="sales-history" page={false} /></section></div>}
    {routeSaleId && !invalidSaleRoute && saleRouteError && <div className="modal-backdrop"><section className="company-modal" role="alertdialog" aria-modal="true" aria-labelledby="sale-route-error-title"><div className="company-modal-heading"><span className="create-icon"><CircleAlert size={18} /></span><button className="modal-close-button" type="button" aria-label="Fechar" onClick={closeSaleView}><X size={18} /></button></div><h2 id="sale-route-error-title">Não foi possível abrir o pedido</h2><p>{saleRouteError}</p><div className="sale-delete-actions"><button className="primary-button" type="button" onClick={closeSaleView}>Voltar às vendas</button></div></section></div>}
    {routeSaleId && viewingSale?.saleId === routeSaleId && <SaleViewModal sale={viewingSale} productNames={productNames} statuses={statuses} onEdit={() => openSaleEdit(viewingSale)} onClose={closeSaleView} />}
    {routeAction === 'editar' && routeSaleId && editingSale?.saleId === routeSaleId && <SaleEditModal key={editingSale.saleId} sale={editingSale} companyId={companyId} statuses={Object.values(statuses)} canManageStatuses={canManageStatuses} saving={savingEdit} saveError={actionError} onClose={() => !savingEdit && closeSaleEdit()} onSave={saveEdit} onProductCreated={(productId, name) => setProductNames((current) => ({ ...current, [productId]: name }))} onStatusCreated={(status) => setStatuses((current) => ({ ...current, [status.statusId]: status }))} />}
    {pendingStatusChange && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !changingStatus) setPendingStatusChange(null) }}><section className="company-modal" role="alertdialog" aria-modal="true" aria-labelledby="sale-status-change-title"><div className="company-modal-heading"><span className="create-icon"><ChevronDown size={18} /></span><button className="modal-close-button" type="button" aria-label="Fechar" onClick={() => !changingStatus && setPendingStatusChange(null)} disabled={changingStatus}><X size={18} /></button></div><h2 id="sale-status-change-title">{shouldOfferSaleFinalization ? 'Finalizar também o pedido?' : pendingStatusChange.itemId ? 'Alterar status do item?' : 'Alterar status do pedido?'}</h2><p>{shouldOfferSaleFinalization ? <>O item “{pendingItemName}” será o último do pedido “{pendingStatusChange.sale.externalNumber || pendingStatusChange.sale.customerName || pendingStatusChange.sale.saleId}” no status “{pendingStatusChange.finalizedSaleStatus?.name}”. Deseja finalizar também o pedido?</> : pendingStatusChange.itemId ? <>O item “{pendingItemName}” do pedido “{pendingStatusChange.sale.externalNumber || pendingStatusChange.sale.customerName || pendingStatusChange.sale.saleId}” será alterado para “{pendingStatusChange.status.name}”. O status do pedido e os demais itens não serão alterados.</> : <>O pedido “{pendingStatusChange.sale.externalNumber || pendingStatusChange.sale.customerName || pendingStatusChange.sale.saleId}” será movido para “{pendingStatusChange.status.name}”. Os status individuais dos itens não serão alterados.</>}</p>{actionError && <p className="field-error" role="alert">{actionError}</p>}<div className={`sale-delete-actions${shouldOfferSaleFinalization ? ' sale-finalization-actions' : ''}`}>{shouldOfferSaleFinalization ? <><button className="quiet-button" type="button" onClick={() => setPendingStatusChange(null)} disabled={changingStatus}>Cancelar</button><button className="quiet-button" type="button" onClick={() => void confirmStatusChange()} disabled={changingStatus}>{changingStatus && !finalizingSale ? 'Atualizando…' : 'Não, apenas o item'}</button><button className="primary-button" type="button" onClick={() => void confirmStatusChange(true)} disabled={changingStatus}>{changingStatus && finalizingSale ? 'Finalizando…' : 'Sim, finalizar venda'}</button></> : <><button className="quiet-button" type="button" onClick={() => setPendingStatusChange(null)} disabled={changingStatus}>Cancelar</button><button className="primary-button" type="button" onClick={() => void confirmStatusChange()} disabled={changingStatus}>{changingStatus ? 'Atualizando…' : 'Confirmar alteração'}</button></>}</div></section></div>}
    {deletingSale && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingSaleId) setDeletingSale(null) }}><section className="company-modal" role="alertdialog" aria-modal="true" aria-labelledby="sale-delete-title"><div className="company-modal-heading"><span className="create-icon"><Trash2 size={18} /></span><button className="modal-close-button" type="button" aria-label="Fechar" onClick={() => setDeletingSale(null)} disabled={Boolean(deletingSaleId)}><X size={18} /></button></div><h2 id="sale-delete-title">Excluir venda?</h2><p>Esta ação excluirá o cabeçalho e todos os {deletingSale.items.length} item(ns) desta venda.</p>{actionError && <p className="field-error" role="alert">{actionError}</p>}<div className="sale-delete-actions"><button className="quiet-button" type="button" onClick={() => setDeletingSale(null)} disabled={Boolean(deletingSaleId)}>Cancelar</button><button className="primary-button" type="button" onClick={() => void confirmDelete()} disabled={Boolean(deletingSaleId)}>{deletingSaleId ? 'Excluindo…' : 'Excluir venda'}</button></div></section></div>}
  </>
}

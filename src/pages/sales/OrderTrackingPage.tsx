import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, CircleAlert, ClipboardList, GripVertical, Phone, RefreshCw } from 'lucide-react'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AccountMenu } from '../../components/AccountMenu'
import { BrandMark } from '../../components/BrandMark'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { SaleEditModal } from '../../components/SaleEditModal'
import { useAuth } from '../../hooks/useAuth'
import { useCompany } from '../../hooks/useCompany'
import { getCompanyProducts } from '../../services/productService'
import { ensureDefaultSaleStatuses, getCompanySaleStatuses } from '../../services/saleStatusService'
import { getSalesForExport, moveSaleToStatus, updateSale } from '../../services/saleService'
import type { SaleFormValues } from '../../schemas/saleSchemas'
import type { Sale } from '../../types/sale'
import type { SaleStatus } from '../../types/saleStatus'

function moveErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : error instanceof Error ? error.message : ''

  if (code === 'SALE_NOT_FOUND') return 'Este pedido não está disponível para sua conta.'
  if (code === 'SALE_STATUS_UNAVAILABLE') return 'O status escolhido está inativo ou não existe mais. Atualize o quadro e tente novamente.'
  if (code === 'SALE_STATUS_COUNT_INVALID') return 'Não foi possível atualizar as contagens dos status. Atualize o quadro e tente novamente.'
  if (code.includes('permission-denied')) return 'O Firestore negou a alteração. Confira sua participação nesta empresa.'
  return 'Não foi possível mover o pedido. Verifique a conexão e tente novamente.'
}

function quantityLabel(quantity: number) {
  return quantity.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
}

function formatCardPhone(value?: string) {
  const phone = value?.trim()
  if (!phone) return ''
  const parsed = parsePhoneNumberFromString(phone, 'BR')
  if (!parsed?.isValid()) return phone
  return parsed.country === 'BR'
    ? `+${parsed.countryCallingCode} ${parsed.formatNational()}`
    : parsed.formatInternational()
}

function formatSaleDate(value: Date) {
  return value.toLocaleDateString('pt-BR')
}

function OrderBoardSkeleton() {
  return <div className="order-kanban-board order-kanban-board-loading" role="status" aria-label="Carregando pedidos">
    {Array.from({ length: 3 }, (_, index) => <section className="order-kanban-column" key={index}>
      <span className="skeleton-block order-kanban-skeleton-heading" />
      {Array.from({ length: 2 }, (_, cardIndex) => <div className="order-kanban-skeleton-card" key={cardIndex}>
        <span className="skeleton-block order-kanban-skeleton-line" />
        <span className="skeleton-block order-kanban-skeleton-line is-short" />
        <span className="skeleton-block order-kanban-skeleton-line" />
      </div>)}
    </section>)}
  </div>
}

export function OrderTrackingPage() {
  const { companyId = '' } = useParams()
  const { currentUser } = useAuth()
  const { companies, activeCompany, loading: loadingCompany, selectCompany } = useCompany()
  const company = companies.find((item) => item.companyId === companyId) ?? null
  const [statuses, setStatuses] = useState<SaleStatus[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [loadingBoard, setLoadingBoard] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [moveError, setMoveError] = useState('')
  const [movingSaleId, setMovingSaleId] = useState<string | null>(null)
  const [draggedSaleId, setDraggedSaleId] = useState<string | null>(null)
  const [dropTargetStatusId, setDropTargetStatusId] = useState<string | null>(null)
  const [collapsedStatusIds, setCollapsedStatusIds] = useState<Set<string>>(() => new Set())
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')
  const [middleScrollActive, setMiddleScrollActive] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)
  const middleAutoScrollCleanup = useRef<(() => void) | null>(null)
  const dragPointerX = useRef<number | null>(null)
  const canManageStatuses = companies.some((item) => item.companyId === companyId)

  const loadBoard = useCallback(async () => {
    if (!company || !currentUser) return
    setLoadingBoard(true)
    setLoadError('')
    setMoveError('')
    try {
      await ensureDefaultSaleStatuses(company.companyId, currentUser.uid)
      const [nextStatuses, nextSales, products] = await Promise.all([
        getCompanySaleStatuses(company.companyId),
        getSalesForExport(company.companyId, currentUser.uid, {}),
        getCompanyProducts(company.companyId),
      ])
      setStatuses(nextStatuses)
      setSales(nextSales)
      setProductNames(Object.fromEntries(products.map((product) => [product.productId, product.name])))
    } catch (error) {
      console.error('Falha ao carregar o acompanhamento de pedidos:', error)
      setLoadError('Não foi possível carregar os pedidos desta empresa. Verifique a conexão e tente novamente.')
    } finally {
      setLoadingBoard(false)
    }
  }, [company, currentUser])

  useEffect(() => { void Promise.resolve().then(loadBoard) }, [loadBoard])
  useEffect(() => { if (company && activeCompany?.companyId !== company.companyId) selectCompany(company.companyId) }, [activeCompany?.companyId, company, selectCompany])
  useEffect(() => () => middleAutoScrollCleanup.current?.(), [])

  useEffect(() => {
    if (!draggedSaleId) return

    function updateDraggedPointer(event: globalThis.DragEvent) {
      dragPointerX.current = event.clientX
    }

    let frameId = 0
    function scrollAtBoardEdges() {
      const board = boardRef.current
      const pointerX = dragPointerX.current
      if (board && pointerX !== null && board.scrollWidth > board.clientWidth) {
        const bounds = board.getBoundingClientRect()
        const edgeSize = 68
        const maxStep = 18
        const leftDistance = pointerX - bounds.left
        const rightDistance = bounds.right - pointerX
        if (leftDistance < edgeSize) {
          const speed = Math.max(2, Math.ceil(Math.min(1, (edgeSize - leftDistance) / edgeSize) * maxStep))
          board.scrollLeft -= speed
        } else if (rightDistance < edgeSize) {
          const speed = Math.max(2, Math.ceil(Math.min(1, (edgeSize - rightDistance) / edgeSize) * maxStep))
          board.scrollLeft += speed
        }
      }
      frameId = window.requestAnimationFrame(scrollAtBoardEdges)
    }

    document.addEventListener('dragover', updateDraggedPointer, true)
    frameId = window.requestAnimationFrame(scrollAtBoardEdges)
    return () => {
      document.removeEventListener('dragover', updateDraggedPointer, true)
      window.cancelAnimationFrame(frameId)
    }
  }, [draggedSaleId])

  const visibleStatuses = useMemo(
    () => statuses
      .filter((status) => status.active || sales.some((sale) => sale.statusId === status.statusId))
      .sort((left, right) => left.sortOrder - right.sortOrder),
    [sales, statuses],
  )

  function toggleStatus(statusId: string) {
    setCollapsedStatusIds((current) => {
      const next = new Set(current)
      if (next.has(statusId)) next.delete(statusId)
      else next.add(statusId)
      return next
    })
  }

  async function moveSale(saleId: string, nextStatusId: string) {
    if (!company || !currentUser || movingSaleId) return
    const sale = sales.find((item) => item.saleId === saleId)
    const nextStatus = statuses.find((status) => status.statusId === nextStatusId)
    if (!sale || !nextStatus?.active || sale.statusId === nextStatusId) return

    setMovingSaleId(saleId)
    setMoveError('')
    try {
      await moveSaleToStatus(company.companyId, saleId, currentUser.uid, nextStatusId)
      setSales((current) => current.map((item) => item.saleId === saleId
        ? { ...item, statusId: nextStatusId, legacyFormat: undefined }
        : item))
    } catch (error) {
      console.error('Falha ao mover pedido no quadro:', error)
      setMoveError(moveErrorMessage(error))
    } finally {
      setMovingSaleId(null)
    }
  }

  async function saveSaleEdit(values: SaleFormValues) {
    if (!company || !currentUser || !editingSale) return
    setSavingEdit(true)
    setEditError('')
    try {
      await updateSale(company.companyId, editingSale.saleId, currentUser.uid, values)
      setEditingSale(null)
      await loadBoard()
    } catch (error) {
      console.error('Falha ao editar pedido no acompanhamento:', error)
      setEditError('Não foi possível salvar as alterações. Verifique a conexão e as regras do Firestore.')
    } finally {
      setSavingEdit(false)
    }
  }

  function openSaleEdit(sale: Sale) {
    if (movingSaleId || savingEdit) return
    setEditError('')
    setEditingSale(sale)
  }

  function openSaleFromCard(event: ReactMouseEvent<HTMLElement>, sale: Sale) {
    const target = event.target
    if (target instanceof Element && target.closest('a, button, summary, select, input, textarea')) return
    if (draggedSaleId) return
    openSaleEdit(sale)
  }

  function openSaleFromKeyboard(event: ReactKeyboardEvent<HTMLElement>, sale: Sale) {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    openSaleEdit(sale)
  }

  function toggleMiddleAutoScroll(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 1) return
    if (middleAutoScrollCleanup.current) {
      middleAutoScrollCleanup.current()
      return
    }

    const target = event.target
    if (target instanceof Element && target.closest('a, button, summary, select, input, textarea')) return
    const board = boardRef.current
    if (!board || board.scrollWidth <= board.clientWidth) return

    const activatingEvent = event.nativeEvent
    let ignoreActivationPointerUp = true

    function stopOnMiddleDown(mouseEvent: globalThis.MouseEvent) {
      if (mouseEvent.button === 1 && mouseEvent !== activatingEvent) stop()
    }

    function stopOnPointerUp(pointerEvent: globalThis.PointerEvent) {
      if (ignoreActivationPointerUp) {
        ignoreActivationPointerUp = false
        return
      }
      if (pointerEvent.button === 1) stop()
    }

    function stopOnEscape(keyEvent: KeyboardEvent) {
      if (keyEvent.key === 'Escape') stop()
    }

    function stop() {
      window.removeEventListener('mousedown', stopOnMiddleDown)
      window.removeEventListener('pointerup', stopOnPointerUp)
      window.removeEventListener('blur', stop)
      document.removeEventListener('keydown', stopOnEscape)
      middleAutoScrollCleanup.current = null
      setMiddleScrollActive(false)
    }

    window.addEventListener('mousedown', stopOnMiddleDown)
    window.addEventListener('pointerup', stopOnPointerUp)
    window.addEventListener('blur', stop)
    document.addEventListener('keydown', stopOnEscape)
    setMiddleScrollActive(true)
    middleAutoScrollCleanup.current = stop
  }

  function startDragging(event: DragEvent<HTMLElement>, sale: Sale) {
    const target = event.target
    if (movingSaleId || (target instanceof Element && target.closest('select, a, button, summary'))) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', sale.saleId)
    dragPointerX.current = event.clientX
    setDraggedSaleId(sale.saleId)
  }

  function allowDrop(event: DragEvent<HTMLElement>, status: SaleStatus) {
    if (!status.active || !draggedSaleId || movingSaleId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTargetStatusId(status.statusId)
  }

  function dropSale(event: DragEvent<HTMLElement>, status: SaleStatus) {
    if (!status.active) return
    event.preventDefault()
    const saleId = event.dataTransfer.getData('text/plain') || draggedSaleId
    setDraggedSaleId(null)
    dragPointerX.current = null
    setDropTargetStatusId(null)
    if (saleId) void moveSale(saleId, status.statusId)
  }

  if (loadingCompany) return <LoadingSkeleton variant="app" />
  if (!company) return <Navigate to="/empresas" replace />

  return <>
    <main className="sales-page order-tracking-page">
    <header className="topbar"><BrandMark /><div className="topbar-user"><AccountMenu /></div></header>
    <div className="sales-content order-tracking-content">
      <div className="sales-heading">
        <div>
          <Link className="sales-back-link" to={`/empresas/${company.companyId}`}><ArrowLeft size={14} /> Dashboard</Link>
          <span className="eyebrow"><ClipboardList size={15} /> {company.companyName}</span>
          <h1>Acompanhamento de pedido</h1>
          <p>Arraste os pedidos para atualizar o status e acompanhar cada etapa.</p>
        </div>
        <button className="quiet-button order-tracking-refresh" type="button" onClick={() => void loadBoard()} disabled={loadingBoard || movingSaleId !== null}>
          <RefreshCw size={15} />{loadingBoard ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>
      {moveError && <p className="order-tracking-error" role="alert"><CircleAlert size={15} />{moveError}</p>}
      {loadError ? <div className="order-tracking-load-error" role="alert"><CircleAlert size={18} /><p>{loadError}</p><button className="quiet-button" type="button" onClick={() => void loadBoard()}>Tentar novamente</button></div>
        : loadingBoard ? <OrderBoardSkeleton />
          : visibleStatuses.length === 0 ? <div className="order-tracking-empty"><ClipboardList size={24} /><h2>Nenhum status disponível</h2><p>Ative um status para começar a acompanhar os pedidos.</p><Link className="quiet-button" to={`/empresas/${company.companyId}/status-vendas`}>Gerenciar status</Link></div>
            : <div
              ref={boardRef}
              className={`order-kanban-board${draggedSaleId || middleScrollActive ? ' is-interacting' : ''}${middleScrollActive ? ' is-middle-panning' : ''}`}
              aria-label="Pedidos agrupados por status"
              onMouseDown={toggleMiddleAutoScroll}
            >
              {visibleStatuses.map((status) => {
                const statusSales = sales.filter((sale) => sale.statusId === status.statusId)
                const isCollapsed = collapsedStatusIds.has(status.statusId)
                return <section
                  className={`order-kanban-column${status.active ? '' : ' is-inactive'}${dropTargetStatusId === status.statusId ? ' is-drop-target' : ''}`}
                  key={status.statusId}
                  aria-labelledby={`order-kanban-heading-${status.statusId}`}
                  onDragOver={(event) => allowDrop(event, status)}
                  onDragLeave={() => setDropTargetStatusId(null)}
                  onDrop={(event) => dropSale(event, status)}
                >
                  <header className="order-kanban-column-heading">
                    <div className="order-kanban-column-title"><h2 id={`order-kanban-heading-${status.statusId}`}>{status.name}</h2>{!status.active && <span className="order-kanban-inactive-label">Inativo</span>}</div>
                    <div className="order-kanban-column-controls">
                      <span className="order-kanban-count">{statusSales.length.toLocaleString('pt-BR')}</span>
                      <button className="order-kanban-mobile-toggle" type="button" aria-expanded={!isCollapsed} aria-controls={`order-kanban-cards-${status.statusId}`} aria-label={`${isCollapsed ? 'Expandir' : 'Recolher'} pedidos de ${status.name}`} onClick={() => toggleStatus(status.statusId)}>
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </header>
                  <div className={`order-kanban-cards${isCollapsed ? ' is-collapsed' : ''}`} id={`order-kanban-cards-${status.statusId}`}>
                    {statusSales.map((sale) => {
                      const phone = sale.customerPhone?.trim()
                      const formattedPhone = formatCardPhone(phone)
                      const soldAt = sale.soldAt.toDate()
                      const deliveryAt = sale.deliveryAt?.toDate()
                      const isMoving = movingSaleId === sale.saleId
                      return <article
                        className={`order-kanban-card${draggedSaleId === sale.saleId ? ' is-dragging' : ''}${isMoving ? ' is-moving' : ''}`}
                        key={sale.saleId}
                        draggable={!movingSaleId}
                        role="button"
                        tabIndex={0}
                        aria-label={`Editar pedido ${sale.externalNumber?.trim() || 'sem número'} de ${sale.customerName?.trim() || 'cliente não informado'}`}
                        onClick={(event) => openSaleFromCard(event, sale)}
                        onKeyDown={(event) => openSaleFromKeyboard(event, sale)}
                        onDragStart={(event) => startDragging(event, sale)}
                        onDragEnd={() => { setDraggedSaleId(null); dragPointerX.current = null; setDropTargetStatusId(null) }}
                        aria-busy={isMoving}
                      >
                        <div className="order-kanban-card-heading"><strong>{sale.customerName?.trim() || 'Cliente não informado'}</strong><GripVertical size={16} aria-hidden="true" /></div>
                        <div className="order-kanban-card-meta">
                          <span>{phone
                            ? <><Phone size={13} /><a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{formattedPhone}</a></>
                            : <><Phone size={13} />Telefone não informado</>}</span>
                          <span><strong>Pedido:</strong> {sale.externalNumber?.trim() || 'Sem número'}</span>
                          <span><CalendarDays size={13} /><strong>Data:</strong> {formatSaleDate(soldAt)}</span>
                          <span><CalendarDays size={13} /><strong>Previsão:</strong> {deliveryAt ? formatSaleDate(deliveryAt) : 'Não informada'}</span>
                        </div>
                        <ul className="order-kanban-item-list" aria-label="Itens do pedido">
                          {sale.items.map((item) => <li key={item.itemId}>
                            <span>{item.productId ? productNames[item.productId] ?? 'Produto indisponível' : 'Item sem produto'}</span>
                            <small>× {quantityLabel(item.quantity)}</small>
                          </li>)}
                        </ul>
                        {statuses.some((item) => item.active && item.statusId !== sale.statusId) && <details className="order-kanban-move-menu">
                          <summary aria-label={`Escolher novo status para o pedido ${sale.externalNumber || sale.saleId}`}><ArrowRight size={13} />{isMoving ? 'Atualizando…' : 'Alterar status'}</summary>
                          <div>
                            {statuses.filter((item) => item.active && item.statusId !== sale.statusId).map((item) => <button key={item.statusId} type="button" disabled={movingSaleId !== null} onClick={(event) => {
                              event.currentTarget.closest('details')?.removeAttribute('open')
                              void moveSale(sale.saleId, item.statusId)
                            }}>{item.name}</button>)}
                          </div>
                        </details>}
                        {sale.legacyFormat && <span className="order-kanban-legacy-hint">O formato antigo será convertido ao mover, preservando valores e observações.</span>}
                      </article>
                    })}
                    {statusSales.length === 0 && <p className="order-kanban-column-empty">{status.active ? 'Solte um pedido aqui.' : 'Nenhum pedido neste status.'}</p>}
                  </div>
                </section>
              })}
            </div>}
    </div>
    </main>
    {editingSale && <SaleEditModal
      key={editingSale.saleId}
      sale={editingSale}
      companyId={company.companyId}
      statuses={statuses}
      canManageStatuses={canManageStatuses}
      saving={savingEdit}
      saveError={editError}
      onClose={() => !savingEdit && setEditingSale(null)}
      onSave={saveSaleEdit}
      onProductCreated={(productId, name) => setProductNames((current) => ({ ...current, [productId]: name }))}
      onStatusCreated={(status) => setStatuses((current) => [...current.filter((item) => item.statusId !== status.statusId), status])}
    />}
  </>
}

import { CalendarDays, Pencil, Receipt, UserRound, X } from 'lucide-react'
import type { Sale } from '../types/sale'
import type { SaleStatus } from '../types/saleStatus'
import { formatBRLFromCents } from '../utils/currency'
import { SaleStatusBadge } from './SaleStatusBadge'

interface SaleViewModalProps {
  sale: Sale
  productNames: Record<string, string>
  statuses: Record<string, SaleStatus>
  onEdit: () => void
  onClose: () => void
}

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 }).format(quantity)
}

function formatSaleDate(sale: Sale) {
  return sale.soldAt.toDate().toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatLocalDate(timestamp?: Sale['soldAt']) {
  return timestamp?.toDate().toLocaleDateString('pt-BR') ?? 'Não informada'
}

export function SaleViewModal({ sale, productNames, statuses, onEdit, onClose }: SaleViewModalProps) {
  const saleStatus = sale.statusId ? statuses[sale.statusId] : undefined
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="company-modal sale-view-modal" role="dialog" aria-modal="true" aria-labelledby={`sale-view-title-${sale.saleId}`}>
      <div className="company-modal-heading">
        <span className="create-icon"><Receipt size={18} /></span>
        <button className="modal-close-button" type="button" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
      </div>
      <h2 id={`sale-view-title-${sale.saleId}`}>{sale.customerName?.trim() || 'Pedido sem cliente'}</h2>
      <p>Visualização dos dados do pedido.</p>
      <div className="sale-view-meta">
        <span><CalendarDays size={14} />{formatSaleDate(sale)}</span>
        <span><UserRound size={14} />{sale.customerPhone || 'Telefone não informado'}</span>
        <span><Receipt size={14} />{sale.externalNumber ? `Pedido nº ${sale.externalNumber}` : 'Número não informado'}</span>
        <span><CalendarDays size={14} />Entrega do pedido: {formatLocalDate(sale.deliveryAt)}</span>
        <div><strong>Status do pedido</strong><SaleStatusBadge status={saleStatus} fallbackText={sale.statusId ? 'Status indisponível' : 'Sem status'} /></div>
      </div>
      {sale.notes && <div className="sale-view-notes"><strong>Observação do pedido</strong><p>{sale.notes}</p></div>}
      <div className="sale-view-items">
        <h3>Itens do pedido</h3>
        {sale.items.map((item, index) => {
          const itemStatus = item.statusId ? statuses[item.statusId] : undefined
          const unitPriceCents = item.unitPriceCents ?? Math.round(item.amountCents / item.quantity)
          return <article className="sale-view-item" key={item.itemId}>
            <div className="sale-view-item-heading">
              <strong>{item.productId ? productNames[item.productId] ?? 'Produto indisponível' : `Item ${index + 1}`}</strong>
              <span>Quantidade: {formatQuantity(item.quantity)}</span>
            </div>
            <div className="sale-view-item-values">
              <span>Valor unitário<strong>{formatBRLFromCents(unitPriceCents)}</strong></span>
              <span>Total do item<strong>{formatBRLFromCents(item.amountCents)}</strong></span>
              <span>Comissão · {(item.commissionRateBps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%<strong>{formatBRLFromCents(item.commissionCents)}</strong></span>
            </div>
            <div className="sale-view-item-meta">
              <span>Status do item <SaleStatusBadge status={itemStatus} fallbackText="Sem status" /></span>
              <span>Entrega prevista: {formatLocalDate(item.deliveryAt)}</span>
            </div>
            {item.notes && <p className="sale-view-item-notes">{item.notes}</p>}
          </article>
        })}
      </div>
      <div className="sale-view-modal-actions"><button className="quiet-button" type="button" onClick={onEdit}><Pencil size={15} />Editar pedido</button><button className="primary-button" type="button" onClick={onClose}>Fechar</button></div>
    </section>
  </div>
}

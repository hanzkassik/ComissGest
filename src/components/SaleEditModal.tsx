import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDays, Clock3, Pencil, Plus, Receipt, Tag, UserRound, X } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useState } from 'react'
import { FormField } from './FormField'
import { PhoneField } from './PhoneField'
import { SaleItemsEditor } from './SaleItemsEditor'
import { SaleStatusQuickCreateModal } from './SaleStatusQuickCreateModal'
import { saleSchema, type SaleFormValues } from '../schemas/saleSchemas'
import type { Sale } from '../types/sale'
import type { SaleStatus } from '../types/saleStatus'
import { toLocalDateInputValue } from '../utils/currency'

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

interface SaleEditModalProps {
  sale: Sale
  companyId: string
  statuses: SaleStatus[]
  canManageStatuses: boolean
  saving: boolean
  saveError?: string
  onClose: () => void
  onSave: (values: SaleFormValues) => Promise<void>
  onProductCreated: (productId: string, name: string) => void
  onStatusCreated: (status: SaleStatus) => void
}

export function SaleEditModal({ sale, companyId, statuses, canManageStatuses, saving, saveError, onClose, onSave, onProductCreated, onStatusCreated }: SaleEditModalProps) {
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
      <div className="sale-status-select-wrap"><label className="field-label" htmlFor={`edit-sale-status-${sale.saleId}`}>Status</label><div className="sale-select-control"><span className="sale-select-icon"><Tag size={16} /></span><select id={`edit-sale-status-${sale.saleId}`} {...register('statusId')}><option value={sale.statusId ?? ''} disabled={currentStatus?.active === false}>{currentStatus?.name ?? (sale.statusId ? 'Status atual' : 'Sem status')}{currentStatus?.active === false ? ' (desativado)' : ''}</option>{activeStatuses.filter((status) => status.statusId !== sale.statusId).map((status) => <option key={status.statusId} value={status.statusId}>{status.name}</option>)}</select>{canManageStatuses && <button className="sale-select-add-button" type="button" aria-label="Adicionar status" title="Adicionar status" onClick={() => setQuickStatusOpen(true)}><Plus size={17} /></button>}</div></div>
      <div className="sale-form-section"><div className="sale-items-heading"><div><h3>Itens da venda</h3><p>O valor informado já representa o total do item. A quantidade não altera os cálculos.</p></div></div><SaleItemsEditor companyId={companyId} items={items} collapsibleDraft onItemsChange={(next) => setValue('items', next, { shouldDirty: true, shouldValidate: true })} onProductCreated={onProductCreated} />{errors.items?.message && <span className="field-error" role="alert">{errors.items.message}</span>}</div>
      <label className="notes-field">Observação do pedido <span>(opcional)</span><textarea rows={3} maxLength={500} {...register('notes')} /></label>
      {Object.keys(errors).length > 0 && <p className="field-error" role="alert">Confira os dados dos campos e tente novamente.</p>}
      {saveError && <p className="field-error" role="alert">{saveError}</p>}
      <div className="sale-delete-actions"><button className="quiet-button" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button></div>
    </form>
    {quickStatusOpen && <SaleStatusQuickCreateModal companyId={companyId} onClose={() => setQuickStatusOpen(false)} onCreated={(status) => { onStatusCreated(status); setValue('statusId', status.statusId, { shouldDirty: true }); setQuickStatusOpen(false) }} />}
  </section></div>
}

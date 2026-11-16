import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { saleItemSchema, type SaleItemFormValues } from '../schemas/saleSchemas'
import { getCompanyProducts } from '../services/productService'
import { calculateCommissionCents, formatBRLFromCents, parseBrazilianDecimalToInteger } from '../utils/currency'
import { ProductSelectField } from './ProductSelectField'

const emptyItem: SaleItemFormValues = { amount: '', commissionRate: '10,00', quantity: '1', productId: '', notes: '' }
const commissionRatePresets = Array.from({ length: 19 }, (_, index) => 1 + (index * 0.5))

interface SaleItemsEditorProps {
  companyId: string
  items: SaleItemFormValues[]
  onItemsChange: (items: SaleItemFormValues[]) => void
  onProductCreated?: (productId: string, name: string) => void
}

function previewCommission(amount: string, rate: string) {
  try {
    if (!amount || !rate) return 0
    return calculateCommissionCents(parseBrazilianDecimalToInteger(amount, 2), parseBrazilianDecimalToInteger(rate, 2))
  } catch {
    return 0
  }
}

function formatRate(rate: string) {
  const value = Number(rate.replace(',', '.'))
  return Number.isFinite(value) ? `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '—'
}

function formatQuantity(quantity: string) {
  const value = Number(quantity.replace(',', '.'))
  return Number.isFinite(value) ? value.toLocaleString('pt-BR', { maximumFractionDigits: 6 }) : quantity
}

export function SaleItemsEditor({ companyId, items, onItemsChange, onProductCreated }: SaleItemsEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [removingIndex, setRemovingIndex] = useState<number | null>(null)
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<SaleItemFormValues>({
    resolver: zodResolver(saleItemSchema),
    defaultValues: { ...emptyItem },
  })
  const draft = useWatch({ control })
  const commission = previewCommission(draft.amount ?? '', draft.commissionRate ?? '')

  useEffect(() => {
    let active = true
    void getCompanyProducts(companyId).then((products) => {
      if (active) setProductNames(Object.fromEntries(products.map((product) => [product.productId, product.name])))
    }).catch(() => undefined)
    return () => { active = false }
  }, [companyId])

  function saveItem(values: SaleItemFormValues) {
    const next = [...items]
    if (editingIndex === null) next.push(values)
    else next[editingIndex] = values
    onItemsChange(next)
    setEditingIndex(null)
    reset({ ...emptyItem })
  }

  function editItem(index: number) {
    setEditingIndex(index)
    reset({ ...emptyItem, ...items[index] })
  }

  function confirmRemoveItem() {
    if (removingIndex === null) return
    const next = items.filter((_, index) => index !== removingIndex)
    onItemsChange(next)
    if (editingIndex === removingIndex) {
      setEditingIndex(null)
      reset({ ...emptyItem })
    } else if (editingIndex !== null && editingIndex > removingIndex) {
      setEditingIndex(editingIndex - 1)
    }
    setRemovingIndex(null)
  }

  return <div className="sale-items-editor">
    <div className="sale-saved-items" aria-live="polite">
      {items.map((item, index) => <article className="sale-saved-item" key={item.itemId ?? `draft-${index}`}>
        <div className="sale-saved-item-heading"><strong>{item.productId ? productNames[item.productId] ?? 'Produto selecionado' : 'Item sem produto'}</strong><span>Item {index + 1}</span></div>
        <div className="sale-saved-item-values"><span>Venda<strong>{item.amount ? `R$ ${item.amount}` : '—'}</strong></span><span>Quantidade<strong>{formatQuantity(item.quantity)}</strong></span><span>Comissão · {formatRate(item.commissionRate)}<strong>{formatBRLFromCents(previewCommission(item.amount, item.commissionRate))}</strong></span></div>
        {item.notes && <p>{item.notes}</p>}
        <div className="sale-saved-item-actions"><button className="quiet-button" type="button" onClick={() => editItem(index)}><Pencil size={14} /> Editar</button><button className="quiet-button sale-item-remove" type="button" onClick={() => setRemovingIndex(index)}><Trash2 size={14} /> Remover</button></div>
      </article>)}
      {items.length === 0 && <p className="sale-items-empty">Nenhum item salvo. Preencha o formulário abaixo e selecione <strong>Salvar item</strong>.</p>}
    </div>

    <div className="sale-item-draft" role="group" aria-label={editingIndex === null ? 'Novo item' : `Editando item ${editingIndex + 1}`}>
      <h4>{editingIndex === null ? 'Novo item' : `Editando item ${editingIndex + 1}`}</h4>
      <ProductSelectField companyId={companyId} value={draft.productId ?? ''} onChange={(value) => setValue('productId', value, { shouldDirty: true, shouldValidate: true })} error={errors.productId?.message} onProductCreated={(product) => onProductCreated?.(product.productId, product.name)} />
      <label className="field-label">Valor total do item (R$)<input inputMode="decimal" placeholder="0,00" autoComplete="off" {...register('amount')} />{errors.amount?.message && <span className="field-error">{errors.amount.message}</span>}</label>
      <div className="sale-item-quantity-rate"><label className="field-label">Quantidade<input type="number" inputMode="decimal" min="0.000001" step="any" {...register('quantity')} />{errors.quantity?.message && <span className="field-error">{errors.quantity.message}</span>}</label><label className="field-label">Comissão (%)<input inputMode="decimal" placeholder="10,00" autoComplete="off" {...register('commissionRate')} />{errors.commissionRate?.message && <span className="field-error">{errors.commissionRate.message}</span>}</label></div>
      <div className="commission-rate-picker"><div className="commission-rate-picker-heading"><span>Atalhos de comissão</span><span>1% a 10%</span></div><div className="commission-rate-presets" role="group" aria-label="Percentuais de comissão do item">{commissionRatePresets.map((rate) => <button className={Number((draft.commissionRate ?? '').replace(',', '.')) === rate ? 'is-selected' : ''} type="button" key={rate} aria-pressed={Number((draft.commissionRate ?? '').replace(',', '.')) === rate} onClick={() => setValue('commissionRate', String(rate).replace('.', ','), { shouldDirty: true, shouldValidate: true })}>{`${rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}</button>)}</div></div>
      <label className="notes-field">Observação do item <span>(opcional)</span><textarea rows={2} maxLength={500} placeholder="Detalhes deste item" {...register('notes')} />{errors.notes?.message && <span className="field-error">{errors.notes.message}</span>}</label>
      {draft.amount && <div className="sale-item-commission-preview"><span>Comissão estimada do item</span><strong>{formatBRLFromCents(commission)}</strong></div>}
      <div className="sale-item-draft-actions">{editingIndex !== null && <button className="quiet-button" type="button" onClick={() => { setEditingIndex(null); reset({ ...emptyItem }) }}>Cancelar edição</button>}<button className="primary-button" type="button" onClick={() => void handleSubmit(saveItem)()}><Plus size={16} />Salvar item</button></div>
    </div>

    {removingIndex !== null && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setRemovingIndex(null) }}><section className="company-modal" role="alertdialog" aria-modal="true" aria-labelledby="sale-editor-remove-title"><h2 id="sale-editor-remove-title">Remover item?</h2><p>O item {removingIndex + 1} será removido deste pedido.</p><div className="sale-delete-actions"><button className="quiet-button" type="button" onClick={() => setRemovingIndex(null)}>Cancelar</button><button className="primary-button" type="button" onClick={confirmRemoveItem}>Remover item</button></div></section></div>}
  </div>
}

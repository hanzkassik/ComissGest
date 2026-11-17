import { zodResolver } from '@hookform/resolvers/zod'
import { Palette, Plus, Tag, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../hooks/useAuth'
import { FormField } from './FormField'
import { saleStatusSchema, type SaleStatusFormValues } from '../schemas/saleStatusSchemas'
import { createSaleStatus } from '../services/saleStatusService'
import { DEFAULT_SALE_STATUS_COLOR, type SaleStatus } from '../types/saleStatus'

function statusErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : ''
  if (code.includes('permission-denied')) return 'O Firestore negou a criação. Confira se as regras de status estão atualizadas e se sua conta participa desta empresa.'
  if (code.includes('unavailable') || code.includes('network-request-failed')) return 'Sem conexão com o Firestore. Verifique a internet e tente novamente.'
  if (code.includes('already-exists')) return 'Já existe um status com este identificador. Tente novamente.'
  return 'Não foi possível cadastrar o status. Tente novamente ou confira as regras do Firestore.'
}

interface SaleStatusQuickCreateModalProps {
  companyId: string
  onClose: () => void
  onCreated: (status: SaleStatus) => void
}

export function SaleStatusQuickCreateModal({ companyId, onClose, onCreated }: SaleStatusQuickCreateModalProps) {
  const { currentUser } = useAuth()
  const [submitError, setSubmitError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SaleStatusFormValues>({
    resolver: zodResolver(saleStatusSchema),
    defaultValues: { name: '', color: DEFAULT_SALE_STATUS_COLOR },
  })

  async function submit(values: SaleStatusFormValues) {
    if (!currentUser) return
    setSubmitError('')
    try {
      onCreated(await createSaleStatus(companyId, currentUser.uid, values.name, values.color))
    } catch (error: unknown) {
      console.error('Falha ao cadastrar status de venda:', error)
      setSubmitError(statusErrorMessage(error))
    }
  }

  return createPortal(<div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) onClose() }}>
    <section className="company-modal sale-status-modal" role="dialog" aria-modal="true" aria-labelledby="sale-status-quick-title">
      <div className="company-modal-heading"><span className="create-icon"><Tag size={18} /></span><button className="modal-close-button" type="button" aria-label="Fechar" onClick={onClose} disabled={isSubmitting}><X size={18} /></button></div>
      <h2 id="sale-status-quick-title">Adicionar status</h2><p>Crie um status para os pedidos desta empresa.</p>
      <form className="form-stack" onSubmit={(event) => { event.stopPropagation(); void handleSubmit(submit)(event) }} noValidate>
        <label className="field-label">Nome do status<input className="sale-status-name-input" autoFocus maxLength={60} placeholder="Ex.: Separando pedido" {...register('name')} />{errors.name?.message && <span className="field-error">{errors.name.message}</span>}</label>
        <FormField id="sale-status-quick-color" label="Cor do status" icon={Palette} type="color" className="sale-status-color-input" registration={register('color')} error={errors.color?.message} />
        {submitError && <p className="field-error" role="alert">{submitError}</p>}
        <button className="primary-button" type="submit" disabled={isSubmitting}><Plus size={16} />{isSubmitting ? 'Salvando…' : 'Salvar status'}</button>
      </form>
    </section>
  </div>, document.body)
}

import { zodResolver } from '@hookform/resolvers/zod'
import { Package, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../hooks/useAuth'
import { createProduct } from '../services/productService'
import { productSchema, type ProductFormValues } from '../schemas/productSchemas'
import type { Product } from '../types/product'

interface ProductCreateModalProps {
  companyId: string
  onClose: () => void
  onCreated: (product: Product) => void
}

export function ProductCreateModal({ companyId, onClose, onCreated }: ProductCreateModalProps) {
  const { currentUser } = useAuth()
  const [submitError, setSubmitError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProductFormValues>({ resolver: zodResolver(productSchema), defaultValues: { name: '' } })

  async function submit(values: ProductFormValues) {
    if (!currentUser) return
    setSubmitError('')
    try {
      const product = await createProduct(companyId, currentUser.uid, values.name)
      onCreated(product)
    } catch (error: unknown) {
      console.error('Falha ao cadastrar produto:', error)
      const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : ''
      setSubmitError(code === 'permission-denied'
        ? 'O Firestore negou o cadastro (permission-denied). Publique as regras atualizadas com: firebase deploy --only firestore:rules --project gestor-comissao'
        : `Não foi possível cadastrar o produto${code ? ` (${code})` : ''}. Confira sua conexão e tente novamente.`)
    }
  }

  return createPortal(<div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) onClose() }}>
    <section className="company-modal product-create-modal" role="dialog" aria-modal="true" aria-labelledby="product-create-title">
      <div className="company-modal-heading"><span className="create-icon"><Package size={18} /></span><button className="modal-close-button" type="button" aria-label="Fechar" onClick={onClose} disabled={isSubmitting}><X size={18} /></button></div>
      <h2 id="product-create-title">Adicionar produto</h2>
      <p>Cadastre um produto para selecionar nesta empresa.</p>
      <form className="form-stack" onSubmit={(event) => {
        event.stopPropagation()
        void handleSubmit(submit)(event)
      }} noValidate>
        <label className="field-label">Nome do produto<input autoFocus maxLength={100} placeholder="Ex.: Plano Premium" {...register('name')} />{errors.name?.message && <span className="field-error">{errors.name.message}</span>}</label>
        {submitError && <p className="field-error" role="alert">{submitError}</p>}
        <button className="primary-button" type="submit" disabled={isSubmitting}><Plus size={16} />{isSubmitting ? 'Salvando…' : 'Salvar produto'}</button>
      </form>
    </section>
  </div>, document.body)
}

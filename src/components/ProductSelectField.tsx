import { CircleAlert, Package, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { getCompanyProducts } from '../services/productService'
import type { Product } from '../types/product'
import { ProductCreateModal } from './ProductCreateModal'

interface ProductSelectFieldProps {
  companyId: string
  value?: string
  onChange: (productId: string) => void
  error?: string
  onProductCreated?: (product: Product) => void
}

export function ProductSelectField({ companyId, value = '', onChange, error: fieldError, onProductCreated }: ProductSelectFieldProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setProducts(await getCompanyProducts(companyId)) }
    catch { setError('Não foi possível carregar os produtos desta empresa.') }
    finally { setLoading(false) }
  }, [companyId])

  useEffect(() => { void Promise.resolve().then(load) }, [load])

  function onCreated(product: Product) {
    setProducts((current) => [...current.filter((item) => item.productId !== product.productId), product].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')))
    onChange(product.productId)
    onProductCreated?.(product)
    setModalOpen(false)
  }

  return <div className="product-select-field">
    <label className="field-label" htmlFor={`sale-product-${companyId}`}>Produto <span className="field-optional">(opcional)</span></label>
    <div className="product-select-control"><span className="product-select-icon"><Package size={16} /></span><select id={`sale-product-${companyId}`} value={value} onChange={(event) => onChange(event.target.value)} disabled={loading} aria-invalid={Boolean(fieldError)}>
      <option value="">{loading ? 'Carregando produtos…' : 'Sem produto'}</option>
      {products.map((product) => <option key={product.productId} value={product.productId}>{product.name}</option>)}
    </select><button type="button" className="product-add-button" aria-label="Cadastrar produto" title="Cadastrar produto" onClick={() => setModalOpen(true)}><Plus size={17} /></button></div>
    {fieldError && <span className="field-error">{fieldError}</span>}
    {error && <span className="product-load-error"><CircleAlert size={13} />{error}<button type="button" onClick={() => void load()}>Tentar novamente</button></span>}
    {modalOpen && <ProductCreateModal companyId={companyId} onClose={() => setModalOpen(false)} onCreated={onCreated} />}
  </div>
}

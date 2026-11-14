import { ArrowLeft, CalendarDays, CircleAlert, Package, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AccountMenu } from '../../components/AccountMenu'
import { BrandMark } from '../../components/BrandMark'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { ProductCreateModal } from '../../components/ProductCreateModal'
import { useAuth } from '../../hooks/useAuth'
import { useCompany } from '../../hooks/useCompany'
import { getCompanyProducts } from '../../services/productService'
import type { Product } from '../../types/product'

export function ProductsPage() {
  const { companyId = '' } = useParams()
  const { currentUser } = useAuth()
  const { companies, activeCompany, loading: loadingCompany, selectCompany } = useCompany()
  const company = companies.find((item) => item.companyId === companyId) ?? null
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setProducts(await getCompanyProducts(companyId)) }
    catch { setError('Não foi possível carregar os produtos. Confira sua conexão e as regras do Firestore.') }
    finally { setLoading(false) }
  }, [companyId])

  useEffect(() => { if (company) void Promise.resolve().then(load) }, [company, load])
  useEffect(() => { if (company && activeCompany?.companyId !== company.companyId) selectCompany(company.companyId) }, [activeCompany?.companyId, company, selectCompany])

  if (loadingCompany) return <LoadingSkeleton variant="products" />
  if (!company || !currentUser) return <Navigate to="/empresas" replace />

  return <main className="products-page">
    <header className="topbar"><BrandMark /><div className="topbar-user"><AccountMenu /></div></header>
    <div className="products-content">
      <div className="products-heading"><div><Link className="sales-back-link" to={`/empresas/${company.companyId}`}><ArrowLeft size={14} /> Dashboard</Link><span className="eyebrow"><Package size={15} /> {company.companyName}</span><h1>Produtos</h1><p>Catálogo de produtos desta empresa.</p></div><button className="primary-button" type="button" onClick={() => setModalOpen(true)}><Plus size={17} /> Adicionar produto</button></div>
      <section className="products-panel" aria-label="Lista de produtos">
        {loading ? <LoadingSkeleton variant="product-list" page={false} rows={3} /> : error ? <div className="company-notice error"><CircleAlert size={17} /><span>{error}</span><button type="button" className="text-link" onClick={() => void load()}>Tentar novamente</button></div> : products.length === 0 ? <div className="products-empty"><span className="company-card-icon"><Package size={20} /></span><h2>Nenhum produto cadastrado</h2><p>Adicione produtos para associá-los às suas vendas. A seleção é opcional.</p><button className="primary-button" type="button" onClick={() => setModalOpen(true)}><Plus size={16} /> Adicionar produto</button></div> : <div className="products-grid">{products.map((product) => <article className="product-card" key={product.productId}><span className="company-card-icon"><Package size={19} /></span><div><h2>{product.name}</h2><p><CalendarDays size={13} /> Criado em {product.createdAt.toDate().toLocaleDateString('pt-BR')}</p></div></article>)}</div>}
      </section>
    </div>
    {modalOpen && <ProductCreateModal companyId={company.companyId} onClose={() => setModalOpen(false)} onCreated={(product) => { setProducts((items) => [...items, product].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))); setModalOpen(false) }} />}
  </main>
}

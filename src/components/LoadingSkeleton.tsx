type LoadingSkeletonVariant =
  | 'app'
  | 'companies'
  | 'company-list'
  | 'products'
  | 'product-list'
  | 'dashboard'
  | 'dashboard-content'
  | 'sales'
  | 'sales-history'
  | 'goals'
  | 'goal-list'
  | 'settings'

interface LoadingSkeletonProps {
  variant?: LoadingSkeletonVariant
  page?: boolean
  rows?: number
}

function Block({ className = '' }: { className?: string }) {
  return <span className={`skeleton-block ${className}`} aria-hidden="true" />
}

function SkeletonCards({ count = 3 }: { count?: number }) {
  return <div className="skeleton-cards">{Array.from({ length: count }, (_, index) => <div className="skeleton-card" key={index}><Block className="skeleton-icon" /><Block className="skeleton-line medium" /><Block className="skeleton-line short" /><Block className="skeleton-line long" /></div>)}</div>
}

function DashboardContent() {
  return <div className="skeleton-dashboard-content" aria-hidden="true">
    <div className="skeleton-metrics"><Block /><Block /><Block /></div>
    <div className="skeleton-panel skeleton-chart"><Block className="skeleton-line medium" /><Block className="skeleton-chart-area" /></div>
    <div className="skeleton-panel"><Block className="skeleton-line medium" /><div className="skeleton-table-rows"><Block /><Block /><Block /></div></div>
  </div>
}

function SalesHistory() {
  return <div className="skeleton-sales-history" aria-hidden="true">
    <div className="skeleton-history-controls"><Block /><Block /><Block /></div>
    <div className="skeleton-table-rows"><Block /><Block /><Block /><Block /></div>
    <div className="skeleton-total"><Block /><Block /></div>
  </div>
}

function VariantContent({ variant, rows = 3 }: { variant: LoadingSkeletonVariant; rows?: number }) {
  if (variant === 'dashboard-content') return <DashboardContent />
  if (variant === 'sales-history') return <SalesHistory />
  if (variant === 'company-list' || variant === 'goal-list' || variant === 'product-list') return <SkeletonCards count={rows} />
  if (variant === 'dashboard') return <DashboardContent />
  if (variant === 'sales') return <div className="skeleton-sales-layout"><div className="skeleton-panel"><Block className="skeleton-line medium" /><Block className="skeleton-field" /><Block className="skeleton-field" /><Block className="skeleton-field tall" /><Block className="skeleton-button" /></div><div className="skeleton-panel"><Block className="skeleton-line medium" /><SalesHistory /></div></div>
  if (variant === 'companies' || variant === 'goals') return <SkeletonCards count={variant === 'companies' ? 3 : 2} />
  if (variant === 'products') return <SkeletonCards count={4} />
  if (variant === 'settings') return <div className="skeleton-panel skeleton-settings"><Block className="skeleton-line medium" /><Block className="skeleton-field" /><Block className="skeleton-field" /><Block className="skeleton-field" /><Block className="skeleton-button" /></div>
  return <div className="skeleton-panel skeleton-app-panel"><Block className="skeleton-line medium" /><Block className="skeleton-field" /><Block className="skeleton-field" /><Block className="skeleton-button" /></div>
}

export function LoadingSkeleton({ variant = 'app', page = true, rows }: LoadingSkeletonProps) {
  return <div className={`loading-skeleton${page ? ' is-page' : ' is-content'}`} role="status" aria-label="Carregando conteúdo" aria-busy="true">
    {page && <div className="skeleton-topbar"><Block className="skeleton-brand-mark" /><Block className="skeleton-brand-name" /><Block className="skeleton-menu" /></div>}
    <div className={`skeleton-body skeleton-body-${variant}`}>
      {page && variant !== 'app' && <div className="skeleton-page-heading"><Block className="skeleton-line short" /><Block className="skeleton-line medium" /><Block className="skeleton-line long" /></div>}
      <VariantContent variant={variant} rows={rows} />
    </div>
    <span className="visually-hidden">Carregando…</span>
  </div>
}

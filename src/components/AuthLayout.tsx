import { Check, ShieldCheck, TrendingUp, WalletCards } from 'lucide-react'
import type { ReactNode } from 'react'
import { BrandMark } from './BrandMark'
import { ThemeToggle } from './ThemeToggle'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <aside className="showcase" aria-label="Sobre o ComissGest">
        <BrandMark />
        <div className="showcase-copy">
          <span className="eyebrow"><TrendingUp size={15} /> Gestão com clareza</span>
          <h1>Seu trabalho merece números claros.</h1>
          <p>
            Organize suas vendas e acompanhe suas comissões em cada empresa,
            com tudo em um só lugar.
          </p>
          <ul className="showcase-points">
            <li><Check size={17} /> Acompanhe seus resultados com facilidade</li>
            <li><Check size={17} /> Tenha suas empresas organizadas</li>
            <li><ShieldCheck size={17} /> Seus dados são privados e protegidos</li>
          </ul>
        </div>
        <div className="showcase-footer">Controle simples para uma rotina mais tranquila.</div>
      </aside>

      <section className="auth-panel">
        <div className="auth-theme-toggle"><ThemeToggle /></div>
        <div className="auth-content">
          <BrandMark className="auth-mobile-brand" />
          {children}
          <p className="auth-legal">
            Ao continuar, você concorda em usar o ComissGest de forma responsável.
          </p>
        </div>
      </section>
    </main>
  )
}

export function AuthHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <header className="auth-heading">
      <span className="eyebrow"><WalletCards size={15} /> {eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  )
}

export function GoogleSignInButton({ onClick, loading = false }: { onClick: () => void; loading?: boolean }) {
  return (
    <button className="auth-google-button" type="button" onClick={onClick} disabled={loading}>
      <GoogleMark />
      {loading ? 'Conectando com Google…' : 'Continuar com Google'}
    </button>
  )
}

function GoogleMark() {
  return <svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.64 5.93c4.46-4.12 7.14-10.19 7.14-17.58Z" />
    <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.98 23.98 0 0 0 0 21.56l7.98-6.19Z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.87l-7.64-5.93c-2.13 1.43-4.85 2.28-8.27 2.28-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
  </svg>
}

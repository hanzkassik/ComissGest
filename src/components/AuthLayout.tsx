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

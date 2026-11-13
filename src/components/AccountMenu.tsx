import { BarChart3, Building2, Check, LogOut, Menu, Receipt, Settings2, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCompany } from '../hooks/useCompany'
import { signOutCurrentUser } from '../services/authService'
import { ThemeToggle } from './ThemeToggle'

interface AccountMenuProps {
  showCompanySwitcher?: boolean
}

export function AccountMenu({ showCompanySwitcher = true }: AccountMenuProps) {
  const { currentUser } = useAuth()
  const { companies, activeCompany, selectCompany } = useCompany()
  const location = useLocation()
  const navigate = useNavigate()
  const [signOutError, setSignOutError] = useState('')
  async function signOut() {
    setSignOutError('')
    try {
      await signOutCurrentUser()
    } catch {
      setSignOutError('Não foi possível sair da conta. Tente novamente.')
    }
  }

  return (
    <details className="dashboard-account-menu app-navigation-menu">
      <summary aria-label="Abrir menu de navegação e conta">
        <Menu className="app-menu-icon-open" size={20} />
        <X className="app-menu-icon-close" size={20} />
      </summary>
      <div className="dashboard-account-popover">
        <div className="dashboard-account-identity"><strong>{currentUser?.displayName || 'Sua conta'}</strong><span>{currentUser?.email}</span></div>
        <nav className="app-navigation-links" aria-label="Navegação principal">
          <Link className={location.pathname === '/empresas' ? 'is-current' : ''} aria-current={location.pathname === '/empresas' ? 'page' : undefined} to="/empresas" onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}><Building2 size={16} />Minhas empresas</Link>
          {showCompanySwitcher && activeCompany && <>
            <Link className={location.pathname === `/empresas/${activeCompany.companyId}` ? 'is-current' : ''} aria-current={location.pathname === `/empresas/${activeCompany.companyId}` ? 'page' : undefined} to={`/empresas/${activeCompany.companyId}`} onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}><BarChart3 size={16} />Dashboard</Link>
            <Link className={location.pathname === `/empresas/${activeCompany.companyId}/vendas` ? 'is-current' : ''} aria-current={location.pathname === `/empresas/${activeCompany.companyId}/vendas` ? 'page' : undefined} to={`/empresas/${activeCompany.companyId}/vendas`} onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}><Receipt size={16} />Vendas</Link>
            <Link className={location.pathname === `/empresas/${activeCompany.companyId}/configuracoes` ? 'is-current' : ''} aria-current={location.pathname === `/empresas/${activeCompany.companyId}/configuracoes` ? 'page' : undefined} to={`/empresas/${activeCompany.companyId}/configuracoes`} onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}><Settings2 size={16} />Configurações da empresa</Link>
          </>}
        </nav>
        {showCompanySwitcher && (
          <>
            <div className="dashboard-account-company"><span>Empresa atual</span><strong><Building2 size={14} />{activeCompany?.companyName ?? 'Selecione uma empresa'}</strong></div>
            <div className="dashboard-company-options" aria-label="Trocar empresa">
              {companies.map((company) => <button key={company.companyId} type="button" className={company.companyId === activeCompany?.companyId ? 'is-current' : ''} onClick={(event) => {
                event.currentTarget.closest('details')?.removeAttribute('open')
                selectCompany(company.companyId)
                navigate(`/empresas/${company.companyId}`)
              }}><span>{company.companyName}</span>{company.companyId === activeCompany?.companyId && <Check size={14} />}</button>)}
            </div>
            <Link className="dashboard-account-action" to="/empresas"><Settings2 size={15} /> Gerenciar empresas</Link>
          </>
        )}
        <Link className="dashboard-account-action" to="/perfil" state={{ from: `${location.pathname}${location.search}${location.hash}` }} onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}><UserRound size={15} /> Meu perfil</Link>
        {signOutError && <p className="dashboard-account-error" role="alert">{signOutError}</p>}
        <div className="dashboard-account-footer"><ThemeToggle /><button className="dashboard-account-action" type="button" onClick={() => void signOut()}><LogOut size={15} /> Sair</button></div>
      </div>
    </details>
  )
}

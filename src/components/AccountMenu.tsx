import { Building2, Check, LogOut, Settings2, UserRound } from 'lucide-react'
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
  const displayName = currentUser?.displayName?.trim() || currentUser?.email?.split('@')[0] || 'Minha conta'
  const initial = Array.from(currentUser?.displayName?.trim() || currentUser?.email || 'U')[0]?.toLocaleUpperCase('pt-BR')

  async function signOut() {
    setSignOutError('')
    try {
      await signOutCurrentUser()
    } catch {
      setSignOutError('Não foi possível sair da conta. Tente novamente.')
    }
  }

  return (
    <details className="dashboard-account-menu">
      <summary aria-label="Abrir menu da conta">
        <span className="dashboard-user-avatar">{initial}</span>
        <span className="dashboard-user-name">{displayName}</span>
        <UserRound size={14} />
      </summary>
      <div className="dashboard-account-popover">
        <div className="dashboard-account-identity"><strong>{currentUser?.displayName || 'Sua conta'}</strong><span>{currentUser?.email}</span></div>
        {showCompanySwitcher && (
          <>
            <div className="dashboard-account-company"><span>Empresa atual</span><strong><Building2 size={14} />{activeCompany?.companyName ?? 'Selecione uma empresa'}</strong></div>
            <div className="dashboard-company-options" aria-label="Trocar empresa">
              {companies.map((company) => <button key={company.companyId} type="button" className={company.companyId === activeCompany?.companyId ? 'is-current' : ''} onClick={() => {
                selectCompany(company.companyId)
                navigate(`/empresas/${company.companyId}`)
              }}><span>{company.companyName}</span>{company.companyId === activeCompany?.companyId && <Check size={14} />}</button>)}
            </div>
            <Link className="dashboard-account-action" to="/empresas"><Settings2 size={15} /> Gerenciar empresas</Link>
          </>
        )}
        <Link className="dashboard-account-action" to="/perfil" state={{ from: `${location.pathname}${location.search}${location.hash}` }}><UserRound size={15} /> Meu perfil</Link>
        {signOutError && <p className="dashboard-account-error" role="alert">{signOutError}</p>}
        <div className="dashboard-account-footer"><ThemeToggle /><button className="dashboard-account-action" type="button" onClick={() => void signOut()}><LogOut size={15} /> Sair</button></div>
      </div>
    </details>
  )
}

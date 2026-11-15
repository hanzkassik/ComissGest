import { ArrowDown, ArrowLeft, ArrowUp, Building2, CircleAlert, Layers3, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AccountMenu } from '../../components/AccountMenu'
import { BrandMark } from '../../components/BrandMark'
import { CustomScreenFormModal } from '../../components/CustomScreenFormModal'
import { SortableList } from '../../components/SortableList'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAuth } from '../../hooks/useAuth'
import { useCompany } from '../../hooks/useCompany'
import { createCompanyScreen, deleteCompanyScreen, getCompanyScreens, reorderCompanyScreens, setCompanyScreenEnabled, updateCompanyScreen } from '../../services/customScreenService'
import type { CustomScreen, CustomScreenFormValues } from '../../types/customScreen'

export function CustomScreensPage() {
  const { companyId = '' } = useParams()
  const { currentUser } = useAuth()
  const { companies, loading: loadingCompanies } = useCompany()
  const company = companies.find((item) => item.companyId === companyId) ?? null
  const [screens, setScreens] = useState<CustomScreen[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [modalScreen, setModalScreen] = useState<CustomScreen | null | undefined>(undefined)

  const loadScreens = useCallback(async () => {
    if (!company || company.role !== 'owner') return
    setLoading(true)
    setError('')
    try {
      setScreens(await getCompanyScreens(company.companyId, true))
    } catch (loadError) {
      console.error('Falha ao carregar telas adicionais:', loadError)
      setError('Não foi possível carregar as telas. Confira sua conexão e as regras do Firestore.')
    } finally {
      setLoading(false)
    }
  }, [company])

  useEffect(() => { void loadScreens() }, [loadScreens])

  async function saveScreen(values: CustomScreenFormValues) {
    if (!company || !currentUser) return
    setSaving(true)
    setError('')
    try {
      if (modalScreen) await updateCompanyScreen(company.companyId, modalScreen.screenId, currentUser.uid, values)
      else await createCompanyScreen(company.companyId, currentUser.uid, values)
      setModalScreen(undefined)
      await loadScreens()
    } catch (saveError) {
      console.error('Falha ao salvar tela adicional:', saveError)
      setError('Não foi possível salvar a tela. Confira sua conexão e as regras publicadas do Firestore.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleScreen(screen: CustomScreen) {
    if (!company || !currentUser) return
    setError('')
    try {
      await setCompanyScreenEnabled(company.companyId, screen.screenId, currentUser.uid, !screen.enabled)
      await loadScreens()
    } catch (toggleError) {
      console.error('Falha ao alterar status da tela:', toggleError)
      setError('Não foi possível alterar o status da tela.')
    }
  }

  async function reorderScreens(screenIds: string[]) {
    if (!company || !currentUser) return
    const screenById = new Map(screens.map((screen) => [screen.screenId, screen]))
    setScreens(screenIds.flatMap((screenId, sortOrder) => {
      const screen = screenById.get(screenId)
      return screen ? [{ ...screen, sortOrder }] : []
    }))
    try {
      await reorderCompanyScreens(company.companyId, currentUser.uid, screenIds)
    } catch (reorderError) {
      console.error('Falha ao reordenar telas adicionais:', reorderError)
      setError('Não foi possível salvar a nova ordem das telas.')
      await loadScreens()
    }
  }

  async function removeScreen(screen: CustomScreen) {
    if (!company || !window.confirm(`Excluir a tela “${screen.name}”? Esta ação não pode ser desfeita.`)) return
    setError('')
    try {
      await deleteCompanyScreen(company.companyId, screen.screenId)
      setScreens((current) => current.filter((item) => item.screenId !== screen.screenId))
    } catch (deleteError) {
      console.error('Falha ao excluir tela adicional:', deleteError)
      setError('Não foi possível excluir a tela. Tente novamente.')
    }
  }

  const screenIds = useMemo(() => screens.map((screen) => screen.screenId), [screens])
  function moveScreen(screenId: string, offset: -1 | 1) {
    const index = screenIds.indexOf(screenId)
    const destination = index + offset
    if (index < 0 || destination < 0 || destination >= screenIds.length) return
    const next = [...screenIds]
    next.splice(index, 1)
    next.splice(destination, 0, screenId)
    void reorderScreens(next)
  }
  if (loadingCompanies) return <LoadingSkeleton variant="companies" />
  if (!company) return <Navigate to="/empresas" replace />
  if (company.role !== 'owner') return <Navigate to={`/empresas/${company.companyId}`} replace />

  return <main className="companies-page custom-screens-page">
    <header className="topbar"><BrandMark /><div className="topbar-user"><AccountMenu /></div></header>
    <div className="companies-content custom-screens-content">
      <Link className="back-link" to={`/empresas/${company.companyId}`}><ArrowLeft size={14} />Dashboard</Link>
      <div className="companies-heading custom-screens-heading">
        <div><span className="eyebrow"><Building2 size={15} />{company.companyName}</span><h1>Construtor de telas</h1><p>Crie páginas adicionais com os indicadores desta empresa.</p></div>
        <button className="primary-button" type="button" onClick={() => { setError(''); setModalScreen(null) }}><Plus size={17} />Nova tela</button>
      </div>

      {error && <div className="custom-screens-error" role="alert"><CircleAlert size={17} />{error}</div>}
      <section className="companies-list-panel custom-screens-list-panel" aria-labelledby="custom-screens-list-title">
        <div className="custom-screens-panel-heading"><span className="create-icon"><Layers3 size={18} /></span><div><h2 id="custom-screens-list-title">Telas da empresa</h2><p>Arraste para ordenar ou use as setas. Telas inativas ficam ocultas no menu.</p></div><span className="company-count">{screens.length} {screens.length === 1 ? 'tela' : 'telas'}</span></div>
        {loading ? <div className="custom-screens-loading"><span className="loading-spinner" />Carregando telas…</div> : screens.length === 0 ? (
          <div className="custom-screens-empty"><Layers3 size={24} /><strong>Nenhuma tela criada</strong><span>Monte uma tela com os indicadores que fazem sentido para acompanhar esta empresa.</span><button className="quiet-button" type="button" onClick={() => setModalScreen(null)}><Plus size={15} />Criar primeira tela</button></div>
        ) : (
          <SortableList
            items={screenIds}
            onReorder={(nextIds) => void reorderScreens(nextIds)}
            className="custom-screens-sortable-list"
            itemClassName="custom-screen-sortable-item"
            renderItem={(screenId, index) => {
              const screen = screens.find((item) => item.screenId === screenId)
              if (!screen) return null
              return <>
                <div className="custom-screen-copy"><span className="company-card-icon"><Layers3 size={17} /></span><div><strong>{screen.name}</strong><span>{screen.visibleIndicators.length} {screen.visibleIndicators.length === 1 ? 'indicador' : 'indicadores'} · {screen.enabled ? 'Visível no menu' : 'Inativa'}</span></div></div>
                <div className="custom-screen-actions">
                  <button className={`custom-screen-status${screen.enabled ? ' is-enabled' : ''}`} type="button" onClick={() => void toggleScreen(screen)} aria-pressed={screen.enabled}>{screen.enabled ? 'Ativa' : 'Inativa'}</button>
                  <button className="quiet-button" type="button" aria-label={`Mover ${screen.name} para cima`} onClick={() => moveScreen(screenId, -1)} disabled={index === 0}><ArrowUp size={15} /></button>
                  <button className="quiet-button" type="button" aria-label={`Mover ${screen.name} para baixo`} onClick={() => moveScreen(screenId, 1)} disabled={index === screenIds.length - 1}><ArrowDown size={15} /></button>
                  <button className="quiet-button" type="button" aria-label={`Editar ${screen.name}`} onClick={() => { setError(''); setModalScreen(screen) }}><Pencil size={15} /></button>
                  <button className="quiet-button custom-screen-delete" type="button" aria-label={`Excluir ${screen.name}`} onClick={() => void removeScreen(screen)}><Trash2 size={15} /></button>
                </div>
              </>
            }}
          />
        )}
      </section>
    </div>
    {modalScreen !== undefined && <CustomScreenFormModal screen={modalScreen ?? undefined} saving={saving} error={error} onClose={() => setModalScreen(undefined)} onSave={saveScreen} />}
  </main>
}

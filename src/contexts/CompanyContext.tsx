import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLocation } from 'react-router-dom'
import type { CompanyFormValues, CompanySettingsValues } from '../schemas/companySchemas'
import type { CompanyMembership } from '../types/company'
import { DEFAULT_BRAND_DARK_PRIMARY, DEFAULT_BRAND_PRIMARY, getBrandPalette } from '../utils/brandColors'
import { CompanyContext } from './company-context'

function storageKey(userId: string) {
  return `comissgest.active-company.${userId}`
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth()
  const location = useLocation()
  const [companies, setCompanies] = useState<CompanyMembership[]>([])
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshCompanies = useCallback(async () => {
    if (!currentUser) return
    setLoading(true)
    setError('')
    try {
      const { getUserCompanies } = await import('../services/companyService')
      const result = await getUserCompanies(currentUser.uid)
      setCompanies(result)
      setLoadedUserId(currentUser.uid)
      const savedCompanyId = window.localStorage.getItem(storageKey(currentUser.uid))
      const selected = result.some((company) => company.companyId === savedCompanyId)
        ? savedCompanyId
        : result[0]?.companyId ?? null
      setActiveCompanyId(selected)
      if (selected) window.localStorage.setItem(storageKey(currentUser.uid), selected)
      else window.localStorage.removeItem(storageKey(currentUser.uid))
    } catch {
      setCompanies([])
      setLoadedUserId(currentUser.uid)
      setActiveCompanyId(null)
      setError('Não foi possível carregar suas empresas. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) return
    const user = currentUser
    let active = true

    async function loadMemberships() {
      try {
        const { getUserCompanies } = await import('../services/companyService')
        const result = await getUserCompanies(user.uid)
        if (!active) return
        setCompanies(result)
        setLoadedUserId(user.uid)
        const savedCompanyId = window.localStorage.getItem(storageKey(user.uid))
        const selected = result.some((company) => company.companyId === savedCompanyId)
          ? savedCompanyId
          : result[0]?.companyId ?? null
        setActiveCompanyId(selected)
        if (selected) window.localStorage.setItem(storageKey(user.uid), selected)
        else window.localStorage.removeItem(storageKey(user.uid))
      } catch {
        if (active) {
          setCompanies([])
          setLoadedUserId(user.uid)
          setActiveCompanyId(null)
          setError('Não foi possível carregar suas empresas. Tente novamente.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadMemberships()
    return () => { active = false }
  }, [currentUser])

  const selectCompany = useCallback((companyId: string) => {
    const belongsToUser = companies.some((company) => company.companyId === companyId)
    if (!belongsToUser || !currentUser) return
    setActiveCompanyId(companyId)
    window.localStorage.setItem(storageKey(currentUser.uid), companyId)
  }, [companies, currentUser])

  const createCompany = useCallback(async (values: CompanyFormValues) => {
    if (!currentUser) throw new Error('Entre na sua conta para criar uma empresa.')
    const { createOwnedCompany } = await import('../services/companyService')
    const companyId = await createOwnedCompany(currentUser.uid, values)
    await refreshCompanies()
    setActiveCompanyId(companyId)
    window.localStorage.setItem(storageKey(currentUser.uid), companyId)
    return companyId
  }, [currentUser, refreshCompanies])

  const updateCompany = useCallback(async (companyId: string, values: CompanySettingsValues) => {
    if (!currentUser) throw new Error('Entre na sua conta para editar uma empresa.')
    const membership = companies.find((company) => company.companyId === companyId)
    if (membership?.role !== 'owner') throw new Error('Somente o proprietário pode editar a empresa.')
    const { updateCompanySettings } = await import('../services/companyService')
    await updateCompanySettings(currentUser.uid, companyId, values)
    await refreshCompanies()
  }, [companies, currentUser, refreshCompanies])

  const visibleCompanies = useMemo(
    () => loadedUserId === currentUser?.uid ? companies : [],
    [loadedUserId, currentUser?.uid, companies],
  )
  const activeCompany = visibleCompanies.find((company) => company.companyId === activeCompanyId) ?? null

  useLayoutEffect(() => {
    const useDefaultBrand = ['/login', '/cadastro', '/recuperar-senha', '/empresas'].includes(location.pathname)
    const lightPrimary = useDefaultBrand ? DEFAULT_BRAND_PRIMARY : activeCompany?.brandPrimary ?? DEFAULT_BRAND_PRIMARY
    const darkPrimary = useDefaultBrand ? DEFAULT_BRAND_DARK_PRIMARY : activeCompany?.brandDarkPrimary ?? DEFAULT_BRAND_DARK_PRIMARY
    const root = document.documentElement
    const lightPalette = getBrandPalette(lightPrimary, 'light')
    const darkPalette = getBrandPalette(darkPrimary, 'dark')
    root.style.setProperty('--brand-light-primary', lightPrimary)
    root.style.setProperty('--brand-light-on-primary', lightPalette.foreground)
    root.style.setProperty('--brand-light-text', lightPalette.text)
    root.style.setProperty('--brand-dark-primary', darkPrimary)
    root.style.setProperty('--brand-dark-on-primary', darkPalette.foreground)
    let favicon = document.querySelector<HTMLLinkElement>('link[data-company-favicon]')
    if (!favicon) {
      favicon = document.createElement('link')
      favicon.rel = 'icon'
      favicon.type = 'image/svg+xml'
      favicon.dataset.companyFavicon = ''
      document.head.appendChild(favicon)
    }
    const faviconColor = /^#[\da-f]{6}$/i.test(lightPrimary) ? lightPrimary : DEFAULT_BRAND_PRIMARY
    const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect x="7" y="20" width="6" height="13" rx="2" fill="${faviconColor}"/><rect x="17" y="12" width="6" height="21" rx="2" fill="${faviconColor}"/><rect x="27" y="6" width="6" height="27" rx="2" fill="${faviconColor}"/></svg>`
    favicon.href = `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`
    const setPalette = (mode: 'light' | 'dark', palette: typeof lightPalette) => {
      const values = {
        text: palette.text,
        'app-text': palette.appText,
        'muted-text': palette.mutedText,
        'placeholder': palette.placeholder,
        'app-background': palette.background,
        'app-header': palette.header,
        'app-surface': palette.surface,
        'app-surface-raised': palette.surfaceRaised,
        'app-control': palette.control,
        'app-border': palette.border,
        'app-soft': palette.soft,
        'app-hover': palette.hover,
        'chart-secondary': palette.chartSecondary,
        'brand-soft': palette.brandSoft,
        'brand-border': palette.brandBorder,
        'brand-hover': palette.brandHover,
        'focus': palette.focus,
        'focus-soft': palette.focusSoft,
        'shadow': palette.shadow,
        'overlay': palette.overlay,
        'status-success': palette.success,
        'status-success-text': palette.successText,
        'status-success-soft': palette.successSoft,
        'status-success-border': palette.successBorder,
        'status-error': palette.error,
        'status-error-text': palette.errorText,
        'status-error-soft': palette.errorSoft,
        'status-error-border': palette.errorBorder,
        'status-warning': palette.warning,
        'status-warning-text': palette.warningText,
        'status-warning-soft': palette.warningSoft,
        'status-warning-border': palette.warningBorder,
        'skeleton-base': palette.surfaceRaised,
        'skeleton-highlight': palette.surface,
      }
      Object.entries(values).forEach(([name, value]) => root.style.setProperty(`--brand-${mode}-${name}`, value))
    }
    setPalette('light', lightPalette)
    setPalette('dark', darkPalette)
  }, [activeCompany?.brandDarkPrimary, activeCompany?.brandPrimary, location.pathname])

  const value = useMemo(() => ({
    companies: visibleCompanies,
    activeCompany,
    loading,
    error,
    createCompany,
    updateCompany,
    selectCompany,
    refreshCompanies,
  }), [visibleCompanies, activeCompany, loading, error, createCompany, updateCompany, selectCompany, refreshCompanies])

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

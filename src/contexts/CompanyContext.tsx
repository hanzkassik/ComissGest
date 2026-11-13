import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { CompanyFormValues, CompanySettingsValues } from '../schemas/companySchemas'
import type { CompanyMembership } from '../types/company'
import { DEFAULT_BRAND_PRIMARY, getBrandForeground, getBrandTextColor } from '../utils/brandColors'
import { CompanyContext } from './company-context'

function storageKey(userId: string) {
  return `comissgest.active-company.${userId}`
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth()
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

  useEffect(() => {
    const primary = activeCompany?.brandPrimary ?? DEFAULT_BRAND_PRIMARY
    const root = document.documentElement
    root.style.setProperty('--brand-primary', primary)
    root.style.setProperty('--brand-on-primary', getBrandForeground(primary))
    root.style.setProperty('--brand-text', getBrandTextColor(primary))
  }, [activeCompany?.brandPrimary])

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

import { useEffect, useState } from 'react'
import type { CustomScreen } from '../types/customScreen'
import { subscribeActiveCompanyScreens } from '../services/customScreenService'

export function useCompanyScreens(companyId?: string) {
  const [screens, setScreens] = useState<CustomScreen[]>([])
  const [loading, setLoading] = useState(Boolean(companyId))
  const [error, setError] = useState('')

  useEffect(() => {
    setScreens([])
    setError('')
    if (!companyId) {
      setLoading(false)
      return
    }
    setLoading(true)
    return subscribeActiveCompanyScreens(companyId, (nextScreens) => {
      setScreens(nextScreens)
      setError('')
      setLoading(false)
    }, (cause) => {
      console.error('Falha ao acompanhar telas adicionais:', cause)
      setScreens([])
      setError('Não foi possível carregar as telas adicionais.')
      setLoading(false)
    })
  }, [companyId])

  return { screens, loading, error }
}

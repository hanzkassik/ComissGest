import { createContext } from 'react'
import type { CompanySettingsValues } from '../schemas/companySchemas'
import type { CompanyMembership } from '../types/company'

export interface CompanyContextValue {
  companies: CompanyMembership[]
  activeCompany: CompanyMembership | null
  loading: boolean
  error: string
  createCompany: (values: { name: string; cnpj?: string }) => Promise<string>
  updateCompany: (companyId: string, values: CompanySettingsValues) => Promise<void>
  selectCompany: (companyId: string) => void
  refreshCompanies: () => Promise<void>
}

export const CompanyContext = createContext<CompanyContextValue | undefined>(undefined)

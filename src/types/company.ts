export type CompanyRole = 'owner' | 'member'

export interface CompanyMembership {
  companyId: string
  companyName: string
  cnpj: string | null
  brandPrimary: string
  role: CompanyRole
}

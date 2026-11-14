export type CompanyRole = 'owner' | 'member'

export interface CompanyMembership {
  companyId: string
  companyName: string
  cnpj: string | null
  brandPrimary: string
  brandDarkPrimary: string
  askForMonthlyGoalIfMissing: boolean
  monthlyGoalReminderMessage: string
  role: CompanyRole
}

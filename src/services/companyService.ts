import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import { firestore } from '../firebase/firestore'
import { DEFAULT_MONTHLY_GOAL_REMINDER_MESSAGE, type CompanyFormValues, type CompanySettingsValues } from '../schemas/companySchemas'
import type { CompanyMembership, CompanyRole } from '../types/company'
import { DEFAULT_BRAND_DARK_PRIMARY, DEFAULT_BRAND_PRIMARY } from '../utils/brandColors'

export async function getUserCompanies(userId: string): Promise<CompanyMembership[]> {
  const memberships = await getDocs(collection(firestore, 'users', userId, 'memberships'))

  return memberships.docs.map((membership) => {
    const data = membership.data()
    const role = data.role
    const primary = data.brandColors?.primary
    const darkPrimary = data.brandColors?.darkPrimary
    if (typeof data.companyId !== 'string' || typeof data.companyName !== 'string'
      || !(typeof data.cnpj === 'string' || data.cnpj === null)
      || (role !== 'owner' && role !== 'member')) {
      throw new Error('Uma associação de empresa contém dados inválidos.')
    }
    return {
      companyId: membership.id,
      companyName: data.companyName,
      cnpj: data.cnpj,
      brandPrimary: typeof primary === 'string' && /^#[0-9a-fA-F]{6}$/.test(primary)
        ? primary
        : DEFAULT_BRAND_PRIMARY,
      brandDarkPrimary: typeof darkPrimary === 'string' && /^#[0-9a-fA-F]{6}$/.test(darkPrimary)
        ? darkPrimary
        : DEFAULT_BRAND_DARK_PRIMARY,
      askForMonthlyGoalIfMissing: typeof data.askForMonthlyGoalIfMissing === 'boolean'
        ? data.askForMonthlyGoalIfMissing
        : true,
      monthlyGoalReminderMessage: typeof data.monthlyGoalReminderMessage === 'string' && data.monthlyGoalReminderMessage.trim()
        ? data.monthlyGoalReminderMessage
        : DEFAULT_MONTHLY_GOAL_REMINDER_MESSAGE,
      role: role as CompanyRole,
    }
  }).sort((a, b) => a.companyName.localeCompare(b.companyName, 'pt-BR'))
}

export async function createOwnedCompany(
  userId: string,
  values: CompanyFormValues,
): Promise<string> {
  const companyRef = doc(collection(firestore, 'companies'))
  const companyId = companyRef.id
  const name = values.name.trim()
  const cnpj = values.cnpj?.replace(/\D/g, '') || null
  const goalSettings = {
    askForMonthlyGoalIfMissing: values.askForMonthlyGoalIfMissing,
    monthlyGoalReminderMessage: values.monthlyGoalReminderMessage.trim() || DEFAULT_MONTHLY_GOAL_REMINDER_MESSAGE,
  }
  const timestamp = serverTimestamp()
  const batch = writeBatch(firestore)

  batch.set(companyRef, {
    name,
    ownerUid: userId,
    cnpj,
    brandColors: { primary: DEFAULT_BRAND_PRIMARY, darkPrimary: DEFAULT_BRAND_DARK_PRIMARY },
    ...goalSettings,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  batch.set(doc(firestore, 'companies', companyId, 'members', userId), {
    uid: userId,
    companyId,
    role: 'owner',
    createdAt: timestamp,
  })
  batch.set(doc(firestore, 'users', userId, 'memberships', companyId), {
    companyId,
    companyName: name,
    cnpj,
    brandColors: { primary: DEFAULT_BRAND_PRIMARY, darkPrimary: DEFAULT_BRAND_DARK_PRIMARY },
    ...goalSettings,
    role: 'owner',
    createdAt: timestamp,
  })

  await batch.commit()
  return companyId
}

export async function updateCompanySettings(
  userId: string,
  companyId: string,
  values: CompanySettingsValues,
): Promise<void> {
  const name = values.name.trim()
  const cnpj = values.cnpj?.replace(/\D/g, '') || null
  const brandColors = { primary: values.primaryColor.toLowerCase(), darkPrimary: values.darkPrimaryColor.toLowerCase() }
  const goalSettings = {
    askForMonthlyGoalIfMissing: values.askForMonthlyGoalIfMissing,
    monthlyGoalReminderMessage: values.monthlyGoalReminderMessage.trim() || DEFAULT_MONTHLY_GOAL_REMINDER_MESSAGE,
  }
  const batch = writeBatch(firestore)

  batch.update(doc(firestore, 'companies', companyId), {
    name,
    cnpj,
    brandColors,
    ...goalSettings,
    updatedAt: serverTimestamp(),
  })
  batch.update(doc(firestore, 'users', userId, 'memberships', companyId), {
    companyName: name,
    cnpj,
    brandColors,
    ...goalSettings,
  })

  await batch.commit()
}

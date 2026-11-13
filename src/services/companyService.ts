import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import { firestore } from '../firebase/firestore'
import type { CompanyFormValues, CompanySettingsValues } from '../schemas/companySchemas'
import type { CompanyMembership, CompanyRole } from '../types/company'
import { DEFAULT_BRAND_PRIMARY } from '../utils/brandColors'

export async function getUserCompanies(userId: string): Promise<CompanyMembership[]> {
  const memberships = await getDocs(collection(firestore, 'users', userId, 'memberships'))

  return memberships.docs.map((membership) => {
    const data = membership.data()
    const role = data.role
    const primary = data.brandColors?.primary
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
  const timestamp = serverTimestamp()
  const batch = writeBatch(firestore)

  batch.set(companyRef, {
    name,
    ownerUid: userId,
    cnpj,
    brandColors: { primary: DEFAULT_BRAND_PRIMARY },
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
    brandColors: { primary: DEFAULT_BRAND_PRIMARY },
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
  const brandColors = { primary: values.primaryColor.toLowerCase() }
  const batch = writeBatch(firestore)

  batch.update(doc(firestore, 'companies', companyId), {
    name,
    cnpj,
    brandColors,
    updatedAt: serverTimestamp(),
  })
  batch.update(doc(firestore, 'users', userId, 'memberships', companyId), {
    companyName: name,
    cnpj,
    brandColors,
  })

  await batch.commit()
}

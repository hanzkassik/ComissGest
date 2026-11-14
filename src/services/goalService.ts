import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { firestore } from '../firebase/firestore'
import type { Goal, GoalFormValues } from '../types/goal'
import { parseBrazilianDecimalToInteger, parseLocalDateStart } from '../utils/currency'

function mapGoal(goalDocument: QueryDocumentSnapshot): Goal {
  const data = goalDocument.data()
  if (typeof data.userId !== 'string'
    || !(data.startDate instanceof Timestamp)
    || !(data.endDate instanceof Timestamp)
    || !Number.isSafeInteger(data.targetCents)
    || !Number.isSafeInteger(data.businessDays)
    || !(data.createdAt instanceof Timestamp)
    || !(data.updatedAt instanceof Timestamp)) {
    throw new Error(`A meta ${goalDocument.id} contém dados inválidos.`)
  }
  return {
    goalId: goalDocument.id,
    userId: data.userId,
    startDate: data.startDate,
    endDate: data.endDate,
    targetCents: data.targetCents,
    businessDays: data.businessDays,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    ...(typeof data.description === 'string' ? { description: data.description } : {}),
  }
}

function goalData(userId: string, values: GoalFormValues) {
  const targetCents = parseBrazilianDecimalToInteger(values.target, 2)
  const businessDays = Number(values.businessDays)
  if (!Number.isSafeInteger(businessDays) || businessDays < 1 || businessDays > 3660) {
    throw new Error('A quantidade de dias úteis é inválida.')
  }
  return {
    userId,
    startDate: Timestamp.fromDate(parseLocalDateStart(values.startDate)),
    endDate: Timestamp.fromDate(parseLocalDateStart(values.endDate)),
    targetCents,
    businessDays,
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
  }
}

export async function getGoals(companyId: string, userId: string): Promise<Goal[]> {
  const goalsQuery = query(collection(firestore, 'companies', companyId, 'goals'), where('userId', '==', userId))
  const snapshot = await getDocs(goalsQuery)
  return snapshot.docs.map(mapGoal).sort((left, right) => left.startDate.toMillis() - right.startDate.toMillis())
}

export async function createGoal(companyId: string, userId: string, values: GoalFormValues): Promise<void> {
  const goalRef = doc(collection(firestore, 'companies', companyId, 'goals'))
  await setDoc(goalRef, {
    ...goalData(userId, values),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateGoal(companyId: string, goalId: string, userId: string, values: GoalFormValues): Promise<void> {
  const data = goalData(userId, values)
  await updateDoc(doc(firestore, 'companies', companyId, 'goals', goalId), {
    ...data,
    description: values.description.trim() ? values.description.trim() : deleteField(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteGoal(companyId: string, goalId: string): Promise<void> {
  await deleteDoc(doc(firestore, 'companies', companyId, 'goals', goalId))
}

export const emptyGoalValues: GoalFormValues = {
  startDate: '',
  endDate: '',
  target: '',
  businessDays: '',
  description: '',
}

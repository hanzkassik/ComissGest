import { createUserWithEmailAndPassword, updateProfile, type User } from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { firebaseAuth } from '../firebase/auth'
import { firestore } from '../firebase/firestore'
import type { RegisterFormValues } from '../schemas/authSchemas'

export async function registerAccount(values: RegisterFormValues): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    firebaseAuth,
    values.email,
    values.password,
  )
  const name = values.name.trim()
  const cpf = values.cpf?.replace(/\D/g, '') || null

  await updateProfile(credential.user, { displayName: name })
  await setDoc(doc(firestore, 'users', credential.user.uid), {
    uid: credential.user.uid,
    name,
    email: credential.user.email,
    cpf,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return credential.user
}

export async function saveProfile(
  user: User,
  values: { name: string; cpf: string | null },
): Promise<void> {
  const name = values.name.trim()
  await updateProfile(user, { displayName: name })
  await setDoc(doc(firestore, 'users', user.uid), {
    uid: user.uid,
    name,
    email: user.email,
    cpf: values.cpf,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

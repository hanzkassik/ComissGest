import { createUserWithEmailAndPassword, updateProfile, type User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { firebaseAuth } from '../firebase/auth'
import { firestore } from '../firebase/firestore'
import { signInWithGoogle } from './authService'
import type { RegisterFormValues } from '../schemas/authSchemas'

export async function registerAccount(values: RegisterFormValues): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    firebaseAuth,
    values.email,
    values.password,
  )
  const name = values.name.trim()
  const cpf = values.cpf?.replace(/\D/g, '') || null
  const phone = values.phone || null

  await updateProfile(credential.user, { displayName: name })
  await setDoc(doc(firestore, 'users', credential.user.uid), {
    uid: credential.user.uid,
    name,
    email: credential.user.email,
    cpf,
    phone,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return credential.user
}

export async function saveProfile(
  user: User,
  values: { name: string; cpf: string | null; phone: string | null },
): Promise<void> {
  const name = values.name.trim()
  await updateProfile(user, { displayName: name })
  await setDoc(doc(firestore, 'users', user.uid), {
    uid: user.uid,
    name,
    email: user.email,
    cpf: values.cpf,
    phone: values.phone,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function signInWithGoogleAccount(): Promise<User> {
  const user = await signInWithGoogle()
  const userRef = doc(firestore, 'users', user.uid)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName ?? '',
      email: user.email,
      cpf: null,
      phone: user.phoneNumber,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return user
  }

  const profile = snapshot.data()
  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() }
  if (typeof profile.name !== 'string' && user.displayName) updates.name = user.displayName
  if (typeof profile.email !== 'string' && user.email) updates.email = user.email
  if (typeof profile.phone !== 'string') updates.phone = user.phoneNumber
  await updateDoc(userRef, updates)
  return user
}

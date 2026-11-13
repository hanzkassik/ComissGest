import { FirebaseError } from 'firebase/app'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  verifyBeforeUpdateEmail,
  type User,
} from 'firebase/auth'
import { firebaseAuth } from '../firebase/auth'

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(firebaseAuth, email, password)
  return credential.user
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(firebaseAuth, email)
}

function emailCredential(user: User, currentPassword: string) {
  if (!user.email) {
    throw new Error('Esta conta não possui e-mail para autenticação por senha.')
  }
  return EmailAuthProvider.credential(user.email, currentPassword)
}

export async function requestEmailChange(
  user: User,
  newEmail: string,
  currentPassword: string,
): Promise<void> {
  await reauthenticateWithCredential(user, emailCredential(user, currentPassword))
  await verifyBeforeUpdateEmail(user, newEmail)
}

export async function changePassword(
  user: User,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await reauthenticateWithCredential(user, emailCredential(user, currentPassword))
  await updatePassword(user, newPassword)
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut(firebaseAuth)
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    const messages: Record<string, string> = {
      'auth/email-already-in-use': 'Já existe uma conta com este e-mail.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/invalid-email': 'O e-mail informado é inválido.',
      'auth/weak-password': 'Escolha uma senha mais forte.',
      'auth/user-disabled': 'Esta conta está desativada.',
      'auth/user-not-found': 'Não encontramos uma conta com este e-mail.',
      'auth/wrong-password': 'E-mail ou senha incorretos.',
      'auth/requires-recent-login': 'Entre novamente para concluir esta alteração.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
      'auth/network-request-failed': 'Falha de conexão. Confira sua internet e tente novamente.',
      'auth/operation-not-allowed': 'Este método de acesso ainda não está habilitado no Firebase.',
      'auth/configuration-not-found': 'A configuração do Firebase Authentication não está completa.',
    }
    return messages[error.code] ?? 'Não foi possível concluir. Tente novamente.'
  }

  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
}

export function isUnknownEmailError(error: unknown): boolean {
  return error instanceof FirebaseError && error.code === 'auth/user-not-found'
}

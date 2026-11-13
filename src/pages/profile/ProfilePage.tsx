import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CheckCircle2, KeyRound, LogOut, Mail, Save, ShieldCheck, UserRound } from 'lucide-react'
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { BrandMark } from '../../components/BrandMark'
import { ThemeToggle } from '../../components/ThemeToggle'
import { FormField } from '../../components/FormField'
import { useAuth } from '../../hooks/useAuth'
import { useCompany } from '../../hooks/useCompany'
import {
  changePassword,
  getAuthErrorMessage,
  requestEmailChange,
  signOutCurrentUser,
} from '../../services/authService'
import { saveProfile } from '../../services/accountService'
import {
  emailChangeSchema,
  passwordChangeSchema,
  profileSchema,
  type EmailChangeFormValues,
  type PasswordChangeFormValues,
  type ProfileFormValues,
} from '../../schemas/authSchemas'
import { firestore } from '../../firebase/firestore'

type Feedback = { kind: 'success' | 'error'; text: string }

export function ProfilePage() {
  const { currentUser } = useAuth()
  const { activeCompany } = useCompany()
  const location = useLocation()
  const navigate = useNavigate()
  const navigationState = location.state as { from?: unknown } | null
  const origin = navigationState?.from
  const returnTo = typeof origin === 'string'
    && origin.startsWith('/')
    && !origin.startsWith('//')
    && !origin.startsWith('/\\')
    && origin !== '/perfil'
    ? origin
    : activeCompany ? `/empresas/${activeCompany.companyId}` : '/empresas'
  const [profileFeedback, setProfileFeedback] = useState<Feedback | null>(null)
  const [emailFeedback, setEmailFeedback] = useState<Feedback | null>(null)
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: currentUser?.displayName ?? '', cpf: '' },
  })
  const emailForm = useForm<EmailChangeFormValues>({ resolver: zodResolver(emailChangeSchema) })
  const passwordForm = useForm<PasswordChangeFormValues>({ resolver: zodResolver(passwordChangeSchema) })

  useEffect(() => {
    if (!currentUser) return
    const user = currentUser
    let active = true

    async function loadProfile() {
      setProfileLoading(true)
      try {
        const profileRef = doc(firestore, 'users', user.uid)
        const snapshot = await getDoc(profileRef)
        const data = snapshot.data()
        const name = typeof data?.name === 'string' ? data.name : user.displayName ?? ''
        const cpf = typeof data?.cpf === 'string' ? data.cpf : ''
        if (!active) return
        profileForm.reset({ name, cpf })

        // A Firebase email change takes effect only after the user follows the verification link.
        if (snapshot.exists() && typeof user.email === 'string'
          && data?.email !== user.email) {
          await updateDoc(profileRef, {
            email: user.email,
            updatedAt: serverTimestamp(),
          })
        }
      } catch {
        if (active) {
          setProfileFeedback({ kind: 'error', text: 'Não foi possível carregar seus dados. Tente novamente.' })
        }
      } finally {
        if (active) setProfileLoading(false)
      }
    }

    void loadProfile()
    return () => { active = false }
  }, [currentUser, profileForm])

  async function onSaveProfile(values: ProfileFormValues) {
    if (!currentUser) return
    setProfileFeedback(null)
    try {
      await saveProfile(currentUser, {
        name: values.name,
        cpf: values.cpf?.replace(/\D/g, '') || null,
      })
      profileForm.reset({ name: values.name.trim(), cpf: values.cpf?.replace(/\D/g, '') ?? '' })
      setProfileFeedback({ kind: 'success', text: 'Seu perfil foi atualizado.' })
    } catch (error) {
      setProfileFeedback({ kind: 'error', text: getAuthErrorMessage(error) })
    }
  }

  async function onRequestEmailChange(values: EmailChangeFormValues) {
    if (!currentUser) return
    setEmailFeedback(null)
    try {
      await requestEmailChange(currentUser, values.email, values.currentPassword)
      emailForm.reset()
      setEmailFeedback({
        kind: 'success',
        text: `Enviamos um link de confirmação para ${values.email}. O e-mail muda depois que você confirmar o link.`,
      })
    } catch (error) {
      setEmailFeedback({ kind: 'error', text: getAuthErrorMessage(error) })
    }
  }

  async function onChangePassword(values: PasswordChangeFormValues) {
    if (!currentUser) return
    setPasswordFeedback(null)
    try {
      await changePassword(currentUser, values.currentPassword, values.password)
      passwordForm.reset()
      setPasswordFeedback({ kind: 'success', text: 'Sua senha foi alterada.' })
    } catch (error) {
      setPasswordFeedback({ kind: 'error', text: getAuthErrorMessage(error) })
    }
  }

  if (!currentUser) return null

  return (
    <main className="profile-page">
      <header className="topbar">
        <BrandMark />
        <div className="topbar-user">
          <button className="quiet-button profile-back-button" type="button" onClick={() => navigate(returnTo)}><ArrowLeft size={15} /> Voltar</button>
          <span className="topbar-email">{currentUser.email}</span>
          <ThemeToggle />
          <button className="quiet-button" type="button" onClick={() => {
            void signOutCurrentUser().catch((error: unknown) => {
              setProfileFeedback({ kind: 'error', text: getAuthErrorMessage(error) })
            })
          }}>
            <LogOut size={15} /> Sair
          </button>
        </div>
      </header>

      <div className="profile-content">
        <header className="profile-title">
          <span className="eyebrow"><ShieldCheck size={15} /> Conta pessoal</span>
          <h1>Seu perfil</h1>
          <p>Gerencie seus dados de acesso e mantenha suas informações atualizadas.</p>
        </header>

        <div className="profile-grid">
          <section className="profile-card">
            <h2>Informações pessoais</h2>
            <p>Esses dados identificam você no ComissGest.</p>
            <form className="form-stack" onSubmit={profileForm.handleSubmit(onSaveProfile)} noValidate>
              <FormField
                id="profile-name"
                label="Nome completo"
                icon={UserRound}
                type="text"
                autoComplete="name"
                registration={profileForm.register('name')}
                error={profileForm.formState.errors.name?.message}
              />
              <FormField
                id="profile-cpf"
                label="CPF (opcional)"
                icon={UserRound}
                type="text"
                inputMode="numeric"
                maxLength={14}
                placeholder="000.000.000-00"
                registration={profileForm.register('cpf')}
                error={profileForm.formState.errors.cpf?.message}
              />
              {profileFeedback && <FeedbackMessage feedback={profileFeedback} />}
              <button className="primary-button" type="submit" disabled={profileLoading || profileForm.formState.isSubmitting}>
                <Save size={16} /> {profileForm.formState.isSubmitting ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </form>
          </section>

          <div className="profile-security">
            <section className="profile-card">
              <h2>Alterar e-mail</h2>
              <p>Enviaremos um link para confirmar o novo endereço. Confirme antes de sair da conta.</p>
              <form className="form-stack" onSubmit={emailForm.handleSubmit(onRequestEmailChange)} noValidate>
                <FormField
                  id="new-email"
                  label="Novo e-mail"
                  icon={Mail}
                  type="email"
                  autoComplete="email"
                  registration={emailForm.register('email')}
                  error={emailForm.formState.errors.email?.message}
                />
                <FormField
                  id="email-current-password"
                  label="Senha atual"
                  icon={KeyRound}
                  type="password"
                  autoComplete="current-password"
                  registration={emailForm.register('currentPassword')}
                  error={emailForm.formState.errors.currentPassword?.message}
                />
                {emailFeedback && <FeedbackMessage feedback={emailFeedback} />}
                <button className="primary-button" type="submit" disabled={emailForm.formState.isSubmitting}>
                  {emailForm.formState.isSubmitting ? 'Enviando…' : 'Enviar confirmação'}
                </button>
              </form>
            </section>

            <section className="profile-card">
              <h2>Alterar senha</h2>
              <p>Por segurança, confirme sua senha atual para escolher uma nova.</p>
              <form className="form-stack" onSubmit={passwordForm.handleSubmit(onChangePassword)} noValidate>
                <FormField
                  id="password-current"
                  label="Senha atual"
                  icon={KeyRound}
                  type="password"
                  autoComplete="current-password"
                  registration={passwordForm.register('currentPassword')}
                  error={passwordForm.formState.errors.currentPassword?.message}
                />
                <FormField
                  id="password-new"
                  label="Nova senha"
                  icon={KeyRound}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo de 8 caracteres"
                  registration={passwordForm.register('password')}
                  error={passwordForm.formState.errors.password?.message}
                />
                <FormField
                  id="password-confirm"
                  label="Confirme a nova senha"
                  icon={KeyRound}
                  type="password"
                  autoComplete="new-password"
                  registration={passwordForm.register('confirmPassword')}
                  error={passwordForm.formState.errors.confirmPassword?.message}
                />
                {passwordFeedback && <FeedbackMessage feedback={passwordFeedback} />}
                <button className="primary-button" type="submit" disabled={passwordForm.formState.isSubmitting}>
                  {passwordForm.formState.isSubmitting ? 'Atualizando…' : 'Atualizar senha'}
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  return (
    <div className={`inline-message${feedback.kind === 'error' ? ' error' : ''}`} role="status">
      {feedback.kind === 'success' && <CheckCircle2 size={17} />}
      <span>{feedback.text}</span>
    </div>
  )
}

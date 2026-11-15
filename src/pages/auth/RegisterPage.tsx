import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AuthHeading, AuthLayout, GoogleSignInButton } from '../../components/AuthLayout'
import { FormField } from '../../components/FormField'
import { PhoneField } from '../../components/PhoneField'
import { PublicOnlyRoute } from '../../components/ProtectedRoute'
import { registerSchema, type RegisterFormValues } from '../../schemas/authSchemas'
import { getAuthErrorMessage } from '../../services/authService'
import { registerAccount, signInWithGoogleAccount } from '../../services/accountService'

export function RegisterPage() {
  const [message, setMessage] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  async function onSubmit(values: RegisterFormValues) {
    setMessage('')
    try {
      await registerAccount(values)
    } catch (error) {
      setMessage(getAuthErrorMessage(error))
    }
  }

  async function onGoogleSignIn() {
    setMessage('')
    setGoogleLoading(true)
    try {
      await signInWithGoogleAccount()
    } catch (error) {
      setMessage(getAuthErrorMessage(error))
    } finally {
      setGoogleLoading(false)
    }
  }

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { phone: '' },
  })

  return (
    <PublicOnlyRoute>
      <AuthLayout>
        <AuthHeading
          eyebrow="Comece por você"
          title="Crie sua conta"
          description="Seus dados ficam organizados em um único lugar."
        />
        <GoogleSignInButton onClick={onGoogleSignIn} loading={googleLoading} />
        <div className="auth-divider"><span>ou crie com seus dados</span></div>
        <form className="form-stack" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FormField
            id="name"
            label="Nome completo"
            icon={UserRound}
            type="text"
            placeholder="Como podemos chamar você?"
            autoComplete="name"
            registration={form.register('name')}
            error={form.formState.errors.name?.message}
          />
          <Controller
            control={form.control}
            name="phone"
            render={({ field }) => <PhoneField id="register-phone" value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={form.formState.errors.phone?.message} />}
          />
          <FormField
            id="email"
            label="E-mail"
            icon={Mail}
            type="email"
            placeholder="voce@empresa.com.br"
            autoComplete="email"
            registration={form.register('email')}
            error={form.formState.errors.email?.message}
          />
          <FormField
            id="cpf"
            label="CPF (opcional)"
            icon={UserRound}
            type="text"
            placeholder="000.000.000-00"
            inputMode="numeric"
            autoComplete="off"
            maxLength={14}
            registration={form.register('cpf')}
            error={form.formState.errors.cpf?.message}
          />
          <FormField
            id="password"
            label="Senha"
            icon={LockKeyhole}
            type="password"
            placeholder="Mínimo de 8 caracteres"
            autoComplete="new-password"
            registration={form.register('password')}
            error={form.formState.errors.password?.message}
          />
          <FormField
            id="confirmPassword"
            label="Confirme sua senha"
            icon={LockKeyhole}
            type="password"
            placeholder="Digite a senha novamente"
            autoComplete="new-password"
            registration={form.register('confirmPassword')}
            error={form.formState.errors.confirmPassword?.message}
          />
          {message && <div className="inline-message error" role="alert">{message}</div>}
          <button className="primary-button" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Criando conta…' : 'Criar conta'} <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          Já tem uma conta?<Link className="text-link" to="/login">Entrar</Link>
        </p>
      </AuthLayout>
    </PublicOnlyRoute>
  )
}

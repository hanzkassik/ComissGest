import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AuthHeading, AuthLayout } from '../../components/AuthLayout'
import { FormField } from '../../components/FormField'
import { PublicOnlyRoute } from '../../components/ProtectedRoute'
import { registerSchema, type RegisterFormValues } from '../../schemas/authSchemas'
import { getAuthErrorMessage } from '../../services/authService'
import { registerAccount } from '../../services/accountService'

export function RegisterPage() {
  const [message, setMessage] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(values: RegisterFormValues) {
    setMessage('')
    try {
      await registerAccount(values)
    } catch (error) {
      setMessage(getAuthErrorMessage(error))
    }
  }

  return (
    <PublicOnlyRoute>
      <AuthLayout>
        <AuthHeading
          eyebrow="Comece por você"
          title="Crie sua conta"
          description="Seus dados ficam organizados em um único lugar."
        />
        <form className="form-stack" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField
            id="name"
            label="Nome completo"
            icon={UserRound}
            type="text"
            placeholder="Como podemos chamar você?"
            autoComplete="name"
            registration={register('name')}
            error={errors.name?.message}
          />
          <FormField
            id="email"
            label="E-mail"
            icon={Mail}
            type="email"
            placeholder="voce@empresa.com.br"
            autoComplete="email"
            registration={register('email')}
            error={errors.email?.message}
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
            registration={register('cpf')}
            error={errors.cpf?.message}
          />
          <FormField
            id="password"
            label="Senha"
            icon={LockKeyhole}
            type="password"
            placeholder="Mínimo de 8 caracteres"
            autoComplete="new-password"
            registration={register('password')}
            error={errors.password?.message}
          />
          <FormField
            id="confirmPassword"
            label="Confirme sua senha"
            icon={LockKeyhole}
            type="password"
            placeholder="Digite a senha novamente"
            autoComplete="new-password"
            registration={register('confirmPassword')}
            error={errors.confirmPassword?.message}
          />
          {message && <div className="inline-message error" role="alert">{message}</div>}
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Criando conta…' : 'Criar conta'} <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          Já tem uma conta?<Link className="text-link" to="/login">Entrar</Link>
        </p>
      </AuthLayout>
    </PublicOnlyRoute>
  )
}

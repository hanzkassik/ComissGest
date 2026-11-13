import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AuthHeading, AuthLayout } from '../../components/AuthLayout'
import { FormField } from '../../components/FormField'
import { PublicOnlyRoute } from '../../components/ProtectedRoute'
import { getAuthErrorMessage, signIn } from '../../services/authService'
import { loginSchema, type LoginFormValues } from '../../schemas/authSchemas'

export function LoginPage() {
  const [message, setMessage] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(values: LoginFormValues) {
    setMessage('')
    try {
      await signIn(values.email, values.password)
    } catch (error) {
      setMessage(getAuthErrorMessage(error))
    }
  }

  return (
    <PublicOnlyRoute>
      <AuthLayout>
        <AuthHeading
          eyebrow="Bem-vindo de volta"
          title="Entre na sua conta"
          description="Acesse suas informações e acompanhe sua rotina de vendas."
        />
        <form className="form-stack" onSubmit={handleSubmit(onSubmit)} noValidate>
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
            id="password"
            label="Senha"
            icon={LockKeyhole}
            type="password"
            placeholder="Sua senha"
            autoComplete="current-password"
            registration={register('password')}
            error={errors.password?.message}
          />
          <div className="form-options">
            <Link className="text-link" to="/recuperar-senha">Esqueci minha senha</Link>
          </div>
          {message && <div className="inline-message error" role="alert">{message}</div>}
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'} <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          Ainda não tem uma conta?<Link className="text-link" to="/cadastro">Criar conta</Link>
        </p>
      </AuthLayout>
    </PublicOnlyRoute>
  )
}

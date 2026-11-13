import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AuthHeading, AuthLayout } from '../../components/AuthLayout'
import { FormField } from '../../components/FormField'
import { PublicOnlyRoute } from '../../components/ProtectedRoute'
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../../schemas/authSchemas'
import { getAuthErrorMessage, isUnknownEmailError, requestPasswordReset } from '../../services/authService'

export function ForgotPasswordPage() {
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  async function onSubmit(values: ForgotPasswordFormValues) {
    setMessage('')
    try {
      await requestPasswordReset(values.email)
      setSent(true)
    } catch (error) {
      if (isUnknownEmailError(error)) {
        setSent(true)
      } else {
        setMessage(getAuthErrorMessage(error))
      }
    }
  }

  return (
    <PublicOnlyRoute>
      <AuthLayout>
        <AuthHeading
          eyebrow="Recuperação de acesso"
          title={sent ? 'Confira seu e-mail' : 'Redefina sua senha'}
          description={sent
            ? 'Se houver uma conta para este endereço, você receberá um link para criar outra senha.'
            : 'Informe o e-mail da sua conta e enviaremos um link de redefinição.'}
        />
        {sent ? (
          <div className="inline-message"><CheckCircle2 size={18} /> Pedido enviado. Verifique sua caixa de entrada e a pasta de spam.</div>
        ) : (
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
            {message && <div className="inline-message error" role="alert">{message}</div>}
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando…' : 'Enviar link de recuperação'}
            </button>
          </form>
        )}
        <p className="auth-switch">
          <Link className="text-link" to="/login"><ArrowLeft size={14} /> Voltar para entrar</Link>
        </p>
      </AuthLayout>
    </PublicOnlyRoute>
  )
}

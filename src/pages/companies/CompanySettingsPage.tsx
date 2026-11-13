import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, CheckCircle2, Palette, Save } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Navigate, useParams } from 'react-router-dom'
import { BrandMark } from '../../components/BrandMark'
import { AccountMenu } from '../../components/AccountMenu'
import { FormField } from '../../components/FormField'
import { useAuth } from '../../hooks/useAuth'
import { useCompany } from '../../hooks/useCompany'
import { companySettingsSchema, type CompanySettingsValues } from '../../schemas/companySchemas'
import { getBrandForeground } from '../../utils/brandColors'

export function CompanySettingsPage() {
  const { companyId = '' } = useParams()
  const { currentUser } = useAuth()
  const { companies, loading, updateCompany } = useCompany()
  const company = companies.find((item) => item.companyId === companyId)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, control } = useForm<CompanySettingsValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: { name: '', cnpj: '', primaryColor: '#187f63' },
  })
  const primaryColor = useWatch({ control, name: 'primaryColor' }) || '#187f63'
  const companyName = useWatch({ control, name: 'name' })

  useEffect(() => {
    if (!company) return
    reset({
      name: company.companyName,
      cnpj: company.cnpj ?? '',
      primaryColor: company.brandPrimary,
    })
  }, [company, reset])

  if (loading) return <div className="loading-screen">Carregando empresa…</div>
  if (!currentUser || !company) return <Navigate to="/empresas" replace />
  if (company.role !== 'owner') return <Navigate to="/empresas" replace />

  async function onSubmit(values: CompanySettingsValues) {
    setMessage('')
    setFailed(false)
    try {
      await updateCompany(companyId, values)
      setMessage('As configurações da empresa foram salvas.')
    } catch {
      setFailed(true)
      setMessage('Não foi possível salvar. Confirme se as regras atualizadas do Firestore foram publicadas.')
    }
  }

  const previewStyle = {
    '--preview-primary': primaryColor,
    '--preview-foreground': getBrandForeground(primaryColor),
  } as CSSProperties

  return (
    <main className="company-settings-page">
      <header className="topbar">
        <BrandMark />
        <div className="topbar-user">
          <AccountMenu />
        </div>
      </header>

      <div className="company-settings-content">
        <div className="company-settings-heading">
          <span className="eyebrow"><Building2 size={15} /> Configurações da empresa</span>
          <h1>{company.companyName}</h1>
          <p>Atualize os dados e a cor que identifica este espaço.</p>
        </div>

        <div className="company-settings-grid">
          <section className="profile-card company-settings-card">
            <h2>Dados da empresa</h2>
            <p>As alterações serão refletidas na sua lista de empresas.</p>
            <form className="form-stack" onSubmit={handleSubmit(onSubmit)} noValidate>
              <FormField
                id="settings-company-name"
                label="Nome da empresa"
                icon={Building2}
                type="text"
                autoComplete="organization"
                registration={register('name')}
                error={errors.name?.message}
              />
              <FormField
                id="settings-company-cnpj"
                label="CNPJ (opcional)"
                icon={Building2}
                type="text"
                inputMode="numeric"
                maxLength={18}
                placeholder="00.000.000/0000-00"
                registration={register('cnpj')}
                error={errors.cnpj?.message}
              />
              <FormField
                id="settings-company-color"
                label="Cor principal"
                icon={Palette}
                type="color"
                registration={register('primaryColor')}
                error={errors.primaryColor?.message}
              />
              <p className="color-help">Essa cor aparece nos destaques enquanto esta empresa estiver selecionada.</p>
              {message && (
                <div className={`inline-message${failed ? ' error' : ''}`} role="status">
                  {!failed && <CheckCircle2 size={17} />}<span>{message}</span>
                </div>
              )}
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                <Save size={16} /> {isSubmitting ? 'Salvando…' : 'Salvar configurações'}
              </button>
            </form>
          </section>

          <aside className="company-preview-card" style={previewStyle}>
            <span className="preview-caption">Prévia da identidade</span>
            <div className="preview-company-mark"><Building2 size={20} /></div>
            <h2>{companyName || company.companyName}</h2>
            <p>Esta é uma amostra da cor escolhida para a empresa.</p>
            <button className="preview-action" type="button">Destaque da empresa</button>
            <span className="preview-color-value">{primaryColor.toUpperCase()}</span>
          </aside>
        </div>
      </div>
    </main>
  )
}

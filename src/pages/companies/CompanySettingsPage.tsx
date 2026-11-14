import { zodResolver } from '@hookform/resolvers/zod'
import { FirebaseError } from 'firebase/app'
import { Building2, CheckCircle2, Palette, RotateCcw, Save } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Navigate, useParams } from 'react-router-dom'
import { BrandMark } from '../../components/BrandMark'
import { AccountMenu } from '../../components/AccountMenu'
import { FormField } from '../../components/FormField'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAuth } from '../../hooks/useAuth'
import { useCompany } from '../../hooks/useCompany'
import { companySettingsSchema, DEFAULT_COMPANY_DARK_PRIMARY, DEFAULT_MONTHLY_GOAL_REMINDER_MESSAGE, type CompanySettingsInput, type CompanySettingsValues } from '../../schemas/companySchemas'
import { DEFAULT_BRAND_PRIMARY, getBrandForeground, getBrandPalette } from '../../utils/brandColors'

export function CompanySettingsPage() {
  const { companyId = '' } = useParams()
  const { currentUser } = useAuth()
  const { companies, loading, updateCompany } = useCompany()
  const company = companies.find((item) => item.companyId === companyId)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, control, setValue } = useForm<CompanySettingsInput, unknown, CompanySettingsValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: { name: '', cnpj: '', primaryColor: DEFAULT_BRAND_PRIMARY, darkPrimaryColor: DEFAULT_COMPANY_DARK_PRIMARY, askForMonthlyGoalIfMissing: true, monthlyGoalReminderMessage: DEFAULT_MONTHLY_GOAL_REMINDER_MESSAGE },
  })
  const primaryColor = useWatch({ control, name: 'primaryColor' }) || DEFAULT_BRAND_PRIMARY
  const darkPrimaryColor = useWatch({ control, name: 'darkPrimaryColor' }) || DEFAULT_COMPANY_DARK_PRIMARY
  const companyName = useWatch({ control, name: 'name' })
  const askForMonthlyGoalIfMissing = useWatch({ control, name: 'askForMonthlyGoalIfMissing' })
  const lightPalette = useMemo(() => getBrandPalette(primaryColor, 'light'), [primaryColor])
  const darkPalette = useMemo(() => getBrandPalette(darkPrimaryColor, 'dark'), [darkPrimaryColor])

  useEffect(() => {
    if (!company) return
    reset({
      name: company.companyName,
      cnpj: company.cnpj ?? '',
      primaryColor: company.brandPrimary,
      darkPrimaryColor: company.brandDarkPrimary,
      askForMonthlyGoalIfMissing: company.askForMonthlyGoalIfMissing,
      monthlyGoalReminderMessage: company.monthlyGoalReminderMessage,
    })
  }, [company, reset])

  if (loading) return <LoadingSkeleton variant="settings" />
  if (!currentUser || !company) return <Navigate to="/empresas" replace />
  if (company.role !== 'owner') return <Navigate to="/empresas" replace />

  async function onSubmit(values: CompanySettingsValues) {
    setMessage('')
    setFailed(false)
    try {
      await updateCompany(companyId, values)
      setMessage('As configurações da empresa foram salvas.')
    } catch (error) {
      setFailed(true)
      if (error instanceof FirebaseError && error.code === 'permission-denied') {
        setMessage('O Firestore recusou a alteração. Publique as regras atualizadas com: firebase deploy --only firestore:rules --project gestor-comissao')
      } else if (error instanceof FirebaseError) {
        setMessage(`Não foi possível salvar as configurações (Firebase: ${error.code}). Tente novamente.`)
      } else {
        setMessage('Não foi possível salvar as configurações. Verifique sua conexão e tente novamente.')
      }
    }
  }

  const previewStyle = {
    '--preview-primary': primaryColor,
    '--preview-foreground': getBrandForeground(primaryColor),
    '--preview-surface': lightPalette.surface,
    '--preview-border': lightPalette.border,
    '--preview-text': lightPalette.appText,
    '--preview-muted': lightPalette.mutedText,
  } as CSSProperties
  const darkPreviewStyle = {
    '--preview-primary': darkPrimaryColor,
    '--preview-foreground': getBrandForeground(darkPrimaryColor),
    '--preview-surface': darkPalette.surface,
    '--preview-border': darkPalette.border,
    '--preview-text': darkPalette.appText,
    '--preview-muted': darkPalette.mutedText,
  } as CSSProperties
  const resetColor = (field: 'primaryColor' | 'darkPrimaryColor', value: string) => {
    setValue(field, value, { shouldDirty: true, shouldValidate: true })
  }
  const paletteSwatches = [
    ['Destaque', 'primary'], ['Texto do destaque', 'foreground'], ['Texto derivado da marca', 'text'],
    ['Texto principal', 'appText'], ['Texto secundário', 'mutedText'], ['Texto de placeholder', 'placeholder'],
    ['Fundo da tela', 'background'], ['Cabeçalho', 'header'], ['Cartão', 'surface'],
    ['Cartão elevado', 'surfaceRaised'], ['Campo', 'control'], ['Borda', 'border'],
    ['Fundo suave', 'soft'], ['Realce ao passar', 'hover'], ['Cor secundária do gráfico', 'chartSecondary'],
    ['Realce da marca', 'brandSoft'], ['Borda da marca', 'brandBorder'], ['Hover da marca', 'brandHover'],
    ['Foco', 'focus'], ['Realce suave de foco', 'focusSoft'], ['Sombra', 'shadow'], ['Sobreposição de modal', 'overlay'],
    ['Base do carregamento', 'surfaceRaised'], ['Brilho do carregamento', 'surface'],
    ['Sucesso', 'success'], ['Texto de sucesso', 'successText'], ['Fundo de sucesso', 'successSoft'], ['Borda de sucesso', 'successBorder'],
    ['Erro', 'error'], ['Texto de erro', 'errorText'], ['Fundo de erro', 'errorSoft'], ['Borda de erro', 'errorBorder'],
    ['Aviso', 'warning'], ['Texto de aviso', 'warningText'], ['Fundo de aviso', 'warningSoft'], ['Borda de aviso', 'warningBorder'],
  ] as const

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
              <div className="company-color-setting-row"><FormField
                id="settings-company-color"
                label="Cor principal · modo claro"
                icon={Palette}
                type="color"
                registration={register('primaryColor')}
                error={errors.primaryColor?.message}
              /><button className="quiet-button color-reset-button" type="button" onClick={() => resetColor('primaryColor', DEFAULT_BRAND_PRIMARY)}><RotateCcw size={14} /> Redefinir</button></div>
              <div className="company-color-setting-row"><FormField
                id="settings-company-dark-color"
                label="Cor principal · modo escuro"
                icon={Palette}
                type="color"
                registration={register('darkPrimaryColor')}
                error={errors.darkPrimaryColor?.message}
              /><button className="quiet-button color-reset-button" type="button" onClick={() => resetColor('darkPrimaryColor', DEFAULT_COMPANY_DARK_PRIMARY)}><RotateCcw size={14} /> Redefinir</button></div>
              <label className="company-goal-reminder-toggle">
                <input type="checkbox" {...register('askForMonthlyGoalIfMissing')} />
                <span><strong>Solicitar cadastro de meta quando não existir</strong><small>O aviso aparece no dashboard quando você ainda não tiver meta para o mês atual.</small></span>
              </label>
              {askForMonthlyGoalIfMissing && <label className="company-goal-reminder-message">Mensagem do aviso
                <textarea rows={3} maxLength={500} {...register('monthlyGoalReminderMessage')} />
                {errors.monthlyGoalReminderMessage?.message && <span className="field-error">{errors.monthlyGoalReminderMessage.message}</span>}
              </label>}
              <p className="color-help">Cada cor personaliza os destaques e estados ativos no tema correspondente desta empresa.</p>
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

          <div className="company-identity-column">
          <aside className="company-preview-card" aria-label="Prévia das cores da empresa">
            <span className="preview-caption">Prévia da identidade</span>
            <h2>{companyName || company.companyName}</h2>
            <p>Veja como os destaques ficam em cada tema.</p>
            <div className="company-preview-themes">
              <div className="company-preview-theme is-light">
                <span>Modo claro</span><button type="button" style={previewStyle}>Destaque</button><code>{primaryColor.toUpperCase()}</code>
              </div>
              <div className="company-preview-theme is-dark">
                <span>Modo escuro</span><button type="button" style={darkPreviewStyle}>Destaque</button><code>{darkPrimaryColor.toUpperCase()}</code>
              </div>
            </div>
          </aside>
          <section className="company-palette-card" aria-label="Variações de cores por tema">
            <h2>Variações da identidade</h2>
            <p>Estas cores são calculadas a partir da cor principal e usadas na interface.</p>
            {([['Modo claro', lightPalette], ['Modo escuro', darkPalette]] as const).map(([mode, palette]) => (
              <div className={`company-palette-group ${mode === 'Modo escuro' ? 'is-dark' : 'is-light'}`} key={mode}>
                <h3>{mode}</h3>
                <div className="company-palette-swatches">
                  {paletteSwatches.map(([label, key]) => {
                    const color = palette[key]
                    const isForeground = key === 'foreground'
                    return <div className="company-palette-swatch" key={`${mode}-${key}`}>
                      <span className="company-palette-color" style={{ backgroundColor: color, color: isForeground ? palette.primary : undefined }} aria-hidden="true" />
                      <span className="company-palette-label">{label}</span><code>{color.toUpperCase()}</code>
                    </div>
                  })}
                </div>
              </div>
            ))}
          </section>
          </div>
        </div>
      </div>
    </main>
  )
}

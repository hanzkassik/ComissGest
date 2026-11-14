import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowUpRight, Building2, Check, CircleAlert, MoreHorizontal, Plus, Settings2, UsersRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { AccountMenu } from '../../components/AccountMenu'
import { BrandMark } from '../../components/BrandMark'
import { FormField } from '../../components/FormField'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useCompany } from '../../hooks/useCompany'
import { companySchema, DEFAULT_MONTHLY_GOAL_REMINDER_MESSAGE, type CompanyFormInput, type CompanyFormValues } from '../../schemas/companySchemas'

function formatCnpj(cnpj: string | null) {
  if (!cnpj) return 'CNPJ não informado'
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function CompaniesPage() {
  const navigate = useNavigate()
  const { companies, activeCompany, loading, error, createCompany, selectCompany, refreshCompanies } = useCompany()
  const [formMessage, setFormMessage] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const { register, handleSubmit, control, formState: { errors, isSubmitting }, reset } = useForm<CompanyFormInput, unknown, CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: '', cnpj: '', askForMonthlyGoalIfMissing: true, monthlyGoalReminderMessage: DEFAULT_MONTHLY_GOAL_REMINDER_MESSAGE },
  })
  const askForMonthlyGoalIfMissing = useWatch({ control, name: 'askForMonthlyGoalIfMissing' })

  async function onCreate(values: CompanyFormValues) {
    setFormMessage('')
    try {
      const companyId = await createCompany(values)
      reset()
      navigate(`/empresas/${companyId}`)
    } catch {
      setFormMessage('Não foi possível criar a empresa. Confira se as regras atualizadas do Firestore foram publicadas.')
    }
  }

  useEffect(() => {
    if (!isCreateOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) setIsCreateOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isCreateOpen, isSubmitting])

  return (
    <main className="companies-page">
      <header className="topbar">
        <BrandMark />
        <div className="topbar-user">
          <AccountMenu showCompanySwitcher={false} />
        </div>
      </header>

      <div className="companies-content">
        <div className="companies-heading">
          <div>
            <span className="eyebrow"><Building2 size={15} /> Espaço de trabalho</span>
            <h1>Suas empresas</h1>
            <p>Organize cada operação em seu próprio espaço.</p>
          </div>
          <div className="companies-heading-actions">
            <span className="company-count"><UsersRound size={16} /> {companies.length} {companies.length === 1 ? 'empresa' : 'empresas'}</span>
            <button className="primary-button add-company-button" type="button" onClick={() => {
              setFormMessage('')
              setIsCreateOpen(true)
            }}><Plus size={17} /> Adicionar empresa</button>
          </div>
        </div>

        {formMessage && !isCreateOpen && <div className="company-success-message" role="status"><Check size={16} />{formMessage}</div>}

        <div className="companies-layout">
          <section className="companies-list-panel" aria-labelledby="company-list-title">
            <div className="section-heading">
              <div>
                <h2 id="company-list-title">Escolha uma empresa</h2>
                <p>Selecione um card para abrir o dashboard da empresa.</p>
              </div>
            </div>

            {loading ? (
              <LoadingSkeleton variant="company-list" page={false} rows={2} />
            ) : error ? (
              <div className="company-notice error"><CircleAlert size={17} />
                <span>{error}</span>
                <button className="text-link" type="button" onClick={() => void refreshCompanies()}>Tentar novamente</button>
              </div>
            ) : companies.length === 0 ? (
              <div className="company-empty">
                <span className="company-empty-icon"><Building2 size={23} /></span>
                <h3>Seu espaço começa aqui</h3>
                <p>Cadastre sua primeira empresa para manter vendas e comissões organizadas.</p>
              </div>
            ) : (
              <div className="company-cards">
                {companies.map((company) => {
                  const isActive = activeCompany?.companyId === company.companyId
                  return (
                    <article className={`company-card${isActive ? ' is-active' : ''}`} key={company.companyId}>
                      <Link
                        className="company-card-main"
                        to={`/empresas/${company.companyId}`}
                        onClick={() => selectCompany(company.companyId)}
                        aria-label={`Abrir dashboard de ${company.companyName}`}
                      >
                        <span className="company-card-icon"><Building2 size={20} /></span>
                        <div className="company-card-copy">
                          <h3>{company.companyName}</h3>
                          <p>{company.role === 'owner' ? 'Proprietário' : 'Membro'} · {formatCnpj(company.cnpj)}</p>
                        </div>
                        {isActive ? <span className="company-card-active"><Check size={13} /> Ativa</span> : <span className="company-card-open">Abrir <ArrowUpRight size={14} /></span>}
                      </Link>
                      {company.role === 'owner' && (
                        <details className="company-actions-menu">
                          <summary aria-label={`Mais opções para ${company.companyName}`} title="Mais opções"><MoreHorizontal size={18} /></summary>
                          <div className="company-actions-popover" role="menu">
                            <Link
                              role="menuitem"
                              to={`/empresas/${company.companyId}/configuracoes`}
                              onClick={() => selectCompany(company.companyId)}
                            ><Settings2 size={15} /> Editar / configurar</Link>
                          </div>
                        </details>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

        </div>
      </div>

      {isCreateOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSubmitting) setIsCreateOpen(false)
        }}>
          <section className="company-modal" role="dialog" aria-modal="true" aria-labelledby="company-modal-title">
            <div className="company-modal-heading">
              <div className="create-icon"><Plus size={19} /></div>
              <button className="modal-close-button" type="button" aria-label="Fechar" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}><X size={18} /></button>
            </div>
            <h2 id="company-modal-title">Adicionar empresa</h2>
            <p>Crie um espaço independente para organizar as vendas de outra empresa.</p>
            <form className="form-stack" onSubmit={handleSubmit(onCreate)} noValidate>
              <FormField
                id="company-name"
                label="Nome da empresa"
                icon={Building2}
                type="text"
                placeholder="Ex.: Mercado Central"
                autoComplete="organization"
                registration={register('name')}
                error={errors.name?.message}
              />
              <FormField
                id="company-cnpj"
                label="CNPJ (opcional)"
                icon={Building2}
                type="text"
                inputMode="numeric"
                maxLength={18}
                placeholder="00.000.000/0000-00"
                registration={register('cnpj')}
                error={errors.cnpj?.message}
              />
              <label className="company-goal-reminder-toggle">
                <input type="checkbox" {...register('askForMonthlyGoalIfMissing')} />
                <span><strong>Solicitar cadastro de meta quando não existir</strong><small>O aviso aparecerá no dashboard da empresa quando você ainda não tiver meta no mês atual.</small></span>
              </label>
              {askForMonthlyGoalIfMissing && <label className="company-goal-reminder-message">Mensagem do aviso
                <textarea rows={3} maxLength={500} {...register('monthlyGoalReminderMessage')} />
                {errors.monthlyGoalReminderMessage?.message && <span className="field-error">{errors.monthlyGoalReminderMessage.message}</span>}
              </label>}
              {formMessage && <div className="inline-message error" role="alert">{formMessage}</div>}
              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Criando…' : 'Criar empresa'} <Plus size={16} />
              </button>
            </form>
            <div className="company-private-note"><Check size={14} /> Só você será associado como proprietário nesta etapa.</div>
          </section>
        </div>
      )}
    </main>
  )
}

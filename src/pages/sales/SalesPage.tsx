import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CalendarDays, Clock3, Plus, Receipt, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AccountMenu } from '../../components/AccountMenu'
import { FormField } from '../../components/FormField'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { BrandMark } from '../../components/BrandMark'
import { SalesHistory } from '../../components/SalesHistory'
import { ProductSelectField } from '../../components/ProductSelectField'
import { useAuth } from '../../hooks/useAuth'
import { useCompany } from '../../hooks/useCompany'
import { saleSchema, type SaleFormValues } from '../../schemas/saleSchemas'
import { createSale } from '../../services/saleService'
import { calculateCommissionCents, formatBRLFromCents, parseBrazilianDecimalToInteger, toLocalDateInputValue } from '../../utils/currency'

const commissionRatePresets = Array.from({ length: 19 }, (_, index) => 1 + (index * 0.5))

function formatRatePreset(rate: number) {
  return `${rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export function SalesPage() {
  const { companyId = '' } = useParams()
  const { currentUser } = useAuth()
  const { companies, activeCompany, loading: loadingCompany, selectCompany } = useCompany()
  const company = companies.find((item) => item.companyId === companyId) ?? null
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, control, setValue } = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: { soldOn: toLocalDateInputValue(), soldTime: new Date().toTimeString().slice(0, 5), amount: '', commissionRate: '10,00', notes: '', productId: '' },
  })
  const amount = useWatch({ control, name: 'amount' })
  const commissionRate = useWatch({ control, name: 'commissionRate' })
  const productId = useWatch({ control, name: 'productId' })
  const numericCommissionRate = commissionRate && /^\d+(?:,\d{1,2})?$/.test(commissionRate)
    ? Number(commissionRate.replace(',', '.'))
    : Number.NaN

  useEffect(() => {
    if (company && activeCompany?.companyId !== company.companyId) selectCompany(company.companyId)
  }, [activeCompany?.companyId, company, selectCompany])

  async function onCreate(values: SaleFormValues) {
    setMessage('')
    setFailed(false)
    if (!currentUser || !company) return
    try {
      await createSale(company.companyId, currentUser.uid, values)
      reset({ soldOn: toLocalDateInputValue(), soldTime: new Date().toTimeString().slice(0, 5), amount: '', commissionRate: values.commissionRate, notes: '', productId: '' })
      setMessage('Venda registrada com sucesso.')
      setHistoryRefreshKey((key) => key + 1)
    } catch {
      setFailed(true)
      setMessage('Não foi possível registrar a venda. Verifique a conexão e as regras do Firestore.')
    }
  }

  const commissionPreview = (() => {
    try {
      if (!amount || !commissionRate) return null
      const cents = parseBrazilianDecimalToInteger(amount, 2)
      const rate = parseBrazilianDecimalToInteger(commissionRate, 2)
      return formatBRLFromCents(calculateCommissionCents(cents, rate))
    } catch {
      return null
    }
  })()

  if (loadingCompany) return <LoadingSkeleton variant="sales" />
  if (!company) return <Navigate to="/empresas" replace />

  return (
    <main className="sales-page">
      <header className="topbar">
        <BrandMark />
        <div className="topbar-user">
          <AccountMenu />
        </div>
      </header>

      <div className="sales-content">
        <div className="sales-heading">
          <div>
            <Link className="sales-back-link" to={`/empresas/${company.companyId}`}><ArrowLeft size={14} /> Dashboard</Link>
            <span className="eyebrow"><Receipt size={15} /> {company.companyName}</span>
            <h1>Vendas e comissões</h1>
            <p>Registre seus resultados e acompanhe sua evolução.</p>
          </div>
          <div className="sales-owner-pill"><UserRound size={15} /> Histórico individual</div>
        </div>

        <div className="sales-layout">
          <section className="profile-card sale-create-card" aria-labelledby="sale-form-heading">
            <div className="sale-card-title"><span className="sale-card-icon"><Plus size={18} /></span><div><h2 id="sale-form-heading">Registrar venda</h2><p>A comissão é calculada automaticamente.</p></div></div>
            <form className="form-stack" onSubmit={handleSubmit(onCreate)} noValidate>
              <div className="sale-datetime-fields">
                <FormField id="sale-date" label="Data da venda" icon={CalendarDays} type="date" max={toLocalDateInputValue()} registration={register('soldOn')} error={errors.soldOn?.message} />
                <FormField id="sale-time" label="Hora da venda" icon={Clock3} type="time" registration={register('soldTime')} error={errors.soldTime?.message} />
              </div>
              <ProductSelectField companyId={company.companyId} value={productId} onChange={(value) => setValue('productId', value, { shouldDirty: true, shouldValidate: true })} error={errors.productId?.message} />
              <FormField id="sale-amount" label="Valor da venda (R$)" icon={Receipt} type="text" inputMode="decimal" placeholder="0,00" autoComplete="off" registration={register('amount')} error={errors.amount?.message} />
              <div className="commission-rate-picker">
                <div className="commission-rate-picker-heading"><span>Atalhos de comissão</span><span>ou digite outro valor abaixo</span></div>
                <div className="commission-rate-presets" role="group" aria-label="Percentuais de comissão sugeridos">
                  {commissionRatePresets.map((rate) => <button
                    className={numericCommissionRate === rate ? 'is-selected' : ''}
                    type="button"
                    key={rate}
                    aria-pressed={numericCommissionRate === rate}
                    onClick={() => setValue('commissionRate', String(rate).replace('.', ','), { shouldDirty: true, shouldValidate: true })}
                  >{formatRatePreset(rate)}</button>)}
                </div>
              </div>
              <FormField id="sale-commission" label="Comissão (%)" icon={Receipt} type="text" inputMode="decimal" placeholder="10,00" autoComplete="off" registration={register('commissionRate')} error={errors.commissionRate?.message} />
              <label className="notes-field" htmlFor="sale-notes">Observação <span>(opcional)</span><textarea id="sale-notes" rows={3} maxLength={500} placeholder="Detalhes sobre esta venda" aria-invalid={Boolean(errors.notes)} {...register('notes')} />{errors.notes?.message && <span className="field-error" role="alert">{errors.notes.message}</span>}</label>
              {commissionPreview && <div className="commission-preview"><span>Comissão estimada</span><strong>{commissionPreview}</strong></div>}
              {message && <div className={`inline-message${failed ? ' error' : ''}`} role="status">{message}</div>}
              <button className="primary-button" type="submit" disabled={isSubmitting}><Plus size={16} />{isSubmitting ? 'Registrando…' : 'Registrar venda'}</button>
            </form>
          </section>

          <SalesHistory companyId={company.companyId} companyName={company.companyName} userId={currentUser?.uid ?? ''} refreshKey={historyRefreshKey} />
        </div>
      </div>
    </main>
  )
}

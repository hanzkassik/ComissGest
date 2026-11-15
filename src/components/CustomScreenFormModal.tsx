import { Layers3, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { customScreenSchema } from '../schemas/customScreenSchema'
import { dashboardIndicatorIds, type DashboardIndicatorId } from '../types/dashboard'
import type { CustomScreen, CustomScreenFormValues } from '../types/customScreen'
import { IndicatorSelectionList } from './IndicatorSelectionList'

interface CustomScreenFormModalProps {
  screen?: CustomScreen
  saving: boolean
  error: string
  onClose: () => void
  onSave: (values: CustomScreenFormValues) => Promise<void>
}

export function CustomScreenFormModal({ screen, saving, error, onClose, onSave }: CustomScreenFormModalProps) {
  const [name, setName] = useState(screen?.name ?? '')
  const [visibleIndicators, setVisibleIndicators] = useState<DashboardIndicatorId[]>(screen?.visibleIndicators ?? [])
  const [indicatorOrder, setIndicatorOrder] = useState<DashboardIndicatorId[]>(screen?.indicatorOrder ?? [...dashboardIndicatorIds])
  const [validationError, setValidationError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = customScreenSchema.safeParse({ name, visibleIndicators, indicatorOrder })
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? 'Confira os dados informados.')
      return
    }
    setValidationError('')
    await onSave(result.data)
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="company-modal custom-screen-modal" role="dialog" aria-modal="true" aria-labelledby="custom-screen-modal-title">
      <div className="company-modal-heading"><span className="create-icon"><Layers3 size={18} /></span><button className="modal-close-button" type="button" aria-label="Fechar formulário" onClick={onClose} disabled={saving}><X size={18} /></button></div>
      <h2 id="custom-screen-modal-title">{screen ? 'Editar tela' : 'Criar tela adicional'}</h2>
      <p>Defina um nome e escolha os indicadores que deseja acompanhar nesta tela.</p>
      <form className="form-stack custom-screen-form" onSubmit={(event) => void submit(event)}>
        <label className="field-label" htmlFor="custom-screen-name">Nome da tela</label>
        <input id="custom-screen-name" className="text-input" type="text" value={name} maxLength={60} placeholder="Ex.: Desempenho semanal" onChange={(event) => setName(event.target.value)} disabled={saving} />
        <span className="custom-screen-indicator-label">Indicadores da tela</span>
        <IndicatorSelectionList order={indicatorOrder} visibleIndicators={visibleIndicators} minVisible={0} disabled={saving} onOrderChange={setIndicatorOrder} onVisibleChange={setVisibleIndicators} />
        {(validationError || error) && <p className="dashboard-settings-error" role="alert">{validationError || error}</p>}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Salvando…' : screen ? 'Salvar alterações' : 'Criar tela'}</button>
      </form>
    </section>
  </div>
}

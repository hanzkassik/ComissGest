import { ArrowDown, ArrowUp, Settings2, X } from 'lucide-react'
import { useState } from 'react'
import type { DashboardIndicatorId, DashboardPreferences } from '../types/dashboard'

const indicatorLabels: Record<DashboardIndicatorId, string> = {
  'period-summary': 'Resumo do período',
  'average-commission': 'Comissão média',
  'average-commission-rate': 'Taxa média de comissão',
  'average-sale': 'Valor médio por venda',
  'commission-rate-chart': 'Gráfico: quantidade por percentual de comissão',
  'commission-rate-details': 'Detalhamento das vendas por percentual',
  'commission-rate-commission': 'Comissões por percentual',
  'product-sales-values': 'Vendas por produto: valores e quantidade',
  'product-commissions': 'Comissões por produto',
  'product-sales-chart': 'Gráfico: vendas por produto',
  'product-commission-chart': 'Gráfico: comissões por produto',
  'goals-progress': 'Metas e progresso',
  'sales-evolution': 'Evolução de vendas e comissões',
}

interface DashboardSettingsModalProps {
  preferences: DashboardPreferences
  saving: boolean
  error: string
  onClose: () => void
  onSave: (preferences: DashboardPreferences) => Promise<void>
}

export function DashboardSettingsModal({ preferences, saving, error, onClose, onSave }: DashboardSettingsModalProps) {
  const [draft, setDraft] = useState(preferences)
  const [selectionError, setSelectionError] = useState('')

  function toggleIndicator(indicatorId: DashboardIndicatorId) {
    const isVisible = draft.visibleIndicators.includes(indicatorId)
    if (isVisible && draft.visibleIndicators.length === 1) {
      setSelectionError('Mantenha pelo menos um indicador visível.')
      return
    }
    setSelectionError('')
    setDraft((current) => ({
      ...current,
      visibleIndicators: isVisible
        ? current.visibleIndicators.filter((item) => item !== indicatorId)
        : [...current.visibleIndicators, indicatorId],
    }))
  }

  function moveIndicator(indicatorId: DashboardIndicatorId, offset: -1 | 1) {
    const currentIndex = draft.indicatorOrder.indexOf(indicatorId)
    const nextIndex = currentIndex + offset
    if (nextIndex < 0 || nextIndex >= draft.indicatorOrder.length) return
    const nextOrder = [...draft.indicatorOrder]
    const [moved] = nextOrder.splice(currentIndex, 1)
    nextOrder.splice(nextIndex, 0, moved)
    setDraft((current) => ({ ...current, indicatorOrder: nextOrder }))
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="company-modal dashboard-settings-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-settings-title">
      <div className="company-modal-heading"><span className="create-icon"><Settings2 size={18} /></span><button className="modal-close-button" type="button" aria-label="Fechar configurações" onClick={onClose} disabled={saving}><X size={18} /></button></div>
      <h2 id="dashboard-settings-title">Configurar indicadores</h2>
      <p>Escolha quais indicadores deseja ver e ajuste a ordem em que aparecem nesta empresa.</p>
      <ol className="dashboard-settings-list">
        {draft.indicatorOrder.map((indicatorId, index) => <li key={indicatorId}>
          <label><input type="checkbox" checked={draft.visibleIndicators.includes(indicatorId)} onChange={() => toggleIndicator(indicatorId)} /><span>{indicatorLabels[indicatorId]}</span></label>
          <div className="dashboard-settings-order">
            <button className="quiet-button" type="button" aria-label={`Mover ${indicatorLabels[indicatorId]} para cima`} onClick={() => moveIndicator(indicatorId, -1)} disabled={saving || index === 0}><ArrowUp size={15} /></button>
            <button className="quiet-button" type="button" aria-label={`Mover ${indicatorLabels[indicatorId]} para baixo`} onClick={() => moveIndicator(indicatorId, 1)} disabled={saving || index === draft.indicatorOrder.length - 1}><ArrowDown size={15} /></button>
          </div>
        </li>)}
      </ol>
      {(selectionError || error) && <p className="dashboard-settings-error" role="alert">{selectionError || error}</p>}
      <button className="primary-button" type="button" onClick={() => void onSave(draft)} disabled={saving}>{saving ? 'Salvando…' : 'Salvar configuração'}</button>
    </section>
  </div>
}

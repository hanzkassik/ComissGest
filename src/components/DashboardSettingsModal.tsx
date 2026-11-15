import { Settings2, X } from 'lucide-react'
import { useState } from 'react'
import { IndicatorSelectionList } from './IndicatorSelectionList'
import type { DashboardIndicatorId, DashboardPreferences } from '../types/dashboard'

interface DashboardSettingsModalProps {
  preferences: DashboardPreferences
  saving: boolean
  error: string
  onClose: () => void
  onSave: (preferences: DashboardPreferences) => Promise<void>
}

export function DashboardSettingsModal({ preferences, saving, error, onClose, onSave }: DashboardSettingsModalProps) {
  const [draft, setDraft] = useState(preferences)

  function updateOrder(indicatorOrder: DashboardIndicatorId[]) {
    setDraft((current) => ({ ...current, indicatorOrder }))
  }

  function updateVisibleIndicators(visibleIndicators: DashboardIndicatorId[]) {
    setDraft((current) => ({ ...current, visibleIndicators }))
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
    <section className="company-modal dashboard-settings-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-settings-title">
      <div className="company-modal-heading"><span className="create-icon"><Settings2 size={18} /></span><button className="modal-close-button" type="button" aria-label="Fechar configurações" onClick={onClose} disabled={saving}><X size={18} /></button></div>
      <h2 id="dashboard-settings-title">Configurar indicadores</h2>
      <p>Escolha quais indicadores deseja ver. Arraste os cards ou use as setas para ajustar a ordem nesta empresa.</p>
      <IndicatorSelectionList order={draft.indicatorOrder} visibleIndicators={draft.visibleIndicators} minVisible={1} disabled={saving} onOrderChange={updateOrder} onVisibleChange={updateVisibleIndicators} />
      {error && <p className="dashboard-settings-error" role="alert">{error}</p>}
      <button className="primary-button" type="button" onClick={() => void onSave(draft)} disabled={saving}>{saving ? 'Salvando…' : 'Salvar configuração'}</button>
    </section>
  </div>
}

import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { SortableList } from './SortableList'
import type { DashboardIndicatorId } from '../types/dashboard'

export const dashboardIndicatorLabels: Record<DashboardIndicatorId, string> = {
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
  'sales-history': 'Histórico de vendas',
}

interface IndicatorSelectionListProps {
  order: DashboardIndicatorId[]
  visibleIndicators: DashboardIndicatorId[]
  minVisible: number
  disabled?: boolean
  onOrderChange: (order: DashboardIndicatorId[]) => void
  onVisibleChange: (visible: DashboardIndicatorId[]) => void
}

export function IndicatorSelectionList({ order, visibleIndicators, minVisible, disabled = false, onOrderChange, onVisibleChange }: IndicatorSelectionListProps) {
  const [selectionError, setSelectionError] = useState('')

  function toggle(indicatorId: DashboardIndicatorId) {
    const isVisible = visibleIndicators.includes(indicatorId)
    if (isVisible && visibleIndicators.length <= minVisible) {
      setSelectionError('Mantenha pelo menos um indicador visível.')
      return
    }
    setSelectionError('')
    onVisibleChange(isVisible ? visibleIndicators.filter((item) => item !== indicatorId) : [...visibleIndicators, indicatorId])
  }

  function move(indicatorId: DashboardIndicatorId, offset: -1 | 1) {
    const index = order.indexOf(indicatorId)
    const target = index + offset
    if (target < 0 || target >= order.length) return
    const next = [...order]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onOrderChange(next)
  }

  return <>
    <SortableList
      items={order}
      onReorder={onOrderChange}
      className="dashboard-settings-list"
      itemClassName="dashboard-settings-item"
      renderItem={(indicatorId, index) => <>
        <label><input type="checkbox" checked={visibleIndicators.includes(indicatorId)} onChange={() => toggle(indicatorId)} disabled={disabled} /><span>{dashboardIndicatorLabels[indicatorId]}</span></label>
        <div className="dashboard-settings-order">
          <button className="quiet-button" type="button" aria-label={`Mover ${dashboardIndicatorLabels[indicatorId]} para cima`} onClick={() => move(indicatorId, -1)} disabled={disabled || index === 0}><ArrowUp size={15} /></button>
          <button className="quiet-button" type="button" aria-label={`Mover ${dashboardIndicatorLabels[indicatorId]} para baixo`} onClick={() => move(indicatorId, 1)} disabled={disabled || index === order.length - 1}><ArrowDown size={15} /></button>
        </div>
      </>}
    />
    {selectionError && <p className="dashboard-settings-error" role="alert">{selectionError}</p>}
  </>
}

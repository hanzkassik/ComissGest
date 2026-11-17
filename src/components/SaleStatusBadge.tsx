import type { CSSProperties } from 'react'
import { getBrandPalette } from '../utils/brandColors'
import type { SaleStatus } from '../types/saleStatus'
import { useTheme } from '../hooks/useTheme'

interface SaleStatusBadgeProps {
  status?: SaleStatus
  fallbackText?: string
  className?: string
}

export function SaleStatusBadge({ status, fallbackText = 'Sem status', className = '' }: SaleStatusBadgeProps) {
  const { theme } = useTheme()
  const palette = status ? getBrandPalette(status.color, theme) : null
  const style = palette ? {
    '--sale-status-text': palette.text,
    '--sale-status-soft': palette.brandSoft,
    '--sale-status-border': palette.brandBorder,
  } as CSSProperties : undefined

  return <span className={`sale-status-badge${status?.active === false ? ' is-inactive' : ''}${className ? ` ${className}` : ''}`} style={style}>
    {status?.name ?? fallbackText}
    {status?.active === false && <small>Desativado</small>}
  </span>
}

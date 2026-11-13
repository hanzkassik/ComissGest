export const DEFAULT_BRAND_PRIMARY = '#187f63'

function channel(hex: string, offset: number) {
  return Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
}

function linearize(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function getBrandForeground(hex: string) {
  const luminance = 0.2126 * linearize(channel(hex, 1))
    + 0.7152 * linearize(channel(hex, 3))
    + 0.0722 * linearize(channel(hex, 5))
  return luminance > 0.179 ? '#071d17' : '#ffffff'
}

export function getBrandTextColor(hex: string) {
  const darken = (offset: number) => Math.round(channel(hex, offset) * 255 * 0.35)
    .toString(16).padStart(2, '0')
  return `#${darken(1)}${darken(3)}${darken(5)}`
}

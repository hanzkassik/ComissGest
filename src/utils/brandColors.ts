export const DEFAULT_BRAND_PRIMARY = '#187f63'
export const DEFAULT_BRAND_DARK_PRIMARY = '#60a5fa'

export type BrandThemeMode = 'light' | 'dark'

export interface BrandPalette {
  primary: string
  foreground: string
  text: string
  appText: string
  mutedText: string
  placeholder: string
  background: string
  header: string
  surface: string
  surfaceRaised: string
  control: string
  border: string
  soft: string
  hover: string
  chartSecondary: string
  brandSoft: string
  brandBorder: string
  brandHover: string
  focus: string
  focusSoft: string
  shadow: string
  overlay: string
  success: string
  successText: string
  successSoft: string
  successBorder: string
  error: string
  errorText: string
  errorSoft: string
  errorBorder: string
  warning: string
  warningText: string
  warningSoft: string
  warningBorder: string
}

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
  const whiteContrast = 1.05 / (luminance + 0.05)
  const darkContrast = (luminance + 0.05) / 0.05
  return darkContrast >= whiteContrast ? '#071d17' : '#ffffff'
}

export function getBrandTextColor(hex: string) {
  const darken = (offset: number) => Math.round(channel(hex, offset) * 255 * 0.35)
    .toString(16).padStart(2, '0')
  return `#${darken(1)}${darken(3)}${darken(5)}`
}

function mixColors(color: string, neutral: string, colorPercent: number) {
  const components = [1, 3, 5].map((offset) => {
    const colorChannel = Number.parseInt(color.slice(offset, offset + 2), 16)
    const neutralChannel = Number.parseInt(neutral.slice(offset, offset + 2), 16)
    return Math.round((colorChannel * colorPercent + neutralChannel * (100 - colorPercent)) / 100)
      .toString(16).padStart(2, '0')
  })
  return `#${components.join('')}`
}

function hslColor(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100
  const l = lightness / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const segment = hue / 60
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1))
  const [red, green, blue] = segment < 1 ? [chroma, secondary, 0]
    : segment < 2 ? [secondary, chroma, 0]
      : segment < 3 ? [0, chroma, secondary]
        : segment < 4 ? [0, secondary, chroma]
          : segment < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary]
  const offset = l - chroma / 2
  return `#${[red, green, blue].map((value) => Math.round((value + offset) * 255).toString(16).padStart(2, '0')).join('')}`
}

function getSemanticColors(primary: string, mode: BrandThemeMode, hue: number) {
  const saturation = Math.min(78, Math.max(42, getHsl(primary).s * 0.72))
  const dark = mode === 'dark'
  const accent = hslColor(hue, saturation, dark ? 70 : 42)
  const text = hslColor(hue, Math.min(72, saturation + 6), dark ? 77 : 36)
  const soft = hslColor(hue, Math.min(58, saturation * 0.55), dark ? 18 : 96)
  const border = hslColor(hue, Math.min(54, saturation * 0.72), dark ? 34 : 79)
  return { accent, text, soft, border }
}

function getHsl(hex: string) {
  const red = channel(hex, 1)
  const green = channel(hex, 3)
  const blue = channel(hex, 5)
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) hue = 60 * ((blue - red) / delta + 2)
    else hue = 60 * ((red - green) / delta + 4)
  }
  const lightness = (max + min) / 2
  return { h: (hue + 360) % 360, s: delta ? delta / (1 - Math.abs(2 * lightness - 1)) * 100 : 0, l: lightness * 100 }
}

function getAlphaHex(hex: string, alpha: number) {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
}

export function getBrandPalette(primary: string, mode: BrandThemeMode): BrandPalette {
  const statusSuccess = getSemanticColors(primary, mode, 145)
  const statusError = getSemanticColors(primary, mode, 4)
  const statusWarning = getSemanticColors(primary, mode, 42)
  if (mode === 'light') {
    return {
      primary,
      foreground: getBrandForeground(primary),
      text: getBrandTextColor(primary),
      appText: mixColors(primary, '#202020', 2),
      mutedText: mixColors(primary, '#737373', 5),
      placeholder: mixColors(mixColors(primary, '#202020', 2), mixColors(primary, '#f5f5f5', 2), 48),
      background: mixColors(primary, '#f5f5f5', 2),
      header: mixColors(primary, '#ffffff', 4),
      surface: mixColors(primary, '#ffffff', 1),
      surfaceRaised: mixColors(primary, '#fafafa', 3),
      control: mixColors(primary, '#ffffff', 1),
      border: mixColors(primary, '#dedede', 18),
      soft: mixColors(primary, '#f0f0f0', 9),
      hover: mixColors(primary, '#e7e7e7', 14),
      chartSecondary: mixColors(primary, '#ffffff', 58),
      brandSoft: mixColors(primary, '#ffffff', 9),
      brandBorder: mixColors(primary, '#dedede', 24),
      brandHover: mixColors(primary, '#ffffff', 13),
      focus: getAlphaHex(primary, 0.34),
      focusSoft: getAlphaHex(primary, 0.15),
      shadow: getAlphaHex(primary, 0.12),
      overlay: '#00000099',
      success: statusSuccess.accent,
      successText: statusSuccess.text,
      successSoft: statusSuccess.soft,
      successBorder: statusSuccess.border,
      error: statusError.accent,
      errorText: statusError.text,
      errorSoft: statusError.soft,
      errorBorder: statusError.border,
      warning: statusWarning.accent,
      warningText: statusWarning.text,
      warningSoft: statusWarning.soft,
      warningBorder: statusWarning.border,
    }
  }

  return {
    primary,
    foreground: getBrandForeground(primary),
    text: mixColors(primary, '#ffffff', 48),
    appText: mixColors(primary, '#e5e5e5', 4),
    mutedText: mixColors(primary, '#b0b0b0', 7),
    placeholder: mixColors(mixColors(primary, '#e5e5e5', 4), mixColors(primary, '#0b0b0b', 4), 48),
    background: mixColors(primary, '#0b0b0b', 4),
    header: mixColors(primary, '#151515', 10),
    surface: mixColors(primary, '#191919', 7),
    surfaceRaised: mixColors(primary, '#202020', 10),
    control: mixColors(primary, '#101010', 4),
    border: mixColors(primary, '#343434', 24),
    soft: mixColors(primary, '#202020', 16),
    hover: mixColors(primary, '#2b2b2b', 21),
    chartSecondary: mixColors(primary, '#ffffff', 58),
    brandSoft: mixColors(primary, '#202020', 14),
    brandBorder: mixColors(primary, '#343434', 25),
    brandHover: mixColors(primary, '#2b2b2b', 20),
    focus: getAlphaHex(primary, 0.55),
    focusSoft: getAlphaHex(primary, 0.15),
    shadow: getAlphaHex(primary, 0.18),
    overlay: '#000000ad',
    success: statusSuccess.accent,
    successText: statusSuccess.text,
    successSoft: statusSuccess.soft,
    successBorder: statusSuccess.border,
    error: statusError.accent,
    errorText: statusError.text,
    errorSoft: statusError.soft,
    errorBorder: statusError.border,
    warning: statusWarning.accent,
    warningText: statusWarning.text,
    warningSoft: statusWarning.soft,
    warningBorder: statusWarning.border,
  }
}

import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import { ChevronDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

interface PhoneFieldProps {
  id: string
  value?: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  disabled?: boolean
}

interface CountryOption {
  code: CountryCode
  name: string
  callingCode: string
}

const countryNames = new Intl.DisplayNames(['pt-BR'], { type: 'region' })

const countries: CountryOption[] = getCountries()
  .map((code) => ({
    code,
    name: countryNames.of(code) ?? code,
    callingCode: getCountryCallingCode(code),
  }))
  .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))

function getCountryFromValue(value?: string): CountryCode | undefined {
  if (!value) return undefined
  const parsed = parsePhoneNumberFromString(value)
  return parsed?.country
}

function formatNationalValue(value: string, country: CountryCode) {
  const parsed = parsePhoneNumberFromString(value)
  if (parsed?.country === country) return parsed.formatNational()
  return new AsYouType(country).input(value.replace(/\D/g, ''))
}

export function PhoneField({ id, value = '', onChange, onBlur, error, disabled = false }: PhoneFieldProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(() => getCountryFromValue(value) ?? 'BR')
  const [nationalNumber, setNationalNumber] = useState(() => value ? formatNationalValue(value, getCountryFromValue(value) ?? 'BR') : '')
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const lastEmittedValue = useRef<string | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value === lastEmittedValue.current) return
    lastEmittedValue.current = value
    if (!value) {
      // Synchronize the local display when React Hook Form resets the controlled value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNationalNumber('')
      setSelectedCountry('BR')
      return
    }
    const country = getCountryFromValue(value)
    if (!country) return
    // Synchronize the local display when loading or resetting a saved international number.
    setSelectedCountry(country)
    setNationalNumber(formatNationalValue(value, country))
  }, [value])

  useEffect(() => {
    if (!menuOpen) return
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setMenuOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [menuOpen])

  const country = countries.find((option) => option.code === selectedCountry) ?? countries[0]
  const filteredCountries = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR').replace(/^\+/, '')
    if (!normalizedSearch) return countries
    return countries.filter((option) => option.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
      || option.callingCode.includes(normalizedSearch))
  }, [search])

  function emitNumber(rawNumber: string, countryCode: CountryCode) {
    const formattedInput = new AsYouType(countryCode)
    const formatted = formattedInput.input(rawNumber)
    setNationalNumber(formatted)
    const e164 = formattedInput.getNumberValue()
    const digits = rawNumber.replace(/\D/g, '')
    const partialValue = digits ? `+${getCountryCallingCode(countryCode)}${digits}` : ''
    const nextValue = e164 ?? partialValue
    lastEmittedValue.current = nextValue
    onChange(nextValue)
  }

  function selectCountry(nextCountry: CountryCode) {
    setSelectedCountry(nextCountry)
    setMenuOpen(false)
    setSearch('')
    emitNumber(nationalNumber, nextCountry)
  }

  return <div className="phone-field" ref={containerRef}>
    <label className="phone-field-label" htmlFor={id}>Telefone</label>
    <div className={`phone-input-control${error ? ' has-error' : ''}${menuOpen ? ' is-open' : ''}`}>
      <button
        className="phone-country-trigger"
        type="button"
        aria-label={`Selecionar país. Atual: ${country.name} (+${country.callingCode})`}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        disabled={disabled}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <img className="phone-country-flag" src={`${import.meta.env.BASE_URL}flags/${country.code}.svg`} alt="" />
        <span className="phone-country-name">{country.name} (+{country.callingCode})</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <input
        id={id}
        className="phone-national-input"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        aria-label={`Telefone no formato nacional. País selecionado: ${country.name}`}
        aria-invalid={Boolean(error)}
        placeholder={selectedCountry === 'BR' ? '(11) 99999-9999' : 'Número de telefone'}
        value={nationalNumber}
        disabled={disabled}
        onChange={(event) => emitNumber(event.target.value, selectedCountry)}
        onBlur={onBlur}
      />
      {menuOpen && <div className="phone-country-menu">
        <div className="phone-country-search-wrap">
          <Search size={15} aria-hidden="true" />
          <input
            autoFocus
            type="search"
            value={search}
            aria-label="Buscar país ou DDI"
            placeholder="Buscar país ou DDI"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setMenuOpen(false)
                setSearch('')
              }
            }}
          />
        </div>
        <ul role="listbox" aria-label="Países e códigos DDI">
          {filteredCountries.map((option) => <li key={option.code} role="presentation">
            <button
              className="phone-country-option"
              type="button"
              role="option"
              aria-selected={option.code === selectedCountry}
              onClick={() => selectCountry(option.code)}
            >
              <img className="phone-country-flag" src={`${import.meta.env.BASE_URL}flags/${option.code}.svg`} alt="" />
              <span>{option.name}</span>
              <span className="phone-country-option-code">+{option.callingCode}</span>
            </button>
          </li>)}
          {filteredCountries.length === 0 && <li className="phone-country-empty">Nenhum país encontrado.</li>}
        </ul>
      </div>}
    </div>
    <span className="phone-field-hint">Escolha o país. O telefone será salvo no padrão internacional.</span>
    {error && <span className="field-error" role="alert">{error}</span>}
  </div>
}

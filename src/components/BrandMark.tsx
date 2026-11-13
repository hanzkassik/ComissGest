import { ChartNoAxesColumnIncreasing } from 'lucide-react'
import { Link } from 'react-router-dom'

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <Link className={`brand-lockup ${className}`} to="/">
      <span className="brand-mark" aria-hidden="true">
        <ChartNoAxesColumnIncreasing size={19} strokeWidth={2.2} />
      </span>
      <span>ComissGest</span>
    </Link>
  )
}

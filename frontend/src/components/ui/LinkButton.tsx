import { Link, type LinkProps } from 'react-router-dom'
import type { ReactNode } from 'react'
import { buttonClasses } from './index'

/** A router link wearing the Button costume. See the note on `buttonClasses`. */
export function LinkButton({
  variant = 'secondary',
  icon,
  className,
  children,
  ...rest
}: LinkProps & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: ReactNode }) {
  return (
    <Link className={buttonClasses(variant, className)} {...rest}>
      {icon}
      {children}
    </Link>
  )
}

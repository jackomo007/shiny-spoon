import React from 'react'
import Link from 'next/link'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  as?: 'button' | 'a'
  href?: string
  className?: string
}

export default function Button({ as = 'button', href, className = '', ...props }: Props) {
  const base =
    'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium ' +
    'bg-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'

  if (as === 'a' && href) {
    return (
      <Link href={href} className={`${base} ${className}`}>
        {props.children}
      </Link>
    )
  }
  return <button {...props} className={`${base} ${className}`} />
}

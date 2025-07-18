import Link from 'next/link'

interface SkipLinkProps {
  href: string
  children: React.ReactNode
}

export function SkipLink({ href, children }: SkipLinkProps) {
  return (
    <Link
      href={href}
      className="skip-link"
      tabIndex={0}
    >
      {children}
    </Link>
  )
}
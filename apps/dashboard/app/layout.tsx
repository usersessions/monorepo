import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'usersessions — Get your product found',
  description:
    'A distribution engine for founders: get listed everywhere AI assistants and humans discover software, then watch whether they actually recommend you.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

import type { Metadata, Viewport } from 'next'
import { PwaRegister } from '@/components/PwaRegister'
import './globals.css'

export const metadata: Metadata = {
  title: 'usersessions — Get your product found',
  description:
    'A distribution engine for founders: get listed everywhere AI assistants and humans discover software, then watch whether they actually recommend you.',
}

export const viewport: Viewport = {
  themeColor: '#101014',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}

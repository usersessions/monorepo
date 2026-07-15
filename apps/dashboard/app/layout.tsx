import type { Metadata, Viewport } from 'next'
import { PwaRegister } from '@/components/PwaRegister'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://usersessions.io'
const TITLE = 'usersessions — Get your product found'
const DESCRIPTION =
  'A distribution engine for founders: get listed everywhere AI assistants and humans discover software, then watch whether they actually recommend you.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'usersessions',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export const viewport: Viewport = {
  themeColor: '#101014',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5722067836852264" crossOrigin="anonymous"></script>
      </head>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}

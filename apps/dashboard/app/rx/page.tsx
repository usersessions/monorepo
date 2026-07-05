import type { Metadata } from 'next'
import { RxDoor } from './RxDoor'

export const metadata: Metadata = {
  title: 'usersessions',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function RxPage() {
  return <RxDoor />
}

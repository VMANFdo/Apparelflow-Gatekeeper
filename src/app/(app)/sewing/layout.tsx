import type { ReactNode } from 'react'
import { requireRolePage } from '@/server/auth/page-guard'

export default async function SewingLayout({ children }: { children: ReactNode }) {
  await requireRolePage('sewing_supervisor')
  return <>{children}</>
}

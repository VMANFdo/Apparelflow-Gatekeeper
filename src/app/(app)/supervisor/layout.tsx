import type { ReactNode } from 'react'
import { requireRolePage } from '@/server/auth/page-guard'

export default async function SupervisorLayout({ children }: { children: ReactNode }) {
  await requireRolePage('cutting_supervisor')
  return <>{children}</>
}

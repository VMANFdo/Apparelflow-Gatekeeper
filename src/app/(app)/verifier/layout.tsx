import type { ReactNode } from 'react'
import { requireRolePage } from '@/server/auth/page-guard'

export default async function VerifierLayout({ children }: { children: ReactNode }) {
  await requireRolePage('cutting_verifier')
  return <>{children}</>
}

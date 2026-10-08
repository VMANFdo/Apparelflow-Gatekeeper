import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/server/auth/session'
import { db } from '@/server/db'
import { countPendingOrders } from '@/server/services/verification'
import { AppShell } from '@/components/app-shell'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const pendingCount = user.role === 'cutting_verifier' ? await countPendingOrders(db) : 0

  return (
    <AppShell user={{ fullName: user.fullName, role: user.role }} pendingCount={pendingCount}>
      {children}
    </AppShell>
  )
}

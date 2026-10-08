import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/server/auth/session'
import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <ToastProvider>
      <AppShell user={{ fullName: user.fullName, role: user.role }}>{children}</AppShell>
    </ToastProvider>
  )
}

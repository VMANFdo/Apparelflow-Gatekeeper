import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/server/auth/session'
import { ROLE_HOME } from '@/domain/roles'
import { LoginForm } from '@/components/login/login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect(ROLE_HOME[user.role])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 py-10">
      <div className="flex items-center gap-2 text-slate-900">
        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
          AF
        </span>
        <span className="text-lg font-semibold">ApparelFlow ERP</span>
      </div>
      <LoginForm />
    </main>
  )
}

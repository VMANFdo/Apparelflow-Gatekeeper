import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/server/auth/session'
import { ROLE_HOME } from '@/domain/roles'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

export default async function NotFound() {
  const user = await getCurrentUser()
  const href = user ? ROLE_HOME[user.role] : '/login'

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-6xl font-semibold tracking-tight text-slate-900">404</p>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The page you are looking for doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link
          href={href}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Go to my dashboard
        </Link>
      </div>
    </main>
  )
}

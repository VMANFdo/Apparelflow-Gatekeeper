import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { getCurrentUser } from '@/server/auth/session'
import { ROLE_HOME } from '@/domain/roles'
import { LoginForm } from '@/components/login/login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect(ROLE_HOME[user.role])

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.08fr_0.92fr]">
      <section
        aria-label="ApparelFlow workspace"
        className="relative hidden min-h-[340px] overflow-hidden bg-slate-900 lg:block"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(15, 23, 42, 0.08) 0%, rgba(15, 23, 42, 0.78) 100%), url('/login-workroom.jpg')",
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      >
        <div className="absolute inset-x-0 bottom-0 p-12 text-white xl:p-16">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="ApparelFlow ERP" width={40} height={40} className="h-10 w-10 rounded-lg object-cover" />
            <span className="text-xl font-semibold tracking-tight">ApparelFlow ERP</span>
          </div>
          <h1 className="mt-8 max-w-lg text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Every cut counted. Every order moving.
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-slate-100">
            A clear handoff from cutting verification to the sewing floor.
          </p>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:px-12 xl:px-20">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 text-slate-900 lg:hidden">
            <Image src="/logo.jpg" alt="ApparelFlow ERP" width={36} height={36} className="h-9 w-9 rounded-lg object-cover" />
            <span className="text-lg font-semibold">ApparelFlow ERP</span>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  )
}

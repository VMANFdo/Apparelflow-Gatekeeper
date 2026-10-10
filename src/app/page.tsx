import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { ClipboardCheck, Scissors, Shirt } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getCurrentUser } from '@/server/auth/session'
import { ROLE_HOME, ROLE_LABELS } from '@/domain/roles'
import type { Role } from '@/db/schema'

const ROLES: { role: Role; icon: LucideIcon; description: string }[] = [
  {
    role: 'cutting_supervisor',
    icon: Scissors,
    description: 'Creates cutting orders from recipes and tracks every batch through verification.',
  },
  {
    role: 'cutting_verifier',
    icon: ClipboardCheck,
    description: 'Counts cut pieces per batch, approves matches, and flags shortages or rejects.',
  },
  {
    role: 'sewing_supervisor',
    icon: Shirt,
    description: 'Takes verified batches and runs the assembly queue on the floor.',
  },
]

export default async function HomePage() {
  const user = await getCurrentUser()
  if (user) redirect(ROLE_HOME[user.role])

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-slate-950"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(15, 23, 42, 0.86) 0%, rgba(15, 23, 42, 0.55) 45%, rgba(15, 23, 42, 0.92) 100%), url('/home.png')",
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.jpg"
              alt="ApparelFlow ERP logo"
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg object-cover"
              priority
            />
            <span className="text-xl font-semibold tracking-tight text-white">
              ApparelFlow ERP
            </span>
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-center py-16">
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl xl:text-6xl">
            Every cut counted.
            <br />
            Every order moving.
          </h1>
          <div className="mt-6 grid gap-8 sm:grid-cols-2 sm:items-center sm:gap-12">
            <p className="max-w-xl text-base leading-7 text-slate-100 sm:text-lg sm:leading-8">
              ApparelFlow is a production gate for your apparel floor. It turns a physical cut-check
              into an auditable record — every component counted, and every handoff from cutting to
              sewing verified before it moves.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 py-3 text-base font-medium text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:-translate-y-10 sm:justify-self-center"
            >
              Sign in to get started
            </Link>
          </div>
        </div>

        <section aria-label="System roles" className="pb-4">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {ROLES.map(({ role, icon: Icon, description }) => (
              <li
                key={role}
                className="rounded-xl border border-white/15 bg-white/10 p-5 shadow-lg shadow-slate-950/20 backdrop-blur"
              >
                <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                <h2 className="mt-3 text-base font-semibold text-white">{ROLE_LABELS[role]}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-200">{description}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
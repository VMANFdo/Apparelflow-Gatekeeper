'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, Loader2, LogIn, Scissors, Shirt } from 'lucide-react'
import { loginSchema } from '@/domain/auth'
import { ROLE_HOME, ROLE_LABELS } from '@/domain/roles'
import type { Role } from '@/db/schema'

const DEMO_ACCOUNTS: { role: Role; email: string; password: string; icon: typeof Scissors }[] = [
  { role: 'cutting_supervisor', email: 'supervisor@apparelflow.demo', password: 'Supervisor@123', icon: Scissors },
  { role: 'cutting_verifier', email: 'verifier@apparelflow.demo', password: 'Verifier@123', icon: ClipboardCheck },
  { role: 'sewing_supervisor', email: 'sewing@apparelflow.demo', password: 'Sewing@123', icon: Shirt },
]

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(overrides?: { email: string; password: string }) {
    const values = overrides ?? { email, password }
    setFormError(null)

    const parsed = loginSchema.safeParse(values)
    if (!parsed.success) {
      const issues = parsed.error.issues
      setEmailError(issues.find((i) => i.path[0] === 'email')?.message ?? null)
      setPasswordError(issues.find((i) => i.path[0] === 'password')?.message ?? null)
      return
    }
    setEmailError(null)
    setPasswordError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const body = await res.json().catch(() => null)

      if (!res.ok) {
        setFormError(body?.error?.message ?? 'Something went wrong. Please try again.')
        return
      }

      router.push(ROLE_HOME[body.user.role as Role])
      router.refresh()
    } catch {
      setFormError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit()
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Use your ApparelFlow account to continue.
        </p>

        {formError && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
          >
            {formError}
          </p>
        )}

        <div className="mt-6">
          <label htmlFor="email" className="block text-sm font-medium text-slate-900">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailError(null)
            }}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? 'email-error' : undefined}
            className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
            placeholder="you@apparelflow.demo"
          />
          {emailError && (
            <p id="email-error" role="alert" className="mt-1 text-sm text-red-700">
              {emailError}
            </p>
          )}
        </div>

        <div className="mt-4">
          <label htmlFor="password" className="block text-sm font-medium text-slate-900">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setPasswordError(null)
            }}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? 'password-error' : undefined}
            className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
            placeholder="Your password"
          />
          {passwordError && (
            <p id="password-error" role="alert" className="mt-1 text-sm text-red-700">
              {passwordError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </>
          )}
        </button>
      </form>

      <section
        aria-label="Demo accounts"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-slate-900">Demo accounts</h2>
        <p className="mt-1 text-xs text-slate-600">
          One click signs you in through the real authentication endpoint.
        </p>
        <ul className="mt-4 space-y-3">
          {DEMO_ACCOUNTS.map((account) => {
            const Icon = account.icon
            return (
              <li
                key={account.role}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-slate-700" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {ROLE_LABELS[account.role]}
                    </span>
                    <span className="block truncate text-xs text-slate-600">
                      {account.email}
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submit({ email: account.email, password: account.password })}
                  className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  Sign in as
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}

'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown, ClipboardCheck, LogOut, Menu, Scissors, Shirt, X } from 'lucide-react'
import { ROLE_BADGE_CLASSES, ROLE_HOME, ROLE_LABELS } from '@/domain/roles'
import type { Role } from '@/db/schema'

type NavItem = { href: string; label: string; icon: LucideIcon }

const NAV: Record<Role, NavItem[]> = {
  cutting_supervisor: [{ href: ROLE_HOME.cutting_supervisor, label: 'Cutting Orders', icon: Scissors }],
  cutting_verifier: [{ href: ROLE_HOME.cutting_verifier, label: 'Verification Queue', icon: ClipboardCheck }],
  sewing_supervisor: [{ href: ROLE_HOME.sewing_supervisor, label: 'Sewing Queue', icon: Shirt }],
}

type AppShellProps = {
  user: { fullName: string; role: Role }
  children: ReactNode
}

function SidebarContent({
  role,
  pathname,
  onClose,
}: {
  role: Role
  pathname: string
  onClose: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
        <Image src="/logo.jpg" alt="ApparelFlow ERP" width={32} height={32} className="h-8 w-8 rounded-lg object-cover" />
        <span className="text-sm font-semibold text-slate-900">ApparelFlow ERP</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="ml-auto rounded-md p-1.5 text-slate-700 hover:bg-slate-100 md:hidden"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Main navigation" className="flex-1 space-y-1 p-3">
        {NAV[role].map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function AppShell({ user, children }: AppShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  async function signOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // still continue to the login page; the cookie is httpOnly and short-lived
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white md:block">
        <SidebarContent role={user.role} pathname={pathname} onClose={() => setSidebarOpen(false)} />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 bg-slate-900/40"
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-lg">
            <SidebarContent role={user.role} pathname={pathname} onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
            className="rounded-md p-1.5 text-slate-700 hover:bg-slate-100 md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="text-left">
            <div className="text-sm font-medium text-slate-900">{user.fullName}</div>
            <span
              className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASSES[user.role]}`}
            >
              {ROLE_LABELS[user.role]}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  Switch role
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  sideOffset={8}
                  className="z-50 min-w-[13rem] rounded-lg border border-slate-200 bg-white p-1 shadow-md"
                >
                  <DropdownMenu.Label className="px-2 py-1.5 text-xs text-slate-600">
                    Signed in as {ROLE_LABELS[user.role]}
                  </DropdownMenu.Label>
                  <DropdownMenu.Item
                    onSelect={() => void signOut()}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-900 outline-none data-[highlighted]:bg-slate-100"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Switch role
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Log out"
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  )
}

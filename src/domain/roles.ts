import type { Role } from '@/db/schema'

export const ROLE_HOME: Record<Role, string> = {
  cutting_supervisor: '/supervisor/orders',
  cutting_verifier: '/verifier',
  sewing_supervisor: '/sewing',
}

export const ROLE_LABELS: Record<Role, string> = {
  cutting_supervisor: 'Cutting Supervisor',
  cutting_verifier: 'Cutting Verifier',
  sewing_supervisor: 'Sewing Supervisor',
}

export const ROLE_BADGE_CLASSES: Record<Role, string> = {
  cutting_supervisor: 'bg-blue-100 text-blue-900 border-blue-300',
  cutting_verifier: 'bg-violet-100 text-violet-900 border-violet-300',
  sewing_supervisor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
}

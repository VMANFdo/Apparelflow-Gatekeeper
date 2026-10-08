import { redirect } from 'next/navigation'
import type { Role } from '@/db/schema'
import { ROLE_HOME } from '@/domain/roles'
import { getCurrentUser, type SessionUser } from '@/server/auth/session'

export async function requireRolePage(role: Role): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== role) redirect(ROLE_HOME[user.role])
  return user
}

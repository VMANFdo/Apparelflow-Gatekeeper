import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/server/auth/session'
import { ROLE_HOME } from '@/domain/roles'

export default async function HomePage() {
  const user = await getCurrentUser()
  redirect(user ? ROLE_HOME[user.role] : '/login')
}

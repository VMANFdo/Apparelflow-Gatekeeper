import { CreateOrderDialog } from '@/components/orders/create-order-dialog'
import { requireRolePage } from '@/server/auth/page-guard'
import { db } from '@/server/db'
import { listRecipes } from '@/server/services/orders'

export default async function SupervisorOrdersPage() {
  await requireRolePage('cutting_supervisor')
  const recipes = await listRecipes(db)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cutting Orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create cutting orders from recipes and track their verification.
          </p>
        </div>
        <CreateOrderDialog recipes={recipes} />
      </div>
    </div>
  )
}

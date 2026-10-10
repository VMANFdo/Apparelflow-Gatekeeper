import { beforeEach, describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { BusinessRuleError, ForbiddenError } from '@/domain/errors'
import { rejectOrderSchema } from '@/domain/verification'
import { listVerifiedQueue } from '@/server/services/sewing'
import { approveOrder, rejectOrder } from '@/server/services/verification'
import {
  countLogs,
  createOrderFixture,
  createTestSet,
  greenCounts,
  orderStatus,
  readApprovalLog,
  type TestFixtureSet,
} from './helpers/testDb'

describe('approving an order (integration)', () => {
  let set: TestFixtureSet

  beforeEach(async () => {
    set = await createTestSet()
  })

  it('approves an all-GREEN order and records an APPROVED log', async () => {
    const result = await approveOrder(set.db, set.actors.verifier, set.order.orderId, {
      counts: greenCounts(set.order),
    })

    expect(result.order.status).toBe('VERIFIED')
    expect(await orderStatus(set.db, set.order.orderId)).toBe('VERIFIED')

    const log = await readApprovalLog(set.db, set.order.orderId)
    expect(log).not.toBeNull()
    expect(log?.decision).toBe('APPROVED')
    expect(log?.verifierId).toBe(set.actors.verifier.id)
    expect(log?.attemptNo).toBe(1)
    const snapshot = log?.varianceSnapshot as { components?: unknown[] } | null | undefined
    expect(snapshot).toHaveProperty('components')
    expect(snapshot?.components).toHaveLength(set.order.componentIds.length)
  })

  it('blocks approval with 422 and keeps the order pending when a component is RED', async () => {
    const sleeves = set.order.componentIds.find(
      (id) => id.endsWith('7777-7777-4777-8777-777777777777')
    )
    const redCounts = set.order.componentIds.map((componentId) => ({
      component_id: componentId,
      actual_qty:
        componentId === sleeves
          ? set.order.expectedQtyByComponent[componentId] - 3
          : set.order.expectedQtyByComponent[componentId],
    }))

    await expect(
      approveOrder(set.db, set.actors.verifier, set.order.orderId, { counts: redCounts })
    ).rejects.toBeInstanceOf(BusinessRuleError)
    await expect(
      approveOrder(set.db, set.actors.verifier, set.order.orderId, { counts: redCounts })
    ).rejects.toMatchObject({ status: 422, code: 'BUSINESS_RULE' })

    expect(await orderStatus(set.db, set.order.orderId)).toBe('PENDING_VERIFICATION')
    expect(await countLogs(set.db, set.order.orderId)).toBe(0)
  })

  it('rejects a note-less rejection before reaching the database (400)', () => {
    expect(() => rejectOrderSchema.parse({})).toThrow(ZodError)
    expect(() =>
      rejectOrderSchema.parse({ counts: [{ component_id: set.order.componentIds[0], actual_qty: 1 }] })
    ).toThrow(ZodError)
  })

  it.each([
    { name: 'cutting supervisor', actorKey: 'supervisor' as const },
    { name: 'sewing supervisor', actorKey: 'sewingUser' as const },
  ])('returns 403 when the $name tries to approve', async ({ actorKey }) => {
    const actor = set.actors[actorKey]

    await expect(
      approveOrder(set.db, actor, set.order.orderId, { counts: greenCounts(set.order) })
    ).rejects.toBeInstanceOf(ForbiddenError)
    await expect(
      approveOrder(set.db, actor, set.order.orderId, { counts: greenCounts(set.order) })
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })

    expect(await orderStatus(set.db, set.order.orderId)).toBe('PENDING_VERIFICATION')
    expect(await countLogs(set.db, set.order.orderId)).toBe(0)
  })

  it('returns 403 when a non-verifier tries to reject', async () => {
    await expect(
      rejectOrder(set.db, set.actors.supervisor, set.order.orderId, {
        note: 'Fabric rolled before cutting.',
      })
    ).rejects.toMatchObject({ status: 403 })
  })

  it('never lists unapproved orders in the sewing queue', async () => {
    const pending = await createOrderFixture(set.db, {
      createdBy: set.actors.supervisor.id,
    })
    const rejected = await createOrderFixture(set.db, {
      createdBy: set.actors.supervisor.id,
    })
    await rejectOrder(set.db, set.actors.verifier, rejected.orderId, {
      note: 'Roll damaged near the edge.',
    })
    await approveOrder(set.db, set.actors.verifier, set.order.orderId, {
      counts: greenCounts(set.order),
    })

    const queue = await listVerifiedQueue(set.db)
    const queueOrderNos = queue.map((entry) => entry.orderNo)

    expect(queueOrderNos).toContain(set.order.orderNo)
    expect(queueOrderNos).not.toContain(pending.orderNo)
    expect(queueOrderNos).not.toContain(rejected.orderNo)
    expect(queueOrderNos).toHaveLength(1)
  })
})
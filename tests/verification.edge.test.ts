import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { cuttingOrders, verificationLogs } from '@/db/schema'
import {
  approveOrderSchema,
  rejectOrderSchema,
  saveCountsSchema,
} from '@/domain/verification'
import { approveOrder } from '@/server/services/verification'
import {
  countLogs,
  createOrderFixture,
  createTestSet,
  greenCounts,
  orderStatus,
  readApprovalLog,
  type TestFixtureSet,
} from './helpers/testDb'

describe('edge cases (integration)', () => {
  let set: TestFixtureSet

  beforeEach(async () => {
    set = await createTestSet()
  })

  it('blocks approval with 422 while components are uncounted (NULL)', async () => {
    await expect(approveOrder(set.db, set.actors.verifier, set.order.orderId, {})).rejects.toMatchObject(
      { status: 422, code: 'BUSINESS_RULE' }
    )
    expect(await orderStatus(set.db, set.order.orderId)).toBe('PENDING_VERIFICATION')
    expect(await countLogs(set.db, set.order.orderId)).toBe(0)
  })

  it('returns 409 when an already approved order is approved again', async () => {
    await approveOrder(set.db, set.actors.verifier, set.order.orderId, {
      counts: greenCounts(set.order),
    })

    await expect(
      approveOrder(set.db, set.actors.verifier, set.order.orderId, {
        counts: greenCounts(set.order),
      })
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' })
  })

  it('approves an order with a YELLOW (excess) component', async () => {
    const yellowCounts = set.order.componentIds.map((componentId) => ({
      component_id: componentId,
      actual_qty:
        componentId === set.order.componentIds[0]
          ? set.order.expectedQtyByComponent[componentId] + 4
          : set.order.expectedQtyByComponent[componentId],
    }))

    const result = await approveOrder(set.db, set.actors.verifier, set.order.orderId, {
      counts: yellowCounts,
    })
    expect(result.order.status).toBe('VERIFIED')
    expect(await orderStatus(set.db, set.order.orderId)).toBe('VERIFIED')
  })

  it('records the correct wastage percentage on approval', async () => {
    const withWastage = await createTestSet()
    // expected 90 yds, used 92.5 yds → (92.5 - 90) / 90 * 100 = 2.78
    const order = await createOrderFixture(withWastage.db, {
      createdBy: withWastage.actors.supervisor.id,
      expectedFabricYds: 90,
      actualFabricYds: 92.5,
    })

    const result = await approveOrder(withWastage.db, withWastage.actors.verifier, order.orderId, {
      counts: greenCounts(order),
    })
    expect(result.wastagePct).toBe(2.78)

    const log = await readApprovalLog(withWastage.db, order.orderId)
    expect(log?.wastagePct).toBe('2.78')
  })

  it('rejects negative, decimal and empty inputs via the Zod schemas', () => {
    const componentId = set.order.componentIds[0]
    expect(() =>
      saveCountsSchema.parse({ counts: [{ component_id: componentId, actual_qty: -1 }] })
    ).toThrow()
    expect(() =>
      approveOrderSchema.parse({
        counts: [{ component_id: componentId, actual_qty: 2.5 }],
      })
    ).toThrow()
    expect(() => rejectOrderSchema.parse({ note: '   ' })).toThrow()
    expect(() => approveOrderSchema.parse({})).not.toThrow()
  })
})

describe('database triggers', () => {
  let set: TestFixtureSet

  beforeEach(async () => {
    set = await createTestSet()
  })

  async function expectRejectedWithTriggerError(
    promise: Promise<unknown>,
    pattern: RegExp
  ): Promise<void> {
    let caught: unknown
    try {
      await promise
    } catch (error) {
      caught = error
    }
    expect(caught, 'expected the query to be rejected by the database').toBeDefined()
    const message =
      caught instanceof Error
        ? caught.message + (caught.cause instanceof Error ? `\n${caught.cause.message}` : '')
        : String(caught)
    expect(message).toMatch(pattern)
  }

  it('blocks direct UPDATE on verification_logs after approval', async () => {
    await approveOrder(set.db, set.actors.verifier, set.order.orderId, {
      counts: greenCounts(set.order),
    })
    const log = await readApprovalLog(set.db, set.order.orderId)
    expect(log).not.toBeNull()

    await expectRejectedWithTriggerError(
      set.db
        .update(verificationLogs)
        .set({ approvalNote: 'tampered' })
        .where(eq(verificationLogs.id, log!.id)),
      /verification_logs rows are immutable/
    )
  })

  it('blocks direct DELETE on verification_logs after approval', async () => {
    await approveOrder(set.db, set.actors.verifier, set.order.orderId, {
      counts: greenCounts(set.order),
    })
    const log = await readApprovalLog(set.db, set.order.orderId)
    expect(log).not.toBeNull()

    await expectRejectedWithTriggerError(
      set.db.delete(verificationLogs).where(eq(verificationLogs.id, log!.id)),
      /verification_logs rows are immutable/
    )
  })

  it('rejects an invalid status transition at the database level', async () => {
    await approveOrder(set.db, set.actors.verifier, set.order.orderId, {
      counts: greenCounts(set.order),
    })
    expect(await orderStatus(set.db, set.order.orderId)).toBe('VERIFIED')

    await expectRejectedWithTriggerError(
      set.db
        .update(cuttingOrders)
        .set({ status: 'PENDING_VERIFICATION' })
        .where(eq(cuttingOrders.id, set.order.orderId)),
      /Invalid status transition/
    )
  })
})
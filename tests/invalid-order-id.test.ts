import { beforeEach, describe, expect, it } from 'vitest'
import { NotFoundError } from '@/domain/errors'
import { isUuid } from '@/domain/validation'
import { getVerifiedOrderDetail } from '@/server/services/sewing'
import { getVerificationContext } from '@/server/services/verification'
import { createTestSet, type TestFixtureSet } from './helpers/testDb'

describe('isUuid', () => {
  it('accepts a canonical UUID', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true)
  })

  it.each([
    'order',
    '',
    'not-a-uuid',
    '12345',
    '11111111-1111-4111-8111-11111111111',
  ])('rejects %j', (value) => {
    expect(isUuid(value)).toBe(false)
  })
})

describe('an invalid order id is treated as not found', () => {
  let set: TestFixtureSet

  beforeEach(async () => {
    set = await createTestSet()
  })

  it('getVerificationContext returns null for a non-UUID id without a Postgres error', async () => {
    await expect(getVerificationContext(set.db, 'order')).resolves.toBeNull()
  })

  it('getVerificationContext returns null for a well-formed but missing UUID', async () => {
    await expect(
      getVerificationContext(set.db, '99999999-9999-4999-8999-999999999999')
    ).resolves.toBeNull()
  })

  it('getVerifiedOrderDetail throws NotFoundError for a non-UUID id', async () => {
    await expect(getVerifiedOrderDetail(set.db, 'order')).rejects.toBeInstanceOf(NotFoundError)
    await expect(getVerifiedOrderDetail(set.db, 'order')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
  })
})

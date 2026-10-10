import fs from 'node:fs'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '@/db/schema'
import {
  cuttingOrders,
  recipeComponents,
  recipes,
  users,
  verificationItems,
  verificationLogs,
  type NewUser,
  type OrderStatus,
} from '@/db/schema'
import type { SessionUser } from '@/server/auth/session'
import type { Db } from '@/server/db'

export const TEST_IDS = {
  verifier: '11111111-1111-4111-8111-111111111111',
  supervisor: '22222222-2222-4222-8222-222222222222',
  sewing: '33333333-3333-4333-8333-333333333333',
  recipe: '44444444-4444-4444-8444-444444444444',
  components: {
    frontBody: '55555555-5555-4555-8555-555555555555',
    backBody: '66666666-6666-4666-8666-666666666666',
    sleeves: '77777777-7777-4777-8777-777777777777',
  },
} as const

export async function createTestDb(): Promise<Db> {
  const client = new PGlite()
  const migrationsFolder = path.resolve(process.cwd(), 'db/migrations')
  // Apply the migration files verbatim. drizzle's PGlite migrator sends each
  // file as a single prepared statement, which PGlite rejects when the file
  // contains several statements (0001_triggers_rls.sql has no breakpoints).
  const files = fs
    .readdirSync(migrationsFolder)
    .filter((name) => name.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsFolder, file), 'utf8')
    await client.exec(sql)
  }
  const database = drizzle(client, { schema })
  return database as unknown as Db
}

export interface TestActors {
  verifier: SessionUser
  supervisor: SessionUser
  sewingUser: SessionUser
}

function session(
  id: string,
  email: string,
  role: Role,
  fullName: string
): SessionUser {
  return { id, email, role, fullName, isActive: true }
}

type Role = (typeof schema.roleEnum.enumValues)[number]

export async function seedUsers(db: Db): Promise<TestActors> {
  const rows: NewUser[] = [
    {
      id: TEST_IDS.verifier,
      email: 'verifier@test.local',
      passwordHash: 'unused-in-tests',
      role: 'cutting_verifier',
      fullName: 'Test Verifier',
      isActive: true,
    },
    {
      id: TEST_IDS.supervisor,
      email: 'supervisor@test.local',
      passwordHash: 'unused-in-tests',
      role: 'cutting_supervisor',
      fullName: 'Test Supervisor',
      isActive: true,
    },
    {
      id: TEST_IDS.sewing,
      email: 'sewing@test.local',
      passwordHash: 'unused-in-tests',
      role: 'sewing_supervisor',
      fullName: 'Test Sewing Supervisor',
      isActive: true,
    },
  ]
  await db.insert(users).values(rows)

  return {
    verifier: session(TEST_IDS.verifier, 'verifier@test.local', 'cutting_verifier', 'Test Verifier'),
    supervisor: session(
      TEST_IDS.supervisor,
      'supervisor@test.local',
      'cutting_supervisor',
      'Test Supervisor'
    ),
    sewingUser: session(
      TEST_IDS.sewing,
      'sewing@test.local',
      'sewing_supervisor',
      'Test Sewing Supervisor'
    ),
  }
}

export async function seedRecipe(db: Db): Promise<void> {
  await db.insert(recipes).values({
    id: TEST_IDS.recipe,
    recipeCode: 'TEST-TEE',
    name: 'Test Crew T-Shirt',
    category: 'Tops',
    stdFabricYards: '1.50',
    wastageCap: '5.00',
  })
  await db.insert(recipeComponents).values([
    {
      id: TEST_IDS.components.frontBody,
      recipeId: TEST_IDS.recipe,
      componentName: 'Front Body Panel',
      piecesPerGarment: 2,
    },
    {
      id: TEST_IDS.components.backBody,
      recipeId: TEST_IDS.recipe,
      componentName: 'Back Body Panel',
      piecesPerGarment: 1,
    },
    {
      id: TEST_IDS.components.sleeves,
      recipeId: TEST_IDS.recipe,
      componentName: 'Sleeves',
      piecesPerGarment: 2,
    },
  ])
}

export interface OrderFixture {
  orderId: string
  orderNo: string
  componentIds: string[]
  expectedQtyByComponent: Record<string, number>
}

export interface CreateOrderFixtureOptions {
  createdBy: string
  recipeId?: string
  orderNo?: string
  targetQty?: number
  actualFabricYds?: number
  expectedFabricYds?: number
  actuals?: Record<string, number>
}

let orderCounter = 1

export async function createOrderFixture(
  db: Db,
  options: CreateOrderFixtureOptions
): Promise<OrderFixture> {
  const recipeId = options.recipeId ?? TEST_IDS.recipe
  const targetQty = options.targetQty ?? 20
  const components = await db
    .select()
    .from(recipeComponents)
    .where(eq(recipeComponents.recipeId, recipeId))

  const [order] = await db
    .insert(cuttingOrders)
    .values({
      orderNo: options.orderNo ?? `CO-TEST-${String(orderCounter++).padStart(4, '0')}`,
      recipeId,
      targetQty,
      fabricRollId: 'RL-TEST-01',
      actualFabricYds: String(options.actualFabricYds ?? 30),
      expectedFabricYds: String(options.expectedFabricYds ?? 30),
      status: 'PENDING_VERIFICATION',
      createdBy: options.createdBy,
    })
    .returning()
  if (!order) throw new Error('Failed to create order fixture')

  const expectedQtyByComponent: Record<string, number> = {}
  const itemRows = components.map((component) => {
    const expectedQty = component.piecesPerGarment * targetQty
    expectedQtyByComponent[component.id] = expectedQty
    return {
      orderId: order.id,
      componentId: component.id,
      expectedQty,
      actualQty: options.actuals?.[component.id] ?? null,
      status: null,
    }
  })
  await db.insert(verificationItems).values(itemRows)

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    componentIds: components.map((component) => component.id),
    expectedQtyByComponent,
  }
}

export interface TestFixtureSet {
  db: Db
  actors: TestActors
  order: OrderFixture
}

export async function createTestSet(): Promise<TestFixtureSet> {
  const db = await createTestDb()
  const actors = await seedUsers(db)
  await seedRecipe(db)
  const order = await createOrderFixture(db, { createdBy: actors.supervisor.id })
  return { db, actors, order }
}

export async function orderStatus(db: Db, orderId: string): Promise<OrderStatus> {
  const rows = await db
    .select({ status: cuttingOrders.status })
    .from(cuttingOrders)
    .where(eq(cuttingOrders.id, orderId))
  if (!rows[0]) throw new Error('Order not found')
  return rows[0].status
}

export async function readApprovalLog(db: Db, orderId: string) {
  const rows = await db
    .select()
    .from(verificationLogs)
    .where(eq(verificationLogs.orderId, orderId))
  return rows[0] ?? null
}

export async function countLogs(db: Db, orderId: string): Promise<number> {
  const rows = await db
    .select()
    .from(verificationLogs)
    .where(eq(verificationLogs.orderId, orderId))
  return rows.length
}

export function greenCounts(fixture: OrderFixture) {
  return fixture.componentIds.map((componentId) => ({
    component_id: componentId,
    actual_qty: fixture.expectedQtyByComponent[componentId],
  }))
}
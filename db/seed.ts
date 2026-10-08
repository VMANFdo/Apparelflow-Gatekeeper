import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'
import { eq, like, sql } from 'drizzle-orm'
import {
  users,
  recipes,
  recipeComponents,
  cuttingOrders,
  verificationItems,
  verificationLogs,
  type OrderStatus,
} from './schema'

config({ path: '.env.local' })

const round2 = (value: number): number => Math.round(value * 100) / 100

interface DemoOrder {
  recipeCode: string
  roll: string
  targetQty: number
  actualFabricYds: string
  ageDays: number
  counts: Record<string, number>
  status: OrderStatus
  log?: {
    decision: 'APPROVED' | 'REJECTED'
    rejectionNote: string | null
    approvalNote: string | null
  }
}

const runSeed = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in .env.local')
  }

  // Use the transaction pooler or direct connection. For seeding, direct is fine if needed,
  // but DATABASE_URL is standard.
  const connectionString = process.env.DATABASE_URL
  const client = postgres(connectionString, { prepare: false, max: 1 })
  const db = drizzle(client)

  console.log('Seeding Database...')

  // ─── 1. Users ─────────────────────────────────────────────────────────────
  console.log('Seeding users...')
  const usersToSeed = [
    {
      email: 'supervisor@apparelflow.demo',
      passwordPlain: 'Supervisor@123',
      role: 'cutting_supervisor' as const,
      fullName: 'Cutting Supervisor',
    },
    {
      email: 'verifier@apparelflow.demo',
      passwordPlain: 'Verifier@123',
      role: 'cutting_verifier' as const,
      fullName: 'Cutting Verifier',
    },
    {
      email: 'sewing@apparelflow.demo',
      passwordPlain: 'Sewing@123',
      role: 'sewing_supervisor' as const,
      fullName: 'Sewing Supervisor',
    },
  ]

  for (const u of usersToSeed) {
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, u.email))
      .limit(1)

    if (existingUser.length === 0) {
      const passwordHash = await bcrypt.hash(u.passwordPlain, 10)
      await db.insert(users).values({
        email: u.email,
        passwordHash,
        role: u.role,
        fullName: u.fullName,
      })
      console.log(`User ${u.email} created.`)
    } else {
      console.log(`User ${u.email} already exists.`)
    }
  }

  // ─── 2. Recipes ───────────────────────────────────────────────────────────
  console.log('Seeding recipes...')
  
  const recipesToSeed = [
    {
      recipeCode: 'REC-BL01',
      name: 'Casual Blouse',
      category: 'Blouse',
      stdFabricYards: '1.80',
      wastageCap: '5.00',
      components: [
        { name: 'Front Body Panel', pieces: 1 },
        { name: 'Back Body Panel', pieces: 1 },
        { name: 'Sleeves (Left & Right)', pieces: 2 },
        { name: 'Collar & Stand', pieces: 1 },
        { name: 'Sleeve Cuffs', pieces: 2 },
      ]
    },
    {
      recipeCode: 'REC-CT02',
      name: 'Crop Top',
      category: 'Crop Top',
      stdFabricYards: '1.10',
      wastageCap: '8.00',
      components: [
        { name: 'Front Chest Panel', pieces: 1 },
        { name: 'Back Support Panel', pieces: 1 },
        { name: 'Neck Binding Strip', pieces: 1 },
        { name: 'Hem Elastic Casing', pieces: 1 },
        { name: 'Side Strap Accents', pieces: 2 },
      ]
    }
  ]

  for (const r of recipesToSeed) {
    let recipeId: string
    const existingRecipe = await db
      .select()
      .from(recipes)
      .where(eq(recipes.recipeCode, r.recipeCode))
      .limit(1)

    if (existingRecipe.length === 0) {
      const [newRecipe] = await db.insert(recipes).values({
        recipeCode: r.recipeCode,
        name: r.name,
        category: r.category,
        stdFabricYards: r.stdFabricYards,
        wastageCap: r.wastageCap,
      }).returning({ id: recipes.id })
      recipeId = newRecipe.id
      console.log(`Recipe ${r.recipeCode} created.`)
    } else {
      recipeId = existingRecipe[0].id
      console.log(`Recipe ${r.recipeCode} already exists.`)
    }

    // Seed components
    for (const c of r.components) {
      const existingComponent = await db
        .select()
        .from(recipeComponents)
        .where(eq(recipeComponents.recipeId, recipeId))
      
      const hasComponent = existingComponent.some(ec => ec.componentName === c.name)
      
      if (!hasComponent) {
        await db.insert(recipeComponents).values({
          recipeId,
          componentName: c.name,
          piecesPerGarment: c.pieces,
        })
        console.log(`  Component ${c.name} added to ${r.recipeCode}.`)
      }
    }
  }

  // ─── 3. Demo cutting orders ──────────────────────────────────────────────
  console.log('Seeding demo orders...')

  const [existingDemoOrder] = await db
    .select({ id: cuttingOrders.id })
    .from(cuttingOrders)
    .where(like(cuttingOrders.fabricRollId, 'DEMO-%'))
    .limit(1)

  if (existingDemoOrder) {
    console.log('Demo orders already exist. Skipping.')
  } else {
    const [supervisor] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'supervisor@apparelflow.demo'))
      .limit(1)
    const [verifier] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'verifier@apparelflow.demo'))
      .limit(1)
    if (!supervisor || !verifier) {
      throw new Error('Demo users are missing. Run the user seed section first.')
    }

    const demoOrders: DemoOrder[] = [
      {
        recipeCode: 'REC-BL01',
        roll: 'DEMO-ROLL-A',
        targetQty: 50,
        actualFabricYds: '92.50',
        ageDays: 3,
        counts: {},
        status: 'PENDING_VERIFICATION',
      },
      {
        recipeCode: 'REC-CT02',
        roll: 'DEMO-ROLL-B',
        targetQty: 40,
        actualFabricYds: '45.60',
        ageDays: 2,
        counts: {
          'Front Chest Panel': 40,
          'Back Support Panel': 41,
          'Neck Binding Strip': 40,
          'Hem Elastic Casing': 36,
          'Side Strap Accents': 80,
        },
        status: 'REJECTED',
        log: {
          decision: 'REJECTED',
          rejectionNote:
            'Hem Elastic Casing is short by 4 pieces - recut and re-count before resubmitting.',
          approvalNote: null,
        },
      },
      {
        recipeCode: 'REC-BL01',
        roll: 'DEMO-ROLL-C',
        targetQty: 30,
        actualFabricYds: '55.10',
        ageDays: 1,
        counts: {
          'Front Body Panel': 30,
          'Back Body Panel': 30,
          'Sleeves (Left & Right)': 60,
          'Collar & Stand': 30,
          'Sleeve Cuffs': 60,
        },
        status: 'VERIFIED',
        log: {
          decision: 'APPROVED',
          rejectionNote: null,
          approvalNote: 'All components match the expected count. Fabric wastage within cap.',
        },
      },
    ]

    for (const demo of demoOrders) {
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(eq(recipes.recipeCode, demo.recipeCode))
        .limit(1)
      if (!recipe) {
        throw new Error(`Recipe ${demo.recipeCode} is missing. Run the recipe seed first.`)
      }

      const components = await db
        .select()
        .from(recipeComponents)
        .where(eq(recipeComponents.recipeId, recipe.id))

      const seqRows = await db.execute(sql`select nextval('order_no_seq') as n`)
      const nextNo = Number((seqRows as unknown as { n: string | number }[])[0].n)
      const orderNo = `CO-${new Date().getFullYear()}-${String(nextNo).padStart(4, '0')}`

      const expectedFabricYds = round2(Number(recipe.stdFabricYards) * demo.targetQty)
      const createdAt = new Date(Date.now() - demo.ageDays * 24 * 60 * 60 * 1000)

      const [order] = await db
        .insert(cuttingOrders)
        .values({
          orderNo,
          recipeId: recipe.id,
          targetQty: demo.targetQty,
          fabricRollId: demo.roll,
          actualFabricYds: demo.actualFabricYds,
          expectedFabricYds: expectedFabricYds.toFixed(2),
          status: demo.status,
          createdBy: supervisor.id,
          createdAt,
          updatedAt: createdAt,
        })
        .returning()
      if (!order) throw new Error(`Failed to insert demo order ${demo.roll}`)

      const itemRows = components.map((component) => {
        const expectedQty = component.piecesPerGarment * demo.targetQty
        const actual = demo.counts[component.componentName]
        return {
          orderId: order.id,
          componentId: component.id,
          expectedQty,
          actualQty: actual ?? null,
          status:
            actual === undefined
              ? null
              : actual === expectedQty
                ? ('GREEN' as const)
                : actual > expectedQty
                  ? ('YELLOW' as const)
                  : ('RED' as const),
        }
      })
      await db.insert(verificationItems).values(itemRows)

      if (demo.log) {
        const wastagePct = round2(
          ((Number(demo.actualFabricYds) - expectedFabricYds) / expectedFabricYds) * 100
        )

        await db.insert(verificationLogs).values({
          orderId: order.id,
          verifierId: verifier.id,
          decision: demo.log.decision,
          rejectionNote: demo.log.rejectionNote,
          approvalNote: demo.log.approvalNote,
          wastagePct: wastagePct.toFixed(2),
          varianceSnapshot: {
            wastagePct,
            components: itemRows.map((row) => ({
              componentName:
                components.find((component) => component.id === row.componentId)
                  ?.componentName ?? null,
              expectedQty: row.expectedQty,
              actualQty: row.actualQty,
              delta: row.actualQty === null ? null : row.actualQty - row.expectedQty,
              status: row.status,
            })),
          },
          attemptNo: 1,
          createdAt,
        })
      }

      console.log(`Demo order ${orderNo} created with status ${demo.status}.`)
    }
  }

  console.log('Seeding completed successfully!')
  await client.end()
}

runSeed().catch((err) => {
  console.error('Failed to seed database:', err)
  process.exit(1)
})

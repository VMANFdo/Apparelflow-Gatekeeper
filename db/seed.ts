import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'
import { users, recipes, recipeComponents } from './schema'
import { eq } from 'drizzle-orm'

config({ path: '.env.local' })

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

  console.log('Seeding completed successfully!')
  await client.end()
}

runSeed().catch((err) => {
  console.error('Failed to seed database:', err)
  process.exit(1)
})

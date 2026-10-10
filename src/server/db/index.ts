import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../../db/schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

// Disable prefetch/prepare for "Transaction" pool mode on serverless
const client = postgres(connectionString, {
  prepare: false,
  max: process.env.NODE_ENV === 'development' ? 5 : 1,
  connect_timeout: 10,
  idle_timeout: 30,
  max_lifetime: 300,
})

export const db = drizzle(client, { schema })

export type Db = typeof db

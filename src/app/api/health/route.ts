import { NextResponse } from 'next/server'
import { db } from '@/server/db'
import { sql } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Run SELECT 1 to verify database connectivity
    await db.execute(sql`SELECT 1`)

    return NextResponse.json(
      { status: 'ok', timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      { status: 'error', message: 'Database connection failed' },
      { status: 503 }
    )
  }
}

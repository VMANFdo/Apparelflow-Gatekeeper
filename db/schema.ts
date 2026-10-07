import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', [
  'cutting_supervisor',
  'cutting_verifier',
  'sewing_supervisor',
])

export const orderStatusEnum = pgEnum('order_status', [
  'PENDING_VERIFICATION',
  'REJECTED',
  'VERIFIED',
])

export const itemStatusEnum = pgEnum('item_status', ['GREEN', 'YELLOW', 'RED'])

export const decisionEnum = pgEnum('decision', ['APPROVED', 'REJECTED'])

// ─── Tables ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull(),
  fullName: text('full_name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeCode: text('recipe_code').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  stdFabricYards: numeric('std_fabric_yards', { precision: 8, scale: 2 }).notNull(),
  wastageCap: numeric('wastage_cap', { precision: 5, scale: 2 }).notNull(),
})

export const recipeComponents = pgTable('recipe_components', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id')
    .notNull()
    .references(() => recipes.id),
  componentName: text('component_name').notNull(),
  piecesPerGarment: integer('pieces_per_garment').notNull(),
  imageUrl: text('image_url'),
})

export const cuttingOrders = pgTable(
  'cutting_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNo: text('order_no').notNull().unique(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id),
    targetQty: integer('target_qty').notNull(),
    fabricRollId: text('fabric_roll_id').notNull(),
    actualFabricYds: numeric('actual_fabric_yds', { precision: 10, scale: 2 }).notNull(),
    expectedFabricYds: numeric('expected_fabric_yds', { precision: 10, scale: 2 }).notNull(),
    status: orderStatusEnum('status').notNull().default('PENDING_VERIFICATION'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    sewingStartedAt: timestamp('sewing_started_at', { withTimezone: true }),
    sewingStartedBy: uuid('sewing_started_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('cutting_orders_status_idx').on(t.status),
    sql`CONSTRAINT cutting_orders_target_qty_check CHECK (${t.targetQty} > 0)`,
    sql`CONSTRAINT cutting_orders_actual_fabric_check CHECK (${t.actualFabricYds} > 0)`,
    sql`CONSTRAINT cutting_orders_expected_fabric_check CHECK (${t.expectedFabricYds} > 0)`,
  ]
)

export const verificationItems = pgTable(
  'verification_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => cuttingOrders.id),
    componentId: uuid('component_id')
      .notNull()
      .references(() => recipeComponents.id),
    expectedQty: integer('expected_qty').notNull(),
    // nullable = uncounted (NULL means the verifier hasn't entered a count yet)
    actualQty: integer('actual_qty'),
    status: itemStatusEnum('status'),
  },
  (t) => [
    uniqueIndex('vi_order_component_unique').on(t.orderId, t.componentId),
    index('verification_items_order_idx').on(t.orderId),
    sql`CONSTRAINT vi_actual_qty_check CHECK (actual_qty IS NULL OR actual_qty >= 0)`,
    sql`CONSTRAINT vi_expected_qty_check CHECK (expected_qty >= 0)`,
  ]
)

export const verificationLogs = pgTable(
  'verification_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => cuttingOrders.id),
    verifierId: uuid('verifier_id')
      .notNull()
      .references(() => users.id),
    decision: decisionEnum('decision').notNull(),
    rejectionNote: text('rejection_note'),
    approvalNote: text('approval_note'),
    wastagePct: numeric('wastage_pct', { precision: 7, scale: 2 }).notNull(),
    varianceSnapshot: jsonb('variance_snapshot').notNull(),
    attemptNo: integer('attempt_no').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    sql`CONSTRAINT vl_rejection_note_check CHECK (
      decision != 'REJECTED' OR (rejection_note IS NOT NULL AND rejection_note != '')
    )`,
  ]
)

// ─── Type exports ─────────────────────────────────────────────────────────────

export type Role = (typeof roleEnum.enumValues)[number]
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number]

export type User = typeof users.$inferSelect
export type Recipe = typeof recipes.$inferSelect
export type RecipeComponent = typeof recipeComponents.$inferSelect
export type CuttingOrder = typeof cuttingOrders.$inferSelect
export type VerificationItem = typeof verificationItems.$inferSelect
export type VerificationLog = typeof verificationLogs.$inferSelect

export type NewUser = typeof users.$inferInsert
export type NewRecipe = typeof recipes.$inferInsert
export type NewRecipeComponent = typeof recipeComponents.$inferInsert
export type NewCuttingOrder = typeof cuttingOrders.$inferInsert
export type NewVerificationItem = typeof verificationItems.$inferInsert
export type NewVerificationLog = typeof verificationLogs.$inferInsert

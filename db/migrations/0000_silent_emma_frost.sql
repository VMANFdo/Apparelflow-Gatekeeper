CREATE TYPE "public"."decision" AS ENUM('APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('GREEN', 'YELLOW', 'RED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING_VERIFICATION', 'REJECTED', 'VERIFIED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('cutting_supervisor', 'cutting_verifier', 'sewing_supervisor');--> statement-breakpoint
CREATE TABLE "cutting_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_no" text NOT NULL,
	"recipe_id" uuid NOT NULL,
	"target_qty" integer NOT NULL,
	"fabric_roll_id" text NOT NULL,
	"actual_fabric_yds" numeric(10, 2) NOT NULL,
	"expected_fabric_yds" numeric(10, 2) NOT NULL,
	"status" "order_status" DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	"created_by" uuid NOT NULL,
	"sewing_started_at" timestamp with time zone,
	"sewing_started_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cutting_orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "recipe_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"component_name" text NOT NULL,
	"pieces_per_garment" integer NOT NULL,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"std_fabric_yards" numeric(8, 2) NOT NULL,
	"wastage_cap" numeric(5, 2) NOT NULL,
	CONSTRAINT "recipes_recipe_code_unique" UNIQUE("recipe_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"full_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"expected_qty" integer NOT NULL,
	"actual_qty" integer,
	"status" "item_status"
);
--> statement-breakpoint
CREATE TABLE "verification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"verifier_id" uuid NOT NULL,
	"decision" "decision" NOT NULL,
	"rejection_note" text,
	"approval_note" text,
	"wastage_pct" numeric(7, 2) NOT NULL,
	"variance_snapshot" jsonb NOT NULL,
	"attempt_no" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_sewing_started_by_users_id_fk" FOREIGN KEY ("sewing_started_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_order_id_cutting_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."cutting_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_component_id_recipe_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."recipe_components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_order_id_cutting_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."cutting_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_verifier_id_users_id_fk" FOREIGN KEY ("verifier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cutting_orders_status_idx" ON "cutting_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "vi_order_component_unique" ON "verification_items" USING btree ("order_id","component_id");--> statement-breakpoint
CREATE INDEX "verification_items_order_idx" ON "verification_items" USING btree ("order_id");
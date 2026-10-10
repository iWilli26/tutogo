CREATE TABLE "anomalies" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"session_id" text,
	"user_id" text,
	"details" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp (3) with time zone,
	CONSTRAINT "anomalies_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_confirmations" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"tutee_id" text NOT NULL,
	"participated" boolean NOT NULL,
	"duration_bucket" text,
	"confirmed_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "session_confirmations_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"tutor_id" text NOT NULL,
	"tutee_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"tutor_duration_min" integer,
	"tutor_declared_at" timestamp (3) with time zone,
	"comparison" text,
	"status_reason" text,
	"validated_minutes" integer DEFAULT 0 NOT NULL,
	"decided_by" text,
	"decided_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "subjects_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tutee_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"promo" text
);
--> statement-breakpoint
CREATE TABLE "tutor_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"promo" text
);
--> statement-breakpoint
CREATE TABLE "tutor_tutee_relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"tutor_id" text NOT NULL,
	"tutee_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_confirmations" ADD CONSTRAINT "session_confirmations_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_confirmations" ADD CONSTRAINT "session_confirmations_tutee_id_users_id_fk" FOREIGN KEY ("tutee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tutor_id_users_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tutee_id_users_id_fk" FOREIGN KEY ("tutee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutee_profiles" ADD CONSTRAINT "tutee_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_tutee_relationships" ADD CONSTRAINT "tutor_tutee_relationships_tutor_id_users_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_tutee_relationships" ADD CONSTRAINT "tutor_tutee_relationships_tutee_id_users_id_fk" FOREIGN KEY ("tutee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anomalies_status_idx" ON "anomalies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "sessions_tutor_idx" ON "sessions" USING btree ("tutor_id","status");--> statement-breakpoint
CREATE INDEX "sessions_tutee_idx" ON "sessions" USING btree ("tutee_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_open_code_idx" ON "sessions" USING btree ("tutor_id","code") WHERE tutor_declared_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "relationship_pair_idx" ON "tutor_tutee_relationships" USING btree ("tutor_id","tutee_id");
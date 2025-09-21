CREATE TABLE "analysis_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"validation_id" uuid NOT NULL,
	"step_name" varchar(20) NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"step_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "code_examples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"code_content" text NOT NULL,
	"quality_score" integer NOT NULL,
	"category" varchar(50),
	"description" text,
	"embedding" vector(1024),
	"tags" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "code_validations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"code_content" text NOT NULL,
	"syntax_is_valid" boolean NOT NULL,
	"syntax_errors" jsonb,
	"rule_compliance_score" integer NOT NULL,
	"rule_findings" jsonb NOT NULL,
	"rule_suggestions" jsonb NOT NULL,
	"code_quality_score" integer NOT NULL,
	"code_quality_feedback" text NOT NULL,
	"detailed_analysis" text NOT NULL,
	"total_duration_ms" integer NOT NULL,
	"model_used" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"section" varchar(100),
	"document_type" varchar(50) NOT NULL,
	"embedding" vector(1024),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_document_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"validation_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"relevance_score" real NOT NULL,
	"usage_context" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "validation_example_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"validation_id" uuid NOT NULL,
	"example_id" uuid NOT NULL,
	"similarity_score" real NOT NULL,
	"improvements" jsonb
);
--> statement-breakpoint
ALTER TABLE "analysis_steps" ADD CONSTRAINT "analysis_steps_validation_id_code_validations_id_fk" FOREIGN KEY ("validation_id") REFERENCES "public"."code_validations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_document_references" ADD CONSTRAINT "validation_document_references_validation_id_code_validations_id_fk" FOREIGN KEY ("validation_id") REFERENCES "public"."code_validations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_document_references" ADD CONSTRAINT "validation_document_references_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_example_references" ADD CONSTRAINT "validation_example_references_validation_id_code_validations_id_fk" FOREIGN KEY ("validation_id") REFERENCES "public"."code_validations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_example_references" ADD CONSTRAINT "validation_example_references_example_id_code_examples_id_fk" FOREIGN KEY ("example_id") REFERENCES "public"."code_examples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "code_examples_embedding_idx" ON "code_examples" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "knowledge_documents_embedding_idx" ON "knowledge_documents" USING hnsw ("embedding" vector_cosine_ops);
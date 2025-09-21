import { pgTable, uuid, text, boolean, integer, jsonb, timestamp, varchar, vector, real, index } from 'drizzle-orm/pg-core'

export const codeValidations = pgTable('code_validations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'), // 나중에 auth 추가 시
  codeContent: text('code_content').notNull(),

  // Syntax Check 결과
  syntaxIsValid: boolean('syntax_is_valid').notNull(),
  syntaxErrors: jsonb('syntax_errors').$type<string[]>(),

  // Rule Compliance 결과
  ruleComplianceScore: integer('rule_compliance_score').notNull(),
  ruleFindings: jsonb('rule_findings').$type<string[]>().notNull(),
  ruleSuggestions: jsonb('rule_suggestions').$type<string[]>().notNull(),

  // Code Quality 결과
  codeQualityScore: integer('code_quality_score').notNull(),
  codeQualityFeedback: text('code_quality_feedback').notNull(),

  // Detailed Analysis
  detailedAnalysis: text('detailed_analysis').notNull(),

  // Metadata
  totalDurationMs: integer('total_duration_ms').notNull(),
  modelUsed: varchar('model_used', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// 단계별 진행 로그 (선택사항 - 나중에 분석 성능 추적용)
export const analysisSteps = pgTable('analysis_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  validationId: uuid('validation_id').references(() => codeValidations.id).notNull(),
  stepName: varchar('step_name', { length: 20 }).notNull(), // 'syntax', 'rules', 'quality', 'analysis'
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  stepData: jsonb('step_data'), // 각 단계별 메타데이터
})

// Panther 규칙 문서 저장 (RAG용)
export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  section: varchar('section', { length: 100 }),
  documentType: varchar('document_type', { length: 50 }).notNull(), // 'rule', 'best-practice', 'example'
  embedding: vector('embedding', { dimensions: 1024 }), // Titan v2 차원
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  embeddingIndex: index('knowledge_documents_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
}))

// Few-shot 코드 예제
export const codeExamples = pgTable('code_examples', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  codeContent: text('code_content').notNull(),
  qualityScore: integer('quality_score').notNull(), // 0-100
  category: varchar('category', { length: 50 }),
  description: text('description'),
  embedding: vector('embedding', { dimensions: 1024 }),
  tags: jsonb('tags').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  embeddingIndex: index('code_examples_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  qualityScoreCheck: 'CHECK (quality_score >= 0 AND quality_score <= 100)',
}))

// 검증 결과에 RAG 정보 추가를 위한 확장
export const validationDocumentReferences = pgTable('validation_document_references', {
  id: uuid('id').primaryKey().defaultRandom(),
  validationId: uuid('validation_id').references(() => codeValidations.id).notNull(),
  documentId: uuid('document_id').references(() => knowledgeDocuments.id).notNull(),
  relevanceScore: real('relevance_score').notNull(), // 0.0-1.0
  usageContext: varchar('usage_context', { length: 100 }), // 'rule-compliance', 'quality-check', etc.
})

export const validationExampleReferences = pgTable('validation_example_references', {
  id: uuid('id').primaryKey().defaultRandom(),
  validationId: uuid('validation_id').references(() => codeValidations.id).notNull(),
  exampleId: uuid('example_id').references(() => codeExamples.id).notNull(),
  similarityScore: real('similarity_score').notNull(), // 0.0-1.0
  improvements: jsonb('improvements').$type<string[]>(),
})

// 타입 추출
export type CodeValidation = typeof codeValidations.$inferSelect
export type NewCodeValidation = typeof codeValidations.$inferInsert
export type AnalysisStep = typeof analysisSteps.$inferSelect
export type NewAnalysisStep = typeof analysisSteps.$inferInsert

export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect
export type NewKnowledgeDocument = typeof knowledgeDocuments.$inferInsert
export type CodeExample = typeof codeExamples.$inferSelect
export type NewCodeExample = typeof codeExamples.$inferInsert

export type ValidationDocumentReference = typeof validationDocumentReferences.$inferSelect
export type NewValidationDocumentReference = typeof validationDocumentReferences.$inferInsert
export type ValidationExampleReference = typeof validationExampleReferences.$inferSelect
export type NewValidationExampleReference = typeof validationExampleReferences.$inferInsert
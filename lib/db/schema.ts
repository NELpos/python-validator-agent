import { pgTable, uuid, text, boolean, integer, jsonb, timestamp, varchar } from 'drizzle-orm/pg-core'

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

// 타입 추출
export type CodeValidation = typeof codeValidations.$inferSelect
export type NewCodeValidation = typeof codeValidations.$inferInsert
export type AnalysisStep = typeof analysisSteps.$inferSelect
export type NewAnalysisStep = typeof analysisSteps.$inferInsert
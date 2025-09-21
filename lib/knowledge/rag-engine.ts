import { TitanEmbeddingClient } from '@/lib/embeddings/titan-client'
import { db } from '@/lib/db'
import { knowledgeDocuments, codeExamples, type KnowledgeDocument, type CodeExample } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export interface SearchResult {
  id: string
  title: string
  content: string
  section?: string
  documentType: string
  similarity: number
  metadata?: Record<string, any>
}

export interface ExampleSearchResult {
  id: string
  title: string
  codeContent: string
  qualityScore: number
  category?: string
  description?: string
  similarity: number
  tags?: string[]
}

export interface RAGContext {
  relevantDocuments: SearchResult[]
  similarExamples: ExampleSearchResult[]
  enhancedPrompt: string
  searchMetadata: {
    documentsFound: number
    examplesFound: number
    queryProcessingTime: number
  }
  complianceContext?: {
    missingRequirements: string[]
    complianceScore: number
    suggestions: string[]
  }
}

export class RAGEngine {
  private embeddingClient: TitanEmbeddingClient

  constructor() {
    this.embeddingClient = new TitanEmbeddingClient()
  }

  /**
   * Panther 공식 규칙 문서 우선 검색
   */
  async searchPantherRules(query: string, topK: number = 5, minSimilarity: number = 0.75): Promise<SearchResult[]> {
    try {
      const startTime = Date.now()

      // 쿼리 임베딩 생성
      const queryEmbedding = await this.embeddingClient.generateEmbedding(
        this.embeddingClient.preprocessText(query)
      )

      // Panther Rule 섹션과 rule 타입 문서를 우선 검색
      const results = await db
        .select({
          id: knowledgeDocuments.id,
          title: knowledgeDocuments.title,
          content: knowledgeDocuments.content,
          section: knowledgeDocuments.section,
          documentType: knowledgeDocuments.documentType,
          metadata: knowledgeDocuments.metadata,
          similarity: sql<number>`1 - (${knowledgeDocuments.embedding} <=> ${queryEmbedding})`,
          // 가중치: Panther Rule 섹션과 rule 타입에 높은 점수
          weightedScore: sql<number>`
            CASE
              WHEN ${knowledgeDocuments.section} ILIKE '%Panther Rule%' AND ${knowledgeDocuments.documentType} = 'rule' THEN (1 - (${knowledgeDocuments.embedding} <=> ${queryEmbedding})) * 1.3
              WHEN ${knowledgeDocuments.section} ILIKE '%Writing Python Detections%' THEN (1 - (${knowledgeDocuments.embedding} <=> ${queryEmbedding})) * 1.2
              WHEN ${knowledgeDocuments.documentType} = 'rule' THEN (1 - (${knowledgeDocuments.embedding} <=> ${queryEmbedding})) * 1.1
              ELSE (1 - (${knowledgeDocuments.embedding} <=> ${queryEmbedding}))
            END
          `
        })
        .from(knowledgeDocuments)
        .where(sql`${knowledgeDocuments.embedding} <=> ${queryEmbedding} < ${1 - minSimilarity}`)
        .orderBy(sql`
          CASE
            WHEN ${knowledgeDocuments.section} ILIKE '%Panther Rule%' AND ${knowledgeDocuments.documentType} = 'rule' THEN (1 - (${knowledgeDocuments.embedding} <=> ${queryEmbedding})) * 1.3
            WHEN ${knowledgeDocuments.section} ILIKE '%Writing Python Detections%' THEN (1 - (${knowledgeDocuments.embedding} <=> ${queryEmbedding})) * 1.2
            WHEN ${knowledgeDocuments.documentType} = 'rule' THEN (1 - (${knowledgeDocuments.embedding} <=> ${queryEmbedding})) * 1.1
            ELSE (1 - (${knowledgeDocuments.embedding} <=> ${queryEmbedding}))
          END DESC
        `)
        .limit(topK)

      const searchTime = Date.now() - startTime
      console.log(`Panther rule search completed in ${searchTime}ms, found ${results.length} results`)

      return results.map(result => ({
        id: result.id,
        title: result.title,
        content: result.content,
        section: result.section || undefined,
        documentType: result.documentType,
        similarity: result.weightedScore, // 가중치가 적용된 점수 사용
        metadata: result.metadata || undefined,
      }))
    } catch (error) {
      console.error('Error searching Panther rules:', error)
      throw new Error(`Panther rule search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 관련 Panther 규칙 문서 검색 (기존 메서드 유지)
   */
  async searchRelevantRules(query: string, topK: number = 5, minSimilarity: number = 0.7): Promise<SearchResult[]> {
    try {
      const startTime = Date.now()

      // 쿼리 임베딩 생성
      const queryEmbedding = await this.embeddingClient.generateEmbedding(
        this.embeddingClient.preprocessText(query)
      )

      // pgVector 코사인 유사도 검색
      const results = await db
        .select({
          id: knowledgeDocuments.id,
          title: knowledgeDocuments.title,
          content: knowledgeDocuments.content,
          section: knowledgeDocuments.section,
          documentType: knowledgeDocuments.documentType,
          metadata: knowledgeDocuments.metadata,
          similarity: sql<number>`1 - (${knowledgeDocuments.embedding} <=> ${queryEmbedding})`,
        })
        .from(knowledgeDocuments)
        .where(sql`${knowledgeDocuments.embedding} <=> ${queryEmbedding} < ${1 - minSimilarity}`)
        .orderBy(sql`${knowledgeDocuments.embedding} <=> ${queryEmbedding}`)
        .limit(topK)

      const searchTime = Date.now() - startTime
      console.log(`Document search completed in ${searchTime}ms, found ${results.length} results`)

      return results.map(result => ({
        id: result.id,
        title: result.title,
        content: result.content,
        section: result.section || undefined,
        documentType: result.documentType,
        similarity: result.similarity,
        metadata: result.metadata || undefined,
      }))
    } catch (error) {
      console.error('Error searching relevant rules:', error)
      throw new Error(`RAG search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 유사한 코드 예제 검색
   */
  async searchSimilarExamples(code: string, topK: number = 3, minSimilarity: number = 0.65): Promise<ExampleSearchResult[]> {
    try {
      const startTime = Date.now()

      // 코드 임베딩 생성
      const codeEmbedding = await this.embeddingClient.generateEmbedding(
        this.embeddingClient.preprocessText(code)
      )

      // 유사 예제 검색
      const results = await db
        .select({
          id: codeExamples.id,
          title: codeExamples.title,
          codeContent: codeExamples.codeContent,
          qualityScore: codeExamples.qualityScore,
          category: codeExamples.category,
          description: codeExamples.description,
          tags: codeExamples.tags,
          similarity: sql<number>`1 - (${codeExamples.embedding} <=> ${codeEmbedding})`,
        })
        .from(codeExamples)
        .where(sql`${codeExamples.embedding} <=> ${codeEmbedding} < ${1 - minSimilarity}`)
        .orderBy(sql`${codeExamples.embedding} <=> ${codeEmbedding}`)
        .limit(topK)

      const searchTime = Date.now() - startTime
      console.log(`Example search completed in ${searchTime}ms, found ${results.length} results`)

      return results.map(result => ({
        id: result.id,
        title: result.title,
        codeContent: result.codeContent,
        qualityScore: result.qualityScore,
        category: result.category || undefined,
        description: result.description || undefined,
        similarity: result.similarity,
        tags: result.tags || undefined,
      }))
    } catch (error) {
      console.error('Error searching similar examples:', error)
      throw new Error(`Example search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 키워드 기반 Panther 함수 검색
   */
  async searchByPantherFunctions(query: string, topK: number = 3): Promise<SearchResult[]> {
    try {
      const queryEmbedding = await this.embeddingClient.generateEmbedding(
        this.embeddingClient.preprocessText(query)
      )

      // Panther 특화 키워드가 포함된 문서 검색
      const results = await db
        .select({
          id: knowledgeDocuments.id,
          title: knowledgeDocuments.title,
          content: knowledgeDocuments.content,
          section: knowledgeDocuments.section,
          documentType: knowledgeDocuments.documentType,
          metadata: knowledgeDocuments.metadata,
          similarity: sql<number>`1 - (${knowledgeDocuments.embedding} <=> ${queryEmbedding})`,
        })
        .from(knowledgeDocuments)
        .where(sql`(
          ${knowledgeDocuments.content} ILIKE '%rule(%' OR
          ${knowledgeDocuments.content} ILIKE '%severity(%' OR
          ${knowledgeDocuments.content} ILIKE '%title(%' OR
          ${knowledgeDocuments.content} ILIKE '%dedup(%' OR
          ${knowledgeDocuments.content} ILIKE '%runbook(%' OR
          ${knowledgeDocuments.content} ILIKE '%deep_get%' OR
          ${knowledgeDocuments.content} ILIKE '%deep_walk%' OR
          ${knowledgeDocuments.content} ILIKE '%event.get%' OR
          ${knowledgeDocuments.content} ILIKE '%event.udm%'
        ) AND ${knowledgeDocuments.embedding} <=> ${queryEmbedding} < 0.5`)
        .orderBy(sql`1 - (${knowledgeDocuments.embedding} <=> ${queryEmbedding}) DESC`)
        .limit(topK)

      return results.map(result => ({
        id: result.id,
        title: result.title,
        content: result.content,
        section: result.section || undefined,
        documentType: result.documentType,
        similarity: result.similarity,
        metadata: result.metadata || undefined,
      }))
    } catch (error) {
      console.error('Error searching by Panther functions:', error)
      return []
    }
  }

  /**
   * 강화된 컨텍스트 생성 (Panther 규칙 우선)
   */
  async buildEnhancedContext(code: string): Promise<RAGContext> {
    const startTime = Date.now()

    try {
      // 병렬로 Panther 특화 검색 실행
      const [pantherRules, functionDocs, similarExamples] = await Promise.all([
        this.searchPantherRules(code, 3, 0.75),
        this.searchByPantherFunctions(code, 2),
        this.searchSimilarExamples(code, 3, 0.65),
      ])

      // Panther 규칙과 함수 문서를 결합하고 중복 제거
      const seenIds = new Set()
      const relevantDocuments = [...pantherRules, ...functionDocs].filter(doc => {
        if (seenIds.has(doc.id)) return false
        seenIds.add(doc.id)
        return true
      }).slice(0, 5) // 최대 5개로 제한

      // 강화된 프롬프트 생성
      const enhancedPrompt = this.buildPromptWithRAG(relevantDocuments, similarExamples)

      const processingTime = Date.now() - startTime

      return {
        relevantDocuments,
        similarExamples,
        enhancedPrompt,
        searchMetadata: {
          documentsFound: relevantDocuments.length,
          examplesFound: similarExamples.length,
          queryProcessingTime: processingTime,
        },
      }
    } catch (error) {
      console.error('Error building enhanced context:', error)
      throw error
    }
  }

  /**
   * RAG 기반 강화 프롬프트 생성 (Panther 규칙 특화)
   */
  private buildPromptWithRAG(documents: SearchResult[], examples: ExampleSearchResult[]): string {
    let prompt = `당신은 Panther 탐지 규칙을 전문으로 하는 Python 코드 검증자입니다.\n\n`

    // Panther 공식 규칙 문서 정보 우선 추가
    const officialRules = documents.filter(doc =>
      doc.section?.includes('Panther Rule') ||
      doc.section?.includes('Writing Python Detections') ||
      doc.documentType === 'rule'
    )

    const otherDocs = documents.filter(doc => !officialRules.includes(doc))

    if (officialRules.length > 0) {
      prompt += `## 🔴 공식 Panther 규칙 가이드라인:\n\n`
      officialRules.forEach((doc, index) => {
        prompt += `### ${index + 1}. ${doc.title}`
        if (doc.section) prompt += ` - ${doc.section}`
        prompt += ` (권위도: ${(doc.similarity * 100).toFixed(1)}%)\n`

        // 공식 규칙에서 핵심 요구사항 추출
        const content = doc.content.slice(0, 1000)
        prompt += `**핵심 요구사항**: ${content}${doc.content.length > 1000 ? '...' : ''}\n\n`
      })
    }

    if (otherDocs.length > 0) {
      prompt += `## 📘 추가 참고 문서:\n\n`
      otherDocs.forEach((doc, index) => {
        prompt += `### ${index + 1}. ${doc.title}`
        if (doc.section) prompt += ` - ${doc.section}`
        prompt += ` (관련도: ${(doc.similarity * 100).toFixed(1)}%)\n`
        prompt += `${doc.content.slice(0, 600)}${doc.content.length > 600 ? '...' : ''}\n\n`
      })
    }

    // 유사 예제 추가
    if (examples.length > 0) {
      prompt += `## 유사한 코드 예제 참고:\n\n`
      examples.forEach((example, index) => {
        prompt += `### 예제 ${index + 1}: ${example.title} (품질점수: ${example.qualityScore}/100, 유사도: ${(example.similarity * 100).toFixed(1)}%)\n`
        if (example.description) prompt += `**설명**: ${example.description}\n`
        if (example.category) prompt += `**카테고리**: ${example.category}\n`
        prompt += `**코드**:\n\`\`\`python\n${example.codeContent.slice(0, 600)}${example.codeContent.length > 600 ? '\n# ... (truncated)' : ''}\n\`\`\`\n\n`
      })
    }

    // Panther 특화 평가 기준 추가
    prompt += `## 🎯 Panther 규칙 준수성 평가 기준:\n\n`

    if (officialRules.length > 0) {
      prompt += `### 📋 공식 규칙 기반 체크리스트:\n`
      prompt += `위의 공식 Panther 문서를 바탕으로 다음을 **필수적으로** 검증하세요:\n\n`

      prompt += `1. **필수 함수 구조 (90점 만점)**:\n`
      prompt += `   - \`rule(event)\` 함수 존재 및 올바른 반환값 (Boolean)\n`
      prompt += `   - 필요시 \`severity()\`, \`title()\`, \`dedup()\`, \`runbook()\` 함수 구현\n`
      prompt += `   - 함수 시그니처와 반환 타입의 정확성\n\n`

      prompt += `2. **Panther 내장 함수 활용 (80점 만점)**:\n`
      prompt += `   - \`event.get()\`, \`deep_get()\`, \`deep_walk()\` 적절한 사용\n`
      prompt += `   - UDM(Unified Data Model) 필드 활용도\n`
      prompt += `   - 안전한 데이터 접근 패턴\n\n`

      prompt += `3. **보안 및 성능 (70점 만점)**:\n`
      prompt += `   - 15초 내 실행 보장 (타임아웃 방지)\n`
      prompt += `   - 외부 API 호출 금지 준수\n`
      prompt += `   - 예외 처리 및 안전한 데이터 핸들링\n\n`
    }

    prompt += `### 🔍 추가 품질 평가:\n`
    prompt += `- **코드 품질**: 유사 예제와 비교한 구현 수준\n`
    prompt += `- **탐지 정확성**: False positive/negative 최소화\n`
    prompt += `- **가독성**: 코드 명확성과 주석의 적절성\n`
    prompt += `- **유지보수성**: 확장성과 수정 용이성\n\n`

    prompt += `### ⚠️ 중요 지침:\n`
    prompt += `- 공식 Panther 문서의 요구사항을 **최우선**으로 적용\n`
    prompt += `- 규칙 준수성 점수는 공식 가이드라인 준수 정도에 따라 엄격하게 채점\n`
    prompt += `- 참고 문서의 구체적인 예시와 패턴을 인용하여 개선 제안 제공\n`
    prompt += `- 검증 불가능한 부분은 명시적으로 언급\n\n`

    prompt += `**모든 응답은 한국어로 작성하고 JSON 형식만 반환하세요.**`

    return prompt
  }

  /**
   * 규칙 패턴 및 스키마 추출
   */
  extractRulePatterns(documents: SearchResult[]): {
    requiredFunctions: string[]
    commonPatterns: string[]
    validationRules: string[]
    bestPractices: string[]
  } {
    const requiredFunctions = new Set<string>()
    const commonPatterns = new Set<string>()
    const validationRules = new Set<string>()
    const bestPractices = new Set<string>()

    documents.forEach(doc => {
      const content = doc.content.toLowerCase()

      // 필수 함수 패턴 추출
      const functionMatches = content.match(/def\s+(rule|severity|title|dedup|runbook)\s*\(/g)
      if (functionMatches) {
        functionMatches.forEach(match => {
          const funcName = match.match(/def\s+(\w+)/)?.[1]
          if (funcName) requiredFunctions.add(funcName)
        })
      }

      // 공통 패턴 추출
      if (content.includes('event.get(')) commonPatterns.add('event.get() 사용')
      if (content.includes('deep_get(')) commonPatterns.add('deep_get() 안전한 접근')
      if (content.includes('deep_walk(')) commonPatterns.add('deep_walk() 중첩 탐색')
      if (content.includes('event.udm')) commonPatterns.add('UDM 필드 활용')
      if (content.includes('try:') && content.includes('except:')) commonPatterns.add('예외 처리 구현')

      // 검증 규칙 추출
      if (content.includes('return true') || content.includes('return false')) {
        validationRules.add('Boolean 반환값 필수')
      }
      if (content.includes('timeout') || content.includes('15 second')) {
        validationRules.add('15초 실행 시간 제한')
      }
      if (content.includes('api') && content.includes('request')) {
        validationRules.add('외부 API 호출 금지')
      }

      // 모범 사례 추출
      if (doc.section?.includes('best practice') || content.includes('best practice')) {
        const sentences = content.split(/[.!?]+/)
        sentences.forEach(sentence => {
          if (sentence.includes('should') || sentence.includes('must') || sentence.includes('recommended')) {
            bestPractices.add(sentence.trim().slice(0, 100))
          }
        })
      }
    })

    return {
      requiredFunctions: Array.from(requiredFunctions),
      commonPatterns: Array.from(commonPatterns),
      validationRules: Array.from(validationRules),
      bestPractices: Array.from(bestPractices).slice(0, 5) // 상위 5개만
    }
  }

  /**
   * 규칙 준수성 컨텍스트 구축
   */
  buildRuleComplianceContext(code: string, documents: SearchResult[]): {
    missingRequirements: string[]
    complianceScore: number
    suggestions: string[]
  } {
    const patterns = this.extractRulePatterns(documents)
    const codeLines = code.toLowerCase()

    const missingRequirements: string[] = []
    let complianceScore = 100

    // 필수 함수 검증
    if (!codeLines.includes('def rule(')) {
      missingRequirements.push('rule(event) 함수가 누락되었습니다')
      complianceScore -= 30
    }

    // 공통 패턴 검증
    if (!codeLines.includes('event.get(') && !codeLines.includes('deep_get(')) {
      missingRequirements.push('안전한 이벤트 데이터 접근 방법이 필요합니다')
      complianceScore -= 15
    }

    if (!codeLines.includes('return true') && !codeLines.includes('return false')) {
      missingRequirements.push('명시적인 Boolean 반환값이 필요합니다')
      complianceScore -= 20
    }

    // 제안사항 생성
    const suggestions = patterns.bestPractices.map(practice =>
      `모범 사례: ${practice}`
    )

    return {
      missingRequirements,
      complianceScore: Math.max(0, complianceScore),
      suggestions
    }
  }

  /**
   * 카테고리별 문서 검색
   */
  async searchByCategory(category: string, topK: number = 10): Promise<SearchResult[]> {
    try {
      const results = await db
        .select({
          id: knowledgeDocuments.id,
          title: knowledgeDocuments.title,
          content: knowledgeDocuments.content,
          section: knowledgeDocuments.section,
          documentType: knowledgeDocuments.documentType,
          metadata: knowledgeDocuments.metadata,
        })
        .from(knowledgeDocuments)
        .where(sql`${knowledgeDocuments.metadata}->>'category' = ${category}`)
        .limit(topK)

      return results.map(result => ({
        id: result.id,
        title: result.title,
        content: result.content,
        section: result.section || undefined,
        documentType: result.documentType,
        similarity: 1.0, // 카테고리 기반이므로 완전 일치
        metadata: result.metadata || undefined,
      }))
    } catch (error) {
      console.error(`Error searching by category ${category}:`, error)
      return []
    }
  }

  /**
   * 메타데이터 기반 고급 필터링 검색
   */
  async searchWithMetadataFiltering(
    query: string,
    filters: {
      ruleType?: string[]
      severity?: string[]
      authorityLevel?: 'official' | 'community' | 'any'
      topK?: number
      minSimilarity?: number
    }
  ): Promise<SearchResult[]> {
    try {
      const {
        ruleType = [],
        severity = [],
        authorityLevel = 'any',
        topK = 5,
        minSimilarity = 0.7
      } = filters

      const queryEmbedding = await this.embeddingClient.generateEmbedding(
        this.embeddingClient.preprocessText(query)
      )

      let whereConditions: any[] = []

      // 기본 유사도 조건
      whereConditions.push(
        sql`${knowledgeDocuments.embedding} <=> ${queryEmbedding} < ${1 - minSimilarity}`
      )

      // 권위성 레벨 필터링
      if (authorityLevel === 'official') {
        whereConditions.push(
          sql`(${knowledgeDocuments.section} ILIKE '%Panther Rule%' OR
               ${knowledgeDocuments.section} ILIKE '%Writing Python Detections%' OR
               ${knowledgeDocuments.documentType} = 'rule')`
        )
      } else if (authorityLevel === 'community') {
        whereConditions.push(
          sql`${knowledgeDocuments.documentType} IN ('best-practice', 'example')`
        )
      }

      // 메타데이터 기반 필터링 (간소화)
      if (ruleType.length > 0) {
        whereConditions.push(
          sql`${knowledgeDocuments.metadata}::text ILIKE ANY(${ruleType.map(type => `%"ruleType":"${type}"%`)})`
        )
      }

      if (severity.length > 0) {
        whereConditions.push(
          sql`${knowledgeDocuments.metadata}::text ILIKE ANY(${severity.map(sev => `%"severity":"${sev}"%`)})`
        )
      }

      const results = await db
        .select({
          id: knowledgeDocuments.id,
          title: knowledgeDocuments.title,
          content: knowledgeDocuments.content,
          section: knowledgeDocuments.section,
          documentType: knowledgeDocuments.documentType,
          metadata: knowledgeDocuments.metadata,
          similarity: sql<number>`1 - (${knowledgeDocuments.embedding} <=> ${queryEmbedding})`,
          // 권위성 점수 계산
          authorityScore: sql<number>`
            CASE
              WHEN ${knowledgeDocuments.section} ILIKE '%Panther Rule%' THEN 1.0
              WHEN ${knowledgeDocuments.section} ILIKE '%Writing Python Detections%' THEN 0.9
              WHEN ${knowledgeDocuments.documentType} = 'rule' THEN 0.8
              WHEN ${knowledgeDocuments.documentType} = 'best-practice' THEN 0.6
              ELSE 0.4
            END
          `
        })
        .from(knowledgeDocuments)
        .where(sql`${sql.and(...whereConditions)}`)
        .orderBy(
          sql`(1 - (${knowledgeDocuments.embedding} <=> ${queryEmbedding})) *
              CASE
                WHEN ${knowledgeDocuments.section} ILIKE '%Panther Rule%' THEN 1.0
                WHEN ${knowledgeDocuments.section} ILIKE '%Writing Python Detections%' THEN 0.9
                WHEN ${knowledgeDocuments.documentType} = 'rule' THEN 0.8
                WHEN ${knowledgeDocuments.documentType} = 'best-practice' THEN 0.6
                ELSE 0.4
              END DESC`
        )
        .limit(topK)

      return results.map(result => ({
        id: result.id,
        title: result.title,
        content: result.content,
        section: result.section || undefined,
        documentType: result.documentType,
        similarity: result.similarity,
        metadata: {
          ...result.metadata,
          authorityScore: result.authorityScore
        }
      }))
    } catch (error) {
      console.error('Error in metadata filtering search:', error)
      return []
    }
  }

  /**
   * 검색 결과 통계
   */
  async getSearchStats(): Promise<{
    totalDocuments: number
    totalExamples: number
    documentTypes: Record<string, number>
    exampleCategories: Record<string, number>
  }> {
    try {
      const [docCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(knowledgeDocuments)

      const [exampleCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(codeExamples)

      const docTypes = await db
        .select({
          type: knowledgeDocuments.documentType,
          count: sql<number>`count(*)`,
        })
        .from(knowledgeDocuments)
        .groupBy(knowledgeDocuments.documentType)

      const exampleCategories = await db
        .select({
          category: codeExamples.category,
          count: sql<number>`count(*)`,
        })
        .from(codeExamples)
        .where(sql`${codeExamples.category} IS NOT NULL`)
        .groupBy(codeExamples.category)

      return {
        totalDocuments: docCount?.count || 0,
        totalExamples: exampleCount?.count || 0,
        documentTypes: Object.fromEntries(
          docTypes.map(dt => [dt.type, dt.count])
        ),
        exampleCategories: Object.fromEntries(
          exampleCategories.map(ec => [ec.category || 'uncategorized', ec.count])
        ),
      }
    } catch (error) {
      console.error('Error getting search stats:', error)
      return {
        totalDocuments: 0,
        totalExamples: 0,
        documentTypes: {},
        exampleCategories: {},
      }
    }
  }
}
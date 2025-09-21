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
}

export class RAGEngine {
  private embeddingClient: TitanEmbeddingClient

  constructor() {
    this.embeddingClient = new TitanEmbeddingClient()
  }

  /**
   * 관련 Panther 규칙 문서 검색
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
   * 강화된 컨텍스트 생성
   */
  async buildEnhancedContext(code: string): Promise<RAGContext> {
    const startTime = Date.now()

    try {
      // 병렬로 문서와 예제 검색 실행
      const [relevantDocuments, similarExamples] = await Promise.all([
        this.searchRelevantRules(code, 5, 0.7),
        this.searchSimilarExamples(code, 3, 0.65),
      ])

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
   * RAG 기반 강화 프롬프트 생성
   */
  private buildPromptWithRAG(documents: SearchResult[], examples: ExampleSearchResult[]): string {
    let prompt = `당신은 Panther 탐지 규칙을 전문으로 하는 Python 코드 검증자입니다.\n\n`

    // 관련 문서 정보 추가
    if (documents.length > 0) {
      prompt += `## 관련 Panther 규칙 참고 문서:\n\n`
      documents.forEach((doc, index) => {
        prompt += `### ${index + 1}. ${doc.title}`
        if (doc.section) prompt += ` - ${doc.section}`
        prompt += ` (관련도: ${(doc.similarity * 100).toFixed(1)}%)\n`
        prompt += `${doc.content.slice(0, 800)}${doc.content.length > 800 ? '...' : ''}\n\n`
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

    // 기본 평가 기준 추가
    prompt += `## 평가 기준:\n`
    prompt += `위의 참고 문서와 예제를 바탕으로 다음 기준으로 코드를 평가하세요:\n\n`
    prompt += `- **규칙 준수성**: 참고 문서의 Panther 가이드라인 준수 여부\n`
    prompt += `- **코드 품질**: 유사 예제와 비교한 코드 품질 수준\n`
    prompt += `- **보안 모범 사례**: 탐지 규칙의 보안 관점 평가\n`
    prompt += `- **성능 및 효율성**: 실행 시간과 리소스 사용 최적화\n`
    prompt += `- **가독성 및 유지보수성**: 코드의 명확성과 문서화 수준\n\n`

    prompt += `**중요**: 참고 문서와 예제의 내용을 기반으로 구체적이고 실용적인 개선 제안을 제공하세요.\n`
    prompt += `모든 응답은 한국어로 작성하고 JSON 형식만 반환하세요.`

    return prompt
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
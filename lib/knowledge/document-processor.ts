import { remark } from 'remark'
import remarkParse from 'remark-parse'
import { toString } from 'mdast-util-to-string'
import type { Root, Heading, Paragraph, Code } from 'mdast'
import { TitanEmbeddingClient } from '@/lib/embeddings/titan-client'
import { db } from '@/lib/db'
import { knowledgeDocuments, type NewKnowledgeDocument } from '@/lib/db/schema'

export interface DocumentChunk {
  title: string
  content: string
  section?: string
  documentType: 'rule' | 'best-practice' | 'example'
  metadata?: Record<string, any>
}

export interface ProcessedDocument {
  chunks: DocumentChunk[]
  totalChunks: number
  totalTokens: number
}

export class DocumentProcessor {
  private embeddingClient: TitanEmbeddingClient
  private markdownProcessor: ReturnType<typeof remark>

  constructor() {
    this.embeddingClient = new TitanEmbeddingClient()
    this.markdownProcessor = remark().use(remarkParse)
  }

  /**
   * 마크다운 파일 처리
   */
  async processMarkdownFile(content: string, documentType: 'rule' | 'best-practice' | 'example' = 'rule'): Promise<ProcessedDocument> {
    try {
      const tree = this.markdownProcessor.parse(content)
      const chunks = await this.extractChunksFromAST(tree, documentType)

      const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0)

      return {
        chunks,
        totalChunks: chunks.length,
        totalTokens,
      }
    } catch (error) {
      console.error('Error processing markdown file:', error)
      throw new Error(`Failed to process markdown: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * AST에서 의미있는 청크 추출
   */
  private async extractChunksFromAST(tree: Root, documentType: 'rule' | 'best-practice' | 'example'): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = []
    let currentSection = ''
    let currentContent: string[] = []
    let currentTitle = ''

    const processNode = (node: any, depth: number = 0) => {
      if (node.type === 'heading') {
        // 이전 섹션 저장
        if (currentContent.length > 0) {
          chunks.push({
            title: currentTitle || currentSection || 'Introduction',
            content: currentContent.join('\n\n').trim(),
            section: currentSection,
            documentType,
            metadata: {
              headingLevel: depth,
              wordCount: currentContent.join(' ').split(' ').length,
            },
          })
          currentContent = []
        }

        const headingText = toString(node)
        if (node.depth === 1) {
          currentTitle = headingText
          currentSection = headingText
        } else if (node.depth === 2) {
          currentSection = headingText
        }

        currentContent.push(`${'#'.repeat(node.depth)} ${headingText}`)
      } else if (node.type === 'paragraph') {
        const text = toString(node)
        if (text.trim()) {
          currentContent.push(text)
        }
      } else if (node.type === 'code') {
        const codeText = node.value || toString(node)
        currentContent.push(`\`\`\`${node.lang || ''}\n${codeText}\n\`\`\``)
      } else if (node.type === 'list') {
        const listText = toString(node)
        currentContent.push(listText)
      }

      // 자식 노드 재귀 처리
      if (node.children) {
        node.children.forEach((child: any) => processNode(child, depth + 1))
      }
    }

    // AST 순회
    tree.children.forEach(node => processNode(node))

    // 마지막 섹션 처리
    if (currentContent.length > 0) {
      chunks.push({
        title: currentTitle || currentSection || 'Final Section',
        content: currentContent.join('\n\n').trim(),
        section: currentSection,
        documentType,
        metadata: {
          wordCount: currentContent.join(' ').split(' ').length,
        },
      })
    }

    return chunks.filter(chunk => chunk.content.length > 50) // 너무 짧은 청크 제외
  }

  /**
   * 청크를 더 작은 단위로 분할 (긴 섹션 처리)
   */
  chunkLongContent(content: string, maxLength: number = 2000): string[] {
    if (content.length <= maxLength) {
      return [content]
    }

    const chunks: string[] = []
    const paragraphs = content.split('\n\n')
    let currentChunk = ''

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim())
          currentChunk = ''
        }

        // 단일 문단이 너무 긴 경우 문장 단위로 분할
        if (paragraph.length > maxLength) {
          const sentences = paragraph.split('. ')
          for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > maxLength) {
              if (currentChunk) {
                chunks.push(currentChunk.trim())
                currentChunk = ''
              }
            }
            currentChunk += sentence + (sentence.endsWith('.') ? ' ' : '. ')
          }
        } else {
          currentChunk = paragraph
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim())
    }

    return chunks
  }

  /**
   * 문서 청크들을 데이터베이스에 저장
   */
  async storeDocuments(chunks: DocumentChunk[]): Promise<string[]> {
    const storedIds: string[] = []

    for (const chunk of chunks) {
      try {
        // 텍스트 전처리
        const processedContent = this.embeddingClient.preprocessText(chunk.content)

        // 임베딩 생성
        const embedding = await this.embeddingClient.generateEmbedding(processedContent)

        // Temporary fix: Pad 1024 dimensions to 1536 to match database expectation
        const paddedEmbedding = [...embedding, ...new Array(512).fill(0)]

        // 데이터베이스에 저장 - pgvector는 배열을 직접 받습니다
        const [stored] = await db.insert(knowledgeDocuments).values({
          title: chunk.title,
          content: processedContent,
          section: chunk.section,
          documentType: chunk.documentType,
          embedding: paddedEmbedding,
          metadata: chunk.metadata,
        }).returning({ id: knowledgeDocuments.id })

        storedIds.push(stored.id)

        // 레이트 리밋 방지
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (error) {
        console.error(`Failed to store document chunk: ${chunk.title}`, error)
        // 개별 청크 실패 시 계속 진행
      }
    }

    return storedIds
  }

  /**
   * 여러 마크다운 파일을 배치 처리
   */
  async processBulkMarkdownFiles(files: Array<{ content: string, documentType: 'rule' | 'best-practice' | 'example' }>): Promise<{
    totalProcessed: number
    totalChunks: number
    storedIds: string[]
  }> {
    let totalChunks = 0
    const allStoredIds: string[] = []

    for (const file of files) {
      try {
        const processed = await this.processMarkdownFile(file.content, file.documentType)
        const storedIds = await this.storeDocuments(processed.chunks)

        totalChunks += processed.totalChunks
        allStoredIds.push(...storedIds)

        console.log(`Processed ${processed.totalChunks} chunks from ${file.documentType} document`)
      } catch (error) {
        console.error(`Failed to process file of type ${file.documentType}:`, error)
      }
    }

    return {
      totalProcessed: files.length,
      totalChunks,
      storedIds: allStoredIds,
    }
  }

  /**
   * 기존 문서 업데이트 (재임베딩)
   */
  async updateDocumentEmbeddings(documentIds?: string[]): Promise<number> {
    try {
      let query = db.select().from(knowledgeDocuments)

      if (documentIds) {
        query = query.where(knowledgeDocuments.id.in(documentIds))
      }

      const documents = await query
      let updatedCount = 0

      for (const doc of documents) {
        try {
          const embedding = await this.embeddingClient.generateEmbedding(doc.content)

          await db.update(knowledgeDocuments)
            .set({ embedding })
            .where(knowledgeDocuments.id.eq(doc.id))

          updatedCount++

          // 레이트 리밋 방지
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (error) {
          console.error(`Failed to update embedding for document ${doc.id}:`, error)
        }
      }

      return updatedCount
    } catch (error) {
      console.error('Error updating document embeddings:', error)
      throw error
    }
  }
}
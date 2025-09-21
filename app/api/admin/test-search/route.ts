import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { codeExamples, knowledgeDocuments } from "@/lib/db/schema"
import { TitanEmbeddingClient } from "@/lib/embeddings/titan-client"
import { sql } from "drizzle-orm"

// RAG 검색 테스트
export async function POST(request: NextRequest) {
  try {
    const { query, limit = 5 } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: '검색어는 필수입니다' },
        { status: 400 }
      )
    }

    // 쿼리 임베딩 생성
    const embeddingClient = new TitanEmbeddingClient()
    const rawQueryEmbedding = await embeddingClient.generateEmbedding(query)
    // Temporary fix: Pad 1024 dimensions to 1536 to match database expectation
    const queryEmbedding = [...rawQueryEmbedding, ...new Array(512).fill(0)]

    // Convert array to string format for PostgreSQL vector
    const vectorString = `[${queryEmbedding.join(',')}]`

    // 문서 검색 (코사인 유사도)
    const documentResults = await db.execute(sql`
      SELECT
        id,
        title,
        'document' as type,
        1 - (embedding <=> ${vectorString}::vector) as similarity
      FROM ${knowledgeDocuments}
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorString}::vector
      LIMIT ${Math.ceil(limit / 2)}
    `)

    // 예제 검색 (코사인 유사도)
    const exampleResults = await db.execute(sql`
      SELECT
        id,
        title,
        'example' as type,
        1 - (embedding <=> ${vectorString}::vector) as similarity
      FROM ${codeExamples}
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorString}::vector
      LIMIT ${Math.ceil(limit / 2)}
    `)

    // 결과 통합 및 정렬
    const allResults = [
      ...documentResults.rows.map(row => ({
        id: row.id as string,
        title: row.title as string,
        type: row.type as 'document' | 'example',
        similarity: parseFloat(row.similarity as string)
      })),
      ...exampleResults.rows.map(row => ({
        id: row.id as string,
        title: row.title as string,
        type: row.type as 'document' | 'example',
        similarity: parseFloat(row.similarity as string)
      }))
    ]

    // 유사도 순으로 정렬하고 제한
    const sortedResults = allResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)

    return NextResponse.json(sortedResults)
  } catch (error) {
    console.error('Error testing search:', error)
    return NextResponse.json(
      { error: '검색 테스트 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류') },
      { status: 500 }
    )
  }
}
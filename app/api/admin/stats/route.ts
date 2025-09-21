import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { codeExamples, knowledgeDocuments } from "@/lib/db/schema"
import { sql } from "drizzle-orm"

// RAG 시스템 통계 조회
export async function GET(request: NextRequest) {
  try {
    // 총 문서 수
    const [{ count: totalDocuments }] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(knowledgeDocuments)

    // 총 예제 수
    const [{ count: totalExamples }] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(codeExamples)

    // 문서 타입별 분포
    const documentTypeResults = await db
      .select({
        documentType: knowledgeDocuments.documentType,
        count: sql<number>`cast(count(*) as int)`
      })
      .from(knowledgeDocuments)
      .groupBy(knowledgeDocuments.documentType)

    const documentTypes = documentTypeResults.reduce((acc, row) => {
      acc[row.documentType] = row.count
      return acc
    }, {} as Record<string, number>)

    // 예제 카테고리별 분포
    const exampleCategoryResults = await db
      .select({
        category: codeExamples.category,
        count: sql<number>`cast(count(*) as int)`
      })
      .from(codeExamples)
      .where(sql`${codeExamples.category} IS NOT NULL`)
      .groupBy(codeExamples.category)

    const exampleCategories = exampleCategoryResults.reduce((acc, row) => {
      if (row.category) {
        acc[row.category] = row.count
      }
      return acc
    }, {} as Record<string, number>)

    // 최근 생성 시간 (가장 최근 문서나 예제)
    const lastDocumentUpdate = await db
      .select({ createdAt: knowledgeDocuments.createdAt })
      .from(knowledgeDocuments)
      .orderBy(sql`${knowledgeDocuments.createdAt} DESC`)
      .limit(1)

    const lastExampleUpdate = await db
      .select({ createdAt: codeExamples.createdAt })
      .from(codeExamples)
      .orderBy(sql`${codeExamples.createdAt} DESC`)
      .limit(1)

    const lastUpdated = [
      lastDocumentUpdate[0]?.createdAt,
      lastExampleUpdate[0]?.createdAt
    ]
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0]

    const stats = {
      totalDocuments,
      totalExamples,
      documentTypes,
      exampleCategories,
      lastUpdated: lastUpdated || new Date().toISOString()
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching RAG stats:', error)
    return NextResponse.json(
      { error: 'RAG 통계 조회 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류') },
      { status: 500 }
    )
  }
}
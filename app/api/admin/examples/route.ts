import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { codeExamples } from "@/lib/db/schema"
import { TitanEmbeddingClient } from "@/lib/embeddings/titan-client"
import { desc, eq, ilike, or, and, gte, lt } from "drizzle-orm"

// 예제 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const qualityMin = searchParams.get('qualityMin')
    const qualityMax = searchParams.get('qualityMax')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = db.select({
      id: codeExamples.id,
      title: codeExamples.title,
      codeContent: codeExamples.codeContent,
      qualityScore: codeExamples.qualityScore,
      category: codeExamples.category,
      description: codeExamples.description,
      tags: codeExamples.tags,
      createdAt: codeExamples.createdAt
    }).from(codeExamples)
    const conditions: any[] = []

    // 검색 조건 추가
    if (search) {
      conditions.push(
        or(
          ilike(codeExamples.title, `%${search}%`),
          ilike(codeExamples.codeContent, `%${search}%`),
          ilike(codeExamples.description, `%${search}%`)
        )
      )
    }

    // 카테고리 필터
    if (category && category !== 'all') {
      conditions.push(eq(codeExamples.category, category))
    }

    // 품질 점수 필터
    if (qualityMin) {
      conditions.push(gte(codeExamples.qualityScore, parseInt(qualityMin)))
    }
    if (qualityMax) {
      conditions.push(lt(codeExamples.qualityScore, parseInt(qualityMax)))
    }

    // 조건 적용
    if (conditions.length > 0) {
      query = query.where(and(...conditions))
    }

    // 정렬 및 페이징 (품질 점수 높은 순)
    const examples = await query
      .orderBy(desc(codeExamples.qualityScore), desc(codeExamples.createdAt))
      .limit(limit)
      .offset(offset)

    return NextResponse.json(examples)
  } catch (error) {
    console.error('Error fetching examples:', error)
    return NextResponse.json(
      { error: '예제 목록 조회 실패' },
      { status: 500 }
    )
  }
}

// 새 예제 추가
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { title, codeContent, qualityScore, category, description, tags } = data

    // 입력 검증
    if (!title || !codeContent) {
      return NextResponse.json(
        { error: '제목과 코드는 필수입니다' },
        { status: 400 }
      )
    }

    if (qualityScore < 0 || qualityScore > 100) {
      return NextResponse.json(
        { error: '품질 점수는 0-100 사이여야 합니다' },
        { status: 400 }
      )
    }

    // 임베딩 생성
    const embeddingClient = new TitanEmbeddingClient()
    const processedCode = embeddingClient.preprocessText(codeContent)
    const embedding = await embeddingClient.generateEmbedding(processedCode)

    // Temporary fix: Pad 1024 dimensions to 1536 to match database expectation
    const paddedEmbedding = [...embedding, ...new Array(512).fill(0)]

    // 예제 저장
    const [savedExample] = await db
      .insert(codeExamples)
      .values({
        title,
        codeContent: processedCode,
        qualityScore,
        category: category || undefined,
        description: description || undefined,
        embedding: paddedEmbedding,
        tags: tags || undefined
      })
      .returning({
        id: codeExamples.id,
        title: codeExamples.title,
        codeContent: codeExamples.codeContent,
        qualityScore: codeExamples.qualityScore,
        category: codeExamples.category,
        description: codeExamples.description,
        tags: codeExamples.tags,
        createdAt: codeExamples.createdAt
      })

    return NextResponse.json(savedExample, { status: 201 })
  } catch (error) {
    console.error('Error creating example:', error)
    return NextResponse.json(
      { error: '예제 생성 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류') },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { codeExamples } from "@/lib/db/schema"
import { TitanEmbeddingClient } from "@/lib/embeddings/titan-client"
import { eq } from "drizzle-orm"

// 특정 예제 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [example] = await db
      .select({
        id: codeExamples.id,
        title: codeExamples.title,
        codeContent: codeExamples.codeContent,
        qualityScore: codeExamples.qualityScore,
        category: codeExamples.category,
        description: codeExamples.description,
        tags: codeExamples.tags,
        createdAt: codeExamples.createdAt
      })
      .from(codeExamples)
      .where(eq(codeExamples.id, id))

    if (!example) {
      return NextResponse.json(
        { error: '예제를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    return NextResponse.json(example)
  } catch (error) {
    console.error('Error fetching example:', error)
    return NextResponse.json(
      { error: '예제 조회 실패' },
      { status: 500 }
    )
  }
}

// 예제 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // 기존 예제 확인
    const [existingExample] = await db
      .select()
      .from(codeExamples)
      .where(eq(codeExamples.id, id))

    if (!existingExample) {
      return NextResponse.json(
        { error: '예제를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 임베딩 재생성이 필요한지 확인 (코드가 변경된 경우)
    const needsEmbeddingUpdate = existingExample.codeContent !== codeContent

    let embedding = existingExample.embedding

    if (needsEmbeddingUpdate) {
      const embeddingClient = new TitanEmbeddingClient()
      const processedCode = embeddingClient.preprocessText(codeContent)
      const rawEmbedding = await embeddingClient.generateEmbedding(processedCode)
      // Temporary fix: Pad 1024 dimensions to 1536 to match database expectation
      embedding = [...rawEmbedding, ...new Array(512).fill(0)]
    }

    // 예제 업데이트
    const [updatedExample] = await db
      .update(codeExamples)
      .set({
        title,
        codeContent: needsEmbeddingUpdate
          ? new TitanEmbeddingClient().preprocessText(codeContent)
          : codeContent,
        qualityScore,
        category: category || undefined,
        description: description || undefined,
        embedding,
        tags: tags || undefined
      })
      .where(eq(codeExamples.id, id))
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

    return NextResponse.json(updatedExample)
  } catch (error) {
    console.error('Error updating example:', error)
    return NextResponse.json(
      { error: '예제 수정 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류') },
      { status: 500 }
    )
  }
}

// 예제 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // 예제 존재 확인
    const [existingExample] = await db
      .select()
      .from(codeExamples)
      .where(eq(codeExamples.id, id))

    if (!existingExample) {
      return NextResponse.json(
        { error: '예제를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 예제 삭제
    await db
      .delete(codeExamples)
      .where(eq(codeExamples.id, id))

    return NextResponse.json(
      { message: '예제가 성공적으로 삭제되었습니다' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting example:', error)
    return NextResponse.json(
      { error: '예제 삭제 실패' },
      { status: 500 }
    )
  }
}
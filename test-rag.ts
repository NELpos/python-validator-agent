#!/usr/bin/env tsx

// 환경 변수 로드
import { config } from 'dotenv'
import path from 'path'
config({ path: path.join(process.cwd(), '.env.local') })

import { RAGEngine } from './lib/knowledge/rag-engine'

async function testRAGSystem() {
  console.log('🧪 RAG 시스템 테스트를 시작합니다...')

  try {
    const ragEngine = new RAGEngine()

    // 1. 통계 정보 확인
    console.log('\n📊 시스템 통계 확인 중...')
    const stats = await ragEngine.getSearchStats()
    console.log(`총 문서 수: ${stats.totalDocuments}`)
    console.log(`총 예제 수: ${stats.totalExamples}`)
    console.log(`문서 타입: ${JSON.stringify(stats.documentTypes)}`)

    if (stats.totalDocuments === 0) {
      console.log('❌ 저장된 문서가 없습니다. 초기화 스크립트를 다시 실행해주세요.')
      return
    }

    // 2. 문서 검색 테스트
    console.log('\n🔍 문서 검색 테스트 중...')
    const testQueries = [
      '브루트포스 공격 탐지',
      'rule 함수 사용법',
      'severity 설정',
      'Panther 규칙 작성'
    ]

    for (const query of testQueries) {
      try {
        console.log(`\n검색어: "${query}"`)
        const results = await ragEngine.searchRelevantRules(query, 3, 0.5)
        console.log(`결과: ${results.length}개 문서 발견`)

        if (results.length > 0) {
          const topResult = results[0]
          console.log(`  🏆 가장 관련성 높은 문서: "${topResult.title}"`)
          console.log(`  📊 유사도: ${(topResult.similarity * 100).toFixed(1)}%`)
          console.log(`  📖 내용 요약: ${topResult.content.slice(0, 100)}...`)
        }
      } catch (error) {
        console.error(`  ❌ 검색 실패: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    console.log('\n✅ RAG 시스템 테스트 완료!')

  } catch (error) {
    console.error('❌ RAG 시스템 테스트 실패:', error)
  }
}

testRAGSystem()
#!/usr/bin/env tsx

// 환경 변수 로드
import { config } from 'dotenv'
import path from 'path'

// .env.local 파일 로드
config({ path: path.join(process.cwd(), '.env.local') })

/**
 * RAG 시스템 초기화 스크립트
 * Panther 문서와 예제 코드를 데이터베이스에 로드합니다.
 */

import fs from 'fs/promises'
import { DocumentProcessor } from '@/lib/knowledge/document-processor'
import { db } from '@/lib/db'
import { codeExamples } from '@/lib/db/schema'
import { TitanEmbeddingClient } from '@/lib/embeddings/titan-client'

// 샘플 코드 예제들
const sampleCodeExamples = [
  {
    title: "브루트포스 로그인 탐지",
    codeContent: `def rule(event):
    """
    연속된 로그인 실패를 탐지합니다.
    """
    failed_attempts = event.get('failed_login_count', 0)
    return failed_attempts >= 5

def severity(event):
    attempts = event.get('failed_login_count', 0)
    if attempts >= 10:
        return 'HIGH'
    return 'MEDIUM'

def title(event):
    user = event.get('user', 'unknown')
    attempts = event.get('failed_login_count', 0)
    return f"Brute force attack detected: {attempts} failed attempts for {user}"

def dedup(event):
    return event.get('user', 'unknown') + ':' + event.get('source_ip', '')`,
    qualityScore: 85,
    category: "authentication",
    description: "사용자 로그인 실패 횟수를 모니터링하여 브루트포스 공격을 탐지하는 규칙",
    tags: ["brute-force", "authentication", "security", "login"]
  },
  {
    title: "권한 상승 탐지",
    codeContent: `def rule(event):
    """
    비정상적인 권한 상승을 탐지합니다.
    """
    action = event.get('action', '').lower()
    privilege_escalation_actions = ['sudo', 'su', 'runas']

    if not any(action_type in action for action_type in privilege_escalation_actions):
        return False

    # 일반 사용자의 권한 상승 확인
    user_role = event.get('user_role', '').lower()
    return user_role in ['user', 'guest']

def severity(event):
    user_role = event.get('user_role', '').lower()
    if user_role == 'guest':
        return 'CRITICAL'
    return 'HIGH'

def title(event):
    user = event.get('user', 'unknown')
    action = event.get('action', 'unknown')
    return f"Privilege escalation detected: {user} performed {action}"`,
    qualityScore: 90,
    category: "privilege-escalation",
    description: "권한 상승 명령어 실행을 탐지하여 내부 위협을 모니터링",
    tags: ["privilege-escalation", "sudo", "security", "internal-threat"]
  },
  {
    title: "의심스러운 네트워크 연결",
    codeContent: `def rule(event):
    """
    알려진 악성 IP로의 연결을 탐지합니다.
    """
    # 악성 IP 리스트 (실제 환경에서는 외부 피드 사용)
    malicious_ips = [
        '192.168.1.100',  # 예제 IP
        '10.0.0.50'
    ]

    destination_ip = event.get('destination_ip')
    return destination_ip in malicious_ips

def severity(event):
    # 모든 악성 IP 연결은 높은 심각도
    return 'HIGH'

def title(event):
    src_ip = event.get('source_ip', 'unknown')
    dst_ip = event.get('destination_ip', 'unknown')
    return f"Malicious network connection: {src_ip} -> {dst_ip}"

def runbook(event):
    return "https://security.company.com/playbooks/malicious-ip-connection"`,
    qualityScore: 75,
    category: "network",
    description: "알려진 악성 IP 주소로의 네트워크 연결을 탐지",
    tags: ["network", "malicious-ip", "connection", "threat-intel"]
  },
  {
    title: "파일 시스템 변경 탐지",
    codeContent: `def rule(event):
    """
    중요한 시스템 파일의 변경을 탐지합니다.
    """
    file_path = event.get('file_path', '')

    # 중요한 시스템 경로들
    critical_paths = [
        '/etc/passwd',
        '/etc/shadow',
        '/etc/hosts',
        '/etc/crontab'
    ]

    # 경로 일치 확인
    return any(critical_path in file_path for critical_path in critical_paths)

def severity(event):
    file_path = event.get('file_path', '')

    # 매우 중요한 파일들
    if any(critical in file_path for critical in ['/etc/passwd', '/etc/shadow']):
        return 'CRITICAL'

    return 'HIGH'

def title(event):
    file_path = event.get('file_path', 'unknown')
    action = event.get('action', 'modified')
    return f"Critical system file {action}: {file_path}"

def dedup(event):
    return event.get('file_path', 'unknown')`,
    qualityScore: 88,
    category: "file-system",
    description: "중요한 시스템 파일의 무단 변경을 탐지하여 시스템 무결성 보호",
    tags: ["file-system", "integrity", "system-files", "unauthorized-access"]
  }
]

async function initializeRAGSystem() {
  console.log('🚀 RAG 시스템 초기화를 시작합니다...')

  try {
    // 1. Panther 문서 처리
    console.log('📚 Panther 문서를 처리하고 있습니다...')

    const documentProcessor = new DocumentProcessor()
    const embeddingClient = new TitanEmbeddingClient()

    // 샘플 문서 읽기
    const documentPath = path.join(process.cwd(), 'lib/knowledge/sample-panther-rules.md')
    const documentContent = await fs.readFile(documentPath, 'utf-8')

    // 문서 처리 및 저장
    const processedDoc = await documentProcessor.processMarkdownFile(documentContent, 'rule')
    const documentIds = await documentProcessor.storeDocuments(processedDoc.chunks)

    console.log(`✅ ${processedDoc.totalChunks}개의 문서 청크가 저장되었습니다.`)

    // 2. 코드 예제 처리
    console.log('💻 코드 예제를 처리하고 있습니다...')

    let exampleCount = 0
    for (const example of sampleCodeExamples) {
      try {
        // 코드 임베딩 생성
        const processedCode = embeddingClient.preprocessText(example.codeContent)
        const embedding = await embeddingClient.generateEmbedding(processedCode)

        // 데이터베이스에 저장
        await db.insert(codeExamples).values({
          title: example.title,
          codeContent: processedCode,
          qualityScore: example.qualityScore,
          category: example.category,
          description: example.description,
          embedding: embedding,
          tags: example.tags,
        })

        exampleCount++
        console.log(`  ✓ ${example.title} 저장 완료`)

        // 레이트 리밋 방지
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (error) {
        console.error(`  ✗ ${example.title} 저장 실패:`, error)
      }
    }

    console.log(`✅ ${exampleCount}개의 코드 예제가 저장되었습니다.`)

    // 3. 시스템 상태 확인
    console.log('🔍 시스템 상태를 확인하고 있습니다...')

    // RAG 엔진으로 통계 정보만 확인 (검색 테스트는 별도로)
    const { RAGEngine } = await import('@/lib/knowledge/rag-engine')
    const ragEngine = new RAGEngine()

    // 통계 정보 출력
    const stats = await ragEngine.getSearchStats()
    console.log('\n📊 RAG 시스템 통계:')
    console.log(`   - 총 문서 수: ${stats.totalDocuments}`)
    console.log(`   - 총 예제 수: ${stats.totalExamples}`)
    console.log(`   - 문서 타입: ${JSON.stringify(stats.documentTypes)}`)
    console.log(`   - 예제 카테고리: ${JSON.stringify(stats.exampleCategories)}`)

    // 검색 테스트는 나중에 별도로 수행
    console.log('\n🧪 검색 테스트는 /api/validate-rag 엔드포인트에서 확인하세요')

    console.log('\n🎉 RAG 시스템 초기화가 완료되었습니다!')
    console.log('\n다음 단계:')
    console.log('1. PostgreSQL에서 pgvector 확장을 활성화하세요: CREATE EXTENSION vector;')
    console.log('2. 데이터베이스 마이그레이션을 실행하세요: pnpm run db:migrate')
    console.log('3. /api/validate-rag 엔드포인트를 테스트해보세요')

  } catch (error) {
    console.error('❌ RAG 시스템 초기화 중 오류 발생:', error)
    process.exit(1)
  }
}

// 스크립트가 직접 실행될 때만 초기화 함수 호출
if (require.main === module) {
  initializeRAGSystem()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('초기화 스크립트 실행 실패:', error)
      process.exit(1)
    })
}

export { initializeRAGSystem }
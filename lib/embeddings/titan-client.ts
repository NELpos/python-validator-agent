import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"
import { fromWebToken } from "@aws-sdk/credential-providers"

// 환경별 credentials 설정 (bedrock/client.ts와 동일한 로직)
function getCredentials() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.AWS_ROLE_ARN || !process.env.AWS_WEB_IDENTITY_TOKEN_FILE) {
      throw new Error("Production environment requires AWS_ROLE_ARN and AWS_WEB_IDENTITY_TOKEN_FILE environment variables.")
    }

    return fromWebToken({
      roleArn: process.env.AWS_ROLE_ARN,
      webIdentityTokenFile: process.env.AWS_WEB_IDENTITY_TOKEN_FILE,
    })
  } else {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error("Development environment requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.")
    }

    return {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  }
}

export class TitanEmbeddingClient {
  private client: BedrockRuntimeClient
  private modelId: string = "amazon.titan-embed-text-v2:0"

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "ap-northeast-2",
      credentials: getCredentials(),
    })
  }

  /**
   * 단일 텍스트에 대한 임베딩 생성
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const payload = {
        inputText: text,
        dimensions: 1024, // Titan v2 max dimensions
        normalize: true,  // 정규화 활성화
      }

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload),
      })

      const response = await this.client.send(command)
      const responseBody = JSON.parse(new TextDecoder().decode(response.body))

      if (!responseBody.embedding || !Array.isArray(responseBody.embedding)) {
        throw new Error("Invalid embedding response format")
      }

      return responseBody.embedding
    } catch (error) {
      console.error("Error generating embedding:", error)

      if (error instanceof Error) {
        if (error.message.includes("ENOTFOUND")) {
          throw new Error(`Invalid AWS region or network error: ${error.message}`)
        }
        if (error.message.includes("UnrecognizedClientException") || error.message.includes("security token")) {
          throw new Error(`AWS authentication failed. Please check your credentials: ${error.message}`)
        }
        if (error.message.includes("throttling") || error.message.includes("ThrottlingException")) {
          throw new Error(`Rate limit exceeded. Please try again later: ${error.message}`)
        }
      }

      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * 여러 텍스트에 대한 임베딩 배치 생성
   * 레이트 리밋을 고려하여 순차 처리
   */
  async generateBulkEmbeddings(texts: string[], delayMs: number = 100): Promise<number[][]> {
    const embeddings: number[][] = []

    for (let i = 0; i < texts.length; i++) {
      try {
        const embedding = await this.generateEmbedding(texts[i])
        embeddings.push(embedding)

        // 레이트 리밋 방지를 위한 지연
        if (i < texts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      } catch (error) {
        console.error(`Failed to generate embedding for text ${i}:`, error)
        // 실패한 경우 빈 배열로 대체 (나중에 재시도 가능)
        embeddings.push([])
      }
    }

    return embeddings
  }

  /**
   * 텍스트 전처리 - 임베딩 품질 향상을 위한 정제
   */
  preprocessText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // 여러 공백을 하나로
      .replace(/\n+/g, '\n') // 여러 줄바꿈을 하나로
      .trim()
      .slice(0, 8000) // Titan 모델의 입력 길이 제한
  }

  /**
   * 코사인 유사도 계산 (벡터 검색 결과 검증용)
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same length")
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
    return magnitude === 0 ? 0 : dotProduct / magnitude
  }

  /**
   * 임베딩 모델 정보 반환
   */
  getModelInfo() {
    return {
      modelId: this.modelId,
      dimensions: 1024,
      maxInputLength: 8000,
      normalized: true,
    }
  }
}
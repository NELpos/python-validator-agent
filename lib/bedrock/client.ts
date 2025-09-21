import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } from "@aws-sdk/client-bedrock-runtime"
import { fromWebToken } from "@aws-sdk/credential-providers"

// 환경별 credentials 설정
function getCredentials() {
  if (process.env.NODE_ENV === 'production') {
    // IRSA 방식 (EKS 환경)
    if (!process.env.AWS_ROLE_ARN || !process.env.AWS_WEB_IDENTITY_TOKEN_FILE) {
      throw new Error("Production environment requires AWS_ROLE_ARN and AWS_WEB_IDENTITY_TOKEN_FILE environment variables.")
    }

    return fromWebToken({
      roleArn: process.env.AWS_ROLE_ARN,
      webIdentityTokenFile: process.env.AWS_WEB_IDENTITY_TOKEN_FILE,
    })
  } else {
    // Access Key 방식 (개발 환경)
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error("Development environment requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.")
    }

    return {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  }
}

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-west-2",
  credentials: getCredentials(),
})

export interface ClaudeMessage {
  role: "user" | "assistant"
  content: string
}

export interface ClaudeRequest {
  messages: ClaudeMessage[]
  max_tokens?: number
  temperature?: number
  system?: string
}

export async function invokeClaude(request: ClaudeRequest): Promise<string> {
  // Validate required environment variables based on environment
  if (!process.env.AWS_REGION) {
    throw new Error("AWS region not configured. Please set AWS_REGION environment variable.")
  }

  if (process.env.NODE_ENV === 'production') {
    // 프로덕션 환경: IRSA 방식 validation
    if (!process.env.AWS_ROLE_ARN || !process.env.AWS_WEB_IDENTITY_TOKEN_FILE) {
      throw new Error("Production environment requires AWS_ROLE_ARN and AWS_WEB_IDENTITY_TOKEN_FILE environment variables.")
    }
  } else {
    // 개발 환경: Access Key 방식 validation
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error("Development environment requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.")
    }
  }

  const modelId = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-sonnet-20240229"

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    messages: request.messages,
    max_tokens: request.max_tokens || 4096,
    temperature: request.temperature || 0.7,
    ...(request.system && { system: request.system }),
  }

  try {
    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    })

    const response = await bedrockClient.send(command)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))

    return responseBody.content[0].text
  } catch (error) {
    console.error("Error invoking Claude:", error)

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("ENOTFOUND")) {
        throw new Error(`Invalid AWS region or network error: ${error.message}`)
      }
      if (error.message.includes("UnrecognizedClientException") || error.message.includes("security token")) {
        throw new Error(`AWS authentication failed. Please check your credentials: ${error.message}`)
      }
    }

    throw new Error(`Failed to invoke Claude model: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function* invokeClaudeStream(
  request: ClaudeRequest,
  maxRetries: number = 3
): AsyncGenerator<string, void, unknown> {
  // Validate required environment variables based on environment
  if (!process.env.AWS_REGION) {
    throw new Error("AWS region not configured. Please set AWS_REGION environment variable.")
  }

  if (process.env.NODE_ENV === 'production') {
    // 프로덕션 환경: IRSA 방식 validation
    if (!process.env.AWS_ROLE_ARN || !process.env.AWS_WEB_IDENTITY_TOKEN_FILE) {
      throw new Error("Production environment requires AWS_ROLE_ARN and AWS_WEB_IDENTITY_TOKEN_FILE environment variables.")
    }
  } else {
    // 개발 환경: Access Key 방식 validation
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error("Development environment requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.")
    }
  }

  const modelId = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-sonnet-20240229"

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    messages: request.messages,
    max_tokens: request.max_tokens || 4096,
    temperature: request.temperature || 0.7,
    ...(request.system && { system: request.system }),
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const command = new InvokeModelWithResponseStreamCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload),
      })

      const response = await bedrockClient.send(command)

      if (!response.body) {
        throw new Error("No response body received from Bedrock")
      }

      for await (const chunk of response.body) {
        if (chunk.chunk?.bytes) {
          const chunkText = new TextDecoder().decode(chunk.chunk.bytes)
          try {
            const chunkData = JSON.parse(chunkText)
            if (chunkData.type === "content_block_delta" && chunkData.delta?.text) {
              yield chunkData.delta.text
            }
          } catch (parseError) {
            console.warn("Failed to parse chunk:", chunkText)
          }
        }
      }

      // If we get here, the request was successful
      return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`Error invoking Claude stream (attempt ${attempt + 1}/${maxRetries + 1}):`, lastError)

      // Check if it's a throttling error
      const isThrottlingError = lastError.message.includes("ThrottlingException") ||
                               lastError.message.includes("Too many requests")

      // If it's the last attempt or not a throttling error, don't retry
      if (attempt === maxRetries || !isThrottlingError) {
        break
      }

      // Exponential backoff: 1s, 2s, 4s, 8s...
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000) // Cap at 10 seconds
      console.log(`Retrying after ${delay}ms...`)
      await sleep(delay)
    }
  }

  // If we get here, all retries failed
  if (lastError) {
    // Provide more specific error messages
    if (lastError.message.includes("ENOTFOUND")) {
      throw new Error(`Invalid AWS region or network error: ${lastError.message}`)
    }
    if (lastError.message.includes("UnrecognizedClientException") || lastError.message.includes("security token")) {
      throw new Error(`AWS authentication failed. Please check your credentials: ${lastError.message}`)
    }
    if (lastError.message.includes("ThrottlingException") || lastError.message.includes("Too many requests")) {
      throw new Error(`Rate limit exceeded after ${maxRetries + 1} attempts. Please try again later.`)
    }

    throw new Error(`Failed to invoke Claude model stream after ${maxRetries + 1} attempts: ${lastError.message}`)
  }

  throw new Error("Unknown error occurred during streaming")
}

export { bedrockClient }
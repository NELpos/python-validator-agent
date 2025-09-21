import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-west-2",
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
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
  // Validate required environment variables
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.")
  }

  if (!process.env.AWS_REGION) {
    throw new Error("AWS region not configured. Please set AWS_REGION environment variable.")
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

export { bedrockClient }
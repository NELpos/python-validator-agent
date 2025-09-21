import { invokeClaude } from "@/lib/bedrock/client"

export interface ValidationResult {
  syntaxCheck: {
    isValid: boolean
    errors?: string[]
  }
  ruleCompliance: {
    score: number
    findings: string[]
    suggestions: string[]
  }
  codeQuality: {
    score: number
    feedback: string
  }
  detailedAnalysis: string
}

const PANTHER_RULES_CONTEXT = `
You are a Python code validator specializing in Panther detection rules. Your task is to evaluate Python code based on the following criteria:

## Panther Detection Rules Guidelines:
1. Must have a \`rule(event)\` function that returns True for suspicious activity
2. Should include optional alert functions: severity(), title(), dedup(), runbook()
3. Use built-in event object functions: get(), deep_get(), deep_walk()
4. Avoid external API requests within detections
5. Complete execution within 15 seconds
6. Use unified data model (UDM) fields when possible
7. Handle nested and complex event structures safely
8. Include comprehensive unit tests
9. Provide clear, actionable context in alerts

## Evaluation Criteria:
- Precision and targeting of detection logic
- Performance and efficiency
- Code readability and maintainability
- Proper error handling
- Documentation and comments
- Security best practices
`

export async function validatePythonCode(code: string): Promise<ValidationResult> {
  try {
    const syntaxCheckPrompt = {
      messages: [
        {
          role: "user" as const,
          content: `Check the following Python code for syntax errors. Return a JSON object with format:
{
  "isValid": boolean,
  "errors": string[] // if any
}

Please provide all error messages in Korean language.

Code:
\`\`\`python
${code}
\`\`\``,
        },
      ],
      system: "You are a Python syntax checker. Return only valid JSON.",
      temperature: 0,
    }

    const syntaxResponse = await invokeClaude(syntaxCheckPrompt)

    // Extract JSON from code block if present
    let syntaxResponseText = syntaxResponse
    const jsonMatch = syntaxResponse.match(/```json\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      syntaxResponseText = jsonMatch[1]
    }

    const syntaxCheck = JSON.parse(syntaxResponseText)

    const validationPrompt = {
      messages: [
        {
          role: "user" as const,
          content: `Analyze the following Python code as a Panther detection rule and provide a comprehensive evaluation.

Return a JSON object with this exact format:
{
  "ruleCompliance": {
    "score": number (0-100),
    "findings": ["string array of issues found"],
    "suggestions": ["string array of improvements"]
  },
  "codeQuality": {
    "score": number (0-100),
    "feedback": "markdown formatted feedback string"
  },
  "detailedAnalysis": "comprehensive markdown analysis"
}

Please provide all text content (findings, suggestions, feedback, detailedAnalysis) in Korean language.

Code to analyze:
\`\`\`python
${code}
\`\`\``,
        },
      ],
      system: PANTHER_RULES_CONTEXT,
      temperature: 0.3,
    }

    const validationResponse = await invokeClaude(validationPrompt)

    // Extract JSON from code block if present
    let validationResponseText = validationResponse
    const validationJsonMatch = validationResponse.match(/```json\n([\s\S]*?)\n```/)
    if (validationJsonMatch) {
      validationResponseText = validationJsonMatch[1]
    }

    const validationResult = JSON.parse(validationResponseText)

    return {
      syntaxCheck,
      ...validationResult,
    }
  } catch (error) {
    console.error("Validation error:", error)
    return {
      syntaxCheck: {
        isValid: false,
        errors: ["Failed to validate code"],
      },
      ruleCompliance: {
        score: 0,
        findings: ["Validation service error"],
        suggestions: [],
      },
      codeQuality: {
        score: 0,
        feedback: "Unable to evaluate code quality",
      },
      detailedAnalysis: "An error occurred during validation",
    }
  }
}

export async function generateImprovedCode(
  originalCode: string,
  feedback: ValidationResult
): Promise<string> {
  const prompt = {
    messages: [
      {
        role: "user" as const,
        content: `Based on the following feedback, generate an improved version of this Python detection rule:

Original Code:
\`\`\`python
${originalCode}
\`\`\`

Feedback:
- Findings: ${feedback.ruleCompliance.findings.join(", ")}
- Suggestions: ${feedback.ruleCompliance.suggestions.join(", ")}

Generate only the improved code without any explanation. If you include any comments in the code, please write them in Korean language.`,
      },
    ],
    system: PANTHER_RULES_CONTEXT,
    temperature: 0.5,
  }

  const response = await invokeClaude(prompt)
  const codeMatch = response.match(/```python\n([\s\S]*?)\n```/)
  return codeMatch ? codeMatch[1] : response
}
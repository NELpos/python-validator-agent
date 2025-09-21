# Python Detection Rule Validator

AI-powered validation system for Panther detection rules using Amazon Bedrock Claude.

## Features

- **Python Syntax Validation**: Real-time syntax checking for Python code
- **Panther Rule Compliance**: Validates against Panther detection rule best practices
- **Code Quality Assessment**: Evaluates code quality and provides scores
- **AI-Powered Improvements**: Generates improved versions of your code
- **Interactive UI**: Split-view interface with Monaco Editor

## Prerequisites

- Node.js 18+ and pnpm
- AWS Account with Bedrock access
- Claude model access in Amazon Bedrock

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd python-validator-agent
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your AWS credentials:
```env
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-west-2
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229
```

## Running the Application

Start the development server:
```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Navigate to the validator page by clicking "Start Validating Code"
2. Enter your Python detection rule code in the left panel
3. Click "Validate Code" to analyze your code
4. Review the evaluation results in the right panel:
   - Syntax validation results
   - Rule compliance score and findings
   - Code quality assessment
   - Detailed analysis and suggestions
5. Click "Improve Code" to generate an improved version

## Architecture

### Technology Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: shadcn/ui, Tailwind CSS
- **Code Editor**: Monaco Editor
- **LLM Integration**: Amazon Bedrock Claude via AWS SDK
- **Markdown Rendering**: react-markdown with GitHub Flavored Markdown

### Project Structure
```
/app
  /api
    /validate         # Validation API endpoint
  /validator         # Main validator page
/components
  /ui
    code-editor.tsx  # Monaco Editor wrapper
    evaluation-panel.tsx # Results display
    split-view.tsx   # Layout component
/lib
  /agents
    python-validator.ts # Validation logic
  /bedrock
    client.ts        # AWS Bedrock client
```

## Panther Detection Rule Guidelines

The validator checks against these Panther best practices:

- Must have a `rule(event)` function returning `True` for suspicious activity
- Should include optional alert functions: `severity()`, `title()`, `dedup()`, `runbook()`
- Use built-in event object functions: `get()`, `deep_get()`, `deep_walk()`
- Avoid external API requests within detections
- Complete execution within 15 seconds
- Use unified data model (UDM) fields when possible
- Handle nested and complex event structures safely
- Include comprehensive unit tests
- Provide clear, actionable context in alerts

## Development

### Building for Production
```bash
pnpm run build
pnpm run start
```

### Linting
```bash
pnpm run lint
```

## Future Enhancements

- RAG system for Panther documentation
- Multi-step agent validation pipeline
- Few-shot learning examples
- Batch validation for multiple files
- Export validation reports
- Custom rule templates
- Integration with version control

## License

MIT

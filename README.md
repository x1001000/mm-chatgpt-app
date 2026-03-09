# MacroMicro ChatGPT App

A ChatGPT App that provides access to MacroMicro financial and economic data analysis with rich UI rendering.

## Features

- **Financial Data Analysis**: Query MacroMicro for economic indicators, market trends, and financial insights
- **Rich UI Widget**: Responses rendered with styled cards, tables, and formatted markdown
- **Chart Gallery**: Related charts displayed as image cards in a scrollable carousel
- **Dark/Light Theme**: Automatically adapts via `prefers-color-scheme`
- **MCP Apps Bridge**: Uses JSON-RPC 2.0 postMessage protocol (`ui/initialize` + `ui/notifications/tool-result`)
- **AWS Lambda Ready**: Stateless deployment for serverless hosting

## Project Structure

```
mm-chatgpt-app/
├── server.py              # FastMCP server with widget support
├── web/
│   ├── package.json       # Node.js dependencies
│   ├── tsconfig.json      # TypeScript config
│   ├── build.mjs          # esbuild script
│   ├── src/
│   │   ├── MacroMicroWidget.tsx   # React widget component
│   │   └── openai.d.ts    # TypeScript types for window.openai
│   └── dist/
│       └── widget.html    # Built widget (generated)
├── requirements.txt       # Python dependencies
├── Dockerfile             # AWS Lambda container
├── .env.example           # Environment template
└── pyproject.toml         # Python project config
```

## Setup

### Prerequisites

- Python 3.13+
- Node.js 18+
- uv (Python package manager)

### 1. Install Python Dependencies

```bash
uv sync
```

### 2. Build the Widget

```bash
cd web
npm install
npm run build
cd ..
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and set MacroMicro_API endpoint
```

### 4. Run Locally

```bash
uv run python server.py
```

Server runs at http://localhost:8000

## Testing

### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector@latest http://localhost:8000/mcp
```

### Connect to ChatGPT (Developer Mode)

1. Go to ChatGPT Settings → Apps & Connectors → Advanced settings
2. Enable Developer Mode
3. Create a new connector with your server URL + `/mcp`
4. Test in a new chat

For local testing, use ngrok:
```bash
ngrok http 8000
```

## AWS Lambda Deployment

### 1. Build Widget First

```bash
cd web && npm run build && cd ..
```

### 2. Build Docker Image

```bash
docker build -t mm-chatgpt-app .
```

### 3. Push to ECR and Deploy

```bash
# Tag and push to ECR
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker tag mm-chatgpt-app:latest <account>.dkr.ecr.<region>.amazonaws.com/mm-chatgpt-app:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/mm-chatgpt-app:latest

# Create/update Lambda function
aws lambda create-function \
  --function-name mm-chatgpt-app \
  --package-type Image \
  --code ImageUri=<account>.dkr.ecr.<region>.amazonaws.com/mm-chatgpt-app:latest \
  --role <lambda-execution-role-arn> \
  --timeout 150 \
  --environment "Variables={MacroMicro_API=<your-api-endpoint>}"
```

### 4. Create Function URL

```bash
aws lambda create-function-url-config \
  --function-name mm-chatgpt-app \
  --auth-type NONE
```

## Tool API

### ask_MacroMicro

Query MacroMicro for financial and economic data.

**Input:**
- `question` (string): Natural language question about financial data

**Output:**
- `ToolResult` with `structuredContent` (question, markdown, summary) delivered to widget via MCP Apps bridge
- Rich UI widget displaying:
  - Question card showing the original query
  - Content card with styled markdown (tables, lists, links)
  - Related Charts gallery with image previews from MacroMicro CDN

## Development

### Watch Mode

```bash
cd web
npm run watch
```

### Modify Widget Styles

Edit `web/src/MacroMicroWidget.tsx` to customize the UI appearance.

## Architecture

The widget communicates with ChatGPT via the MCP Apps bridge:

1. ChatGPT calls the `ask_MacroMicro` tool
2. Widget iframe loads from the `ui://widget/macromicro.html` resource
3. Widget sends `ui/initialize` handshake via `postMessage`
4. After tool completes, ChatGPT delivers `ui/notifications/tool-result` with `structuredContent`
5. Widget renders the formatted response

Resource MIME type: `text/html;profile=mcp-app`

## References

- [OpenAI Apps SDK](https://developers.openai.com/apps-sdk/)
- [Build MCP Server](https://developers.openai.com/apps-sdk/build/mcp-server)
- [Build ChatGPT UI](https://developers.openai.com/apps-sdk/build/chatgpt-ui/)
- [FastMCP](https://github.com/jlowin/fastmcp)

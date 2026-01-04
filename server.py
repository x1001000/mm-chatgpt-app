"""
MacroMicro ChatGPT App - FastMCP Server with UI Widget Support

This server provides the ask_MacroMicro tool with rich UI rendering
for ChatGPT Apps integration.
"""

import os
import logging
from functools import lru_cache
from pathlib import Path

import requests
from dotenv import load_dotenv
from fastmcp import FastMCP

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastMCP server
mcp = FastMCP(
    name="MacroMicro ChatGPT App",
    instructions="""
    This app provides access to MacroMicro, a financial and economic data analysis platform.
    Use the ask_MacroMicro tool to send questions about economic indicators, market trends,
    and financial data analysis. Results are displayed with rich UI formatting.
    """,
)

logger.info("FastMCP server 'MacroMicro ChatGPT App' initialized")


@lru_cache(maxsize=1)
def _load_widget_html() -> str:
    """Load the widget HTML template with embedded React component."""
    widget_path = Path(__file__).parent / "web" / "dist" / "widget.html"
    if widget_path.exists():
        return widget_path.read_text()

    # Fallback: inline widget template for development/testing
    return r"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MacroMicro Widget</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
            --bg-primary: #ffffff;
            --bg-secondary: #f7f7f8;
            --text-primary: #1a1a1a;
            --text-secondary: #6b6b6b;
            --border-color: #e5e5e5;
            --accent-color: #0066cc;
        }

        [data-theme="dark"] {
            --bg-primary: #1a1a1a;
            --bg-secondary: #2d2d2d;
            --text-primary: #ffffff;
            --text-secondary: #a0a0a0;
            --border-color: #404040;
            --accent-color: #4da6ff;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            padding: 16px;
            line-height: 1.6;
        }

        .widget-container {
            max-width: 100%;
        }

        .question-card {
            background: var(--bg-secondary);
            border-radius: 12px;
            padding: 12px 16px;
            margin-bottom: 16px;
            border-left: 4px solid var(--accent-color);
        }

        .question-label {
            font-size: 11px;
            font-weight: 600;
            color: var(--accent-color);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }

        .question-text {
            font-size: 14px;
            color: var(--text-primary);
        }

        .content-card {
            background: var(--bg-secondary);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
        }

        .content-card h1, .content-card h2, .content-card h3 {
            color: var(--text-primary);
            margin-bottom: 12px;
        }

        .content-card h1 { font-size: 20px; }
        .content-card h2 { font-size: 18px; }
        .content-card h3 { font-size: 16px; }

        .content-card p {
            margin-bottom: 12px;
            color: var(--text-primary);
        }

        .content-card ul, .content-card ol {
            margin-left: 20px;
            margin-bottom: 12px;
        }

        .content-card li {
            margin-bottom: 6px;
        }

        .content-card table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            font-size: 13px;
        }

        .content-card th, .content-card td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }

        .content-card th {
            background: var(--bg-primary);
            font-weight: 600;
            color: var(--text-secondary);
            font-size: 11px;
            text-transform: uppercase;
        }

        .content-card code {
            background: var(--bg-primary);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 13px;
        }

        .content-card pre {
            background: var(--bg-primary);
            padding: 12px;
            border-radius: 8px;
            overflow-x: auto;
            margin-bottom: 12px;
        }

        .content-card blockquote {
            border-left: 3px solid var(--accent-color);
            padding-left: 12px;
            margin: 12px 0;
            color: var(--text-secondary);
        }

        .content-card a {
            color: var(--accent-color);
            text-decoration: none;
        }

        .content-card a:hover {
            text-decoration: underline;
        }

        .content-card img {
            max-width: 100%;
            border-radius: 8px;
            margin: 12px 0;
        }

        /* References Section */
        .references-section {
            margin-top: 24px;
        }

        .references-header {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-secondary);
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
        }

        .references-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 12px;
        }

        .reference-card {
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            overflow: hidden;
            transition: box-shadow 0.2s, transform 0.2s;
            cursor: pointer;
            text-decoration: none;
            display: block;
        }

        .reference-card:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            transform: translateY(-2px);
            text-decoration: none;
        }

        [data-theme="dark"] .reference-card:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .reference-image {
            width: 100%;
            aspect-ratio: 16 / 9;
            object-fit: cover;
            background: var(--bg-secondary);
            display: block;
        }

        .reference-content {
            padding: 10px 12px;
        }

        .reference-title {
            font-size: 13px;
            font-weight: 500;
            color: var(--text-primary);
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .reference-url {
            font-size: 11px;
            color: var(--text-secondary);
            margin-top: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* Text-only references (no image) */
        .references-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-top: 8px;
        }

        .reference-link {
            font-size: 13px;
            color: var(--accent-color);
            text-decoration: none;
            padding: 6px 0;
        }

        .reference-link:hover {
            text-decoration: underline;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: var(--text-secondary);
        }

        .error {
            background: #fee2e2;
            color: #dc2626;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 12px;
        }

        [data-theme="dark"] .error {
            background: #450a0a;
            color: #fca5a5;
        }
    </style>
</head>
<body>
    <div id="root" class="widget-container">
        <div class="loading">Loading...</div>
    </div>

    <script>
        // Extract chart references with images from markdown (for RELATED CHARTS section)
        function extractChartReferences(md) {
            if (!md) return [];

            const references = [];
            const lines = md.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Match: * [Title](url) or - [Title](url) where url contains macromicro.me
                const linkMatch = line.match(/^\s*[\*\-]\s*\[([^\]]+)\]\((https?:\/\/[^)]*macromicro\.me[^)]+)\)/);
                if (linkMatch) {
                    const ref = {
                        title: linkMatch[1],
                        url: linkMatch[2],
                        imageUrl: null
                    };

                    // Check next line for image: [![alt](imageUrl)](url)
                    if (i + 1 < lines.length) {
                        const nextLine = lines[i + 1];
                        const imgMatch = nextLine.match(/\[!\[[^\]]*\]\((https?:\/\/cdn\.macromicro\.me[^)]+)\)\]\([^)]+\)/);
                        if (imgMatch) {
                            ref.imageUrl = imgMatch[1];
                        }
                    }

                    // Only add if it has an image (chart reference)
                    if (ref.imageUrl) {
                        references.push(ref);
                    }
                }
            }

            return references;
        }

        // Remove chart preview images from content (they're shown in RELATED CHARTS)
        function removeChartPreviewImages(md) {
            if (!md) return md;

            // Remove standalone image links that are chart previews from cdn.macromicro.me
            // Pattern: [![alt](cdn.macromicro.me/...)](url) on its own line
            let cleaned = md.replace(/^\s*\[!\[[^\]]*\]\(https?:\/\/cdn\.macromicro\.me[^)]+\)\]\([^)]+\)\s*$/gm, '');

            // Clean up multiple consecutive empty lines
            cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

            return cleaned;
        }

        // Parse markdown to HTML (simple implementation)
        function parseMarkdown(md) {
            if (!md) return '';

            let html = md
                // Horizontal rules
                .replace(/^---+$/gm, '<hr>')
                // Headers
                .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                // Bold
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                // Italic
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                // Links (but not image links)
                .replace(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
                // Images
                .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
                // Code blocks
                .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                // Inline code
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                // Blockquotes
                .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
                // Unordered lists
                .replace(/^\s*[\-\*\+] (.*$)/gm, '<li>$1</li>')
                // Ordered lists
                .replace(/^\s*\d+\. (.*$)/gm, '<li>$1</li>')
                // Paragraphs
                .replace(/\n\n/g, '</p><p>')
                // Line breaks
                .replace(/\n/g, '<br>');

            // Wrap consecutive li elements in ul
            html = html.replace(/(<li>[\s\S]*?<\/li>)(?=\s*<li>|$)/g, '<ul>$1</ul>');
            // Clean up nested ul tags
            html = html.replace(/<\/ul>\s*<ul>/g, '');

            return '<p>' + html + '</p>';
        }

        // Render reference cards with image previews
        function renderReferences(references) {
            if (!references || references.length === 0) return '';

            const cardsWithImages = references.filter(r => r.imageUrl);
            const linksOnly = references.filter(r => !r.imageUrl);

            let html = '<div class="references-section">';
            html += '<div class="references-header">📊 Data Sources & Charts</div>';

            // Cards with images
            if (cardsWithImages.length > 0) {
                html += '<div class="references-grid">';
                for (const ref of cardsWithImages) {
                    html += `
                        <a href="${escapeHtml(ref.url)}" target="_blank" rel="noopener" class="reference-card">
                            <img src="${escapeHtml(ref.imageUrl)}" alt="${escapeHtml(ref.title)}" class="reference-image" loading="lazy" onerror="this.style.display='none'">
                            <div class="reference-content">
                                <div class="reference-title">${escapeHtml(ref.title)}</div>
                            </div>
                        </a>
                    `;
                }
                html += '</div>';
            }

            // Text-only links
            if (linksOnly.length > 0) {
                html += '<div class="references-list">';
                for (const ref of linksOnly) {
                    html += `<a href="${escapeHtml(ref.url)}" target="_blank" rel="noopener" class="reference-link">📄 ${escapeHtml(ref.title)}</a>`;
                }
                html += '</div>';
            }

            html += '</div>';
            return html;
        }

        // Initialize widget
        function initWidget() {
            const root = document.getElementById('root');

            // Get theme from host
            const theme = window.openai?.theme || 'light';
            document.documentElement.setAttribute('data-theme', theme);

            // toolOutput IS the structuredContent directly
            const toolOutput = window.openai?.toolOutput;

            if (!toolOutput) {
                root.innerHTML = '<div class="error">No data available</div>';
                return;
            }

            const { question, markdown, summary } = toolOutput;

            let html = '';

            // Question card
            if (question) {
                html += `
                    <div class="question-card">
                        <div class="question-label">Your Question</div>
                        <div class="question-text">${escapeHtml(question)}</div>
                    </div>
                `;
            }

            // Parse markdown and extract references
            if (markdown) {
                // Extract chart references (with images) for RELATED CHARTS section
                const chartReferences = extractChartReferences(markdown);

                // Remove preview images from content (keep text links intact)
                const cleanedMarkdown = removeChartPreviewImages(markdown);

                // Main content card (with original text, minus preview images)
                html += `
                    <div class="content-card">
                        ${parseMarkdown(cleanedMarkdown)}
                    </div>
                `;

                // RELATED CHARTS section with image previews
                if (chartReferences.length > 0) {
                    html += renderReferences(chartReferences);
                }
            } else if (summary) {
                html += `
                    <div class="content-card">
                        <p>${escapeHtml(summary)}</p>
                    </div>
                `;
            }

            root.innerHTML = html || '<div class="error">No content to display</div>';

            // Notify host of height
            if (window.openai?.notifyIntrinsicHeight) {
                window.openai.notifyIntrinsicHeight(document.body.scrollHeight);
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Listen for theme changes
        window.addEventListener('openai:set_globals', (event) => {
            const theme = event.detail?.theme || 'light';
            document.documentElement.setAttribute('data-theme', theme);
        });

        // Initialize when ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initWidget);
        } else {
            initWidget();
        }
    </script>
</body>
</html>"""


# Register widget template as MCP resource
# Using ui://widget/ scheme as per OpenAI Apps SDK
@mcp.resource(
    uri="ui://widget/macromicro.html",
    name="MacroMicro Widget",
    description="UI widget for displaying MacroMicro financial analysis results",
    mime_type="text/html+skybridge",
)
def get_widget_template() -> str:
    """Return the widget HTML template."""
    return _load_widget_html()


logger.info("Widget resource registered at ui://widget/macromicro.html")


@mcp.tool(
    name="ask_MacroMicro",
    description="""Send a question to the MacroMicro API and receive financial analysis with rich UI.

The MacroMicro API provides financial and economic data analysis. Submit natural
language questions about economic indicators, market trends, or financial data.

The response is displayed in an interactive widget with styled formatting.

Args:
    question: A natural language question about financial or economic data

Returns:
    Financial analysis displayed in a rich UI widget""",
    meta={
        "openai/outputTemplate": "ui://widget/macromicro.html",
        "openai/toolInvocation/invoking": "Analyzing financial data...",
        "openai/toolInvocation/invoked": "Analysis complete",
    },
)
def ask_MacroMicro(question: str) -> dict:
    """Query MacroMicro API and return structured content for widget rendering."""
    logger.info(f"ask_MacroMicro called with question: {question[:50]}...")

    # Get API endpoint from environment
    api_endpoint = os.getenv("MacroMicro_API")

    if not api_endpoint:
        logger.error("MacroMicro_API environment variable not set")
        return {
            "question": question,
            "markdown": None,
            "summary": "Error: MacroMicro API not configured.",
            "error": True,
        }

    try:
        # Call MacroMicro API
        payload = {
            "user_id": 101001000,
            "message": question,
            "response_type": "text",
        }

        logger.info(f"Sending request to MacroMicro API: {api_endpoint}")
        response = requests.post(api_endpoint, json=payload, timeout=90)
        response.raise_for_status()

        # Parse JSON response and extract markdown
        api_response = response.json()
        markdown_response = api_response.get("response_markdown") or api_response.get("response", "")
        logger.info("Successfully received response from MacroMicro API")

        # Generate a brief summary for the model
        summary_lines = markdown_response.split("\n")[:5]
        summary = " ".join(line.strip() for line in summary_lines if line.strip())[:200]

        # Return structured content for widget rendering
        # The _meta is now in the tool decorator, not here
        return {
            "question": question,
            "markdown": markdown_response,
            "summary": summary + "..." if len(summary) == 200 else summary,
        }

    except requests.exceptions.Timeout:
        logger.error("Request to MacroMicro API timed out")
        return {
            "question": question,
            "markdown": None,
            "summary": "Request timed out. Please try again.",
            "error": True,
        }

    except requests.exceptions.RequestException as e:
        logger.error(f"Error communicating with MacroMicro API: {str(e)}")
        return {
            "question": question,
            "markdown": None,
            "summary": f"Error: {str(e)}",
            "error": True,
        }


logger.info("ask_MacroMicro tool registered")


# Create the MCP HTTP app with stateless mode for AWS Lambda
app = mcp.http_app(stateless_http=True)
logger.info("MCP server created with HTTP app (stateless mode)")


# Add HTTP endpoints for health check and widget serving
from starlette.responses import PlainTextResponse, HTMLResponse
from starlette.routing import Route


async def health_check(request):
    """Health check endpoint for Lambda Web Adapter."""
    from datetime import datetime, timezone

    client_ip = request.client.host if request.client else "Unknown"
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    return PlainTextResponse(
        f"MacroMicro ChatGPT App\n"
        f"Status: OK\n"
        f"Timestamp: {timestamp}\n"
        f"Client: {client_ip}"
    )


async def serve_widget(request):
    """Serve the widget HTML for ChatGPT to render."""
    widget_html = _load_widget_html()
    return HTMLResponse(
        content=widget_html,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Cache-Control": "public, max-age=3600",
        },
    )


async def widget_options(request):
    """Handle CORS preflight for widget endpoint."""
    return PlainTextResponse(
        "",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        },
    )


app.routes.append(Route("/", health_check))
app.routes.append(Route("/widget.html", serve_widget, methods=["GET"]))
app.routes.append(Route("/widget.html", widget_options, methods=["OPTIONS"]))
logger.info("Health check endpoint added at /")
logger.info("Widget endpoint added at /widget.html")


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting server in development mode on port 8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)

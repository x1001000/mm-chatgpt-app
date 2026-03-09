import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import "./openai.d.ts";

// Types
interface ToolOutput {
  question?: string;
  markdown?: string;
  summary?: string;
  error?: boolean;
}

interface ChartReference {
  title: string;
  chartUrl: string;
  imageUrl: string;
}

function useOpenAI() {
  const [theme, setTheme] = useState<"light" | "dark">(
    (window.openai?.theme as "light" | "dark") ||
    (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );
  const [toolOutput, setToolOutput] = useState<ToolOutput | null>(null);
  const loadedRef = { current: false };

  const safeSet = (data: unknown) => {
    if (loadedRef.current) return;
    const d = (data as { structuredContent?: ToolOutput })?.structuredContent || data;
    if (!d) return;
    loadedRef.current = true;
    setToolOutput(d as ToolOutput);
  };

  useEffect(() => {
    // 1. postMessage JSON-RPC 2.0 bridge (primary for first load)
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.jsonrpc === "2.0" && msg.method === "ui/notifications/tool-result") {
        safeSet(msg.params);
      }
    };
    window.addEventListener("message", handleMessage);

    // 2. openai:set_globals event
    const handleGlobals = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const output = detail?.globals?.toolOutput || detail?.toolOutput;
      if (output) {
        const t = detail?.globals?.theme || detail?.theme || "light";
        setTheme(t);
        safeSet(output);
      }
    };
    window.addEventListener("openai:set_globals", handleGlobals);

    // 3. Check window.openai.toolOutput (works on reload when data is pre-set)
    const legacy = window.openai?.toolOutput;
    if (legacy) safeSet(legacy);

    // 4. Poll for window.openai.toolOutput (covers async injection)
    let pollCount = 0;
    const pollTimer = setInterval(() => {
      if (loadedRef.current || pollCount > 600) { clearInterval(pollTimer); return; }
      pollCount++;
      const to = window.openai?.toolOutput;
      if (to) { clearInterval(pollTimer); safeSet(to); }
    }, 50);

    // 5. ui/initialize handshake
    window.parent.postMessage(
      { jsonrpc: "2.0", id: "init-1", method: "ui/initialize",
        params: { appInfo: { name: "macromicro-widget", version: "1.0.0" },
                  appCapabilities: {}, protocolVersion: "2026-01-26" } },
      "*"
    );

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("openai:set_globals", handleGlobals);
    };
  }, []);

  return { theme, toolOutput };
}

// Extract chart references from markdown (pattern: text link + image link)
function extractChartReferences(md: string): { content: string; charts: ChartReference[] } {
  const charts: ChartReference[] = [];

  // Normalize line endings
  const normalized = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Pattern 1: * [Title](URL)\n[![alt](ImageURL)](URL)
  // Handles bullet point followed by image link on next line
  // Uses (?:[^\[\]]|\[[^\]]*\])* to allow nested brackets like [Puell Multiple]
  const pattern1 = /\*\s*\[((?:[^\[\]]|\[[^\]]*\])*)\]\((https?:\/\/[^\)]+)\)\s*\n\s*\[!\[(?:[^\[\]]|\[[^\]]*\])*\]\((https?:\/\/[^\)]+)\)\]\(https?:\/\/[^\)]+\)/g;

  // Pattern 2: Just the image link format [![alt](ImageURL)](URL) for standalone charts
  const pattern2 = /\[!\[((?:[^\[\]]|\[[^\]]*\])*)\]\((https?:\/\/cdn\.macromicro\.me[^\)]+)\)\]\((https?:\/\/(?:en\.|www\.)?macromicro\.me[^\)]+)\)/g;

  let match;
  const seenUrls = new Set<string>();

  // Try pattern 1 first (bullet + image)
  while ((match = pattern1.exec(normalized)) !== null) {
    const imageUrl = match[3];
    if (!seenUrls.has(imageUrl)) {
      seenUrls.add(imageUrl);
      charts.push({
        title: match[1],
        chartUrl: match[2],
        imageUrl: imageUrl,
      });
    }
  }

  // If no charts found with pattern 1, try pattern 2 (standalone image links)
  if (charts.length === 0) {
    while ((match = pattern2.exec(normalized)) !== null) {
      const imageUrl = match[2];
      if (!seenUrls.has(imageUrl)) {
        seenUrls.add(imageUrl);
        charts.push({
          title: match[1] || "Chart",
          chartUrl: match[3],
          imageUrl: imageUrl,
        });
      }
    }
  }

  // Remove the chart reference section from content
  let content = normalized;
  if (charts.length > 0) {
    // Find reference section and remove everything after
    // Matches: **Data Sources...**, **參考資料**, or similar headers near the end
    const sectionPattern = /\n+(?:\*\*(?:Data Sources|Further Reading|參考資料)[^*]*\*\*|#{1,4}\s*(?:Data Sources|Further Reading|參考資料))[\s\S]*$/i;
    content = normalized.replace(sectionPattern, '');
    // Also remove any remaining standalone image links that were extracted
    for (const chart of charts) {
      const escapedUrl = chart.imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const imgPattern = new RegExp(`\\[!\\[(?:[^\\[\\]]|\\[[^\\]]*\\])*\\]\\(${escapedUrl}\\)\\]\\([^)]+\\)`, 'g');
      content = content.replace(imgPattern, '');
    }
  }

  return { content, charts };
}

// Parse markdown tables into HTML
function parseMarkdownTables(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let tableLines: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      if (/^\|[\s\-:|]+\|$/.test(line)) {
        if (!inTable) inTable = true;
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableLines = [];
      }
      tableLines.push(line);
    } else {
      if (inTable && tableLines.length > 0) {
        result.push(renderTable(tableLines));
        tableLines = [];
        inTable = false;
      }
      result.push(lines[i]);
    }
  }
  if (inTable && tableLines.length > 0) {
    result.push(renderTable(tableLines));
  }
  return result.join("\n");
}

function renderTable(rows: string[]): string {
  if (rows.length === 0) return "";
  const parseRow = (row: string) => row.slice(1, -1).split("|").map((cell) => cell.trim());
  const headerCells = parseRow(rows[0]);
  const bodyRows = rows.slice(1).map(parseRow);

  let html = '<div class="mm-table-container"><table class="mm-table">';
  html += "<thead><tr>";
  headerCells.forEach((cell) => { html += `<th>${cell}</th>`; });
  html += "</tr></thead>";

  if (bodyRows.length > 0) {
    html += "<tbody>";
    bodyRows.forEach((cells) => {
      html += "<tr>";
      cells.forEach((cell) => {
        const isNumeric = /^[+-]?[\d,]+\.?\d*%?$/.test(cell.replace(/[$€£¥~]/g, ""));
        const isNegative = cell.startsWith("-");
        let className = "mm-td";
        if (isNumeric) {
          className += " mm-numeric";
          if (isNegative) className += " mm-negative";
        }
        html += `<td class="${className}">${cell}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody>";
  }
  html += "</table></div>";
  return html;
}

// Parse lists
function parseMarkdownLists(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  for (const line of lines) {
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);

    if (ulMatch) {
      if (listType !== "ul") {
        if (listItems.length > 0) result.push(renderList(listItems, listType!));
        listItems = [];
        listType = "ul";
      }
      listItems.push(ulMatch[2]);
    } else if (olMatch) {
      if (listType !== "ol") {
        if (listItems.length > 0) result.push(renderList(listItems, listType!));
        listItems = [];
        listType = "ol";
      }
      listItems.push(olMatch[2]);
    } else {
      if (listItems.length > 0) {
        result.push(renderList(listItems, listType!));
        listItems = [];
        listType = null;
      }
      result.push(line);
    }
  }
  if (listItems.length > 0) result.push(renderList(listItems, listType!));
  return result.join("\n");
}

function renderList(items: string[], type: "ul" | "ol"): string {
  const html = items.map((item) => `<li>${item}</li>`).join("");
  return `<${type} class="mm-list">${html}</${type}>`;
}

// Main markdown parser
function parseMarkdown(md: string): string {
  if (!md) return "";

  let html = parseMarkdownTables(md);
  html = parseMarkdownLists(html);

  html = html
    .replace(/^#### (.*$)/gm, '<h4 class="mm-h4">$1</h4>')
    .replace(/^### (.*$)/gm, '<h3 class="mm-h3">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="mm-h2">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="mm-h1">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/!\[((?:[^\[\]]|\[[^\]]*\])*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="mm-img" />')
    .replace(/\[((?:[^\[\]]|\[[^\]]*\])*)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="mm-link">$1</a>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="mm-pre"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="mm-code">$1</code>')
    .replace(/^> (.*$)/gm, '<blockquote class="mm-quote">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="mm-hr" />');

  const blocks = html.split(/\n\n+/);
  html = blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (/^<(h[1-6]|p|ul|ol|table|div|pre|blockquote|hr)/i.test(trimmed)) return trimmed;
    return `<p class="mm-p">${trimmed.replace(/\n/g, "<br />")}</p>`;
  }).join("");

  return html;
}

// Chart Gallery Component
function ChartGallery({ charts }: { charts: ChartReference[] }) {
  if (charts.length === 0) return null;

  return (
    <div className="mm-gallery">
      <div className="mm-gallery-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" />
          <path d="M18 9l-5 5-4-4-3 3" />
        </svg>
        <span>Related Charts</span>
      </div>
      <div className="mm-gallery-scroll">
        {charts.map((chart, index) => (
          <a
            key={index}
            href={chart.chartUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mm-gallery-card"
          >
            <div className="mm-gallery-img-wrapper">
              <img src={chart.imageUrl} alt={chart.title} className="mm-gallery-img" />
            </div>
            <div className="mm-gallery-title">{chart.title}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

// CSS styles
const cssStyles = `
:root {
  --mm-bg: #ffffff;
  --mm-bg-card: #f7f7f8;
  --mm-bg-code: #ececf1;
  --mm-text: #1a1a1a;
  --mm-text-secondary: #6b6b6b;
  --mm-text-muted: #999999;
  --mm-border: #e5e5e5;
  --mm-accent: #0066cc;
  --mm-accent-hover: #0052a3;
  --mm-positive: #16a34a;
  --mm-negative: #dc2626;
  --mm-error-bg: #fef2f2;
  --mm-error-text: #dc2626;
}

@media (prefers-color-scheme: dark) {
  :root {
    --mm-bg: #212121;
    --mm-bg-card: #2d2d2d;
    --mm-bg-code: #3d3d3d;
    --mm-text: #ececec;
    --mm-text-secondary: #a0a0a0;
    --mm-text-muted: #666666;
    --mm-border: #404040;
    --mm-accent: #4da6ff;
    --mm-accent-hover: #80bfff;
    --mm-positive: #4ade80;
    --mm-negative: #f87171;
    --mm-error-bg: #450a0a;
    --mm-error-text: #fca5a5;
  }
}

[data-theme="dark"] {
  --mm-bg: #212121;
  --mm-bg-card: #2d2d2d;
  --mm-bg-code: #3d3d3d;
  --mm-text: #ececec;
  --mm-text-secondary: #a0a0a0;
  --mm-text-muted: #666666;
  --mm-border: #404040;
  --mm-accent: #4da6ff;
  --mm-accent-hover: #80bfff;
  --mm-positive: #4ade80;
  --mm-negative: #f87171;
  --mm-error-bg: #450a0a;
  --mm-error-text: #fca5a5;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  background: var(--mm-bg);
  color: var(--mm-text);
  -webkit-font-smoothing: antialiased;
}

.mm-widget { padding: 16px; }
.mm-loading { text-align: center; padding: 32px; color: var(--mm-text-secondary); }

/* Question Card */
.mm-question {
  background: var(--mm-bg-card);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  border-left: 4px solid var(--mm-accent);
}
.mm-question-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--mm-accent);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.mm-question-text { color: var(--mm-text); }

/* Error */
.mm-error {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--mm-error-bg);
  color: var(--mm-error-text);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}
.mm-error svg { flex-shrink: 0; }

/* Content Card */
.mm-content {
  background: var(--mm-bg-card);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

/* Typography */
.mm-h1 { font-size: 22px; font-weight: 700; margin: 0 0 16px; border-bottom: 1px solid var(--mm-border); padding-bottom: 8px; }
.mm-h2 { font-size: 18px; font-weight: 600; margin: 24px 0 12px; }
.mm-h3 { font-size: 16px; font-weight: 600; margin: 20px 0 8px; }
.mm-h4 { font-size: 14px; font-weight: 600; margin: 16px 0 8px; color: var(--mm-text-secondary); }
.mm-p { margin-bottom: 12px; }

.mm-link { color: var(--mm-accent); text-decoration: none; }
.mm-link:hover { text-decoration: underline; color: var(--mm-accent-hover); }

.mm-list { margin: 0 0 12px 24px; }
.mm-list li { margin-bottom: 6px; }

.mm-quote {
  border-left: 3px solid var(--mm-accent);
  padding-left: 16px;
  margin: 16px 0;
  color: var(--mm-text-secondary);
  font-style: italic;
}

.mm-hr { border: none; border-top: 1px solid var(--mm-border); margin: 24px 0; }

/* Code */
.mm-pre {
  background: var(--mm-bg-code);
  padding: 14px 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
  font-family: "SF Mono", Monaco, Consolas, monospace;
  font-size: 13px;
}
.mm-code {
  background: var(--mm-bg-code);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: "SF Mono", Monaco, Consolas, monospace;
  font-size: 13px;
}

/* Images */
.mm-img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 16px 0;
}

/* Tables */
.mm-table-container {
  overflow-x: auto;
  margin: 16px 0;
  border: 1px solid var(--mm-border);
  border-radius: 8px;
}
.mm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.mm-table th {
  background: var(--mm-bg-code);
  padding: 10px 14px;
  text-align: left;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--mm-text-secondary);
  border-bottom: 1px solid var(--mm-border);
  white-space: nowrap;
}
.mm-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--mm-border);
}
.mm-table tbody tr:last-child td { border-bottom: none; }
.mm-table tbody tr:hover { background: var(--mm-bg-code); }
.mm-numeric {
  text-align: right;
  font-family: "SF Mono", Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}
.mm-positive { color: var(--mm-positive); }
.mm-negative { color: var(--mm-negative); }

/* Chart Gallery - Carousel Style */
.mm-gallery {
  background: var(--mm-bg-card);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.mm-gallery-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--mm-text-secondary);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.mm-gallery-header svg {
  color: var(--mm-accent);
}
.mm-gallery-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
}
.mm-gallery-scroll::-webkit-scrollbar {
  height: 6px;
}
.mm-gallery-scroll::-webkit-scrollbar-track {
  background: var(--mm-bg-code);
  border-radius: 3px;
}
.mm-gallery-scroll::-webkit-scrollbar-thumb {
  background: var(--mm-border);
  border-radius: 3px;
}
.mm-gallery-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--mm-text-muted);
}
.mm-gallery-card {
  flex: 0 0 280px;
  scroll-snap-align: start;
  background: var(--mm-bg);
  border-radius: 8px;
  overflow: hidden;
  text-decoration: none;
  color: var(--mm-text);
  border: 1px solid var(--mm-border);
  transition: transform 0.2s, box-shadow 0.2s;
}
.mm-gallery-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
[data-theme="dark"] .mm-gallery-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.mm-gallery-img-wrapper {
  width: 100%;
  height: 160px;
  overflow: hidden;
  background: var(--mm-bg-code);
}
.mm-gallery-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mm-gallery-title {
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Footer */
.mm-footer {
  text-align: center;
  padding-top: 12px;
}
.mm-footer-text {
  font-size: 11px;
  color: var(--mm-text-muted);
}
`;

// Main Widget Component
function MacroMicroWidget() {
  const { theme, toolOutput } = useOpenAI();
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  if (!toolOutput) {
    return (
      <div className="mm-widget">
        <div className="mm-loading">Loading...</div>
      </div>
    );
  }

  const { question, markdown, summary, error } = toolOutput;

  // Extract chart references for gallery
  const { content, charts } = markdown
    ? extractChartReferences(markdown)
    : { content: '', charts: [] };

  return (
    <div className="mm-widget">
      {/* Question */}
      {question && (
        <div className="mm-question">
          <div className="mm-question-label">Your Question</div>
          <div className="mm-question-text">{question}</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mm-error">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{summary || "An error occurred"}</span>
        </div>
      )}

      {/* Content */}
      {!error && content && (
        <div className="mm-content">
          <div dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }} />
        </div>
      )}

      {/* Chart Gallery */}
      {!error && charts.length > 0 && (
        <ChartGallery charts={charts} />
      )}

      {/* Summary fallback */}
      {!error && !markdown && summary && (
        <div className="mm-content">
          <p className="mm-p">{summary}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mm-footer">
        <span className="mm-footer-text">Powered by MacroMicro</span>
      </div>
    </div>
  );
}

// Inject styles
const styleEl = document.createElement("style");
styleEl.textContent = cssStyles;
document.head.appendChild(styleEl);

// Mount
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<MacroMicroWidget />);
}

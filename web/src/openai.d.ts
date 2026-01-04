// Type declarations for ChatGPT Apps window.openai API

interface OpenAIToolOutput {
  question?: string;
  markdown?: string;
  summary?: string;
  error?: boolean;
}

interface OpenAIWidgetState {
  [key: string]: unknown;
}

interface OpenAIGlobals {
  theme: "light" | "dark";
  displayMode: "inline" | "fullscreen" | "pip";
  maxHeight: number;
  locale: string;
  userAgent: string;
}

interface OpenAI {
  // State
  toolInput: Record<string, unknown>;
  toolOutput: OpenAIToolOutput;
  toolResponseMetadata: Record<string, unknown>;
  widgetState: OpenAIWidgetState;
  theme: "light" | "dark";
  displayMode: "inline" | "fullscreen" | "pip";
  maxHeight: number;
  locale: string;

  // Actions
  setWidgetState: (state: OpenAIWidgetState) => void;
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  sendFollowUpMessage: (options: { prompt: string }) => void;
  uploadFile: (file: File) => Promise<{ fileId: string }>;
  getFileDownloadUrl: (options: { fileId: string }) => Promise<{ url: string }>;

  // Layout
  requestDisplayMode: (mode: "inline" | "fullscreen" | "pip") => void;
  notifyIntrinsicHeight: (height: number) => void;
  requestClose: () => void;
  openExternal: (url: string) => void;
}

declare global {
  interface Window {
    openai?: OpenAI;
  }

  interface WindowEventMap {
    "openai:set_globals": CustomEvent<OpenAIGlobals>;
  }
}

export {};

import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { auth } from "#/modules/auth/auth.server";
import { chat, toServerSentEventsResponse, toHttpResponse } from "@tanstack/ai";
import { openaiCompatibleText } from "@tanstack/ai-openai/compatible";

const DEFAULT_AI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_AI_MODEL = "gpt-4o-mini";

export const Route = createFileRoute("/api/ai/complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
          if (!session?.user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const apiKey =
            env.AI_API_KEY ||
            (process.env.AI_API_KEY as string) ||
            (process.env.OPENAI_API_KEY as string);

          if (!apiKey) {
            return Response.json(
              { error: "AI_API_KEY environment variable not configured" },
              { status: 500 },
            );
          }

          const baseURL =
            env.AI_BASE_URL || (process.env.AI_BASE_URL as string) || DEFAULT_AI_BASE_URL;

          const body = (await request.json().catch(() => ({}))) as {
            prompt?: string;
            context?: string;
            action?:
              | "continue"
              | "improve"
              | "fix_grammar"
              | "summarize"
              | "generate_title"
              | "custom";
            model?: string;
            stream?: boolean;
          };

          const {
            prompt = "",
            context = "",
            action = "continue",
            model = env.AI_MODEL || (process.env.AI_MODEL as string) || DEFAULT_AI_MODEL,
            stream = true,
          } = body;

          if (!prompt && !context) {
            return Response.json({ error: "No prompt or context provided" }, { status: 400 });
          }

          let systemPrompt =
            'You are an expert writing assistant in a minimalist blog editor. Return well-formatted Markdown with clean headers (##, ###), bullet lists, and paragraphs ready for TipTap parsing. Do not include conversational filler, preamble ("Sure!", "Here is..."), or code block wrapping unless specifically writing code.';

          let userMessage = "";

          switch (action) {
            case "continue":
              systemPrompt +=
                " Continue writing seamlessly from the current document context. Match tone, voice, and topic.";
              userMessage = `Document so far:\n"""\n${context}\n"""\n\nContinue writing the next sections directly:`;
              break;
            case "improve":
              systemPrompt +=
                " Rewrite and polish this text for better structure, clarity, and tone while retaining key meaning.";
              userMessage = `Rewrite and improve this text:\n"""\n${prompt || context}\n"""`;
              break;
            case "fix_grammar":
              systemPrompt +=
                " Fix spelling, grammar, typographical errors, and awkward phrasing. Keep formatting intact.";
              userMessage = `Fix grammar in this text:\n"""\n${prompt || context}\n"""`;
              break;
            case "summarize":
              systemPrompt =
                "Write a single short paragraph summary/excerpt for article preview cards (1-2 sentences, maximum 40 words). Output ONLY raw plain text. No multiple paragraphs, no newlines, no markdown formatting, no bold, no asterisks, no quotes, no headers.";
              userMessage = `Summarize this text in exactly one short plain-text paragraph (under 40 words):\n"""\n${context || prompt}\n"""`;
              break;
            case "generate_title":
              systemPrompt =
                "Suggest a short, concise, and compelling article title (3-8 words). Output ONLY plain text on a single line. No quotes, no markdown, no bold, no asterisks, no punctuation at the end.";
              userMessage = `Suggest a short title based on this content:\n"""\n${context || prompt}\n"""`;
              break;
            case "custom":
            default:
              userMessage = context
                ? `Context:\n"""\n${context}\n"""\n\nInstruction: ${prompt}`
                : prompt;
              break;
          }

          const abortController = new AbortController();

          // ponytail: Standard TanStack AI OpenAI-compatible adapter for custom endpoints
          const adapter = openaiCompatibleText(model, {
            baseURL,
            apiKey,
            defaultHeaders: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            },
          });

          const aiStream = chat({
            adapter,
            systemPrompts: [systemPrompt],
            messages: [{ role: "user", content: userMessage }],
            abortController,
          });

          if (stream) {
            return toServerSentEventsResponse(aiStream, { abortController });
          }

          return toHttpResponse(aiStream, { abortController });
        } catch (error: any) {
          return Response.json({ error: error.message || "Server error" }, { status: 500 });
        }
      },
    },
  },
});

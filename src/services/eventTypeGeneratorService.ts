export interface EventTypeDraft {
  title: string;
  durationMinutes: number;
  description: string;
  color: string;
}

export interface GenerateEventTypeIdeasInput {
  prompt: string;
  audience?: string;
}

export interface GenerateEventTypeIdeasResult {
  provider: "gemini" | "template";
  suggestions: EventTypeDraft[];
}

const allowedDurations = [15, 30, 45, 60, 90, 120];
const allowedColors = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#6B7280",
];

function sanitizeText(value?: string): string {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function normalizeDuration(value?: number): number {
  if (!value) {
    return 30;
  }

  return allowedDurations.reduce((closest, current) => {
    return Math.abs(current - value) < Math.abs(closest - value) ? current : closest;
  }, allowedDurations[0]);
}

function normalizeColor(value?: string, index = 0): string {
  if (value && allowedColors.includes(value)) {
    return value;
  }

  return allowedColors[index % allowedColors.length];
}

function normalizeSuggestion(
  suggestion: Partial<EventTypeDraft>,
  index: number
): EventTypeDraft | null {
  const title = sanitizeText(suggestion.title);
  const description = sanitizeText(suggestion.description);

  if (!title || !description) {
    return null;
  }

  return {
    title,
    description,
    durationMinutes: normalizeDuration(suggestion.durationMinutes),
    color: normalizeColor(suggestion.color, index),
  };
}

function tryParseSuggestionPayload(rawContent: string): EventTypeDraft[] | null {
  const cleaned = rawContent
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    const parsed = JSON.parse(cleaned) as {
      suggestions?: Array<Partial<EventTypeDraft>>;
    };

    if (!Array.isArray(parsed.suggestions)) {
      return null;
    }

    const suggestions = parsed.suggestions
      .map((suggestion, index) => normalizeSuggestion(suggestion, index))
      .filter((suggestion): suggestion is EventTypeDraft => Boolean(suggestion))
      .slice(0, 3);

    return suggestions.length ? suggestions : null;
  } catch {
    return null;
  }
}

function extractGeminiText(data: {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}): string | null {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts?.length) {
    return null;
  }

  return parts
    .map((part) => part.text || "")
    .join("")
    .trim() || null;
}

function buildTemplateSuggestions(input: GenerateEventTypeIdeasInput): EventTypeDraft[] {
  const prompt = sanitizeText(input.prompt).toLowerCase();
  const audience = sanitizeText(input.audience);
  const durationMatches = Array.from(prompt.matchAll(/(\d{2,3})\s*minute/g)).map((match) =>
    Number(match[1])
  );
  const uniqueDurations = Array.from(new Set(durationMatches))
    .map((duration) => normalizeDuration(duration))
    .slice(0, 3);

  const durations = uniqueDurations.length ? uniqueDurations : [30, 60];

  return durations.map((duration, index) => {
    const isIntro = prompt.includes("intro") || prompt.includes("discovery");
    const isStrategy = prompt.includes("strategy") || prompt.includes("consult");
    const isSupport = prompt.includes("support") || prompt.includes("help");

    const title =
      isIntro && duration <= 30
        ? `${duration} Min Intro Call`
        : isStrategy && duration >= 45
          ? `${duration} Min Strategy Session`
          : isSupport
            ? `${duration} Min Support Call`
            : `${duration} Min Consultation`;

    const descriptionParts = [
      `Use this ${duration}-minute session to talk through your goals, questions, and next steps.`,
      audience ? `Best for ${audience}.` : "Best for people looking for focused help and clear direction.",
      index === 0
        ? "This is a strong starting point if you want a simple, versatile event type."
        : "You can tailor this draft further once it is in your event settings.",
    ];

    return {
      title,
      durationMinutes: duration,
      description: descriptionParts.join(" "),
      color: normalizeColor(undefined, index),
    };
  });
}

async function generateWithGemini(
  input: GenerateEventTypeIdeasInput
): Promise<EventTypeDraft[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey || !model) {
    return null;
  }

  const baseUrl =
    process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
  const prompt = [
    "You convert a user's plain-English service description into booking event type drafts.",
    "Return valid JSON only with this shape:",
    '{"suggestions":[{"title":"...","durationMinutes":30,"description":"...","color":"#3B82F6"},{"title":"...","durationMinutes":60,"description":"...","color":"#10B981"}]}',
    "Return 1 to 3 suggestions.",
    "Allowed durationMinutes values: 15, 30, 45, 60, 90, 120.",
    `Allowed colors: ${allowedColors.join(", ")}`,
    "Descriptions should be 2 to 4 sentences, clear and easy to book.",
    "Do not mention unsupported features like payments, deposits, questionnaires, or routing rules.",
    `User prompt: ${sanitizeText(input.prompt)}`,
    `Audience: ${sanitizeText(input.audience) || "not provided"}`,
  ].join("\n");

  try {
    const response = await fetch(`${baseUrl}/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "You generate structured booking event type drafts and always respond with valid JSON.",
            },
          ],
        },
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.8,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini event type generation failed:", errorText);
      return null;
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const content = extractGeminiText(data);

    if (!content) {
      return null;
    }

    return tryParseSuggestionPayload(content);
  } catch (error) {
    console.error("Gemini event type generation error:", error);
    return null;
  }
}

export async function generateEventTypeIdeas(
  input: GenerateEventTypeIdeasInput
): Promise<GenerateEventTypeIdeasResult> {
  const geminiSuggestions = await generateWithGemini(input);

  if (geminiSuggestions?.length) {
    return {
      provider: "gemini",
      suggestions: geminiSuggestions,
    };
  }

  return {
    provider: "template",
    suggestions: buildTemplateSuggestions(input),
  };
}

export type BookingCopyTone =
  | "professional"
  | "friendly"
  | "consultative"
  | "sales"
  | "supportive";

export interface GenerateBookingCopyInput {
  title: string;
  durationMinutes?: number;
  audience?: string;
  goal?: string;
  tone?: BookingCopyTone;
  additionalContext?: string;
  existingDescription?: string;
}

export interface BookingCopySuggestion {
  label: string;
  title: string;
  description: string;
}

export interface GenerateBookingCopyResult {
  provider: "gemini" | "template";
  suggestions: BookingCopySuggestion[];
}

const toneInstructions: Record<BookingCopyTone, string> = {
  professional: "sound clear, polished, and trustworthy",
  friendly: "sound warm, approachable, and easy to book",
  consultative: "sound thoughtful, expert-led, and collaborative",
  sales: "sound value-focused, confident, and action-oriented",
  supportive: "sound reassuring, calm, and helpful",
};

const toneIntros: Record<BookingCopyTone, string[]> = {
  professional: [
    "Use this time to discuss your goals, key questions, and the best next steps.",
    "We will focus on your priorities, clarify what matters most, and leave with a clear direction.",
    "This session is designed to help you get direct answers and a practical plan.",
  ],
  friendly: [
    "This is a relaxed conversation where we can talk through what you need and how I can help.",
    "Bring your questions and context, and we will use the time to find the most useful next step.",
    "This session is meant to feel easy, helpful, and focused on what matters to you.",
  ],
  consultative: [
    "We will use this session to unpack your situation, surface the right priorities, and map out next steps together.",
    "Expect a focused conversation that balances strategy, questions, and practical guidance.",
    "This time is designed for thoughtful discussion so you can leave with more clarity and momentum.",
  ],
  sales: [
    "Use this session to explore fit, understand the value of working together, and decide on the right next move.",
    "We will focus on your goals, the outcomes you want, and whether this offer is the right match.",
    "This conversation is built to help you quickly understand options, value, and next steps.",
  ],
  supportive: [
    "This session is a calm space to talk through what is going on and identify the most helpful next step.",
    "Bring your questions, concerns, or context, and we will work through them together in a practical way.",
    "The goal is to leave you feeling clearer, more supported, and confident about what comes next.",
  ],
};

function sanitizeText(value?: string): string {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function makeSentence(value: string, fallback: string): string {
  if (!value) return fallback;
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function buildAudienceSentence(audience: string): string {
  return audience
    ? `Best for ${audience}.`
    : "Best for people who want a focused and productive conversation.";
}

function buildGoalSentence(goal: string): string {
  return goal
    ? `You should book this if you want to ${goal}.`
    : "You should book this if you want focused guidance and a clear next step.";
}

function buildLogisticsSentence(durationMinutes?: number, additionalContext?: string): string {
  const durationText = durationMinutes
    ? `In ${durationMinutes} minutes`
    : "During this session";
  const extra = sanitizeText(additionalContext);

  if (!extra) {
    return `${durationText}, we will keep things focused and practical.`;
  }

  return `${durationText}, we will cover ${extra}.`;
}

function buildTemplateSuggestions(
  input: GenerateBookingCopyInput
): BookingCopySuggestion[] {
  const title = sanitizeText(input.title);
  const audience = sanitizeText(input.audience);
  const goal = sanitizeText(input.goal);
  const additionalContext = sanitizeText(input.additionalContext);
  const existingDescription = sanitizeText(input.existingDescription);
  const tone = input.tone || "professional";

  const intros = toneIntros[tone];
  const audienceSentence = buildAudienceSentence(audience);
  const goalSentence = buildGoalSentence(goal);
  const logisticsSentence = buildLogisticsSentence(
    input.durationMinutes,
    additionalContext
  );
  const existingSentence = existingDescription
    ? makeSentence(
        `Current focus: ${existingDescription.replace(/^[^.?!]+:\s*/, "")}`,
        ""
      )
    : "";

  return intros.map((intro, index) => {
    const description = [
      makeSentence(intro, ""),
      audienceSentence,
      goalSentence,
      logisticsSentence,
      index === 0 ? existingSentence : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      label:
        index === 0
          ? "Balanced"
          : index === 1
            ? "More inviting"
            : "More outcome-focused",
      title,
      description,
    };
  });
}

function tryParseSuggestionPayload(rawContent: string): BookingCopySuggestion[] | null {
  const cleaned = rawContent
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    const parsed = JSON.parse(cleaned) as {
      suggestions?: Array<Partial<BookingCopySuggestion>>;
    };

    if (!Array.isArray(parsed.suggestions)) {
      return null;
    }

    const suggestions = parsed.suggestions
      .map((suggestion, index) => ({
        label: sanitizeText(suggestion.label) || `Option ${index + 1}`,
        title: sanitizeText(suggestion.title),
        description: sanitizeText(suggestion.description),
      }))
      .filter((suggestion) => suggestion.title && suggestion.description);

    return suggestions.length ? suggestions.slice(0, 3) : null;
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

async function generateWithGemini(
  input: GenerateBookingCopyInput
): Promise<BookingCopySuggestion[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey || !model) {
    return null;
  }

  const baseUrl =
    process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
  const prompt = [
    "You write high-converting copy for booking pages.",
    "Return valid JSON only with this shape:",
    '{"suggestions":[{"label":"Balanced","title":"...","description":"..."},{"label":"More inviting","title":"...","description":"..."},{"label":"More outcome-focused","title":"...","description":"..."}]}',
    "Each description should be 2 to 4 sentences, clear, specific, and easy to scan.",
    "Avoid hype, exclamation points, and vague filler.",
    `Event title: ${sanitizeText(input.title)}`,
    `Duration: ${input.durationMinutes ? `${input.durationMinutes} minutes` : "not provided"}`,
    `Audience: ${sanitizeText(input.audience) || "not provided"}`,
    `Goal: ${sanitizeText(input.goal) || "not provided"}`,
    `Tone: ${input.tone || "professional"} which should ${toneInstructions[input.tone || "professional"]}`,
    `Additional context: ${sanitizeText(input.additionalContext) || "not provided"}`,
    `Existing description: ${sanitizeText(input.existingDescription) || "not provided"}`,
  ].join("\n");

  try {
    const response = await fetch(
      `${baseUrl}/models/${model}:generateContent`,
      {
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
                "You generate polished booking page copy and always respond with valid JSON.",
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
          temperature: 0.9,
        },
      }),
    }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini booking copy generation failed:", errorText);
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
    console.error("Gemini booking copy generation error:", error);
    return null;
  }
}

export async function generateBookingCopy(
  input: GenerateBookingCopyInput
): Promise<GenerateBookingCopyResult> {
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

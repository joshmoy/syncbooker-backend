export interface BookingFaq {
  question: string;
  answer: string;
}

export interface GenerateBookingFaqInput {
  title: string;
  description?: string;
  businessType?: string;
  audience?: string;
}

export interface GenerateBookingFaqResult {
  provider: "gemini" | "template";
  faqs: BookingFaq[];
}

function sanitizeText(value?: string): string {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function normalizeFaqs(faqs: BookingFaq[]): BookingFaq[] {
  return faqs
    .map((faq) => ({
      question: sanitizeText(faq.question),
      answer: sanitizeText(faq.answer),
    }))
    .filter((faq) => faq.question && faq.answer)
    .slice(0, 4);
}

function tryParseFaqPayload(rawContent: string): BookingFaq[] | null {
  const cleaned = rawContent
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    const parsed = JSON.parse(cleaned) as {
      faqs?: Array<Partial<BookingFaq>>;
    };

    if (!Array.isArray(parsed.faqs)) {
      return null;
    }

    const faqs = normalizeFaqs(
      parsed.faqs.map((faq) => ({
        question: faq.question || "",
        answer: faq.answer || "",
      }))
    );

    return faqs.length ? faqs : null;
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

function buildTemplateFaqs(input: GenerateBookingFaqInput): BookingFaq[] {
  const title = sanitizeText(input.title);
  const description = sanitizeText(input.description);
  const businessType = sanitizeText(input.businessType);
  const audience = sanitizeText(input.audience);

  const faqs: BookingFaq[] = [
    {
      question: `What should I expect from this ${title.toLowerCase()}?`,
      answer: description
        ? description
        : "You can expect a focused conversation with clear next steps tailored to your needs.",
    },
    {
      question: "Who is this session best for?",
      answer: audience
        ? `This session is best for ${audience}.`
        : businessType
          ? `This session is designed for people looking for help related to ${businessType}.`
          : "This session is best for people who want practical guidance and a clear path forward.",
    },
    {
      question: "How can I prepare before the booking?",
      answer:
        "Bring any context, questions, or goals you want to cover so we can make the most of the time together.",
    },
    {
      question: "What happens after the session?",
      answer:
        "You will leave with more clarity on next steps, and if it makes sense, we can discuss the best follow-up from there.",
    },
  ];

  return normalizeFaqs(faqs);
}

async function generateWithGemini(
  input: GenerateBookingFaqInput
): Promise<BookingFaq[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey || !model) {
    return null;
  }

  const baseUrl =
    process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
  const prompt = [
    "You write concise, helpful FAQs for booking pages.",
    "Return valid JSON only with this shape:",
    '{"faqs":[{"question":"...","answer":"..."},{"question":"...","answer":"..."},{"question":"...","answer":"..."},{"question":"...","answer":"..."}]}',
    "Write 3 to 4 FAQs.",
    "Keep answers short, useful, and reassuring.",
    "Do not invent pricing or guarantees.",
    `Event title: ${sanitizeText(input.title)}`,
    `Event description: ${sanitizeText(input.description) || "not provided"}`,
    `Business type: ${sanitizeText(input.businessType) || "not provided"}`,
    `Audience: ${sanitizeText(input.audience) || "not provided"}`,
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
                  "You generate polished booking page FAQs and always respond with valid JSON.",
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
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini booking FAQ generation failed:", errorText);
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

    return tryParseFaqPayload(content);
  } catch (error) {
    console.error("Gemini booking FAQ generation error:", error);
    return null;
  }
}

export async function generateBookingFaqs(
  input: GenerateBookingFaqInput
): Promise<GenerateBookingFaqResult> {
  const geminiFaqs = await generateWithGemini(input);

  if (geminiFaqs?.length) {
    return {
      provider: "gemini",
      faqs: geminiFaqs,
    };
  }

  return {
    provider: "template",
    faqs: buildTemplateFaqs(input),
  };
}

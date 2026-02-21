import { GeminiDetails } from "../types";

const env = import.meta.env as unknown as Record<string, string>;
const GEMINI_MODEL = env.VITE_GEMINI_MODEL || "gemini-2.0-flash";
const API_KEY = env.VITE_GEMINI_API_KEY || "";

export const fetchWordDetailsFromGemini = async (
  word: string,
  userContext: string,
): Promise<GeminiDetails> => {
  if (!API_KEY) {
    return {
      definition: "",
      partOfSpeech: "",
      transcription: "",
      examples: [],
      error:
        "API key is not configured. Please set VITE_GEMINI_API_KEY in your environment.",
    };
  }
  const systemPrompt = `You are a word definition expert. Return ONLY a valid JSON object with the exact structure: {"definition": "string", "partOfSpeech": "string", "transcription": "string", "examples": ["string", "string"]}`;
  const userQuery = `Define this word in context: "${word}" (Context: "${userContext}"). Return only valid JSON.`;

  const definitionSchema = {
    type: "OBJECT",
    properties: {
      definition: {
        type: "STRING",
        description: "The primary meaning of the word.",
      },
      partOfSpeech: {
        type: "STRING",
        description:
          "The grammatical part of speech (e.g., noun, verb, adjective).",
      },
      transcription: {
        type: "STRING",
        description: "The phonetic transcription or pronunciation guide.",
      },
      examples: {
        type: "ARRAY",
        items: {
          type: "STRING",
        },
        description: "An array of 2 example sentences using the word.",
      },
    },
    required: ["definition", "partOfSpeech", "transcription", "examples"],
  };

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: definitionSchema,
      temperature: 1,
    },
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`API response status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Gemini Response:", result);

      const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (jsonText) {
        try {
          const parsedJson = JSON.parse(jsonText);
          return {
            definition: parsedJson.definition || "",
            partOfSpeech: parsedJson.partOfSpeech || "",
            transcription: parsedJson.transcription || "",
            examples: Array.isArray(parsedJson.examples)
              ? parsedJson.examples
              : [],
            error: null,
          };
        } catch (e) {
          console.error("Failed to parse JSON response:", jsonText, e);
        }
      }
      throw new Error(
        "API response structure missing content or invalid JSON.",
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Attempt ${i + 1} failed:`, errorMessage);
      if (i < 2) {
        await new Promise((resolve) => setTimeout(resolve, 2 ** i * 1000));
      } else {
        return {
          definition: "Could not fetch definition details.",
          partOfSpeech: "",
          transcription: "",
          examples: [],
          error: `Failed to fetch details after multiple retries. ${errorMessage}`,
        };
      }
    }
  }
  return {
    definition: null,
    partOfSpeech: null,
    transcription: null,
    examples: [],
    error: "Unknown fetch failure.",
  };
};

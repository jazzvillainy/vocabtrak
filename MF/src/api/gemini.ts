import { GeminiDetails } from "../types";

const env = import.meta.env as unknown as Record<string, string>;
const GEMINI_MODEL =
  env.VITE_GEMINI_MODEL || "gemini-2.5-flash-preview-09-2025";
const API_KEY = env.VITE_GEMINI_API_KEY || "";

export const fetchWordDetailsFromGemini = async (
  word: string,
  userContext: string
): Promise<GeminiDetails> => {
  const systemPrompt = `You are a word definition and language analysis expert. Based on the user's word and context, find its definition, part of speech, phonetic transcription, and provide 2 clear example sentences. Respond ONLY with a JSON object that adheres strictly to the provided schema.`;
  const userQuery = `Word: "${word}". Context: "${userContext}". Please provide the definition, part of speech, phonetic transcription, and 2 example sentences.`;

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
        description:
          "The phonetic transcription or pronunciation guide (e.g., /ˌsɪl.əˈɡɪ.zəm/).",
      },
      examples: {
        type: "ARRAY",
        description: "An array of 2-3 clear example sentences using the word.",
        items: { type: "STRING" },
      },
    },
    propertyOrdering: [
      "definition",
      "partOfSpeech",
      "transcription",
      "examples",
    ],
  };

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    tools: [{ google_search: {} }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: definitionSchema,
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
      console.log("resulttttttttttttttttttttttttttttttt:", response);

      if (!response.ok) {
        throw new Error(`API response status: ${response.status}`);
      }

      const result = await response.json();
      console.log("resulttttttttttttttttttttttttttttttt:", result);
      const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (jsonText) {
        try {
          const parsedJson = JSON.parse(jsonText);
          return {
            definition: parsedJson.definition || null,
            partOfSpeech: parsedJson.partOfSpeech || null,
            transcription: parsedJson.transcription || null,
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
        "API response structure missing content or invalid JSON."
      );
    } catch (error: any) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      if (i < 2) {
        await new Promise((resolve) => setTimeout(resolve, 2 ** i * 1000));
      } else {
        return {
          definition: "Could not fetch definition details.",
          partOfSpeech: null,
          transcription: null,
          examples: [],
          error: `Failed to fetch details after multiple retries. ${error.message}`,
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

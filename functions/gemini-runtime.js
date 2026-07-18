const { cleanText } = require('./judgment-v2');

const DEFAULT_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash';
const SUPPORTED_MODELS = new Set([
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  'gemini-3.1-pro-preview',
  'gemini-2.5-pro',
]);

let sdkPromise = null;

async function loadSdk() {
  if (!sdkPromise) sdkPromise = import('@google/genai');
  return sdkPromise;
}

function modelCandidates(configuredModel = '') {
  const configured = cleanText(configuredModel, 80);
  const ordered = [];
  if (SUPPORTED_MODELS.has(configured)) ordered.push(configured);
  ordered.push(DEFAULT_MODEL, FALLBACK_MODEL);
  return [...new Set(ordered)];
}

function responseText(response) {
  if (typeof response?.text === 'string') return response.text;
  if (typeof response?.text === 'function') return response.text();
  return String(response?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('') || '');
}

function errorMessage(error) {
  return String(error?.message || error || '');
}

function invalidApiKey(error) {
  return /(API key not valid|invalid api key|API_KEY_INVALID|GEMINI_API_KEY|authentication|unauthenticated)/i.test(errorMessage(error));
}

function retryWithAnotherModel(error) {
  return /(not found|404|unsupported|not supported|not available|permission denied|403|model.*invalid|model.*does not exist)/i.test(errorMessage(error));
}

function normalizeParts(prompt, image) {
  const parts = [{ text: String(prompt || '') }];
  if (image?.data && image?.mimeType) {
    parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });
  }
  return [{ role: 'user', parts }];
}

async function generateContent({
  apiKey,
  configuredModel,
  prompt,
  image = null,
  responseMimeType = 'text/plain',
  responseJsonSchema,
  temperature = 0.9,
  topP = 0.95,
  maxOutputTokens = 7000,
}) {
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('GEMINI_API_KEY is not configured');

  const { GoogleGenAI } = await loadSdk();
  const ai = new GoogleGenAI({ apiKey: key });
  const candidates = modelCandidates(configuredModel);
  let lastError = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const modelName = candidates[index];
    try {
      const config = {
        temperature,
        topP,
        maxOutputTokens,
        responseMimeType,
      };
      if (responseJsonSchema && responseMimeType === 'application/json') {
        config.responseJsonSchema = responseJsonSchema;
      }
      const response = await ai.models.generateContent({
        model: modelName,
        contents: normalizeParts(prompt, image),
        config,
      });
      const text = responseText(response).trim();
      if (!text) throw new Error(`Gemini returned an empty response from ${modelName}`);
      return {
        text,
        modelName,
        usage: response?.usageMetadata || {},
      };
    } catch (error) {
      lastError = error;
      if (invalidApiKey(error)) throw error;
      const hasNext = index < candidates.length - 1;
      if (!hasNext || !retryWithAnotherModel(error)) throw error;
      console.warn(`Gemini model ${modelName} unavailable; trying next supported model:`, errorMessage(error));
    }
  }

  throw lastError || new Error('Gemini generation failed');
}

async function generateJson(options) {
  return generateContent({ ...options, responseMimeType: 'application/json' });
}

async function generateText(options) {
  return generateContent({ ...options, responseMimeType: 'text/plain' });
}

module.exports = {
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  SUPPORTED_MODELS,
  modelCandidates,
  generateContent,
  generateJson,
  generateText,
};

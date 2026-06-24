'use strict';

const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const AI_RUNTIME_SECRETS = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY'];

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

async function readRuntimeConfig() {
  const ref = db.doc('config/ai_king');
  const snap = await ref.get().catch(() => null);
  const data = snap?.exists ? snap.data() || {} : {};

  const hasRetiredFields = [
    'geminiApiKey',
    'claudeApiKey',
    'openaiApiKey',
  ].some(field => Object.prototype.hasOwnProperty.call(data, field));

  if (hasRetiredFields) {
    await ref.set({
      geminiApiKey: FieldValue.delete(),
      claudeApiKey: FieldValue.delete(),
      openaiApiKey: FieldValue.delete(),
      keyStorage: 'managed-secret-only',
      credentialsPurgedAt: FieldValue.serverTimestamp(),
    }, { merge: true }).catch(error => {
      console.warn('[ai-runtime-provider] retired field cleanup failed:', error.message);
    });
  }

  return {
    enabled: data.enabled !== false,
    provider: data.activeModel === 'gemini' ? 'gemini' : 'anthropic',
    geminiModel: String(data.geminiModel || 'gemini-2.5-flash').slice(0, 100),
    anthropicModel: String(data.claudeModel || 'claude-haiku-4-5-20251001').slice(0, 100),
    dailyFreeLimit: clampInteger(data.dailyFreeLimit, 3, 1, 20),
    monthlyCap: clampInteger(data.monthlyCap, 0, 0, 100000),
  };
}

function parseJson(raw) {
  const text = String(raw || '').replace(/```json|```/gi, '').trim();
  try { return JSON.parse(text); } catch {}
  const match = text.match(/[[{][\s\S]*[\]}]/);
  if (!match) throw new Error('AI 응답 형식이 올바르지 않습니다.');
  return JSON.parse(match[0]);
}

async function runGemini(credential, config, system, prompt, maxTokens, temperature, jsonMode) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const client = new GoogleGenerativeAI(credential);
  const model = client.getGenerativeModel({ model: config.geminiModel, systemInstruction: system });
  const generationConfig = { maxOutputTokens: maxTokens, temperature, thinkingConfig: { thinkingBudget: 0 } };
  if (jsonMode) generationConfig.responseMimeType = 'application/json';
  const response = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  });
  return response.response.text() || '';
}

async function runAnthropic(credential, config, system, prompt, maxTokens, temperature) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: credential });
  const response = await client.messages.create({
    model: config.anthropicModel,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  });
  return response.content.find(item => item.type === 'text')?.text || '';
}

async function callAI(system, prompt, maxTokens = 800, temperature = 0.8, jsonMode = false) {
  const config = await readRuntimeConfig();
  if (!config.enabled) throw new HttpsError('failed-precondition', 'AI 기능이 현재 일시 중지되어 있습니다.');

  const geminiCredential = String(process.env.GEMINI_API_KEY || '').trim();
  const anthropicCredential = String(process.env.ANTHROPIC_API_KEY || '').trim();

  if (config.provider === 'gemini' && geminiCredential) {
    return runGemini(geminiCredential, config, system, prompt, maxTokens, temperature, jsonMode);
  }
  if (config.provider === 'anthropic' && anthropicCredential) {
    return runAnthropic(anthropicCredential, config, system, prompt, maxTokens, temperature);
  }
  if (geminiCredential) return runGemini(geminiCredential, config, system, prompt, maxTokens, temperature, jsonMode);
  if (anthropicCredential) return runAnthropic(anthropicCredential, config, system, prompt, maxTokens, temperature);
  throw new HttpsError('failed-precondition', 'AI 실행 환경이 준비되지 않았습니다.');
}

async function callAndParse(factory, maxTokens) {
  try {
    const raw = await factory(maxTokens);
    return { parsed: parseJson(raw), raw };
  } catch (firstError) {
    if (firstError instanceof HttpsError) throw firstError;
    const raw = await factory(Math.min(Math.round(maxTokens * 1.6), 4000));
    return { parsed: parseJson(raw), raw };
  }
}

module.exports = {
  AI_RUNTIME_SECRETS,
  readRuntimeConfig,
  callAI,
  callAndParse,
  parseJson,
  clampInteger,
};

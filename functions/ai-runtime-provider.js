'use strict';

const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();
const AI_RUNTIME_SECRETS = ['GEMINI_API_KEY', 'ANTHROPIC_API_KEY'];

async function readRuntimeConfig() {
  const snap = await db.doc('config/ai_king').get().catch(() => null);
  const data = snap?.exists ? snap.data() || {} : {};
  return {
    provider: data.activeModel === 'gemini' ? 'gemini' : 'anthropic',
    geminiModel: String(data.geminiModel || 'gemini-2.5-flash').slice(0, 100),
    anthropicModel: String(data.claudeModel || 'claude-haiku-4-5-20251001').slice(0, 100),
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
    const raw = await factory(Math.min(Math.round(maxTokens * 1.6), 4000));
    return { parsed: parseJson(raw), raw };
  }
}

module.exports = { AI_RUNTIME_SECRETS, callAI, callAndParse, parseJson };

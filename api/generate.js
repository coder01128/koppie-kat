import { Redis } from '@upstash/redis';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const LIMIT = 3;
const MAX_IMAGES = 3;
const MAX_B64_BYTES = 7 * 1024 * 1024; // ~5MB image
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const VALID_SECTIONS = new Set(['description', 'instagram', 'tiktok', 'campaign']);
const VALID_TONES = new Set(['neutral', 'highend', 'fun']);

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const TONE_INSTRUCTIONS = {
  neutral: `You are Koppie-Kat, an AI retail copy assistant. Write clean, confident, benefit-driven copy that works for any product — clothing, homewares, electronics, food, beauty, or anything in between. Professional but human. No corporate jargon, no empty hype. Let the product do the talking.`,

  highend: `You are Koppie-Kat, an AI retail copy assistant specialising in premium product positioning. Write elevated, considered copy — evocative without being pretentious, aspirational without being unreachable. Every word justifies the price tag. Works for any premium product category.`,

  fun: `You are Koppie-Kat, an AI retail copy assistant with genuine personality. Write copy that is warm, witty, and entertaining — the kind of product description people actually read to the end. Relatable energy, never try-hard. Works for cushions, candles, kitchen gear, clothing, or anything a real person would actually buy. Charming but never silly.`,
};

const PROMPTS = {
  description: (tone) => `${TONE_INSTRUCTIONS[tone]}\n\nLook at the product image(s) carefully. Write a complete retail product description that includes:\n1. A bold product name/headline\n2. A one-liner hook\n3. A short intro paragraph (2-3 sentences)\n4. A "Why you need it" bullet list (5 bullets, each with an emoji)\n5. A use suggestion (how or where to use this product)\n6. A mood line (3 words max, e.g. "Bold. Considered. Yours.")\n\nStay true to the tone throughout.`,

  tiktok: (tone) => `${TONE_INSTRUCTIONS[tone]}\n\nLook at the product image(s) carefully. Write a complete TikTok video script that includes:\n1. A scroll-stopping hook (0-3 seconds)\n2. Beat drop moment with text overlays (3-8 seconds)\n3. Detail showcase middle section (8-20 seconds)\n4. Strong CTA outro (20-30 seconds)\n5. Suggested audio style\n6. 3 caption options`,

  instagram: (tone) => `${TONE_INSTRUCTIONS[tone]}\n\nLook at the product image(s) carefully. Write a complete Instagram carousel post that includes:\n1. Slide 1 — Cover slide: bold headline\n2. Slide 2 — The detail slide: one key feature\n3. Slide 3 — The concept slide: bigger story\n4. Slide 4 — The use slide: how or where to use it\n5. Slide 5 — Close-up detail\n6. Slide 6 — CTA slide\n7. Full post caption with emojis\n8. Hashtag pack (20 hashtags)`,

  campaign: (tone) => `${TONE_INSTRUCTIONS[tone]}\n\nLook at the product image(s) carefully. Write a complete campaign concept:\n1. Campaign name and tagline\n2. The Big Idea (2-3 sentences)\n3. Target audience (vivid description)\n4. Creative direction (mood, colours, aesthetic)\n5. Hero video concept (30-60 second outline)\n6. 3 social content series ideas\n7. Creator/influencer strategy (3 tiers)\n8. Launch timeline (6 weeks)\n9. 5 tagline variations\n10. 3 key success metrics`,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']
    || req.headers['cf-connecting-ip']
    || 'unknown';

  const key = `kk:${ip}`;
  const count = (await redis.get(key)) || 0;

  if (Number(count) >= LIMIT) {
    return res.status(429).json({
      error: 'rate_limit',
      message: 'Free generations used up. Contact DarkLoud Digital for full access.',
      remaining: 0,
    });
  }

  const { section, tone, images } = req.body;

  if (!section || !tone || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!VALID_SECTIONS.has(section) || !VALID_TONES.has(tone)) {
    return res.status(400).json({ error: 'Invalid section or tone' });
  }

  if (images.length > MAX_IMAGES) {
    return res.status(400).json({ error: 'Too many images' });
  }

  for (const img of images) {
    if (!img.b64 || !img.type || !ALLOWED_MIME.has(img.type)) {
      return res.status(400).json({ error: 'Invalid image type' });
    }
    if (img.b64.length > MAX_B64_BYTES) {
      return res.status(400).json({ error: 'Image too large' });
    }
  }

  const imageBlocks = images.map(img => ({
    type: 'image',
    source: { type: 'base64', media_type: img.type, data: img.b64 }
  }));

  const anthropicBody = {
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        { type: 'text', text: PROMPTS[section](tone) }
      ]
    }]
  };

  try {
    const anthropicRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody)
    });

    const anthropicData = await anthropicRes.json();

    if (anthropicData.error) {
      return res.status(500).json({ error: anthropicData.error.message });
    }

    const text = anthropicData.content
      ?.map(b => b.text || '').join('')
      || 'Could not generate content.';

    const newCount = Number(count) + 1;
    await redis.set(key, newCount, { ex: 86400 });

    return res.status(200).json({ text, remaining: LIMIT - newCount });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

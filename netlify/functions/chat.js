exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    // ── تحقق من المفتاح أولاً ──
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply: '⚠️ GEMINI_API_KEY غير موجود في متغيرات البيئة. تأكد من إضافته في Netlify ثم أعد النشر.' }),
      };
    }

    // ── قراءة الجسم ──
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON غير صالح' }) };
    }

    const { messages, imageBase64, mimeType } = body;

    if (!messages?.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'ما في رسائل' }) };
    }

    // ── بناء contents مع ضمان تناوب user/model ──
    const rawContents = messages.map((msg, i) => {
      const parts = [];
      if (i === messages.length - 1 && imageBase64) {
        parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } });
      }
      parts.push({ text: msg.content || ' ' });
      return { role: msg.role === 'assistant' ? 'model' : 'user', parts };
    });

    // ضمان التناوب
    const contents = [];
    for (const msg of rawContents) {
      if (contents.length > 0 && contents[contents.length - 1].role === msg.role) {
        contents[contents.length - 1].parts.push(...msg.parts);
      } else {
        contents.push(msg);
      }
    }
    if (contents[0]?.role === 'model') contents.shift();

    // ── استدعاء Gemini ──
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: `أنت أزهلها، مساعد ذكاء اصطناعي سعودي ذكي. تحكي باللهجة السعودية العامية بشكل طبيعي. لا تقول أنك Gemini أو Google.` }]
          },
          contents,
          generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
        }),
      }
    );

    // اقرأ الرد كنص أولاً
    const rawText = await geminiRes.text();

    if (!geminiRes.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply: `⚠️ خطأ من Gemini (${geminiRes.status}): ${rawText.slice(0, 200)}` }),
      };
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply: `⚠️ رد غير متوقع من Gemini: ${rawText.slice(0, 200)}` }),
      };
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'ما قدرت أرد، حاول مرة ثانية.';
    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };

  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: `⚠️ خطأ تقني: ${err.message}` }),
    };
  }
};

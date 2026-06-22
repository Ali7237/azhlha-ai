// netlify/functions/chat.js
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
    const body = JSON.parse(event.body || '{}');
    const { messages, imageBase64, mimeType } = body;

    if (!messages || !messages.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'no messages' }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // تحقق من المفتاح
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'GEMINI_API_KEY غير موجود في إعدادات Netlify' }),
      };
    }

    // ── بناء contents مع ضمان تناوب user/model ──
    const rawContents = messages.map((msg, index) => {
      const isLast = index === messages.length - 1;
      const parts  = [];

      // أضف الصورة في آخر رسالة فقط
      if (isLast && imageBase64) {
        parts.push({
          inline_data: {
            mime_type: mimeType || 'image/jpeg',
            data: imageBase64,
          },
        });
      }

      parts.push({ text: msg.content || ' ' });

      return {
        role:  msg.role === 'assistant' ? 'model' : 'user',
        parts,
      };
    });

    // ── ضمان التناوب: لا رسالتان متتاليتان بنفس الـ role ──
    const contents = [];
    for (const msg of rawContents) {
      if (contents.length > 0 && contents[contents.length - 1].role === msg.role) {
        // دمج مع السابقة
        contents[contents.length - 1].parts.push(...msg.parts);
      } else {
        contents.push(msg);
      }
    }

    // Gemini يجب أن تبدأ بـ user
    if (contents[0]?.role === 'model') contents.shift();

    const systemInstruction = {
      parts: [{
        text: `أنت MeAi، مساعد ذكاء اصطناعي ذكي وودود. تجيب دائماً بالعربية ما لم يطلب المستخدم غير ذلك. لا تذكر أنك Gemini أو Google.`,
      }],
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: systemInstruction,
          contents,
          generationConfig: {
            temperature:     0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: `Gemini API error ${response.status}`, details: responseText }),
      };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'رد غير صالح من Gemini', details: responseText.slice(0, 200) }),
      };
    }

    const result = data.candidates?.[0]?.content?.parts?.[0]?.text
      || data.error?.message
      || 'عذراً، لم أتمكن من الرد.';

    return { statusCode: 200, headers, body: JSON.stringify({ reply: result }) };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

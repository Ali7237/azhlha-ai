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
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON غير صالح' }) }; }

    const { messages } = body;
    if (!messages?.length) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ما في رسائل' }) };

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return { statusCode: 200, headers, body: JSON.stringify({ reply: '⚠️ أضف GROQ_API_KEY في Netlify Environment Variables' }) };

    // بناء الرسائل
    const groqMessages = [
      {
        role: 'system',
        content: `أنت أزهلها، مساعد ذكاء اصطناعي سعودي ذكي وعملي. تحكي باللهجة السعودية العامية بشكل طبيعي ومريح. ردودك واضحة ومفيدة. لا تقول أنك Groq أو أي شركة ثانية — أنت أزهلها فقط.`
      },
      ...messages.map(m => ({
        role:    m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || ' ',
      }))
    ];

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages:    groqMessages,
        max_tokens:  2048,
        temperature: 0.8,
      }),
    });

    const rawText = await res.text();

    if (!res.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ reply: `⚠️ خطأ من Groq (${res.status}): ${rawText.slice(0, 200)}` }) };
    }

    let data;
    try { data = JSON.parse(rawText); }
    catch { return { statusCode: 200, headers, body: JSON.stringify({ reply: `⚠️ رد غير صالح: ${rawText.slice(0, 200)}` }) }; }

    const reply = data.choices?.[0]?.message?.content || 'ما قدرت أرد، حاول مرة ثانية.';
    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ reply: `⚠️ خطأ: ${err.message}` }) };
  }
};

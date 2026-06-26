module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GROQ_API_KEY;
    const { messages = [], lang = 'ar', style = 'formal', length = 'medium', userName, memory } = req.body || {};
    const isEn = lang === 'en';

    if (!messages.length) return res.status(400).json({ error: 'No messages provided' });
    if (!apiKey) {
      return res.status(200).json({
        reply: isEn
          ? 'GROQ_API_KEY is missing. Add it in Vercel project environment variables.'
          : 'مفتاح GROQ_API_KEY غير موجود. أضفه في متغيرات البيئة داخل Vercel.'
      });
    }

    const lengthText = {
      short: isEn ? 'Keep the answer short.' : 'اجعل الرد مختصراً.',
      medium: isEn ? 'Keep the answer balanced.' : 'اجعل الرد متوازناً.',
      long: isEn ? 'Give a detailed answer.' : 'قدّم رداً مفصلاً.'
    }[length] || '';

    const styleText = {
      formal: isEn ? 'Use professional English.' : 'استخدم العربية الفصحى الواضحة.',
      saudi: isEn ? 'Use professional English.' : 'استخدم لهجة سعودية واضحة ومهذبة.',
      casual: isEn ? 'Use a friendly tone.' : 'استخدم عربية بسيطة وودودة.'
    }[style] || '';

    const systemPrompt = isEn
      ? `You are Amerni, a helpful AI assistant. ${styleText} ${lengthText}
Never mention internal model/provider details unless asked. Use Markdown when useful.
User name: ${userName || 'Guest'}
Memory: ${memory || 'none'}

When the user asks to create a PDF, Word, Excel, or PowerPoint file, write the full content, then end with:
%%%GENERATE_START%%%
{"type":"pdf","filename":"document_name","lang":"en"}
%%%GENERATE_END%%%
Supported types: pdf, docx, xlsx, pptx.`
      : `أنت آمرني، مساعد ذكي مفيد. ${styleText} ${lengthText}
لا تذكر تفاصيل المزود أو النموذج الداخلي إلا إذا سئلت مباشرة. استخدم Markdown عند الحاجة.
اسم المستخدم: ${userName || 'زائر'}
الذاكرة: ${memory || 'لا توجد'}

إذا طلب المستخدم إنشاء ملف PDF أو Word أو Excel أو PowerPoint، اكتب المحتوى كاملاً، ثم اختم بهذا الشكل:
%%%GENERATE_START%%%
{"type":"pdf","filename":"document_name","lang":"ar"}
%%%GENERATE_END%%%
الأنواع المدعومة: pdf, docx, xlsx, pptx.`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.65,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: String(msg.content || ' ')
          }))
        ]
      })
    });

    const raw = await groqRes.text();
    if (!groqRes.ok) {
      let message = `HTTP ${groqRes.status}`;
      try { message = JSON.parse(raw).error?.message || message; } catch {}
      return res.status(200).json({ reply: `⚠️ ${message}` });
    }

    const data = JSON.parse(raw);
    let reply = data.choices?.[0]?.message?.content || (isEn ? 'No response.' : 'لم يصل رد.');
    let generateData = null;
    const match = reply.match(/%%%GENERATE_START%%%([\s\S]*?)%%%GENERATE_END%%%/);
    if (match) {
      try {
        generateData = JSON.parse(match[1].trim());
        reply = reply.replace(match[0], '').trim();
      } catch {}
    }

    return res.status(200).json({ reply, generateData });
  } catch (error) {
    return res.status(200).json({ reply: `⚠️ ${error.message}` });
  }
};

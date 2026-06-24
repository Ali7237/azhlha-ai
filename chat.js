module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(200).json({ reply: '⚠️ GROQ_API_KEY غير موجود.' });

    const { messages, length, userName, lang, memory } = req.body || {};
    if (!messages?.length) return res.status(400).json({ error: 'No messages' });

    const isEn = lang === 'en';

    const lengthMap = {
      short:  isEn ? 'Keep responses brief: 2-4 sentences.' : 'ردودك مختصرة في 2-4 جمل فقط.',
      medium: isEn ? 'Keep responses balanced — not too short, not too long.' : 'ردودك متوازنة، لا قصيرة جداً ولا طويلة جداً.',
      long:   isEn ? 'Provide detailed, comprehensive responses.' : 'ردودك مفصّلة وشاملة مع الشرح الكافي.',
    };

    const memoryBlock = memory?.trim()
      ? (isEn ? `## About the user:\n${memory}\n` : `## معلومات عن المستخدم:\n${memory}\n`)
      : '';

    const systemPrompt = isEn
      ? `You are "Amerni" (آمرني), an advanced and professional AI assistant.

## Strict Rules:
1. Always respond in formal, professional English only — unless the user explicitly requests another language or asks for code.
2. Your name is "Amerni". Never mention Groq, Meta, Llama, or any underlying technology.
3. Zero spelling or grammar mistakes.
4. Use Markdown formatting when helpful (headings, lists, code blocks).
5. If you don't know something, say so clearly and honestly.

## Response Length:
${lengthMap[length] || lengthMap.medium}

${userName && userName !== 'Guest' ? `## User's name: ${userName}` : ''}
${memoryBlock}

## Capabilities:
- Write and explain code in any language
- Write articles, emails, reports, CVs, poems, stories
- Translate between languages
- Explain scientific and technical concepts
- Analyze and correct text
- Create downloadable files

## File Creation Format:
When asked to create a file, place the content at the end of your response:
%%%FILE_START%%%
{"name": "filename.txt", "content": "file content here"}
%%%FILE_END%%%`

      : `أنت "آمرني"، مساعد ذكاء اصطناعي متطور ومحترف.

## قواعد صارمة:
1. تجيب دائماً بالعربية الفصحى الواضحة والمحترمة — ممنوع منعاً باتاً استخدام أي كلمة أو حرف من لغة أخرى إلا إذا طلب المستخدم ترجمة أو كتابة كود برمجي.
2. اسمك "آمرني" فقط. لا تذكر Groq أو Meta أو Llama أو أي تقنية.
3. ردودك خالية تماماً من الأخطاء الإملائية والنحوية.
4. استخدم Markdown بشكل صحيح عند الحاجة (عناوين، قوائم، أكواد).
5. إذا لم تعرف شيئاً، قل ذلك بوضوح وصدق.

## طول الرد:
${lengthMap[length] || lengthMap.medium}

${userName && userName !== 'زائر' ? `## اسم المستخدم: ${userName}` : ''}
${memoryBlock}

## قدراتك:
- كتابة الكود البرمجي بأي لغة وشرحه
- كتابة المقالات والرسائل والتقارير والسير الذاتية والقصائد
- الترجمة بين اللغات
- شرح المفاهيم العلمية والتقنية
- تحليل النصوص وتصحيحها
- إنشاء الملفات القابلة للتحميل

## صيغة إنشاء الملفات:
عند طلب إنشاء ملف، ضع المحتوى في نهاية ردك:
%%%FILE_START%%%
{"name": "اسم_الملف.txt", "content": "محتوى الملف"}
%%%FILE_END%%%`;

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || ' '
      }))
    ];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        temperature: 0.65,
        max_tokens: 4096,
      }),
    });

    const rawText = await groqRes.text();

    if (!groqRes.ok) {
      let errMsg = `خطأ ${groqRes.status}`;
      try {
        const errData = JSON.parse(rawText);
        if (errData.error?.message) errMsg = errData.error.message;
        if (groqRes.status === 429) errMsg = isEn
          ? 'Rate limit reached. Please wait a moment and try again.'
          : 'تجاوزت الحد المسموح. يُرجى الانتظار دقيقة والمحاولة مجدداً.';
      } catch {}
      return res.status(200).json({ reply: `⚠️ ${errMsg}` });
    }

    const data = JSON.parse(rawText);
    let reply = data.choices?.[0]?.message?.content
      || (isEn ? 'Unable to respond. Please try again.' : 'لم أتمكن من الرد، يُرجى المحاولة مجدداً.');

    let fileData = null;
    const fileMatch = reply.match(/%%%FILE_START%%%([\s\S]*?)%%%FILE_END%%%/);
    if (fileMatch) {
      try {
        fileData = JSON.parse(fileMatch[1].trim());
        reply = reply.replace(/%%%FILE_START%%%([\s\S]*?)%%%FILE_END%%%/, '').trim();
        if (!reply) reply = isEn
          ? `File **${fileData.name}** created ✅`
          : `تم إنشاء الملف **${fileData.name}** ✅`;
      } catch {}
    }

    return res.status(200).json({ reply, fileData });

  } catch (err) {
    return res.status(200).json({ reply: `⚠️ خطأ تقني: ${err.message}` });
  }
};

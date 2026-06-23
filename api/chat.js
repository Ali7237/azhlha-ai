module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(200).json({ reply: '⚠️ GROQ_API_KEY missing.' });

    const { messages, style, length, userName, lang, memory } = req.body || {};
    if (!messages?.length) return res.status(400).json({ error: 'No messages' });

    const isEn = lang === 'en';

    // ── Style instructions ──
    const styleMap = {
      formal: isEn
        ? `You speak in formal, professional English. Responses are clear and well-structured.`
        : `تتحدث بالعربية الفصحى الرسمية الواضحة. ردودك دقيقة ومنظمة ومحترفة.`,
      saudi: `تتحدث بالعامية السعودية الطبيعية. تستخدم كلمات مثل "وش"، "زين"، "يلا"، "ترا"، "والله". ردودك خفيفة وودية.`,
      casual: isEn
        ? `You speak in a friendly, casual conversational English tone.`
        : `تتحدث بعربية بسيطة مفهومة للجميع، وسط بين الفصحى والعامية.`,
    };

    const lengthMap = {
      short:  isEn ? `Keep responses brief: 2-4 sentences max.` : `ردودك مختصرة في 2-4 جمل.`,
      medium: isEn ? `Keep responses balanced — not too short, not too long.` : `ردودك متوازنة، لا قصيرة جداً ولا طويلة جداً.`,
      long:   isEn ? `Provide detailed, comprehensive responses with full explanation.` : `ردودك مفصّلة وشاملة مع الشرح الكافي.`,
    };

    // ── Memory context ──
    const memoryBlock = memory?.trim()
      ? (isEn
          ? `## What I know about you:\n${memory}\n`
          : `## ما أعرفه عنك:\n${memory}\n`)
      : '';

    const systemPrompt = isEn
      ? `You are "Amerni" (آمرني), an advanced AI assistant.

## Strict rules:
1. **Language**: Always respond in English only, unless the user explicitly asks for another language or writes code.
2. **Identity**: Your name is "Amerni". Never mention Groq, Meta, Llama, or any underlying technology.
3. **Accuracy**: Zero spelling or grammar mistakes.
4. **Professionalism**: Use Markdown formatting when helpful.
5. **Honesty**: If you don't know something, say so clearly.

## Style:
${styleMap[style] || styleMap.formal}
${lengthMap[length] || lengthMap.medium}
${userName && userName !== 'Guest' ? `## User:\nName: ${userName}` : ''}
${memoryBlock}

## Capabilities:
- Write and explain code in any language
- Write articles, emails, reports, CVs, poems, stories
- Translate between languages
- Explain scientific and technical concepts
- Analyze and correct text
- Create downloadable files (wrap content between %%%FILE_START%%% and %%%FILE_END%%%)

## File format:
%%%FILE_START%%%
{"name": "filename.txt", "content": "file content here"}
%%%FILE_END%%%`

      : `أنت "آمرني"، مساعد ذكاء اصطناعي متطور ومحترف.

## قواعد صارمة:
1. **اللغة**: اكتب دائماً بالعربية فقط — ممنوع أي كلمة أو حرف من لغة أخرى إلا إذا طلب المستخدم ترجمة أو كود برمجي.
2. **الهوية**: اسمك "آمرني" فقط. لا تذكر Groq أو Meta أو Llama أو أي تقنية.
3. **الدقة**: ردودك خالية تماماً من الأخطاء الإملائية والنحوية.
4. **الاحترافية**: استخدم Markdown عند الحاجة.
5. **الصدق**: إذا لم تعرف شيئاً قل ذلك بوضوح.

## أسلوبك:
${styleMap[style] || styleMap.formal}
${lengthMap[length] || lengthMap.medium}
${userName && userName !== 'زائر' ? `## المستخدم:\nاسمه ${userName}` : ''}
${memoryBlock}

## قدراتك:
- كتابة الكود البرمجي بأي لغة وشرحه
- كتابة المقالات والرسائل والتقارير والسير الذاتية والقصائد
- الترجمة بين اللغات
- شرح المفاهيم العلمية والتقنية
- تحليل النصوص وتصحيحها
- إنشاء الملفات (ضع المحتوى بين %%%FILE_START%%% و %%%FILE_END%%%)

## صيغة إنشاء الملفات:
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
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    const rawText = await groqRes.text();

    if (!groqRes.ok) {
      let errMsg = `Error ${groqRes.status}`;
      try {
        const errData = JSON.parse(rawText);
        if (errData.error?.message) errMsg = errData.error.message;
        if (groqRes.status === 429) errMsg = isEn
          ? 'Rate limit reached. Please wait a moment and try again.'
          : 'تجاوزت الحد المسموح. انتظر دقيقة وحاول مرة أخرى.';
      } catch {}
      return res.status(200).json({ reply: `⚠️ ${errMsg}` });
    }

    const data = JSON.parse(rawText);
    let reply = data.choices?.[0]?.message?.content
      || (isEn ? 'Unable to respond. Please try again.' : 'لم أتمكن من الرد، يرجى المحاولة مرة أخرى.');

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
    return res.status(200).json({ reply: `⚠️ Technical error: ${err.message}` });
  }
};

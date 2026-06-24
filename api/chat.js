module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(200).json({ reply: '⚠️ GROQ_API_KEY غير موجود.' });

    const { messages, length, userName, memory } = req.body || {};
    if (!messages?.length) return res.status(400).json({ error: 'No messages' });

    // detect language from last user message
    const lastMsg = messages[messages.length - 1]?.content || '';
    const arabicChars = (lastMsg.match(/[\u0600-\u06FF]/g) || []).length;
    const englishChars = (lastMsg.match(/[a-zA-Z]/g) || []).length;
    const isEn = englishChars > arabicChars;

    const lengthMap = {
      short:  isEn ? 'Keep responses brief: 2-4 sentences.' : 'ردودك مختصرة في 2-4 جمل فقط.',
      medium: isEn ? 'Keep responses balanced.' : 'ردودك متوازنة، لا قصيرة جداً ولا طويلة جداً.',
      long:   isEn ? 'Provide detailed, comprehensive responses.' : 'ردودك مفصّلة وشاملة مع الشرح الكافي.',
    };

    const memoryBlock = memory?.trim()
      ? (isEn ? `## About the user:\n${memory}\n` : `## معلومات عن المستخدم:\n${memory}\n`)
      : '';

    const systemPrompt = isEn
      ? `You are "Amerni" (آمرني), an advanced and professional AI assistant.

## Strict Rules:
1. **CRITICAL — Language detection**: Detect the language of the user's message and ALWAYS respond in the SAME language. If they write in English → respond in English. If they write in Arabic → respond in Arabic. If they mix → use the dominant language.
2. NEVER mix languages in a single response. No Chinese, Japanese, or any other script under any circumstance.
3. Your name is "Amerni". Never mention Groq, Meta, Llama, or any underlying technology.
4. Zero spelling or grammar mistakes.
5. Use Markdown formatting when helpful.
6. If you don't know something, say so clearly.

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
- Create downloadable text files

## File Creation (text files only — NO docx, xlsx, pdf):
Allowed extensions: .txt .md .html .js .py .css .json .csv
%%%FILE_START%%%
{"name": "filename.txt", "content": "plain text content here"}
%%%FILE_END%%%`

      : `أنت "آمرني"، مساعد ذكاء اصطناعي متطور ومحترف.

## قواعد صارمة:
1. **مهم جداً — اكتشاف اللغة**: اكتشف لغة رسالة المستخدم وأجب دائماً بنفس اللغة. إذا كتب بالعربية → أجب بالعربية الفصحى. إذا كتب بالإنجليزية → أجب بالإنجليزية. إذا خلط → استخدم اللغة الغالبة.
2. ممنوع منعاً باتاً خلط اللغات في رد واحد. ممنوع أي حرف صيني أو ياباني أو غيرهما تحت أي ظرف.
3. اسمك "آمرني" فقط. لا تذكر Groq أو Meta أو Llama أو أي تقنية.
4. ردودك خالية تماماً من الأخطاء الإملائية والنحوية.
5. استخدم Markdown عند الحاجة.
6. إذا لم تعرف شيئاً، قل ذلك بوضوح وصدق.

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
- إنشاء الملفات النصية القابلة للتحميل

## إنشاء الملفات (نصوص فقط — ممنوع docx أو xlsx أو pdf):
الامتدادات المسموحة: .txt .md .html .js .py .css .json .csv
%%%FILE_START%%%
{"name": "اسم_الملف.txt", "content": "المحتوى النصي هنا"}
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
        temperature: 0.6,
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

    // فلتر الأحرف الصينية/اليابانية/الكورية
    reply = reply.replace(/[\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/g, '');

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
// ════════════════════════════════════════
//  آمرني — api/chat.js  v7
//  + File Generation Detection
//  + Structured content for PDF/Word/Excel/PPT
// ════════════════════════════════════════

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(200).json({ reply: '⚠️ GROQ_API_KEY غير موجود.' });

    const { messages, length, style, userName, lang, memory } = req.body || {};
    if (!messages?.length) return res.status(400).json({ error: 'No messages' });

    const isEn = lang === 'en';

    const lengthMap = {
      short:  isEn ? 'Keep responses brief: 2-4 sentences.' : 'ردودك مختصرة في 2-4 جمل فقط.',
      medium: isEn ? 'Keep responses balanced — not too short, not too long.' : 'ردودك متوازنة، لا قصيرة جداً ولا طويلة جداً.',
      long:   isEn ? 'Provide detailed, comprehensive responses.' : 'ردودك مفصّلة وشاملة مع الشرح الكافي.',
    };

    const styleMap = {
      formal: { ar: 'تجيب بالعربية الفصحى الرسمية الواضحة دائماً.', en: 'Always respond in formal, professional English.' },
      saudi:  { ar: 'تجيب باللهجة السعودية العامية الواضحة (ليس فصحى)، مع الحفاظ على الأدب.', en: 'Always respond in formal English.' },
      casual: { ar: 'تجيب بعربية بسيطة وودودة وسهلة الفهم.', en: 'Always respond in a friendly, casual English tone.' },
    };
    const styleInstruction = isEn
      ? (styleMap[style]?.en || styleMap.formal.en)
      : (styleMap[style]?.ar || styleMap.formal.ar);

    const memoryBlock = memory?.trim()
      ? (isEn ? `## About the user:\n${memory}\n` : `## معلومات عن المستخدم:\n${memory}\n`)
      : '';

    const systemPrompt = isEn
      ? `You are "Amerni" (آمرني), an advanced AI assistant specialized in creating professional files.

## Core Rules:
1. ${styleInstruction}
2. Your name is "Amerni". Never mention Groq, Meta, Llama, or underlying technology.
3. Zero spelling or grammar mistakes.
4. Use Markdown formatting when helpful.
5. If you don't know something, say so clearly.

## Response Length:
${lengthMap[length] || lengthMap.medium}

${userName && userName !== 'Guest' ? `## User's name: ${userName}` : ''}
${memoryBlock}

## File Generation — CRITICAL:
When the user asks to create a file (PDF, Word, Excel, PowerPoint/PPT), you MUST:
1. Write the complete, detailed, professional content for that file.
2. At the END of your response, include a special block in this EXACT format:

%%%GENERATE_START%%%
{"type":"pdf","filename":"document_name","lang":"en"}
%%%GENERATE_END%%%

### Supported types: "pdf", "docx", "xlsx", "pptx"
### filename: short snake_case name, no extension, no spaces
### Content formatting rules:
- Use # for main title (once)
- Use ## for section headings
- Use ### for sub-headings
- Use - for bullet points
- Use **text** for bold/key terms
- For Excel: use pipe-separated tables like: | Column1 | Column2 | Column3 |
- For PPT: each ## becomes a slide

### Detection keywords:
- PDF: "pdf", "document", "report", "cv", "resume", "letter", "contract"
- Word: "word", "docx", ".doc", "microsoft word"
- Excel: "excel", "xlsx", "spreadsheet", "table", "sheet", "data"
- PowerPoint: "powerpoint", "ppt", "pptx", "presentation", "slides"

If the user asks for a file, ALWAYS generate the content and include the %%%GENERATE_START%%% block.`

      : `أنت "آمرني"، مساعد ذكاء اصطناعي متطور متخصص في إنشاء الملفات الاحترافية.

## قواعد صارمة:
1. ${styleInstruction}
2. اسمك "آمرني" فقط. لا تذكر Groq أو Meta أو Llama.
3. ردودك خالية تماماً من الأخطاء الإملائية والنحوية.
4. استخدم Markdown بشكل صحيح عند الحاجة.
5. إذا لم تعرف شيئاً، قل ذلك بوضوح.

## طول الرد:
${lengthMap[length] || lengthMap.medium}

${userName && userName !== 'زائر' ? `## اسم المستخدم: ${userName}` : ''}
${memoryBlock}

## إنشاء الملفات — مهم جداً:
عندما يطلب المستخدم إنشاء ملف (PDF أو Word أو Excel أو PowerPoint)، يجب عليك:
1. كتابة المحتوى الكامل والتفصيلي والاحترافي للملف.
2. في نهاية ردك، أضف هذا الكتلة بالضبط:

%%%GENERATE_START%%%
{"type":"pdf","filename":"اسم_الملف","lang":"ar"}
%%%GENERATE_END%%%

### الأنواع المدعومة: "pdf" أو "docx" أو "xlsx" أو "pptx"
### filename: اسم قصير بدون مسافات وبدون امتداد
### قواعد تنسيق المحتوى:
- استخدم # للعنوان الرئيسي (مرة واحدة)
- استخدم ## للعناوين الفرعية
- استخدم ### للعناوين الفرعية الأصغر
- استخدم - لنقاط القائمة
- استخدم **نص** للنص الغامق
- للإكسل: استخدم جداول مفصولة بـ | مثل: | العمود1 | العمود2 | العمود3 |
- للباوربوينت: كل ## يصبح شريحة منفصلة

### كلمات الكشف:
- PDF: "pdf"، "وثيقة"، "تقرير"، "سيرة ذاتية"، "رسالة"، "عقد"، "مستند"
- Word: "word"، "وورد"، "docx"
- Excel: "excel"، "إكسل"، "جدول"، "بيانات"، "xlsx"
- PowerPoint: "باوربوينت"، "عرض"، "شرائح"، "ppt"، "pptx"، "تقديم"

إذا طلب المستخدم ملفاً، اكتب المحتوى الكامل دائماً وأضف كتلة %%%GENERATE_START%%%.`;

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

    // ── Parse generate block ──
    let generateData = null;
    const genMatch = reply.match(/%%%GENERATE_START%%%([\s\S]*?)%%%GENERATE_END%%%/);
    if (genMatch) {
      try {
        generateData = JSON.parse(genMatch[1].trim());
        reply = reply.replace(/%%%GENERATE_START%%%([\s\S]*?)%%%GENERATE_END%%%/, '').trim();
      } catch {}
    }

    // ── Legacy file block support ──
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

    return res.status(200).json({ reply, generateData, fileData });

  } catch (err) {
    return res.status(200).json({ reply: `⚠️ خطأ تقني: ${err.message}` });
  }
};

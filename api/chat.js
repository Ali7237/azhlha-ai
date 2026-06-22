export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(200).json({ reply: '⚠️ GEMINI_API_KEY غير موجود.' });

    const { messages, imageBase64, mimeType, style, length, userName } = req.body || {};
    if (!messages?.length) return res.status(400).json({ error: 'ما في رسائل' });

    const styleInstructions = {
      saudi: `أسلوبك سعودي عامي طبيعي 100%. تحكي مثل شخص من السعودية: تستخدم كلمات زي "وش"، "زين"، "يلا"، "خلاص"، "ترا"، "والله"، "صح". ردودك خفيفة وودية، مو رسمية أبداً. تتكيف مع أسلوب الشخص. ما تقول "يسعدني" أو "بكل سرور".`,
      formal: `أسلوبك العربية الفصحى الرسمية. ردودك دقيقة ومنظمة ومحترفة.`,
      casual: `أسلوبك عربي بسيط، وسط بين العامية والفصحى.`,
    };

    const lengthInstructions = {
      short:  `ردودك مختصرة ومباشرة.`,
      medium: `ردودك متوازنة.`,
      long:   `ردودك مفصّلة وشاملة.`,
    };

    const systemPrompt = `أنت آمرني، مساعد ذكاء اصطناعي سعودي متطور. اسمك "آمرني" فقط، ما تقول أنك Gemini أو Google.

${styleInstructions[style] || styleInstructions.saudi}
${lengthInstructions[length] || lengthInstructions.medium}
${userName && userName !== 'زائر' ? `اسم المستخدم: ${userName}` : ''}

قدراتك: كتابة كود، تحليل صور، كتابة مقالات ورسائل وCVs وقصائد، ترجمة، شرح مفاهيم، حل مشاكل، إنشاء ملفات.

قواعد: ما تكذب، لو ما تعرف قل ذلك، ردودك دقيقة إملائياً، استخدم Markdown عند الحاجة.
لو طُلب ملف، ضعه في نهاية ردك هكذا:
%%%FILE_START%%%
{"name": "اسم.txt", "content": "المحتوى"}
%%%FILE_END%%%`;

    const rawContents = messages.map((msg, i) => {
      const parts = [];
      if (i === messages.length - 1 && imageBase64) {
        parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } });
      }
      parts.push({ text: msg.content || ' ' });
      return { role: msg.role === 'assistant' ? 'model' : 'user', parts };
    });

    const contents = [];
    for (const msg of rawContents) {
      if (contents.length > 0 && contents[contents.length - 1].role === msg.role) {
        contents[contents.length - 1].parts.push(...msg.parts);
      } else {
        contents.push(msg);
      }
    }
    if (contents[0]?.role === 'model') contents.shift();

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.85, maxOutputTokens: 4096, topP: 0.95 },
        }),
      }
    );

    const rawText = await geminiRes.text();

    if (!geminiRes.ok) {
      let errMsg = `خطأ ${geminiRes.status}`;
      try {
        const errData = JSON.parse(rawText);
        if (errData.error?.message) errMsg = errData.error.message;
        if (geminiRes.status === 429) errMsg = 'تجاوزت الحد المسموح. انتظر دقيقة وحاول مرة ثانية.';
      } catch {}
      return res.status(200).json({ reply: `⚠️ ${errMsg}` });
    }

    const data = JSON.parse(rawText);
    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'ما قدرت أرد، حاول مرة ثانية.';

    let fileData = null;
    const fileMatch = reply.match(/%%%FILE_START%%%([\s\S]*?)%%%FILE_END%%%/);
    if (fileMatch) {
      try {
        fileData = JSON.parse(fileMatch[1].trim());
        reply = reply.replace(/%%%FILE_START%%%([\s\S]*?)%%%FILE_END%%%/, '').trim();
        if (!reply) reply = `تم إنشاء الملف **${fileData.name}** ✅`;
      } catch {}
    }

    return res.status(200).json({ reply, fileData });

  } catch (err) {
    return res.status(200).json({ reply: `⚠️ خطأ تقني: ${err.message}` });
  }
}

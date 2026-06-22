module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(200).json({ reply: '⚠️ GROQ_API_KEY غير موجود.' });

    const { messages, style, length, userName } = req.body || {};
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

    const systemPrompt = `أنت آمرني، مساعد ذكاء اصطناعي سعودي متطور. اسمك "آمرني" فقط، ما تقول أنك Groq أو Meta أو أي AI ثاني.

${styleInstructions[style] || styleInstructions.saudi}
${lengthInstructions[length] || lengthInstructions.medium}
${userName && userName !== 'زائر' ? `اسم المستخدم: ${userName}` : ''}

قدراتك: كتابة كود، كتابة مقالات ورسائل وCVs وقصائد، ترجمة، شرح مفاهيم، حل مشاكل، إنشاء ملفات.

قواعد: ما تكذب، لو ما تعرف قل ذلك، ردودك دقيقة إملائياً، استخدم Markdown عند الحاجة.
لو طُلب ملف، ضعه في نهاية ردك هكذا:
%%%FILE_START%%%
{"name": "اسم.txt", "content": "المحتوى"}
%%%FILE_END%%%`;

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content || ' ' }))
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
        temperature: 0.85,
        max_tokens: 4096,
      }),
    });

    const rawText = await groqRes.text();

    if (!groqRes.ok) {
      let errMsg = `خطأ ${groqRes.status}`;
      try {
        const errData = JSON.parse(rawText);
        if (errData.error?.message) errMsg = errData.error.message;
        if (groqRes.status === 429) errMsg = 'تجاوزت الحد المسموح. انتظر دقيقة وحاول مرة ثانية.';
      } catch {}
      return res.status(200).json({ reply: `⚠️ ${errMsg}` });
    }

    const data = JSON.parse(rawText);
    let reply = data.choices?.[0]?.message?.content || 'ما قدرت أرد، حاول مرة ثانية.';

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
};

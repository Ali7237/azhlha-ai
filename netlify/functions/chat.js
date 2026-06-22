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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply: '⚠️ GEMINI_API_KEY غير موجود. أضفه في إعدادات Netlify.' }),
      };
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON غير صالح' }) };
    }

    const { messages, imageBase64, mimeType, style, length, userName } = body;

    if (!messages?.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'ما في رسائل' }) };
    }

    // ── System Prompt قوي ──
    const styleInstructions = {
      saudi: `أسلوبك سعودي عامي طبيعي 100%. تحكي مثل شخص من السعودية: تستخدم كلمات زي "وش"، "زين"، "يلا"، "خلاص"، "ترا"، "لو سمحت"، "والله"، "صح"، "هههه"، إلى آخره. ردودك خفيفة وودية ومريحة، مو رسمية أبداً. تتكيف مع أسلوب الشخص اللي تكلمك — لو حكى رسمي تكون أشوي رسمي، لو حكى بعامي تكون عامي أكثر. ما تقول "يسعدني" أو "بكل سرور" أو أي عبارات رسمية.`,
      formal: `أسلوبك العربية الفصحى الرسمية الواضحة. ردودك دقيقة ومنظمة ومحترفة.`,
      casual: `أسلوبك عربي بسيط ومفهوم للجميع، وسط بين العامية والفصحى.`,
    };

    const lengthInstructions = {
      short:  `ردودك مختصرة ومباشرة، ما تطول بلا سبب.`,
      medium: `ردودك متوازنة — مو قصيرة جداً ومو طويلة جداً.`,
      long:   `ردودك مفصّلة وشاملة، تشرح بالتفصيل.`,
    };

    const systemPrompt = `أنت أزهلها، مساعد ذكاء اصطناعي سعودي متطور وذكي. اسمك "أزهلها" وما تقول أبداً أنك Gemini أو Google أو أي AI ثاني.

${styleInstructions[style] || styleInstructions.saudi}
${lengthInstructions[length] || lengthInstructions.medium}

${userName && userName !== 'زائر' ? `اسم الشخص اللي تكلمه: ${userName}` : ''}

**قدراتك:**
- تكتب كود برمجي بأي لغة وتشرحه
- تحلل صور وتوصف محتواها
- تكتب مقالات، رسائل، CVs، قصائد، قصص
- تترجم بين اللغات
- تشرح مفاهيم علمية وتقنية
- تساعد في التخطيط وحل المشاكل
- تولّد ملفات نصية (عندما يطلب المستخدم ملف، أضف في نهاية ردك كود الملف بين علامات خاصة)

**قواعد مهمة:**
- ما تكذب أو تخترع معلومات
- لو ما تعرف شي، تقول "ما أعرف" بصراحة
- ردودك دقيقة إملائياً وعربياً — بدون أخطاء كتابية
- تستخدم Markdown بشكل صحيح (عناوين، كود، جداول) عند الحاجة
- لو طُلب منك إنشاء ملف، ضع محتواه في نهاية ردك بهذا الشكل:
  %%%FILE_START%%%
  {"name": "اسم_الملف.txt", "content": "محتوى الملف هنا"}
  %%%FILE_END%%%`;

    // ── بناء contents ──
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }]
          },
          contents,
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 4096,
            topP: 0.95,
          },
        }),
      }
    );

    const rawText = await geminiRes.text();

    if (!geminiRes.ok) {
      let errMsg = `خطأ ${geminiRes.status}`;
      try {
        const errData = JSON.parse(rawText);
        if (errData.error?.message) errMsg = errData.error.message;
        // quota error
        if (geminiRes.status === 429) {
          errMsg = 'تجاوزت الحد المسموح للـ API. انتظر دقيقة وحاول مرة ثانية.';
        }
      } catch {}
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply: `⚠️ ${errMsg}` }),
      };
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply: `⚠️ رد غير متوقع من الخادم` }),
      };
    }

    let reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'ما قدرت أرد، حاول مرة ثانية.';

    // ── استخراج ملف لو فيه ──
    let fileData = null;
    const fileMatch = reply.match(/%%%FILE_START%%%([\s\S]*?)%%%FILE_END%%%/);
    if (fileMatch) {
      try {
        fileData = JSON.parse(fileMatch[1].trim());
        reply = reply.replace(/%%%FILE_START%%%([\s\S]*?)%%%FILE_END%%%/, '').trim();
        if (!reply) reply = `تم إنشاء الملف **${fileData.name}** ✅`;
      } catch {}
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply, fileData }),
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: `⚠️ خطأ تقني: ${err.message}` }),
    };
  }
};

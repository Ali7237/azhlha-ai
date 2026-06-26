function safeName(name = 'document') {
  return String(name).trim().replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 80) || 'document';
}

function disposition(name, ext) {
  const file = `${safeName(name)}.${ext}`;
  return `attachment; filename="${encodeURIComponent(file)}"`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type = 'txt', content = '', filename = 'document', lang = 'ar' } = req.body || {};
    if (!content) return res.status(400).json({ error: 'Missing content' });

    const normalized = String(type).toLowerCase();
    if (normalized === 'pdf') return sendPrintableHtml(res, content, filename, lang);
    if (normalized === 'docx') return sendDocx(res, content, filename, lang);
    if (normalized === 'xlsx') return sendXlsx(res, content, filename, lang);
    if (normalized === 'pptx') return sendPptx(res, content, filename, lang);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', disposition(filename, 'txt'));
    return res.status(200).send(content);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

function sendPrintableHtml(res, content, filename, lang) {
  const isAr = lang !== 'en';
  const body = markdownToHtml(content);
  const html = `<!doctype html><html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(filename)}</title><style>
  body{font-family:Arial,sans-serif;line-height:1.8;color:#0a1628;margin:40px;direction:${isAr ? 'rtl' : 'ltr'}}
  h1{border-bottom:3px solid #18bfe8;padding-bottom:10px} h2{color:#0788a8;margin-top:28px}
  table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border:1px solid #d7eeee;padding:8px}tr:first-child{background:#eefafa;font-weight:bold}
  @media print{body{margin:22mm}}
  </style></head><body>${body}<script>setTimeout(()=>print(),500)</script></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', disposition(filename, 'html'));
  return res.status(200).send(Buffer.from(html, 'utf8'));
}

async function sendDocx(res, content, filename, lang) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
  const isAr = lang !== 'en';
  const align = isAr ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const children = content.split('\n').filter(Boolean).map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) return new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: align, bidirectional: isAr, children: [new TextRun({ text: trimmed.slice(2), bold: true })] });
    if (trimmed.startsWith('## ')) return new Paragraph({ heading: HeadingLevel.HEADING_2, alignment: align, bidirectional: isAr, children: [new TextRun({ text: trimmed.slice(3), bold: true })] });
    if (trimmed.startsWith('- ')) return new Paragraph({ bullet: { level: 0 }, alignment: align, bidirectional: isAr, children: [new TextRun(trimmed.slice(2))] });
    return new Paragraph({ alignment: align, bidirectional: isAr, children: [new TextRun(trimmed.replace(/\*\*/g, ''))] });
  });
  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', disposition(filename, 'docx'));
  return res.status(200).send(buffer);
}

async function sendXlsx(res, content, filename, lang) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(lang === 'en' ? 'Data' : 'البيانات', { views: [{ rightToLeft: lang !== 'en' }] });
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.includes('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean).filter(c => !/^[-:]+$/.test(c));
      if (cells.length) sheet.addRow(cells);
    } else if (!trimmed.startsWith('#')) {
      sheet.addRow([trimmed.replace(/\*\*/g, '')]);
    }
  }
  sheet.columns.forEach(col => { col.width = 24; });
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', disposition(filename, 'xlsx'));
  return res.status(200).send(buffer);
}

async function sendPptx(res, content, filename, lang) {
  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16X9';
  const sections = content.split(/\n(?=##?\s)/).filter(Boolean);
  for (const section of sections.length ? sections : [content]) {
    const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
    const title = (lines.shift() || filename).replace(/^#+\s*/, '');
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    slide.addText(title, { x: .5, y: .35, w: 9, h: .7, fontSize: 25, bold: true, color: '0A1628', align: lang === 'en' ? 'l' : 'r', rtlMode: lang !== 'en' });
    slide.addText(lines.map(l => l.replace(/^[-*]\s*/, '').replace(/\*\*/g, '')).join('\n'), { x: .7, y: 1.3, w: 8.6, h: 5.2, fontSize: 15, color: '27404A', breakLine: false, fit: 'shrink', rtlMode: lang !== 'en' });
  }
  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.setHeader('Content-Disposition', disposition(filename, 'pptx'));
  return res.status(200).send(buffer);
}

function markdownToHtml(md) {
  const lines = String(md).split('\n');
  let html = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('# ')) html += `<h1>${esc(line.slice(2))}</h1>`;
    else if (line.startsWith('## ')) html += `<h2>${esc(line.slice(3))}</h2>`;
    else if (line.startsWith('### ')) html += `<h3>${esc(line.slice(4))}</h3>`;
    else if (line.startsWith('- ')) html += `<li>${esc(line.slice(2))}</li>`;
    else if (line.includes('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean).filter(c => !/^[-:]+$/.test(c));
      if (cells.length) html += `<tr>${cells.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`;
    } else html += `<p>${esc(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`;
  }
  return html.replace(/(<li>.*?<\/li>)+/gs, '<ul>$&</ul>').replace(/(<tr>.*?<\/tr>)+/gs, '<table>$&</table>');
}

function esc(value = '') {
  return String(value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

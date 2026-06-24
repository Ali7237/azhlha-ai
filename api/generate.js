// ════════════════════════════════════════
//  آمرني — api/generate.js  v8
//  PDF: Pure HTML→PDF via base64 (no font issues)
//  Word: docx ✅  Excel: exceljs ✅  PPT: pptxgenjs ✅
// ════════════════════════════════════════

function contentDisposition(name, ext) {
  const full    = `${name}.${ext}`;
  const ascii   = `${name.replace(/[^\x20-\x7E]/g,'_').replace(/\s+/g,'_')}.${ext}`;
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(full)}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type, content, filename, lang } = req.body || {};
    if (!type || !content) return res.status(400).json({ error: 'Missing type or content' });
    const name = (filename || 'document').trim() || 'document';

    switch (type.toLowerCase()) {
      case 'pdf':  return generatePDF(res, content, name, lang);
      case 'docx': return await generateWord(res, content, name, lang);
      case 'xlsx': return await generateExcel(res, content, name, lang);
      case 'pptx': return await generatePPT(res, content, name, lang);
      default:     return res.status(400).json({ error: `Unsupported: ${type}` });
    }
  } catch (err) {
    console.error('generate error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// ══════════════════════════════════════════════════════════
//  PDF  —  HTML string returned, client converts via print
//  (Server sends an HTML file that auto-prints as PDF)
// ══════════════════════════════════════════════════════════
function generatePDF(res, content, filename, lang) {
  const isAr = lang !== 'en';

  // Parse markdown-like content to HTML
  function toHTML(md) {
    const lines = md.split('\n');
    let html = '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { html += '<div class="spacer"></div>'; continue; }

      if (line.startsWith('# ')) {
        html += `<h1>${esc(line.slice(2))}</h1>`;
      } else if (line.startsWith('## ')) {
        html += `<h2>${esc(line.slice(3))}</h2>`;
      } else if (line.startsWith('### ')) {
        html += `<h3>${esc(line.slice(4))}</h3>`;
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        html += `<li>${esc(line.slice(2))}</li>`;
      } else if (line.startsWith('**') && line.endsWith('**')) {
        html += `<p><strong>${esc(line.slice(2,-2))}</strong></p>`;
      } else if (line.includes('|')) {
        // table row
        const cells = line.split('|').map(c=>c.trim()).filter(c=>c && !c.match(/^[-:]+$/));
        if (cells.length) {
          html += `<tr>${cells.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`;
        }
      } else {
        // inline bold
        const p = esc(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html += `<p>${p}</p>`;
      }
    }
    // wrap orphan <li> in <ul>
    html = html.replace(/(<li>.*?<\/li>\s*)+/gs, m => `<ul>${m}</ul>`);
    // wrap orphan <tr> in <table>
    html = html.replace(/(<tr>.*?<\/tr>\s*)+/gs, m => `<table>${m}</table>`);
    return html;
  }

  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  const bodyHTML = toHTML(content);
  const dir      = isAr ? 'rtl' : 'ltr';
  const fontURL  = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Inter:wght@400;600;700&display=swap';

  const html = `<!DOCTYPE html>
<html lang="${isAr?'ar':'en'}" dir="${dir}">
<head>
<meta charset="UTF-8"/>
<title>${esc(filename)}</title>
<link rel="stylesheet" href="${fontURL}"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  @page { size:A4; margin:2cm 2.2cm; }
  body {
    font-family:${isAr?"'IBM Plex Sans Arabic'":"'Inter'"}, sans-serif;
    font-size:11pt; line-height:1.75; color:#0a1628; direction:${dir};
    background:#fff;
  }
  .header {
    display:flex; align-items:center; justify-content:space-between;
    border-bottom:2px solid #00bfff; padding-bottom:.5cm; margin-bottom:.8cm;
  }
  .header-brand { font-size:10pt; color:#00bfff; font-weight:700; letter-spacing:.05em; }
  .header-title { font-size:10pt; color:#6a8a9a; }
  h1 { font-size:18pt; font-weight:700; color:#0a1628; margin:0 0 .4cm; padding-bottom:.25cm; border-bottom:1.5px solid #00bfff; }
  h2 { font-size:13pt; font-weight:700; color:#0091c7; margin:.6cm 0 .25cm; }
  h3 { font-size:11pt; font-weight:700; color:#0a1628; margin:.4cm 0 .18cm; }
  p  { margin:.22cm 0; }
  ul { padding-${isAr?'right':'left'}:1.2cm; margin:.3cm 0; }
  li { margin:.15cm 0; }
  strong { font-weight:700; }
  table { width:100%; border-collapse:collapse; margin:.4cm 0; font-size:10pt; }
  td, th { border:1px solid #ddf2f2; padding:.2cm .35cm; text-align:${isAr?'right':'left'}; }
  tr:first-child td { background:#e6fffe; font-weight:700; color:#0a1628; }
  tr:nth-child(even) td { background:#f7fffe; }
  .spacer { height:.2cm; }
  .footer {
    position:fixed; bottom:.6cm; left:2.2cm; right:2.2cm;
    border-top:1px solid #ddf2f2; padding-top:.25cm;
    font-size:8pt; color:#94b0c0; text-align:center;
  }
  @media print {
    body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  }
</style>
</head>
<body>
<div class="header">
  <span class="header-brand">AMRNI · آمرني</span>
  <span class="header-title">${esc(filename)}</span>
</div>
${bodyHTML}
<div class="footer">آمرني · AMRNI — amrni.vercel.app</div>
<script>
  // Wait for fonts to load then print
  if (document.fonts) {
    document.fonts.ready.then(() => setTimeout(() => window.print(), 400));
  } else {
    setTimeout(() => window.print(), 1000);
  }
</script>
</body>
</html>`;

  const buf = Buffer.from(html, 'utf8');
  // Send as HTML — browser opens it and auto-triggers print dialog → Save as PDF
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', contentDisposition(filename, 'html'));
  res.setHeader('Content-Length', buf.length);
  return res.status(200).send(buf);
}

// ══════════════════════════════════════
//  WORD — docx
// ══════════════════════════════════════
async function generateWord(res, content, filename, lang) {
  const {
    Document, Packer, Paragraph, TextRun,
    HeadingLevel, AlignmentType, BorderStyle,
    Header, Footer, PageNumber,
  } = require('docx');

  const isAr = lang !== 'en';
  const align = isAr ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const font  = isAr ? 'Arial' : 'Calibri';

  const children = [];
  let inList = false;

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) { children.push(new Paragraph({ text:'', spacing:{ after:80 } })); inList=false; continue; }

    if (line.startsWith('# ')) {
      inList = false;
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1, alignment: align, bidirectional: isAr,
        spacing: { before:280, after:140 },
        children: [new TextRun({ text:line.slice(2), bold:true, size:36, color:'0a1628', font })],
        border: { bottom: { color:'00bfff', size:8, style:BorderStyle.SINGLE } }
      }));
    } else if (line.startsWith('## ')) {
      inList = false;
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2, alignment: align, bidirectional: isAr,
        spacing: { before:200, after:100 },
        children: [new TextRun({ text:line.slice(3), bold:true, size:28, color:'0091c7', font })]
      }));
    } else if (line.startsWith('### ')) {
      inList = false;
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3, alignment: align, bidirectional: isAr,
        spacing: { before:160, after:80 },
        children: [new TextRun({ text:line.slice(4), bold:true, size:24, color:'1a2a3a', font })]
      }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      inList = true;
      children.push(new Paragraph({
        bullet: { level:0 }, alignment: align, bidirectional: isAr,
        spacing: { after:80 },
        children: [new TextRun({ text:line.slice(2), size:22, font, color:'1a2a3a' })]
      }));
    } else if (line.startsWith('**') && line.endsWith('**')) {
      inList = false;
      children.push(new Paragraph({
        alignment: align, bidirectional: isAr, spacing: { after:80 },
        children: [new TextRun({ text:line.slice(2,-2), bold:true, size:22, font, color:'0a1628' })]
      }));
    } else {
      inList = false;
      // Parse inline bold
      const parts = line.split(/(\*\*.+?\*\*)/);
      const runs  = parts.map(p => {
        if (p.startsWith('**') && p.endsWith('**'))
          return new TextRun({ text:p.slice(2,-2), bold:true, size:22, font, color:'0a1628' });
        return new TextRun({ text:p, size:22, font, color:'1a2a3a' });
      });
      children.push(new Paragraph({ alignment:align, bidirectional:isAr, spacing:{ after:100 }, children:runs }));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run:{ font, size:22, color:'1a2a3a' }, paragraph:{ spacing:{ line:360 } } }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: { top:1080, bottom:1080, left:1200, right:1200 },
          textDirection: isAr ? 'rtlGrid' : undefined,
        }
      },
      headers: { default: new Header({ children:[
        new Paragraph({
          alignment: AlignmentType.CENTER, bidirectional: isAr,
          border: { bottom:{ color:'00bfff', size:6, style:BorderStyle.SINGLE } },
          children: [new TextRun({ text:'AMRNI · آمرني', size:18, color:'00bfff', font })]
        })
      ]})},
      footers: { default: new Footer({ children:[
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: isAr ? 'صفحة ' : 'Page ', size:16, color:'94b0c0', font }),
            new TextRun({ children:[PageNumber.CURRENT], size:16, color:'94b0c0' }),
          ]
        })
      ]})},
      children
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', contentDisposition(filename, 'docx'));
  res.setHeader('Content-Length', buffer.length);
  return res.status(200).send(buffer);
}

// ══════════════════════════════════════
//  EXCEL — exceljs
// ══════════════════════════════════════
async function generateExcel(res, content, filename, lang) {
  const ExcelJS = require('exceljs');
  const isAr    = lang !== 'en';
  const wb      = new ExcelJS.Workbook();
  wb.creator    = 'AMRNI';

  const sheetName = isAr ? 'البيانات' : 'Data';
  const ws = wb.addWorksheet(sheetName, {
    properties: { tabColor:{ argb:'FF00bfff' } },
    views: [{ rightToLeft: isAr }]
  });

  let headerDone = false;
  let rowIdx     = 1;

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    if (line.includes('|')) {
      const cells = line.split('|').map(c=>c.trim()).filter(c=>c && !c.match(/^[-:]+$/));
      if (!cells.length) continue;
      const row = ws.addRow(cells);

      if (!headerDone) {
        row.height = 28;
        row.eachCell(cell => {
          cell.fill      = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF00bfff' } };
          cell.font      = { bold:true, color:{ argb:'FF062030' }, size:11, name: isAr?'Arial':'Calibri' };
          cell.alignment = { vertical:'middle', horizontal: isAr?'right':'left', readingOrder: isAr?2:1 };
          cell.border    = { bottom:{ style:'medium', color:{ argb:'FF0091c7' } } };
        });
        headerDone = true;
      } else {
        row.height = 22;
        row.eachCell(cell => {
          if (rowIdx%2===0) cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF7FFFE' } };
          cell.font      = { size:10, name: isAr?'Arial':'Calibri', color:{ argb:'FF1a2a3a' } };
          cell.alignment = { vertical:'middle', horizontal: isAr?'right':'left', readingOrder: isAr?2:1 };
          cell.border    = { bottom:{ style:'thin', color:{ argb:'FFddf2f2' } } };
        });
      }
      rowIdx++;
    } else if (line.startsWith('#')) {
      const title = line.replace(/^#+\s*/,'');
      const row   = ws.addRow([title]);
      row.height  = 30;
      const cell  = row.getCell(1);
      cell.font      = { bold:true, size:13, color:{ argb:'FF0a1628' }, name: isAr?'Arial':'Calibri' };
      cell.fill      = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFe3f8f8' } };
      cell.alignment = { vertical:'middle', horizontal: isAr?'right':'left', readingOrder: isAr?2:1 };
      headerDone = false; rowIdx = 1;
    } else {
      const row = ws.addRow([line]);
      row.height = 20;
      row.getCell(1).font      = { size:10, name: isAr?'Arial':'Calibri', color:{ argb:'FF1a2a3a' } };
      row.getCell(1).alignment = { horizontal: isAr?'right':'left', readingOrder: isAr?2:1 };
      rowIdx++;
    }
  }

  // Auto-fit columns
  ws.columns.forEach(col => {
    let max = 10;
    col.eachCell({ includeEmpty:false }, cell => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 4, 55);
  });

  ws.views = [{ state:'frozen', ySplit:1, rightToLeft: isAr }];

  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', contentDisposition(filename, 'xlsx'));
  res.setHeader('Content-Length', buffer.length);
  return res.status(200).send(buffer);
}

// ══════════════════════════════════════
//  POWERPOINT — pptxgenjs
// ══════════════════════════════════════
async function generatePPT(res, content, filename, lang) {
  const PptxGenJS = require('pptxgenjs');
  const isAr      = lang !== 'en';
  const prs       = new PptxGenJS();
  prs.author      = 'AMRNI';
  prs.layout      = 'LAYOUT_16x9';

  const C  = { bg:'FFFFFF', accent:'00bfff', text:'0a1628', sub:'4a6580', light:'f0fffe' };
  const rtl = isAr ? { rtlMode:true } : {};
  const al  = isAr ? 'r' : 'l';
  const ff  = isAr ? 'Arial' : 'Calibri';

  // Parse into sections
  const sections = [];
  let cur = null;
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('# ')) {
      if (cur) sections.push(cur);
      cur = { title:line.slice(2), sub:'', bullets:[], type:'cover' };
    } else if (line.startsWith('## ')) {
      if (cur) sections.push(cur);
      cur = { title:line.slice(3), sub:'', bullets:[], type:'content' };
    } else if (line.startsWith('### ')) {
      if (cur) cur.bullets.push({ text:line.slice(4), bold:true });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (cur) cur.bullets.push({ text:line.slice(2), bold:false });
    } else {
      if (!cur) cur = { title:line, sub:'', bullets:[], type:'cover' };
      else if (!cur.sub) cur.sub = line;
      else cur.bullets.push({ text:line, bold:false });
    }
  }
  if (cur) sections.push(cur);
  if (!sections.length) sections.push({ title:filename, sub:content.slice(0,180), bullets:[], type:'cover' });

  sections.forEach((sec, i) => {
    const s = prs.addSlide();
    s.background = { color: C.bg };
    // Top accent bar
    s.addShape(prs.ShapeType.rect, { x:0, y:0, w:'100%', h:.1, fill:{ color:C.accent } });

    if (sec.type === 'cover' && i === 0) {
      // Cover slide
      s.addShape(prs.ShapeType.rect, { x:3.6, y:2.25, w:2.8, h:.06, fill:{ color:C.accent }, line:{ color:C.accent } });
      s.addText(sec.title, { x:.5, y:1.3, w:9, h:1.3, fontSize:34, bold:true, color:C.text, fontFace:ff, align:'c', valign:'middle', ...rtl });
      if (sec.sub)
        s.addText(sec.sub, { x:.5, y:2.8, w:9, h:.75, fontSize:17, color:C.sub, fontFace:ff, align:'c', ...rtl });
      s.addText('AMRNI · آمرني', { x:.3, y:6.8, w:9.4, h:.3, fontSize:9, color:C.accent, align:'c', fontFace:ff });
    } else {
      // Content slide
      s.addShape(prs.ShapeType.rect, { x:0, y:.1, w:'100%', h:1.1, fill:{ color:C.light }, line:{ color:C.light } });
      s.addText(sec.title, { x:.4, y:.15, w:9.2, h:.9, fontSize:22, bold:true, color:C.text, fontFace:ff, align:al, valign:'middle', ...rtl });
      s.addShape(prs.ShapeType.line, { x:.4, y:1.25, w:9.2, h:0, line:{ color:C.accent, width:2 } });

      if (sec.sub)
        s.addText(sec.sub, { x:.4, y:1.38, w:9.2, h:.45, fontSize:12, color:C.sub, fontFace:ff, align:al, ...rtl });

      if (sec.bullets.length) {
        const startY = sec.sub ? 1.9 : 1.45;
        const items  = sec.bullets.slice(0, 8).map(b => ({
          text: b.text,
          options: {
            fontSize:12, color: b.bold ? C.text : '2a3a4a', bold:b.bold,
            bullet: b.bold ? false : { type:'bullet', code:'25CF', color:C.accent },
            indentLevel: b.bold ? 0 : 1, fontFace:ff, ...rtl,
          }
        }));
        s.addText(items, { x:.4, y:startY, w:9.2, h:6.7-startY-.4, valign:'top', lineSpacingMultiple:1.35 });
      }

      s.addText(`${i+1}  |  AMRNI`, { x:.3, y:6.82, w:9.4, h:.28, fontSize:8, color:C.accent, align:'c', fontFace:ff });
    }
  });

  const buffer = await prs.write({ outputType:'nodebuffer' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.setHeader('Content-Disposition', contentDisposition(filename, 'pptx'));
  res.setHeader('Content-Length', buffer.length);
  return res.status(200).send(buffer);
}

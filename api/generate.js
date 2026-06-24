// ════════════════════════════════════════
//  آمرني — api/generate.js
//  File Generation: PDF, Word, Excel, PPT
//  Arabic RTL + Professional Formatting
// ════════════════════════════════════════

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type, content, filename, lang } = req.body || {};
    if (!type || !content) return res.status(400).json({ error: 'Missing type or content' });

    const safeFilename = (filename || 'document').replace(/[^a-zA-Z0-9_\u0600-\u06FF\-]/g, '_');

    switch (type.toLowerCase()) {
      case 'pdf':   return await generatePDF(res, content, safeFilename, lang);
      case 'docx':  return await generateWord(res, content, safeFilename, lang);
      case 'xlsx':  return await generateExcel(res, content, safeFilename, lang);
      case 'pptx':  return await generatePPT(res, content, safeFilename, lang);
      default:      return res.status(400).json({ error: `Unsupported type: ${type}` });
    }
  } catch (err) {
    console.error('generate error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// ══════════════════════════════════════
//  PDF Generation — pdfkit
// ══════════════════════════════════════
async function generatePDF(res, content, filename, lang) {
  const PDFDocument = require('pdfkit');
  const path = require('path');

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    info: { Title: filename, Author: 'آمرني · AMRNI' }
  });

  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));

  await new Promise(resolve => {
    doc.on('end', resolve);

    const isAr = lang !== 'en';
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const margin = 60;
    const contentW = pageW - margin * 2;

    // ── Header bar ──
    doc.rect(0, 0, pageW, 8)
       .fill('#00bfff');

    // ── Logo text ──
    doc.fontSize(11)
       .fillColor('#00bfff')
       .font('Helvetica-Bold')
       .text('AMRNI | \u0622\u0645\u0631\u0646\u064a', margin, 22, { align: isAr ? 'right' : 'left' });

    // ── Divider ──
    doc.moveTo(margin, 42).lineTo(pageW - margin, 42)
       .strokeColor('#e0f5f5').lineWidth(1).stroke();

    // ── Content ──
    let yPos = 60;
    const lines = content.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { yPos += 10; continue; }

      // Heading detection
      if (line.startsWith('# ')) {
        if (yPos > pageH - 120) { doc.addPage(); yPos = 60; }
        doc.fontSize(18).fillColor('#0a1628').font('Helvetica-Bold')
           .text(line.slice(2), margin, yPos, { width: contentW, align: isAr ? 'right' : 'left' });
        yPos += 32;
        doc.moveTo(margin, yPos - 6).lineTo(pageW - margin, yPos - 6)
           .strokeColor('#00bfff').lineWidth(1.5).stroke();
        yPos += 6;
      } else if (line.startsWith('## ')) {
        if (yPos > pageH - 100) { doc.addPage(); yPos = 60; }
        doc.fontSize(14).fillColor('#0099cc').font('Helvetica-Bold')
           .text(line.slice(3), margin, yPos, { width: contentW, align: isAr ? 'right' : 'left' });
        yPos += 26;
      } else if (line.startsWith('### ')) {
        if (yPos > pageH - 90) { doc.addPage(); yPos = 60; }
        doc.fontSize(12).fillColor('#0a1628').font('Helvetica-Bold')
           .text(line.slice(4), margin, yPos, { width: contentW, align: isAr ? 'right' : 'left' });
        yPos += 22;
      } else if (line.startsWith('- ') || line.startsWith('• ')) {
        if (yPos > pageH - 80) { doc.addPage(); yPos = 60; }
        const bulletText = line.slice(2);
        // bullet dot
        doc.circle(isAr ? pageW - margin - 6 : margin + 6, yPos + 6, 2.5)
           .fill('#00bfff');
        doc.fontSize(10).fillColor('#1a2a3a').font('Helvetica')
           .text(bulletText,
             isAr ? margin : margin + 16,
             yPos,
             { width: isAr ? contentW - 16 : contentW - 16, align: isAr ? 'right' : 'left' });
        yPos += doc.heightOfString(bulletText, { width: contentW - 16 }) + 8;
      } else if (line.startsWith('**') && line.endsWith('**')) {
        if (yPos > pageH - 80) { doc.addPage(); yPos = 60; }
        doc.fontSize(10).fillColor('#0a1628').font('Helvetica-Bold')
           .text(line.slice(2, -2), margin, yPos, { width: contentW, align: isAr ? 'right' : 'left' });
        yPos += 20;
      } else {
        if (yPos > pageH - 80) { doc.addPage(); yPos = 60; }
        doc.fontSize(10).fillColor('#1a2a3a').font('Helvetica')
           .text(line, margin, yPos, { width: contentW, align: isAr ? 'right' : 'left' });
        yPos += doc.heightOfString(line, { width: contentW }) + 8;
      }
    }

    // ── Footer ──
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.rect(0, pageH - 30, pageW, 30).fill('#f0fffe');
      doc.moveTo(margin, pageH - 30).lineTo(pageW - margin, pageH - 30)
         .strokeColor('#e0f5f5').lineWidth(0.5).stroke();
      doc.fontSize(8).fillColor('#94b0c0').font('Helvetica')
         .text(`\u0622\u0645\u0631\u0646\u064a · AMRNI`, margin, pageH - 18, { align: 'center', width: contentW });
    }

    doc.end();
  });

  const buffer = Buffer.concat(chunks);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  res.setHeader('Content-Length', buffer.length);
  return res.status(200).send(buffer);
}

// ══════════════════════════════════════
//  Word Generation — docx
// ══════════════════════════════════════
async function generateWord(res, content, filename, lang) {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, BorderStyle, ShadingType, Header,
    Footer, PageNumber, Tab, TabStopType, TabStopLeader,
    convertInchesToTwip, LevelFormat, UnderlineType
  } = require('docx');

  const isAr = lang !== 'en';
  const align = isAr ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const rtl   = isAr;

  const children = [];
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      continue;
    }

    if (line.startsWith('# ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: align,
        bidirectional: rtl,
        spacing: { before: 280, after: 140 },
        children: [new TextRun({
          text: line.slice(2),
          bold: true, size: 36, color: '0a1628',
          font: isAr ? 'Arial' : 'Calibri',
        })],
        border: { bottom: { color: '00bfff', size: 8, style: BorderStyle.SINGLE } }
      }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: align,
        bidirectional: rtl,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({
          text: line.slice(3),
          bold: true, size: 28, color: '0099cc',
          font: isAr ? 'Arial' : 'Calibri',
        })]
      }));
    } else if (line.startsWith('### ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        alignment: align,
        bidirectional: rtl,
        spacing: { before: 160, after: 80 },
        children: [new TextRun({
          text: line.slice(4),
          bold: true, size: 24, color: '1a2a3a',
          font: isAr ? 'Arial' : 'Calibri',
        })]
      }));
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      children.push(new Paragraph({
        bullet: { level: 0 },
        alignment: align,
        bidirectional: rtl,
        spacing: { after: 80 },
        children: [new TextRun({
          text: line.slice(2),
          size: 22,
          font: isAr ? 'Arial' : 'Calibri',
          color: '1a2a3a',
        })]
      }));
    } else if (line.startsWith('**') && line.endsWith('**')) {
      children.push(new Paragraph({
        alignment: align,
        bidirectional: rtl,
        spacing: { after: 80 },
        children: [new TextRun({
          text: line.slice(2, -2),
          bold: true, size: 22,
          font: isAr ? 'Arial' : 'Calibri',
          color: '0a1628',
        })]
      }));
    } else {
      children.push(new Paragraph({
        alignment: align,
        bidirectional: rtl,
        spacing: { after: 100 },
        children: [new TextRun({
          text: line, size: 22,
          font: isAr ? 'Arial' : 'Calibri',
          color: '1a2a3a',
        })]
      }));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: isAr ? 'Arial' : 'Calibri', size: 22, color: '1a2a3a' },
          paragraph: { spacing: { line: 360 } }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1200, right: 1200 },
          textDirection: isAr ? 'rtlGrid' : undefined,
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            bidirectional: rtl,
            border: { bottom: { color: '00bfff', size: 6, style: BorderStyle.SINGLE } },
            children: [new TextRun({
              text: '\u0622\u0645\u0631\u0646\u064a · AMRNI',
              size: 18, color: '00bfff',
              font: isAr ? 'Arial' : 'Calibri',
            })]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: '\u0635\u0641\u062d\u0629 ', size: 16, color: '94b0c0', font: isAr ? 'Arial' : 'Calibri' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '94b0c0' }),
            ]
          })]
        })
      },
      children
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.docx"`);
  res.setHeader('Content-Length', buffer.length);
  return res.status(200).send(buffer);
}

// ══════════════════════════════════════
//  Excel Generation — exceljs
// ══════════════════════════════════════
async function generateExcel(res, content, filename, lang) {
  const ExcelJS = require('exceljs');
  const isAr = lang !== 'en';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'آمرني · AMRNI';

  const sheet = workbook.addWorksheet(
    isAr ? '\u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a' : 'Data',
    { properties: { tabColor: { argb: 'FF00bfff' } },
      views: [{ rightToLeft: isAr }] }
  );

  const lines = content.split('\n').filter(l => l.trim());
  let rowIndex = 1;
  let headerDone = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect table rows (pipe-separated)
    if (line.includes('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c && c !== '---' && !c.match(/^[-:]+$/));
      if (!cells.length) continue;

      const row = sheet.addRow(cells);

      if (!headerDone) {
        // Style header row
        row.height = 28;
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00bfff' } };
          cell.font = { bold: true, color: { argb: 'FF0a1628' }, size: 11, name: isAr ? 'Arial' : 'Calibri' };
          cell.alignment = { vertical: 'middle', horizontal: isAr ? 'right' : 'left', readingOrder: isAr ? 2 : 1 };
          cell.border = {
            bottom: { style: 'medium', color: { argb: 'FF0099cc' } }
          };
        });
        headerDone = true;
      } else {
        row.height = 22;
        const isEven = rowIndex % 2 === 0;
        row.eachCell(cell => {
          if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0fffe' } };
          cell.font = { size: 10, name: isAr ? 'Arial' : 'Calibri', color: { argb: 'FF1a2a3a' } };
          cell.alignment = { vertical: 'middle', horizontal: isAr ? 'right' : 'left', readingOrder: isAr ? 2 : 1 };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFe0f5f5' } }
          };
        });
      }
      rowIndex++;
    } else if (line.startsWith('# ') || line.startsWith('## ')) {
      // Section title
      const title = line.replace(/^#+\s*/, '');
      const row = sheet.addRow([title]);
      row.height = 32;
      const cell = row.getCell(1);
      cell.font = { bold: true, size: 14, color: { argb: 'FF0a1628' }, name: isAr ? 'Arial' : 'Calibri' };
      cell.alignment = { vertical: 'middle', horizontal: isAr ? 'right' : 'left', readingOrder: isAr ? 2 : 1 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe6fffe' } };
      rowIndex++;
      headerDone = false;
    } else {
      // Regular text row
      const row = sheet.addRow([line]);
      row.height = 20;
      row.getCell(1).font = { size: 10, name: isAr ? 'Arial' : 'Calibri', color: { argb: 'FF1a2a3a' } };
      row.getCell(1).alignment = { horizontal: isAr ? 'right' : 'left', readingOrder: isAr ? 2 : 1 };
      rowIndex++;
    }
  }

  // Auto-fit columns
  sheet.columns.forEach(col => {
    let maxLen = 12;
    col.eachCell({ includeEmpty: false }, cell => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 4, 50);
  });

  // Freeze top row
  sheet.views = [{ state: 'frozen', ySplit: 1, rightToLeft: isAr }];

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  res.setHeader('Content-Length', buffer.length);
  return res.status(200).send(buffer);
}

// ══════════════════════════════════════
//  PowerPoint Generation — pptxgenjs
// ══════════════════════════════════════
async function generatePPT(res, content, filename, lang) {
  const PptxGenJS = require('pptxgenjs');
  const isAr = lang !== 'en';

  const prs = new PptxGenJS();
  prs.author  = 'آمرني · AMRNI';
  prs.subject = filename;
  prs.layout  = 'LAYOUT_16x9';

  // Brand theme
  const COLORS = {
    bg:      'FFFFFF',
    accent:  '00bfff',
    accent2: '0099cc',
    text:    '0a1628',
    sub:     '4a6580',
    light:   'f0fffe',
    grad1:   'a8ff78',
  };

  const rtlProps = isAr ? { rtlMode: true } : {};
  const align    = isAr ? 'r' : 'l';
  const fontFace = isAr ? 'Arial' : 'Calibri';

  // Parse content into slides
  const sections = [];
  let current = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('# ')) {
      if (current) sections.push(current);
      current = { title: line.slice(2), subtitle: '', bullets: [], type: 'title' };
    } else if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { title: line.slice(3), subtitle: '', bullets: [], type: 'content' };
    } else if (line.startsWith('### ')) {
      if (current) {
        if (!current.subtitle) current.subtitle = line.slice(4);
        else current.bullets.push({ text: line.slice(4), bold: true });
      }
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      if (current) current.bullets.push({ text: line.slice(2), bold: false });
    } else {
      if (current) {
        if (!current.subtitle && current.type !== 'title') current.subtitle = line;
        else current.bullets.push({ text: line, bold: false });
      } else {
        current = { title: line, subtitle: '', bullets: [], type: 'title' };
      }
    }
  }
  if (current) sections.push(current);

  // Fallback if no sections parsed
  if (!sections.length) {
    sections.push({ title: filename, subtitle: content.slice(0, 200), bullets: [], type: 'title' });
  }

  // ── Generate slides ──
  sections.forEach((sec, idx) => {
    const slide = prs.addSlide();

    // Background
    slide.background = { color: COLORS.bg };

    // Top accent bar (gradient-like)
    slide.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.12, fill: { color: COLORS.accent } });

    if (sec.type === 'title' && idx === 0) {
      // ── Title slide ──
      // Center accent shape
      slide.addShape(prs.ShapeType.rect, {
        x: 3.5, y: 2.2, w: 3, h: 0.06,
        fill: { color: COLORS.accent }, line: { color: COLORS.accent }
      });

      slide.addText(sec.title, {
        x: 0.5, y: 1.2, w: 9, h: 1.4,
        fontSize: 36, bold: true, color: COLORS.text,
        fontFace, align: 'c', valign: 'middle',
        ...rtlProps,
      });

      if (sec.subtitle) {
        slide.addText(sec.subtitle, {
          x: 0.5, y: 2.8, w: 9, h: 0.8,
          fontSize: 18, color: COLORS.sub,
          fontFace, align: 'c',
          ...rtlProps,
        });
      }

      // Brand footer
      slide.addText('\u0622\u0645\u0631\u0646\u064a · AMRNI', {
        x: 0.3, y: 6.8, w: 9.4, h: 0.35,
        fontSize: 10, color: COLORS.accent, align: 'c', fontFace,
      });

    } else {
      // ── Content slide ──
      // Title area
      slide.addShape(prs.ShapeType.rect, {
        x: 0, y: 0.12, w: '100%', h: 1.15,
        fill: { color: COLORS.light }, line: { color: COLORS.light }
      });

      slide.addText(sec.title, {
        x: 0.4, y: 0.18, w: 9.2, h: 0.95,
        fontSize: 24, bold: true, color: COLORS.text,
        fontFace, align, valign: 'middle',
        ...rtlProps,
      });

      // Accent line under title
      slide.addShape(prs.ShapeType.line, {
        x: 0.4, y: 1.32, w: 9.2, h: 0,
        line: { color: COLORS.accent, width: 2 }
      });

      if (sec.subtitle) {
        slide.addText(sec.subtitle, {
          x: 0.4, y: 1.45, w: 9.2, h: 0.5,
          fontSize: 13, color: COLORS.sub, fontFace, align,
          ...rtlProps,
        });
      }

      // Bullets
      if (sec.bullets.length > 0) {
        const bulletStartY = sec.subtitle ? 2.05 : 1.55;
        const maxBullets = 7;
        const visibleBullets = sec.bullets.slice(0, maxBullets);

        const bulletObjs = visibleBullets.map(b => ({
          text: b.text,
          options: {
            fontSize: 13,
            color: b.bold ? COLORS.text : '2a3a4a',
            bold: b.bold,
            bullet: b.bold ? false : { type: 'bullet', code: '25CF', color: COLORS.accent },
            indentLevel: b.bold ? 0 : 1,
            fontFace,
            ...rtlProps,
          }
        }));

        slide.addText(bulletObjs, {
          x: 0.4, y: bulletStartY, w: 9.2,
          h: 6.8 - bulletStartY - 0.4,
          valign: 'top',
          lineSpacingMultiple: 1.4,
        });
      }

      // Slide number + brand
      slide.addText(`${idx + 1}  |  \u0622\u0645\u0631\u0646\u064a`, {
        x: 0.3, y: 6.85, w: 9.4, h: 0.28,
        fontSize: 9, color: COLORS.accent, align: 'c', fontFace,
      });
    }
  });

  const buffer = await prs.write({ outputType: 'nodebuffer' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pptx"`);
  res.setHeader('Content-Length', buffer.length);
  return res.status(200).send(buffer);
}

import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

const FONT = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
const FONT_BOLD = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');
const NAVY = '#101C35';
const BLUE = '#4568FF';
const MUTED = '#8993A7';

export interface PdfTable { headers: string[]; rows: string[][]; align?: ('left' | 'right')[] }

/** Branded PDF generation (DejaVu Sans covers Mongolian Cyrillic incl. Ө/Ү). */
@Injectable()
export class PdfService {
  render(build: (doc: PDFKit.PDFDocument, h: PdfHelpers) => void, opts: { landscape?: boolean } = {}): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: opts.landscape ? 'landscape' : 'portrait', margin: 40, info: { Producer: 'Orgil', Creator: 'Orgil' } });
      doc.registerFont('regular', FONT);
      doc.registerFont('bold', FONT_BOLD);
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      build(doc, new PdfHelpers(doc));
      doc.end();
    });
  }
}

export class PdfHelpers {
  constructor(private readonly doc: PDFKit.PDFDocument) {}

  header(title: string, subtitle?: string) {
    const d = this.doc;
    d.rect(0, 0, d.page.width, 70).fill(NAVY);
    d.fillColor('#FFFFFF').font('bold').fontSize(18).text('ОРГИЛ', 40, 24);
    d.fillColor('#42D6A4').font('regular').fontSize(9).text('ORGIL FINANCE', 40, 46);
    d.fillColor('#FFFFFF').font('bold').fontSize(13).text(title, 200, 24, { width: d.page.width - 240, align: 'right' });
    if (subtitle) d.font('regular').fontSize(9).fillColor('#C9D2EA').text(subtitle, 200, 44, { width: d.page.width - 240, align: 'right' });
    d.fillColor(NAVY).moveDown(0).y = 95;
  }

  banner(text: string) {
    const d = this.doc;
    const y = d.y;
    d.roundedRect(40, y, d.page.width - 80, 26, 6).fill('#FFF5E3');
    d.fillColor('#9A6400').font('bold').fontSize(9).text(text, 50, y + 8, { width: d.page.width - 100 });
    d.y = y + 36;
    d.fillColor(NAVY);
  }

  kv(rows: [string, string][]) {
    const d = this.doc;
    for (const [k, v] of rows) {
      const y = d.y;
      d.font('regular').fontSize(10).fillColor(MUTED).text(k, 40, y, { width: 220 });
      d.font('bold').fillColor(NAVY).text(v, 260, y, { width: d.page.width - 300, align: 'right' });
      d.moveTo(40, d.y + 4).lineTo(d.page.width - 40, d.y + 4).strokeColor('#E6EAF2').lineWidth(0.5).stroke();
      d.y += 10;
    }
  }

  section(title: string) {
    this.doc.moveDown(0.6).font('bold').fontSize(12).fillColor(BLUE).text(title, 40).moveDown(0.3).fillColor(NAVY);
  }

  paragraph(text: string, size = 9) {
    this.doc.font('regular').fontSize(size).fillColor(NAVY).text(text, 40, undefined, { width: this.doc.page.width - 80, lineGap: 2 });
  }

  table(t: PdfTable) {
    const d = this.doc;
    const width = d.page.width - 80;
    const colW = width / t.headers.length;
    const drawRow = (cells: string[], bold: boolean, fill?: string) => {
      if (d.y > d.page.height - 60) d.addPage();
      const y = d.y;
      if (fill) d.rect(40, y - 3, width, 18).fill(fill);
      cells.forEach((c, i) => {
        d.font(bold ? 'bold' : 'regular').fontSize(8).fillColor(bold ? '#FFFFFF' : NAVY)
          .text(c, 44 + i * colW, y, { width: colW - 8, align: t.align?.[i] ?? 'left', lineBreak: false, ellipsis: true });
      });
      d.y = y + 18;
    };
    drawRow(t.headers, true, NAVY);
    t.rows.forEach((r, idx) => drawRow(r, false, idx % 2 ? '#F5F7FB' : undefined));
  }

  footer(text: string) {
    const d = this.doc;
    d.font('regular').fontSize(7).fillColor(MUTED).text(text, 40, d.page.height - 50, { width: d.page.width - 80, align: 'center' });
  }
}

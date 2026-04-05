import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Build a simple PDF from plain text sections (free pdf-lib).
 */
export async function buildMonthlyPdf({ title, executiveSummary, sections }) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]); // A4
  const margin = 50;
  let y = 800;
  const lineHeight = 14;
  const maxWidth = 495;

  function addLine(text, bold = false, size = 11) {
    const f = bold ? fontBold : font;
    const words = text.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      const width = f.widthOfTextAtSize(test, size);
      if (width > maxWidth && line) {
        if (y < margin + 40) {
          page = pdf.addPage([595.28, 841.89]);
          y = 800;
        }
        page.drawText(line, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.12) });
        y -= lineHeight;
        line = w;
      } else {
        line = test;
      }
    }
    if (line) {
      if (y < margin + 40) {
        page = pdf.addPage([595.28, 841.89]);
        y = 800;
      }
      page.drawText(line, { x: margin, y, size, font: f, color: rgb(0.1, 0.1, 0.12) });
      y -= lineHeight;
    }
  }

  addLine(title, true, 16);
  y -= 8;
  addLine(new Date().toISOString().slice(0, 10), false, 9);
  y -= 12;
  addLine("Executive summary", true, 12);
  for (const para of executiveSummary.split("\n")) {
    if (para.trim()) addLine(para.trim());
  }
  y -= 8;

  for (const sec of sections || []) {
    addLine(sec.title, true, 12);
    y -= 4;
    for (const line of (sec.body || "").split("\n")) {
      if (line.trim()) addLine(line.trim());
    }
    y -= 8;
  }

  addLine("Disclaimer: Internal operational summary. Not medical advice.", false, 8);
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

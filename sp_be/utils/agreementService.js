const { getBrandName } = require('./featureFlags');

// Stateless Owner Agreement PDF, generated on demand from DB rows (nothing
// stored). Mirrors the Booking Bill rendering (pdfkit, A4).
function pdfDoc() {
  const PDFDocument = require('pdfkit');
  return new PDFDocument({ size: 'A4', margin: 48 });
}

function collectPdf(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

async function renderAgreementPdf(agreement, plan) {
  const doc = pdfDoc();
  const brand = await getBrandName();

  doc.font('Helvetica-Bold').fontSize(20).text(`${brand}`, { align: 'center' });
  doc.font('Helvetica').fontSize(12).text(agreement.title, { align: 'center' });
  doc.moveDown(1.5);

  if (plan) {
    doc.font('Helvetica-Bold').fontSize(11).text('Plan');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Term: ${plan.name} (${plan.term_days} days)`);
    doc.text(`Price: ${plan.price_lkr > 0 ? `LKR ${plan.price_lkr}` : 'Free'}`);
    doc.text(`Start: ${plan.start_date}   End: ${plan.end_date}`);
    doc.moveDown(1);
  }

  doc.font('Helvetica').fontSize(11).text(agreement.body, { align: 'left' });
  doc.moveDown(2);

  doc.font('Helvetica-Bold').fontSize(10).text('Acceptance');
  doc.font('Helvetica').fontSize(9).text(
    `By accepting this agreement in the console, the venue owner agrees to the terms above.`,
    { align: 'left' }
  );

  return collectPdf(doc);
}

module.exports = { renderAgreementPdf };
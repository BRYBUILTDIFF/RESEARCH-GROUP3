import PDFDocument from 'pdfkit';
import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listCertificates = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const result = await pool.query(
    `
      SELECT
        c.id, c.enrollment_id, c.user_id, c.module_id, c.certificate_no, c.pdf_url, c.issued_at,
        m.title AS module_title
      FROM certificates c
      JOIN modules m ON m.id = c.module_id
      WHERE ($1::boolean = TRUE OR c.user_id = $2)
      ORDER BY c.issued_at DESC;
    `,
    [isAdmin, req.user.id]
  );
  res.json({ certificates: result.rows });
});

export const getCertificateById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';
  const result = await pool.query(
    `
      SELECT
        c.id, c.enrollment_id, c.user_id, c.module_id, c.certificate_no, c.pdf_url, c.issued_at,
        m.title AS module_title
      FROM certificates c
      JOIN modules m ON m.id = c.module_id
      WHERE c.id = $1
        AND ($2::boolean = TRUE OR c.user_id = $3)
      LIMIT 1;
    `,
    [id, isAdmin, req.user.id]
  );
  if (result.rowCount === 0) {
    throw new AppError('Certificate not found.', 404);
  }
  res.json({ certificate: result.rows[0] });
});

export const downloadCertificate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';
  const result = await pool.query(
    `
      SELECT
        c.id, c.enrollment_id, c.user_id, c.module_id, c.certificate_no, c.issued_at,
        m.title AS module_title,
        u.full_name AS learner_name
      FROM certificates c
      JOIN modules m ON m.id = c.module_id
      JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
        AND ($2::boolean = TRUE OR c.user_id = $3)
      LIMIT 1;
    `,
    [id, isAdmin, req.user.id]
  );
  if (result.rowCount === 0) {
    throw new AppError('Certificate not found.', 404);
  }

  const certificate = result.rows[0];
  const safeName = certificate.certificate_no.replace(/[^A-Z0-9-]/gi, '');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);

  const doc = new PDFDocument({
    size: 'A4',
    margin: 60,
  });
  doc.pipe(res);

  doc.fontSize(26).text('HelpDesk Academy', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(18).text('Certificate of Completion', { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(12).text('This certifies that', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(22).text(certificate.learner_name, { align: 'center' });
  doc.moveDown(0.5);
  doc
    .fontSize(12)
    .text(`has successfully completed the module "${certificate.module_title}"`, { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(11).text(`Certificate No: ${certificate.certificate_no}`, { align: 'center' });
  doc
    .fontSize(11)
    .text(`Issued: ${new Date(certificate.issued_at).toLocaleDateString('en-US')}`, { align: 'center' });

  doc.end();
});

const PDFDocument = require("pdfkit");

/**
 * Generates a beautiful dark-themed invoice PDF and returns it as a Buffer.
 * @param {Object} order - The order document
 * @param {Object} userData - { name, email }
 * @returns {Promise<Buffer>}
 */
function generateInvoicePDF(order, userData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 0,
        info: {
          Title: `Invoice ${order.invoiceNumber}`,
          Author: "Readify Digital Library",
          Subject: "Purchase Invoice",
        },
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const W = 595.28; // A4 width
      const H = 841.89; // A4 height

      /* ── Colors ── */
      const BG_DARK = "#0f172a";
      const BG_CARD = "#141832";
      const BG_SECTION = "#0d1225";
      const GOLD = "#f59e0b";
      const GOLD_DARK = "#d97706";
      const WHITE = "#f1f5f9";
      const MUTED = "#94a3b8";
      const SUBTLE = "#64748b";
      const GREEN = "#34d399";
      const GREEN_BG = "#065f46";
      const BORDER = "#1e293b";

      /* ── Full page background ── */
      doc.rect(0, 0, W, H).fill(BG_DARK);

      /* ── Top accent bar ── */
      const grad1 = doc.linearGradient(0, 0, W, 0);
      grad1.stop(0, GOLD).stop(0.5, GOLD_DARK).stop(1, GOLD);
      doc.rect(0, 0, W, 5).fill(grad1);

      /* ═══════════════ HEADER ═══════════════ */
      doc.rect(40, 25, W - 80, 95).lineWidth(1).fillAndStroke(BG_CARD, BORDER);

      // Brand
      doc.fontSize(26).font("Helvetica-Bold").fillColor(GOLD)
        .text("READIFY", 60, 42);
      doc.fontSize(9).font("Helvetica").fillColor(MUTED)
        .text("Digital Library", 60, 72);
      doc.fontSize(8).fillColor(SUBTLE)
        .text("www.readify.app", 60, 86);

      // Invoice title
      doc.fontSize(28).font("Helvetica-Bold").fillColor(WHITE)
        .text("INVOICE", 350, 38, { width: 200, align: "right" });
      doc.fontSize(11).font("Helvetica-Bold").fillColor(GOLD)
        .text(order.invoiceNumber, 350, 70, { width: 200, align: "right" });

      // Status badge
      doc.roundedRect(440, 88, 70, 20, 10).fill(GREEN_BG);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(GREEN)
        .text("✓ PAID", 440, 93, { width: 70, align: "center" });

      /* ═══════════════ META ROW ═══════════════ */
      const metaY = 140;
      doc.rect(40, metaY, W - 80, 68).lineWidth(1).fillAndStroke(BG_SECTION, BORDER);

      const dateStr = new Date(order.createdAt).toLocaleDateString("en-IN", {
        year: "numeric", month: "long", day: "numeric",
      });
      const payLabel = (order.paymentMethod || "upi").toUpperCase();

      // Billed To
      doc.fontSize(7).font("Helvetica-Bold").fillColor(SUBTLE)
        .text("BILLED TO", 60, metaY + 12);
      doc.fontSize(11).font("Helvetica-Bold").fillColor(WHITE)
        .text(userData.name || "Customer", 60, metaY + 26);
      doc.fontSize(8).font("Helvetica").fillColor(MUTED)
        .text(userData.email || "", 60, metaY + 42);

      // Date
      doc.fontSize(7).font("Helvetica-Bold").fillColor(SUBTLE)
        .text("INVOICE DATE", 270, metaY + 12);
      doc.fontSize(10).font("Helvetica-Bold").fillColor(WHITE)
        .text(dateStr, 270, metaY + 28);

      // Payment
      doc.fontSize(7).font("Helvetica-Bold").fillColor(SUBTLE)
        .text("PAYMENT METHOD", 430, metaY + 12);
      doc.fontSize(10).font("Helvetica-Bold").fillColor(WHITE)
        .text(payLabel, 430, metaY + 28);

      /* ═══════════════ ITEMS TABLE ═══════════════ */
      const tableTop = metaY + 88;

      // Table header
      doc.rect(40, tableTop, W - 80, 28).fill("#0a0f1f");
      doc.fontSize(8).font("Helvetica-Bold").fillColor(SUBTLE);
      doc.text("S.NO", 56, tableTop + 9, { width: 30 });
      doc.text("ITEM DESCRIPTION", 100, tableTop + 9, { width: 240 });
      doc.text("QTY", 350, tableTop + 9, { width: 40, align: "center" });
      doc.text("UNIT PRICE", 395, tableTop + 9, { width: 80, align: "right" });
      doc.text("TOTAL", 480, tableTop + 9, { width: 70, align: "right" });

      // Header bottom line
      doc.moveTo(40, tableTop + 28).lineTo(W - 40, tableTop + 28)
        .lineWidth(1.5).stroke(GOLD);

      // Item rows
      let rowY = tableTop + 36;
      const items = order.items || [];
      items.forEach((item, i) => {
        const isAlt = i % 2 === 0;
        doc.rect(40, rowY - 4, W - 80, 36).fill(isAlt ? BG_CARD : BG_SECTION);

        doc.fontSize(9).font("Helvetica").fillColor(MUTED)
          .text(String(i + 1).padStart(2, "0"), 56, rowY + 4, { width: 30 });

        doc.fontSize(10).font("Helvetica-Bold").fillColor(WHITE)
          .text(item.title || "Book", 100, rowY, { width: 230 });
        doc.fontSize(8).font("Helvetica").fillColor(SUBTLE)
          .text(item.author || "Unknown Author", 100, rowY + 15, { width: 230 });

        doc.fontSize(9).font("Helvetica").fillColor(MUTED)
          .text(String(item.quantity || 1), 350, rowY + 6, { width: 40, align: "center" });

        doc.fontSize(9).font("Helvetica").fillColor(MUTED)
          .text(`Rs.${(item.price || 0).toFixed(2)}`, 395, rowY + 6, { width: 80, align: "right" });

        doc.fontSize(10).font("Helvetica-Bold").fillColor(GOLD)
          .text(`Rs.${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`, 480, rowY + 6, { width: 70, align: "right" });

        rowY += 36;
      });

      // Table bottom line
      doc.moveTo(40, rowY).lineTo(W - 40, rowY).lineWidth(0.5).stroke(BORDER);

      /* ═══════════════ TOTALS / GST BREAKDOWN ═══════════════ */
      const totalsY = rowY + 16;
      doc.rect(300, totalsY, W - 340, 170).lineWidth(1).fillAndStroke(BG_SECTION, BORDER);

      let tY = totalsY + 14;
      const totalRow = (label, value, color = MUTED, valColor = WHITE, bold = false) => {
        doc.fontSize(9).font(bold ? "Helvetica-Bold" : "Helvetica").fillColor(color)
          .text(label, 318, tY, { width: 120 });
        doc.fontSize(9).font(bold ? "Helvetica-Bold" : "Helvetica").fillColor(valColor)
          .text(value, 440, tY, { width: 100, align: "right" });
        tY += 18;
      };

      const sub = order.subtotal || 0;
      const cgst = order.cgst || 0;
      const sgst = order.sgst || 0;
      const igst = order.igst || 0;
      const pFee = order.platformFee || 0;
      const disc = order.discount || 0;
      const tot = order.total || 0;

      totalRow("Subtotal", `Rs.${sub.toFixed(2)}`);
      if (cgst > 0) totalRow("CGST (6%)", `Rs.${cgst.toFixed(2)}`);
      if (sgst > 0) totalRow("SGST (6%)", `Rs.${sgst.toFixed(2)}`);
      if (igst > 0) totalRow("IGST (12%)", `Rs.${igst.toFixed(2)}`);
      if (cgst === 0 && sgst === 0 && igst === 0 && order.tax > 0) {
        totalRow("GST (12%)", `Rs.${order.tax.toFixed(2)}`);
      }
      totalRow("Platform Fee (2%)", `Rs.${pFee.toFixed(2)}`);
      if (disc > 0) totalRow("Discount", `-Rs.${disc.toFixed(2)}`, MUTED, GREEN);

      // Divider
      doc.moveTo(318, tY).lineTo(W - 58, tY).lineWidth(1.5).stroke(GOLD);
      tY += 10;

      // Grand total
      doc.fontSize(12).font("Helvetica-Bold").fillColor(WHITE)
        .text("Total Paid", 318, tY, { width: 120 });
      doc.fontSize(16).font("Helvetica-Bold").fillColor(GOLD)
        .text(`Rs.${tot.toFixed(2)}`, 420, tY - 2, { width: 120, align: "right" });

      /* ═══════════════ GST SUMMARY BOX (left side) ═══════════════ */
      const gstBoxY = totalsY;
      doc.rect(40, gstBoxY, 245, 80).lineWidth(1).fillAndStroke(BG_SECTION, BORDER);

      doc.fontSize(8).font("Helvetica-Bold").fillColor(GOLD)
        .text("TAX SUMMARY (GST)", 56, gstBoxY + 10);

      doc.fontSize(8).font("Helvetica").fillColor(SUBTLE)
        .text("Tax Type", 56, gstBoxY + 28, { width: 80 })
        .text("Rate", 150, gstBoxY + 28, { width: 50, align: "center" })
        .text("Amount", 210, gstBoxY + 28, { width: 60, align: "right" });

      doc.moveTo(56, gstBoxY + 40).lineTo(270, gstBoxY + 40).lineWidth(0.5).stroke(BORDER);

      let gstRowY = gstBoxY + 46;
      if (cgst > 0 || (cgst === 0 && igst === 0)) {
        const c = cgst || (order.tax ? order.tax / 2 : 0);
        const s = sgst || (order.tax ? order.tax / 2 : 0);
        doc.fontSize(8).font("Helvetica").fillColor(MUTED)
          .text("CGST", 56, gstRowY).text("6%", 150, gstRowY, { width: 50, align: "center" })
          .text(`Rs.${c.toFixed(2)}`, 210, gstRowY, { width: 60, align: "right" });
        gstRowY += 14;
        doc.text("SGST", 56, gstRowY).text("6%", 150, gstRowY, { width: 50, align: "center" })
          .text(`Rs.${s.toFixed(2)}`, 210, gstRowY, { width: 60, align: "right" });
      } else if (igst > 0) {
        doc.fontSize(8).font("Helvetica").fillColor(MUTED)
          .text("IGST", 56, gstRowY).text("12%", 150, gstRowY, { width: 50, align: "center" })
          .text(`Rs.${igst.toFixed(2)}`, 210, gstRowY, { width: 60, align: "right" });
      }

      /* ═══════════════ NOTE SECTION ═══════════════ */
      const noteY = Math.max(tY + 40, gstBoxY + 100);
      doc.rect(40, noteY, W - 80, 50).lineWidth(1).fillAndStroke(BG_CARD, BORDER);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(GOLD)
        .text("IMPORTANT NOTE", 60, noteY + 10);
      doc.fontSize(7.5).font("Helvetica").fillColor(MUTED)
        .text("This is a computer-generated invoice. Digital books are non-refundable once accessed. For queries, email support@readify.app", 60, noteY + 25, { width: W - 140 });

      /* ═══════════════ FOOTER ═══════════════ */
      const footY = H - 65;
      doc.rect(0, footY, W, 65).fill("#0a0f1f");

      // Footer accent line
      const grad2 = doc.linearGradient(0, footY, W, footY);
      grad2.stop(0, GOLD).stop(0.5, GOLD_DARK).stop(1, GOLD);
      doc.rect(0, footY, W, 2).fill(grad2);

      doc.fontSize(8).font("Helvetica-Bold").fillColor(GOLD)
        .text("READIFY", 60, footY + 16);
      doc.fontSize(7).font("Helvetica").fillColor(SUBTLE)
        .text("Your Digital Library · Premium Book Collection", 60, footY + 30);

      doc.fontSize(7).font("Helvetica").fillColor(SUBTLE)
        .text("support@readify.app", 350, footY + 16, { width: 200, align: "right" })
        .text("© 2026 Readify · All rights reserved", 350, footY + 30, { width: 200, align: "right" });

      // Bottom accent bar
      doc.rect(0, H - 4, W, 4).fill(grad2);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePDF };

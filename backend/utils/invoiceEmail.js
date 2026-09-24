const nodemailer = require("nodemailer");
const { generateInvoicePDF } = require("./invoicePDF");

/* ── Gmail SMTP transporter (reuses same env vars as OTP) ── */
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log("⚠️  Invoice email: credentials not configured");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  return transporter;
}

/* ── Build gorgeous HTML invoice email with GST breakdown ── */
function buildInvoiceHTML(order, userName) {
  const dateStr = new Date(order.createdAt).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const cgst = order.cgst || (order.tax ? order.tax / 2 : 0);
  const sgst = order.sgst || (order.tax ? order.tax / 2 : 0);
  const igst = order.igst || 0;

  const itemRows = order.items
    .map(
      (it, idx) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:#64748b;font-size:13px;width:30px;">${String(idx + 1).padStart(2, '0')}</td>
      <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e2e8f0;font-size:14px;">
        <div style="font-weight:600;color:#f1f5f9;">${it.title}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:2px;">${it.author || "Unknown Author"}</div>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e2e8f0;text-align:center;font-size:14px;">${it.quantity}</td>
      <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e2e8f0;text-align:right;font-size:14px;">₹${(it.price || 0).toFixed(2)}</td>
      <td style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);color:#f59e0b;text-align:right;font-weight:600;font-size:14px;">₹${((it.price || 0) * (it.quantity || 1)).toFixed(2)}</td>
    </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:660px;margin:0 auto;padding:20px;">

    <!-- Top accent -->
    <div style="height:4px;background:linear-gradient(90deg,#f59e0b,#d97706,#f59e0b);border-radius:16px 16px 0 0;"></div>

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a1f3a 0%,#0f172a 100%);padding:40px 32px;text-align:center;border:1px solid rgba(245,158,11,0.2);border-bottom:none;border-top:none;">
      <div style="font-size:32px;font-weight:800;color:#f59e0b;letter-spacing:2px;">📚 READIFY</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:6px;letter-spacing:1px;">DIGITAL LIBRARY</div>
      <div style="margin-top:24px;padding:12px 28px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:50px;display:inline-block;">
        <span style="color:#0f172a;font-size:15px;font-weight:700;">✓ Payment Successful</span>
      </div>
    </div>

    <!-- Invoice Body -->
    <div style="background:linear-gradient(180deg,#141832 0%,#0f172a 100%);padding:32px;border:1px solid rgba(255,255,255,0.06);border-top:none;">

      <!-- Greeting -->
      <div style="margin-bottom:28px;">
        <div style="font-size:20px;font-weight:700;color:#f1f5f9;">Thank you, ${userName}!</div>
        <div style="font-size:14px;color:#94a3b8;margin-top:4px;">Your purchase has been confirmed. Here's your invoice with detailed tax breakdown:</div>
      </div>

      <!-- Invoice Meta -->
      <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
        <tr>
          <td style="padding:16px 20px;background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.15);border-radius:12px 0 0 12px;">
            <div style="font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:1px;">Invoice No.</div>
            <div style="font-size:15px;font-weight:700;color:#f59e0b;margin-top:4px;">${order.invoiceNumber}</div>
          </td>
          <td style="padding:16px 20px;background:rgba(245,158,11,0.05);border-top:1px solid rgba(245,158,11,0.15);border-bottom:1px solid rgba(245,158,11,0.15);">
            <div style="font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:1px;">Date</div>
            <div style="font-size:14px;font-weight:600;color:#e2e8f0;margin-top:4px;">${dateStr}</div>
          </td>
          <td style="padding:16px 20px;background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.15);border-radius:0 12px 12px 0;">
            <div style="font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:1px;">Payment</div>
            <div style="font-size:14px;font-weight:600;color:#e2e8f0;margin-top:4px;text-transform:uppercase;">${order.paymentMethod}</div>
          </td>
        </tr>
      </table>

      <!-- Items Table -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:rgba(15,23,42,0.8);">
            <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:1px;width:30px;">#</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:1px;">Item</th>
            <th style="padding:10px 16px;text-align:center;font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:1px;">Qty</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:1px;">Price</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:1px;border-bottom:2px solid rgba(245,158,11,0.3);">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- GST Breakdown + Totals side by side -->
      <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
        <tr>
          <!-- GST Summary -->
          <td style="vertical-align:top;width:50%;padding-right:10px;">
            <div style="background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.12);border-radius:12px;padding:16px;">
              <div style="font-size:11px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">📋 Tax Summary (GST)</div>
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                  <td style="padding:6px 0;font-size:11px;color:#64748b;">Tax Type</td>
                  <td style="padding:6px 0;font-size:11px;color:#64748b;text-align:center;">Rate</td>
                  <td style="padding:6px 0;font-size:11px;color:#64748b;text-align:right;">Amount</td>
                </tr>
                ${igst > 0 ? `
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#e2e8f0;">IGST</td>
                  <td style="padding:6px 0;font-size:12px;color:#94a3b8;text-align:center;">12%</td>
                  <td style="padding:6px 0;font-size:12px;color:#f59e0b;text-align:right;font-weight:600;">₹${igst.toFixed(2)}</td>
                </tr>` : `
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#e2e8f0;">CGST</td>
                  <td style="padding:6px 0;font-size:12px;color:#94a3b8;text-align:center;">6%</td>
                  <td style="padding:6px 0;font-size:12px;color:#f59e0b;text-align:right;font-weight:600;">₹${cgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#e2e8f0;">SGST</td>
                  <td style="padding:6px 0;font-size:12px;color:#94a3b8;text-align:center;">6%</td>
                  <td style="padding:6px 0;font-size:12px;color:#f59e0b;text-align:right;font-weight:600;">₹${sgst.toFixed(2)}</td>
                </tr>`}
                <tr style="border-top:1px solid rgba(245,158,11,0.15);">
                  <td style="padding:8px 0;font-size:12px;color:#e2e8f0;font-weight:700;">Total Tax</td>
                  <td style="padding:8px 0;font-size:12px;color:#94a3b8;text-align:center;">12%</td>
                  <td style="padding:8px 0;font-size:13px;color:#f59e0b;text-align:right;font-weight:700;">₹${(order.tax || 0).toFixed(2)}</td>
                </tr>
              </table>
            </div>
          </td>
          <!-- Totals -->
          <td style="vertical-align:top;width:50%;padding-left:10px;">
            <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;">
              <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#94a3b8;">
                <span>Subtotal</span><span style="color:#e2e8f0;">₹${(order.subtotal || 0).toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#94a3b8;">
                <span>CGST (6%)</span><span style="color:#e2e8f0;">₹${cgst.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#94a3b8;">
                <span>SGST (6%)</span><span style="color:#e2e8f0;">₹${sgst.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#94a3b8;">
                <span>Platform Fee (2%)</span><span style="color:#e2e8f0;">₹${(order.platformFee || 0).toFixed(2)}</span>
              </div>
              ${order.discount > 0 ? `
              <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#94a3b8;">
                <span>Discount</span><span style="color:#10b981;">-₹${order.discount.toFixed(2)}</span>
              </div>` : ""}
              <div style="border-top:2px solid rgba(245,158,11,0.3);margin-top:10px;padding-top:12px;display:flex;justify-content:space-between;">
                <span style="font-size:16px;font-weight:800;color:#f1f5f9;">Total</span>
                <span style="font-size:20px;font-weight:800;color:#f59e0b;">₹${(order.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="http://localhost:5173/my-library" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#0f172a;font-weight:700;font-size:15px;border-radius:50px;text-decoration:none;">📖 Go to My Library</a>
      </div>

      <!-- PDF Attachment note -->
      <div style="text-align:center;padding:12px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:10px;margin-bottom:20px;">
        <span style="font-size:13px;color:#60a5fa;">📎 A detailed PDF invoice is attached to this email for your records.</span>
      </div>

      <!-- Footer Note -->
      <div style="text-align:center;padding:16px;border-top:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:13px;color:#64748b;">Your books are now available in your library forever.</div>
        <div style="font-size:12px;color:#475569;margin-top:8px;">Questions? Contact us at <a href="mailto:support@readify.app" style="color:#f59e0b;text-decoration:none;">support@readify.app</a></div>
        <div style="font-size:11px;color:#334155;margin-top:16px;">© 2026 Readify • Digital Library</div>
      </div>
    </div>

    <!-- Bottom border -->
    <div style="height:4px;background:linear-gradient(90deg,#f59e0b,#d97706,#f59e0b);border-radius:0 0 16px 16px;"></div>
  </div>
</body>
</html>`;
}

/* ── Send invoice email with PDF attachment ── */
async function sendInvoiceEmail(order, userEmail, userName) {
  const t = getTransporter();
  if (!t) {
    console.log("⚠️  Skipping invoice email — no transporter");
    return false;
  }

  try {
    // Generate PDF
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateInvoicePDF(order, { name: userName, email: userEmail });
    } catch (pdfErr) {
      console.error("⚠️  PDF generation failed, sending email without attachment:", pdfErr.message);
    }

    const mailOptions = {
      from: `"Readify Library" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `🎉 Order Confirmed — Invoice #${order.invoiceNumber}`,
      html: buildInvoiceHTML(order, userName),
    };

    // Attach PDF if generated
    if (pdfBuffer) {
      mailOptions.attachments = [
        {
          filename: `Readify_Invoice_${order.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ];
    }

    await t.sendMail(mailOptions);
    console.log(`✅ Invoice email sent to ${userEmail}${pdfBuffer ? " (with PDF)" : ""}`);
    return true;
  } catch (err) {
    console.error("❌ Invoice email failed:", err.message);
    return false;
  }
}

function buildCancellationHTML({ order, userName, item, reason, refundMethod }) {
  const dateStr = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:20px;">
    <div style="height:4px;background:linear-gradient(90deg,#ef4444,#f59e0b,#ef4444);border-radius:14px 14px 0 0;"></div>
    <div style="background:linear-gradient(180deg,#141832,#0f172a);padding:30px;border:1px solid rgba(239,68,68,.25);border-top:none;">
      <div style="font-size:28px;font-weight:800;color:#f59e0b;letter-spacing:1px;">READIFY</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Cancellation Confirmation</div>

      <div style="margin-top:20px;padding:14px;border-radius:10px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);color:#fecaca;font-size:14px;font-weight:700;">
        Your cancellation request has been processed.
      </div>

      <div style="margin-top:18px;color:#e2e8f0;font-size:14px;line-height:1.6;">
        Hi ${userName},<br/>
        We confirmed your cancellation for the book below. This title is now removed from your active library purchases.
      </div>

      <div style="margin-top:18px;padding:14px;border-radius:10px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.22);">
        <div style="font-size:11px;text-transform:uppercase;color:#94a3b8;letter-spacing:1px;">Book</div>
        <div style="font-size:16px;font-weight:700;color:#f8fafc;margin-top:5px;">${item.title}</div>
        <div style="font-size:13px;color:#94a3b8;margin-top:2px;">${item.author || "Unknown Author"}</div>
        <div style="margin-top:10px;font-size:12px;color:#94a3b8;">Invoice: <span style="color:#f59e0b;font-weight:700;">${order.invoiceNumber}</span></div>
        <div style="margin-top:4px;font-size:12px;color:#94a3b8;">Cancelled on: <span style="color:#e2e8f0;">${dateStr}</span></div>
        <div style="margin-top:4px;font-size:12px;color:#94a3b8;">Refund method: <span style="color:#e2e8f0;text-transform:uppercase;">${refundMethod || item.refundMethodApproved || item.refundMethodRequested || 'UPI'}</span></div>
      </div>

      <div style="margin-top:16px;padding:12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);">
        <div style="font-size:11px;text-transform:uppercase;color:#94a3b8;letter-spacing:1px;">Reason submitted</div>
        <div style="font-size:14px;color:#e2e8f0;margin-top:6px;">${reason}</div>
      </div>

      <div style="margin-top:22px;text-align:center;">
        <a href="http://localhost:5173/my-library" style="display:inline-block;padding:12px 30px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#0f172a;font-weight:700;font-size:14px;border-radius:999px;text-decoration:none;">Open My Library</a>
      </div>

      <div style="margin-top:20px;font-size:12px;color:#64748b;line-height:1.6;">
        If this was not requested by you, contact support at <a href="mailto:support@readify.app" style="color:#f59e0b;text-decoration:none;">support@readify.app</a>.
      </div>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,#ef4444,#f59e0b,#ef4444);border-radius:0 0 14px 14px;"></div>
  </div>
</body>
</html>`;
}

async function sendCancellationEmail({ order, userEmail, userName, item, reason, refundMethod }) {
  const t = getTransporter();
  if (!t) return false;

  try {
    await t.sendMail({
      from: `"Readify Library" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `Cancellation Confirmed - ${item.title}`,
      html: buildCancellationHTML({ order, userName, item, reason, refundMethod }),
    });
    return true;
  } catch (err) {
    console.error("Cancellation email failed:", err.message);
    return false;
  }
}

module.exports = {
  sendInvoiceEmail,
  buildInvoiceHTML,
  sendCancellationEmail,
};

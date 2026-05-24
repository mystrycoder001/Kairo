const crypto = require('crypto');
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  // Enforce CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, email } = req.body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !email) {
    return res.status(400).json({ error: 'Missing required parameters: razorpay_payment_id, razorpay_order_id, razorpay_signature, and email are required.' });
  }

  // 1. Verify Razorpay Payment Signature
  const secret = process.env.RAZORPAY_SECRET;
  if (!secret) {
    console.error('Server Configuration Error: RAZORPAY_SECRET environment variable is missing.');
    return res.status(500).json({ error: 'Server configuration error. Razorpay Secret key is missing.' });
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
  const generatedSignature = hmac.digest('hex');

  if (generatedSignature !== razorpay_signature) {
    console.error(`Signature verification failed for order ${razorpay_order_id}`);
    return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
  }

  console.log(`Payment verified successfully for order: ${razorpay_order_id}, payment: ${razorpay_payment_id}, email: ${email}`);

  // 2. Determine App URL and Direct Download Link
  const appUrl = process.env.APP_URL || (req.headers.host ? `https://${req.headers.host}` : 'https://cloasta.com');
  const downloadLink = `${appUrl}/cloasta-pro.zip`;

  // 3. Draft Email HTML content
  const emailHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Cloasta Pro Download is Ready</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #1a1a1a;
        background-color: #fafafa;
        margin: 0;
        padding: 0;
      }
      .wrapper {
        width: 100%;
        background-color: #fafafa;
        padding: 40px 20px;
        box-sizing: border-box;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background: #ffffff;
        padding: 40px;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.03);
        border: 1px solid #f0f0f0;
      }
      .header {
        text-align: center;
        margin-bottom: 32px;
      }
      .logo {
        font-size: 26px;
        font-weight: 800;
        color: #000000;
        letter-spacing: -0.03em;
        text-decoration: none;
      }
      .logo span {
        color: #a78bfa;
      }
      .hero-title {
        font-size: 22px;
        font-weight: 700;
        color: #111111;
        margin-top: 0;
        margin-bottom: 16px;
        letter-spacing: -0.02em;
      }
      .button-container {
        text-align: center;
        margin: 32px 0;
      }
      .button {
        display: inline-block;
        padding: 16px 36px;
        background: linear-gradient(135deg, #a78bfa, #818cf8);
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 600;
        font-size: 16px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(167, 139, 250, 0.25);
      }
      .warning-box {
        border-left: 4px solid #fbbf24;
        background-color: #fffbeb;
        padding: 18px;
        border-radius: 8px;
        font-size: 14px;
        color: #78350f;
        margin: 24px 0;
      }
      .warning-box strong {
        color: #d97706;
      }
      .guide-section {
        margin: 32px 0;
      }
      .guide-title {
        font-size: 16px;
        font-weight: 700;
        color: #111111;
        margin-bottom: 16px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .steps {
        padding-left: 0;
        list-style: none;
        margin: 0;
      }
      .step-item {
        position: relative;
        padding-left: 36px;
        margin-bottom: 16px;
        font-size: 15px;
        color: #4b5563;
      }
      .step-number {
        position: absolute;
        left: 0;
        top: 2px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: #f3e8ff;
        color: #a78bfa;
        font-weight: 700;
        font-size: 12px;
        line-height: 24px;
        text-align: center;
      }
      .step-item code {
        background-color: #f3f4f6;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;
        color: #1f2937;
      }
      .footer {
        text-align: center;
        font-size: 12px;
        color: #9ca3af;
        margin-top: 40px;
        border-top: 1px solid #f3f4f6;
        padding-top: 24px;
      }
      .support-link {
        color: #818cf8;
        text-decoration: none;
      }
      .support-link:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          <span class="logo">Cloasta<span>Pro</span> ✦</span>
        </div>
        
        <h1 class="hero-title">Your Cloasta Pro Download is Ready ✦</h1>
        <p>Thank you for purchasing lifetime access to Cloasta Pro! Your extension ZIP package is ready for download. Please click the button below to retrieve your file.</p>
        
        <div class="button-container">
          <a href="${downloadLink}" class="button">Download Cloasta Pro</a>
        </div>
        
        <div class="warning-box">
          <strong>Important:</strong> Please uninstall the free version of Cloasta from your browser before installing Cloasta Pro to avoid extension conflicts.
        </div>

        <div class="guide-section">
          <div class="guide-title">Quick Installation Instructions</div>
          <ul class="steps">
            <li class="step-item">
              <span class="step-number">1</span>
              Extract the downloaded <code>cloasta-pro.zip</code> file to a folder on your computer.
            </li>
            <li class="step-item">
              <span class="step-number">2</span>
              Open Google Chrome and navigate to <code>chrome://extensions</code>.
            </li>
            <li class="step-item">
              <span class="step-number">3</span>
              Enable <strong>Developer Mode</strong> using the toggle in the top-right corner.
            </li>
            <li class="step-item">
              <span class="step-number">4</span>
              Click the <strong>Load Unpacked</strong> button and select the extracted folder.
            </li>
          </ul>
        </div>

        <p>If the button doesn't work, you can copy and paste the following link into your browser:<br>
        <span style="font-size: 13px; color: #6b7280; word-break: break-all;">${downloadLink}</span></p>

        <p>If you have any questions, run into issues, or need support, feel free to contact us at <a class="support-link" href="mailto:cloastaofficial@gmail.com">cloastaofficial@gmail.com</a>.</p>
        
        <div class="footer">
          <p>© 2026 Cloasta. All rights reserved.</p>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  // 4. Send Email using Resend or Brevo
  const resendKey = process.env.RESEND_API_KEY;
  const brevoKey = process.env.BREVO_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || 'Cloasta Pro <cloastaofficial@gmail.com>';

  if (resendKey) {
    // --- RESEND EMAIL DELIVERY ---
    try {
      console.log('Attempting to send email via Resend...');
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [email],
          subject: 'Your Cloasta Pro Download is Ready ✦',
          html: emailHtml
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Resend API returned an error');
      }
      console.log('Email sent successfully via Resend:', data.id);
      return res.status(200).json({ success: true, message: 'Payment verified and email sent successfully via Resend.' });
    } catch (err) {
      console.error('Resend delivery failed:', err.message);
      return res.status(500).json({ error: 'Payment verified, but email delivery failed. Please contact support.', details: err.message });
    }
  } else if (brevoKey) {
    // --- BREVO EMAIL DELIVERY ---
    try {
      console.log('Attempting to send email via Brevo...');
      // Extract name and clean email from the "from" header
      let senderName = 'Cloasta Pro';
      let senderEmail = 'noreply@cloasta.com';
      const fromMatch = emailFrom.match(/^(.*?)\s*<(.*?)>$/);
      if (fromMatch) {
        senderName = fromMatch[1].trim();
        senderEmail = fromMatch[2].trim();
      } else if (emailFrom.includes('@')) {
        senderEmail = emailFrom;
      }

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: email }],
          subject: 'Your Cloasta Pro Download is Ready ✦',
          htmlContent: emailHtml
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Brevo API returned status ${response.status}: ${errText}`);
      }
      console.log('Email sent successfully via Brevo.');
      return res.status(200).json({ success: true, message: 'Payment verified and email sent successfully via Brevo.' });
    } catch (err) {
      console.error('Brevo delivery failed:', err.message);
      return res.status(500).json({ error: 'Payment verified, but email delivery failed. Please contact support.', details: err.message });
    }
  } else {
    // --- NO EMAIL CONFIGURATION (LOCAL DEV/SANDBOX WARNING) ---
    console.warn('Warning: Neither RESEND_API_KEY nor BREVO_API_KEY environment variables are set. Email delivery skipped.');
    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully! (Email delivery skipped: RESEND_API_KEY or BREVO_API_KEY environment variable is not configured)',
      download_link: downloadLink
    });
  }
};

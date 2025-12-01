import nodemailer from 'nodemailer';

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Send OTP email
export const sendOTPEmail = async (email: string, otp: string, name: string): Promise<boolean> => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .title { color: #333; font-size: 24px; font-weight: bold; }
            .content { color: #666; line-height: 1.6; margin-bottom: 30px; }
            .otp-box { 
              background-color: #f0f0f0; 
              border: 2px solid #007bff; 
              border-radius: 8px; 
              padding: 20px; 
              text-align: center; 
              margin: 20px 0;
            }
            .otp-code { 
              font-size: 32px; 
              font-weight: bold; 
              color: #007bff; 
              letter-spacing: 4px;
              font-family: 'Courier New', monospace;
            }
            .footer { 
              text-align: center; 
              color: #999; 
              font-size: 12px; 
              border-top: 1px solid #eee; 
              padding-top: 20px; 
            }
            .expiry { color: #e74c3c; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">SeemaIQ - Email Verification</div>
            </div>
            
            <div class="content">
              <p>Hi ${name},</p>
              
              <p>Welcome to SeemaIQ! To complete your signup, please verify your email address by entering the OTP below:</p>
              
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              
              <p>This OTP will expire in <strong>10 minutes</strong>.</p>
              
              <p>If you didn't request this verification, please ignore this email.</p>
              
              <div class="expiry">⏱️ Valid for 10 minutes only</div>
            </div>
            
            <div class="footer">
              <p>© 2025 SeemaIQ. All rights reserved.</p>
              <p>If you have any questions, contact our support team.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'SeemaIQ - Email Verification OTP',
      html: htmlContent,
    });

    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
};

// Verify transporter connection
export const verifyEmailConfig = async (): Promise<boolean> => {
  try {
    await transporter.verify();
    console.log('SMTP connection verified');
    return true;
  } catch (error) {
    console.error('SMTP verification failed:', error);
    return false;
  }
};

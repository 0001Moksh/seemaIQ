import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number.parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

export interface EmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@seemaiq.com",
      ...options,
    })
  } catch (error) {
    console.error("Email send failed:", error)
    throw error
  }
}

export function getWelcomeEmailTemplate(name: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #6366f1; margin: 0; }
          .content { color: #333; line-height: 1.6; }
          .button { background-color: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to SeemaIQ</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Welcome to SeemaIQ! We're excited to help you master your interview skills with our AI-powered practice platform.</p>
            <p>With SeemaIQ, you can:</p>
            <ul>
              <li>Practice realistic interviews with AI interviewers</li>
              <li>Get instant feedback on your communication and technical skills</li>
              <li>Track your progress with detailed performance metrics</li>
              <li>Improve with personalized recommendations</li>
            </ul>
            <p>Let's get started!</p>
            <a href="${process.env.APP_URL}/dashboard" class="button">Start Your First Interview</a>
          </div>
          <div class="footer">
            <p>© 2025 SeemaIQ. Powered By Moksh Bhardwaj</p>
          </div>
        </div>
      </body>
    </html>
  `
}

export function getInterviewCompletionEmailTemplate(
  name: string,
  score: number,
  role: string,
  resultsUrl: string,
): string {
  const getScoreMessage = (score: number) => {
    if (score >= 85) return "Excellent work! You demonstrated outstanding skills."
    if (score >= 70) return "Great job! Keep practicing to reach your goals."
    return "Good effort! Continue practicing to improve further."
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #6366f1; margin: 0; }
          .score-box { 
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            padding: 40px;
            text-align: center;
            border-radius: 10px;
            margin: 30px 0;
          }
          .score-box .score { font-size: 60px; font-weight: bold; }
          .score-box .label { font-size: 18px; opacity: 0.9; }
          .content { color: #333; line-height: 1.6; }
          .button { background-color: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Interview Complete!</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Congratulations on completing your ${role} interview!</p>
            <div class="score-box">
              <div class="score">${score}</div>
              <div class="label">out of 100</div>
            </div>
            <p>${getScoreMessage(score)}</p>
            <p>Check out your detailed results to see your performance breakdown, get personalized improvement recommendations, and track your progress.</p>
            <a href="${resultsUrl}" class="button">View Your Results</a>
          </div>
          <div class="footer">
            <p>© 2025 SeemaIQ. Powered By Moksh Bhardwaj</p>
          </div>
        </div>
      </body>
    </html>
  `
}

export function getPasswordResetEmailTemplate(name: string, resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #6366f1; margin: 0; }
          .content { color: #333; line-height: 1.6; }
          .button { background-color: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
          .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <div class="warning">
              <p><strong>Security Note:</strong> This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
            </div>
          </div>
          <div class="footer">
            <p>© 2025 SeemaIQ. Powered By Moksh Bhardwaj</p>
          </div>
        </div>
      </body>
    </html>
  `
}

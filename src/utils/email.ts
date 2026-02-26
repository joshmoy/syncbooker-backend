import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const MAILEROO_API_KEY = process.env.MAILEROO_API_KEY;
const MAILEROO_DOMAIN_ID = process.env.MAILEROO_DOMAIN_ID;
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM || "noreply@syncbooker.anniversaryhelper.com";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "SyncBooker";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email service using Maileroo API
 */
export const emailService = {
  /**
   * Send an email using Maileroo
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    if (!MAILEROO_API_KEY) {
      console.warn("⚠️ MAILEROO_API_KEY is not defined. Email not sent.");
      console.log(`📧 Email would have been sent to: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      return;
    }

    try {
      await axios.post(
        "https://smtp.maileroo.com/api/v2/emails",
        {
          from: {
            address: EMAIL_FROM_ADDRESS,
            display_name: EMAIL_FROM_NAME,
          },
          to: {
            address: options.to,
          },
          reply_to: {
            address: EMAIL_FROM_ADDRESS,
          },
          subject: options.subject,
          html: options.html,
          plain: options.text || options.html.replace(/<[^>]*>/g, ""),
          tracking: {
            open: false,
            click: false,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": MAILEROO_API_KEY,
          },
        }
      );
      console.log(`✅ Email sent successfully to ${options.to}`);
    } catch (error: any) {
      console.error("❌ Failed to send email via Maileroo:", error.response?.data || error.message);
      // Don't throw error to prevent breaking the main flow
    }
  },

  /**
   * Template for Booking Request (to User)
   */
  async sendBookingRequestEmail(
    userEmail: string,
    userName: string,
    inviteeName: string,
    eventTitle: string,
    startTime: Date
  ): Promise<void> {
    const dateStr = startTime.toLocaleString();
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Booking Request</h2>
        <p>Hi ${userName},</p>
        <p>You have a new booking request for <strong>${eventTitle}</strong>.</p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Invitee:</strong> ${inviteeName}</p>
          <p><strong>Time:</strong> ${dateStr}</p>
        </div>
        <p>Please log in to your dashboard to approve or reject this request.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard/bookings" style="display: inline-block; background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Bookings</a>
      </div>
    `;

    await this.sendEmail({
      to: userEmail,
      subject: `New Booking Request: ${inviteeName}`,
      html,
    });
  },

  /**
   * Template for Booking Request Received (to Invitee)
   */
  async sendBookingRequestReceivedEmail(
    inviteeEmail: string,
    inviteeName: string,
    userName: string,
    eventTitle: string,
    startTime: Date
  ): Promise<void> {
    const dateStr = startTime.toLocaleString();
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Booking Request Received</h2>
        <p>Hi ${inviteeName},</p>
        <p>Your booking request with <strong>${userName}</strong> for <strong>${eventTitle}</strong> has been received.</p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Time:</strong> ${dateStr}</p>
          <p><strong>Status:</strong> Pending Approval</p>
        </div>
        <p>You will receive another email once <strong>${userName}</strong> has reviewed and confirmed your request.</p>
      </div>
    `;

    await this.sendEmail({
      to: inviteeEmail,
      subject: `Request Received: Meeting with ${userName}`,
      html,
    });
  },

  /**
   * Template for Booking Confirmation (to Invitee)
   */
  async sendBookingConfirmedEmail(
    inviteeEmail: string,
    inviteeName: string,
    userName: string,
    eventTitle: string,
    startTime: Date
  ): Promise<void> {
    const dateStr = startTime.toLocaleString();
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Booking Confirmed!</h2>
        <p>Hi ${inviteeName},</p>
        <p>Your booking with <strong>${userName}</strong> for <strong>${eventTitle}</strong> has been confirmed.</p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Time:</strong> ${dateStr}</p>
        </div>
        <p>We've added this to your calendar.</p>
      </div>
    `;

    await this.sendEmail({
      to: inviteeEmail,
      subject: `Confirmed: Meeting with ${userName}`,
      html,
    });
  },

  /**
   * Template for Booking Rejection (to Invitee)
   */
  async sendBookingRejectedEmail(
    inviteeEmail: string,
    inviteeName: string,
    userName: string,
    eventTitle: string,
    startTime: Date
  ): Promise<void> {
    const dateStr = startTime.toLocaleString();
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Booking Cancelled</h2>
        <p>Hi ${inviteeName},</p>
        <p>Unfortunately, your booking request with <strong>${userName}</strong> for <strong>${eventTitle}</strong> at ${dateStr} could not be accepted at this time.</p>
        <p>You can try booking another slot if available.</p>
      </div>
    `;

    await this.sendEmail({
      to: inviteeEmail,
      subject: `Cancelled: Meeting with ${userName}`,
      html,
    });
  },

  /**
   * Template for Password Reset
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string
  ): Promise<void> {
    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:3001"}/reset-password?token=${resetToken}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>You requested a password reset for your SyncBooker account.</p>
        <p>Click the button below to set a new password. This link will expire in 1 hour.</p>
        <a href="${resetLink}" style="display: inline-block; background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;

    await this.sendEmail({
      to: email,
      subject: "Reset your SyncBooker password",
      html,
    });
  },

  /**
   * Template for Welcome Email (on Signup)
   */
  async sendWelcomeEmail(
    email: string,
    name: string
  ): Promise<void> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to SyncBooker, ${name}!</h2>
        <p>We're excited to have you on board. Your account has been successfully created.</p>
        <p>With SyncBooker, you can now:</p>
        <ul>
          <li>Create custom event types</li>
          <li>Set your availability</li>
          <li>Share your personal booking link</li>
          <li>Manage all your meetings in one place</li>
        </ul>
        <p>Ready to get started?</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">If you have any questions, feel free to reply to this email.</p>
      </div>
    `;

    await this.sendEmail({
      to: email,
      subject: "Welcome to SyncBooker!",
      html,
    });
  },
};

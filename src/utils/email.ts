import axios from "axios";
import dotenv from "dotenv";
import { formatDateTimeInTimeZone } from "./timezone";

dotenv.config();

const MAILEROO_API_KEY = process.env.MAILEROO_API_KEY;
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM || "noreply@syncbooker.anniversaryhelper.com";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "SyncBooker";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3001";
const APP_DOMAIN = new URL(FRONTEND_URL).host;
const LOGO_URL = process.env.EMAIL_LOGO_URL || `${FRONTEND_URL}/favicon/android-chrome-192x192.png`;

function emailTemplate(content: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9f9f9; padding: 40px 16px;">
      <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
        <!-- Header -->
        <div style="background: #000000; padding: 28px 32px; text-align: center;">
          <img src="${LOGO_URL}" alt="SyncBooker" width="160" style="display: inline-block;" />
        </div>
        <!-- Body -->
        <div style="padding: 32px;">
          ${content}
        </div>
        <!-- Footer -->
        <div style="padding: 20px 32px; border-top: 1px solid #eeeeee; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #999999;">
            © ${new Date().getFullYear()} SyncBooker · <a href="${FRONTEND_URL}" style="color: #999999;">${APP_DOMAIN}</a>
          </p>
        </div>
      </div>
    </div>
  `;
}

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
    startTime: Date,
    timeZone?: string
  ): Promise<void> {
    const dateStr = formatDateTimeInTimeZone(startTime, timeZone);
    const html = emailTemplate(`
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #111;">New Booking Request</h2>
      <p style="margin: 0 0 12px; color: #333;">Hi ${userName},</p>
      <p style="margin: 0 0 20px; color: #333;">You have a new booking request for <strong>${eventTitle}</strong>.</p>
      <div style="background: #f5f5f5; padding: 16px 20px; border-radius: 8px; margin: 0 0 24px;">
        <p style="margin: 0 0 8px; color: #333;"><strong>Invitee:</strong> ${inviteeName}</p>
        <p style="margin: 0; color: #333;"><strong>Time:</strong> ${dateStr}</p>
      </div>
      <p style="margin: 0 0 24px; color: #333;">Log in to your dashboard to approve or reject this request.</p>
      <a href="${FRONTEND_URL}/dashboard/bookings" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">View Bookings</a>
    `);

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
    startTime: Date,
    timeZone: string | undefined,
    cancelToken: string
  ): Promise<void> {
    const dateStr = formatDateTimeInTimeZone(startTime, timeZone);
    const cancelLink = `${FRONTEND_URL}/cancel/${cancelToken}`;
    const html = emailTemplate(`
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #111;">Booking Request Received</h2>
      <p style="margin: 0 0 12px; color: #333;">Hi ${inviteeName},</p>
      <p style="margin: 0 0 20px; color: #333;">Your booking request with <strong>${userName}</strong> for <strong>${eventTitle}</strong> has been received.</p>
      <div style="background: #f5f5f5; padding: 16px 20px; border-radius: 8px; margin: 0 0 24px;">
        <p style="margin: 0 0 8px; color: #333;"><strong>Time:</strong> ${dateStr}</p>
        <p style="margin: 0; color: #333;"><strong>Status:</strong> Pending Approval</p>
      </div>
      <p style="margin: 0 0 20px; color: #333;">You'll receive another email once <strong>${userName}</strong> has confirmed your request.</p>
      <p style="margin: 0; color: #666; font-size: 13px;">Need to cancel? <a href="${cancelLink}" style="color: #000;">Cancel this request</a></p>
    `);

    await this.sendEmail({
      to: inviteeEmail,
      subject: `Request Received: Meeting with ${userName}`,
      html,
    });
  },

  /**
   * Template for Booking Rescheduled (to Invitee)
   */
  async sendBookingRescheduledEmail(
    inviteeEmail: string,
    inviteeName: string,
    userName: string,
    eventTitle: string,
    newStartTime: Date,
    timeZone?: string,
    meetingLink?: string
  ): Promise<void> {
    const dateStr = formatDateTimeInTimeZone(newStartTime, timeZone);
    const html = emailTemplate(`
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #111;">Your Meeting Has Been Rescheduled</h2>
      <p style="margin: 0 0 12px; color: #333;">Hi ${inviteeName},</p>
      <p style="margin: 0 0 20px; color: #333;">Your meeting with <strong>${userName}</strong> for <strong>${eventTitle}</strong> has been rescheduled to a new time.</p>
      <div style="background: #f5f5f5; padding: 16px 20px; border-radius: 8px; margin: 0 0 24px;">
        <p style="margin: 0 0 8px; color: #333;"><strong>New Time:</strong> ${dateStr}</p>
        ${meetingLink ? `<p style="margin: 0; color: #333;"><strong>Meeting Link:</strong> <a href="${meetingLink}" style="color: #000;">${meetingLink}</a></p>` : ""}
      </div>
      ${meetingLink ? `<a href="${meetingLink}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Join Meeting</a>` : `<p style="margin: 0; color: #333;">Please update your calendar accordingly.</p>`}
    `);

    await this.sendEmail({
      to: inviteeEmail,
      subject: `Rescheduled: Meeting with ${userName}`,
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
    startTime: Date,
    timeZone?: string,
    meetingLink?: string,
    cancelToken?: string
  ): Promise<void> {
    const dateStr = formatDateTimeInTimeZone(startTime, timeZone);
    const cancelLink = cancelToken ? `${FRONTEND_URL}/cancel/${cancelToken}` : null;
    const html = emailTemplate(`
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #111;">Booking Confirmed!</h2>
      <p style="margin: 0 0 12px; color: #333;">Hi ${inviteeName},</p>
      <p style="margin: 0 0 20px; color: #333;">Your booking with <strong>${userName}</strong> for <strong>${eventTitle}</strong> has been confirmed.</p>
      <div style="background: #f5f5f5; padding: 16px 20px; border-radius: 8px; margin: 0 0 24px;">
        <p style="margin: 0 0 8px; color: #333;"><strong>Time:</strong> ${dateStr}</p>
        ${meetingLink ? `<p style="margin: 0; color: #333;"><strong>Meeting Link:</strong> <a href="${meetingLink}" style="color: #000;">${meetingLink}</a></p>` : ""}
      </div>
      ${meetingLink ? `<a href="${meetingLink}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Join Meeting</a>` : `<p style="margin: 0 0 20px; color: #333;">We've added this to your calendar.</p>`}
      ${cancelLink ? `<p style="margin: 16px 0 0; color: #666; font-size: 13px;">Need to cancel? <a href="${cancelLink}" style="color: #000;">Cancel this booking</a></p>` : ""}
    `);

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
    startTime: Date,
    timeZone?: string
  ): Promise<void> {
    const dateStr = formatDateTimeInTimeZone(startTime, timeZone);
    const html = emailTemplate(`
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #111;">Booking Cancelled</h2>
      <p style="margin: 0 0 12px; color: #333;">Hi ${inviteeName},</p>
      <p style="margin: 0 0 20px; color: #333;">Unfortunately, your booking with <strong>${userName}</strong> for <strong>${eventTitle}</strong> at ${dateStr} could not be accepted at this time.</p>
      <p style="margin: 0; color: #333;">You're welcome to try booking another available slot.</p>
    `);

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
    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    const html = emailTemplate(`
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #111;">Reset Your Password</h2>
      <p style="margin: 0 0 12px; color: #333;">You requested a password reset for your SyncBooker account.</p>
      <p style="margin: 0 0 24px; color: #333;">Click the button below to set a new password. This link will expire in 1 hour.</p>
      <a href="${resetLink}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Reset Password</a>
      <p style="margin: 24px 0 0; font-size: 12px; color: #999;">If you didn't request this, you can safely ignore this email.</p>
    `);

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
    const html = emailTemplate(`
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #111;">Welcome to SyncBooker, ${name}!</h2>
      <p style="margin: 0 0 20px; color: #333;">We're excited to have you on board. Your account has been successfully created.</p>
      <p style="margin: 0 0 12px; color: #333;">With SyncBooker, you can now:</p>
      <ul style="margin: 0 0 24px; padding-left: 20px; color: #333;">
        <li style="margin-bottom: 6px;">Create custom event types</li>
        <li style="margin-bottom: 6px;">Set your availability</li>
        <li style="margin-bottom: 6px;">Share your personal booking link</li>
        <li>Manage all your meetings in one place</li>
      </ul>
      <p style="margin: 0 0 24px; color: #333;">Ready to get started?</p>
      <a href="${FRONTEND_URL}/dashboard" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Go to Dashboard</a>
    `);

    await this.sendEmail({
      to: email,
      subject: "Welcome to SyncBooker!",
      html,
    });
  },

  /**
   * Template for Meeting Reminder (24h before) — sent to invitee
   */
  async sendMeetingReminderToInvitee(
    inviteeEmail: string,
    inviteeName: string,
    userName: string,
    eventTitle: string,
    startTime: Date,
    meetingLink?: string
  ): Promise<void> {
    const dateStr = startTime.toLocaleString();
    const html = emailTemplate(`
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #111;">Your Meeting is Tomorrow</h2>
      <p style="margin: 0 0 12px; color: #333;">Hi ${inviteeName},</p>
      <p style="margin: 0 0 20px; color: #333;">Just a reminder that you have a meeting with <strong>${userName}</strong> for <strong>${eventTitle}</strong> coming up soon.</p>
      <div style="background: #f5f5f5; padding: 16px 20px; border-radius: 8px; margin: 0 0 24px;">
        <p style="margin: 0 0 8px; color: #333;"><strong>Time:</strong> ${dateStr}</p>
        ${meetingLink ? `<p style="margin: 0; color: #333;"><strong>Meeting Link:</strong> <a href="${meetingLink}" style="color: #000;">${meetingLink}</a></p>` : ""}
      </div>
      ${meetingLink ? `<a href="${meetingLink}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Join Meeting</a>` : `<p style="margin: 0; color: #333;">We'll see you then!</p>`}
    `);

    await this.sendEmail({
      to: inviteeEmail,
      subject: `Reminder: Meeting with ${userName} tomorrow`,
      html,
    });
  },

  /**
   * Template for Meeting Reminder (24h before) — sent to host
   */
  async sendMeetingReminderToHost(
    userEmail: string,
    userName: string,
    inviteeName: string,
    eventTitle: string,
    startTime: Date
  ): Promise<void> {
    const dateStr = startTime.toLocaleString();
    const html = emailTemplate(`
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #111;">Your Meeting is Tomorrow</h2>
      <p style="margin: 0 0 12px; color: #333;">Hi ${userName},</p>
      <p style="margin: 0 0 20px; color: #333;">Just a reminder that you have a meeting with <strong>${inviteeName}</strong> for <strong>${eventTitle}</strong> coming up soon.</p>
      <div style="background: #f5f5f5; padding: 16px 20px; border-radius: 8px; margin: 0 0 24px;">
        <p style="margin: 0; color: #333;"><strong>Time:</strong> ${dateStr}</p>
      </div>
      <a href="${FRONTEND_URL}/dashboard/bookings" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">View Bookings</a>
    `);

    await this.sendEmail({
      to: userEmail,
      subject: `Reminder: Meeting with ${inviteeName} tomorrow`,
      html,
    });
  },

  /**
   * Template for Pending Booking Nudge (to host, after 24h of inaction)
   */
  async sendPendingBookingNudge(
    userEmail: string,
    userName: string,
    inviteeName: string,
    eventTitle: string,
    startTime: Date
  ): Promise<void> {
    const dateStr = startTime.toLocaleString();
    const html = emailTemplate(`
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #111;">Booking Request Awaiting Your Response</h2>
      <p style="margin: 0 0 12px; color: #333;">Hi ${userName},</p>
      <p style="margin: 0 0 20px; color: #333;">You have a pending booking request from <strong>${inviteeName}</strong> for <strong>${eventTitle}</strong> that hasn't been responded to yet.</p>
      <div style="background: #f5f5f5; padding: 16px 20px; border-radius: 8px; margin: 0 0 24px;">
        <p style="margin: 0 0 8px; color: #333;"><strong>Invitee:</strong> ${inviteeName}</p>
        <p style="margin: 0; color: #333;"><strong>Requested Time:</strong> ${dateStr}</p>
      </div>
      <a href="${FRONTEND_URL}/dashboard/bookings" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Review Request</a>
    `);

    await this.sendEmail({
      to: userEmail,
      subject: `Action needed: Booking request from ${inviteeName}`,
      html,
    });
  },

  /**
   * Template for Email Verification
   */
  async sendEmailVerificationEmail(
    email: string,
    name: string,
    verificationToken: string
  ): Promise<void> {
    const verifyLink = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
    const html = emailTemplate(`
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #111;">Verify Your Email Address</h2>
      <p style="margin: 0 0 12px; color: #333;">Hi ${name},</p>
      <p style="margin: 0 0 24px; color: #333;">Thanks for signing up! Please verify your email address to activate your account and start receiving booking notifications.</p>
      <a href="${verifyLink}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Verify Email Address</a>
      <p style="margin: 24px 0 0; color: #666; font-size: 13px;">This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    `);

    await this.sendEmail({
      to: email,
      subject: "Verify your SyncBooker email address",
      html,
    });
  },
};

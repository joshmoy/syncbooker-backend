import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { getJwtSecret } from "./jwt";

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export const googleCalendarService = {
  /**
   * Create a Google Calendar event with a Meet link
   */
  async createEvent(
    refreshToken: string,
    bookingDetails: {
      title: string;
      description?: string;
      startTime: Date;
      endTime: Date;
      timeZone?: string;
      inviteeEmail: string;
      inviteeName: string;
    }
  ) {
    const calendar = googleAuthService.getClient(refreshToken);

    const event = {
      summary: bookingDetails.title,
      description: bookingDetails.description,
      start: {
        dateTime: bookingDetails.startTime.toISOString(),
        timeZone: bookingDetails.timeZone,
      },
      end: {
        dateTime: bookingDetails.endTime.toISOString(),
        timeZone: bookingDetails.timeZone,
      },
      attendees: [{ email: bookingDetails.inviteeEmail, displayName: bookingDetails.inviteeName }],
      conferenceData: {
        createRequest: {
          requestId: uuidv4(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
      conferenceDataVersion: 1,
    });

    // Google Meet links are sometimes in hangoutLink or conferenceData
    const meetingLink = response.data.hangoutLink || 
                        (response.data.conferenceData?.entryPoints?.find(ep => ep.entryPointType === "video")?.uri);

    return {
      googleEventId: response.data.id,
      meetingLink: meetingLink,
    };
  },

  /**
   * Check for busy periods across a set of time windows using the freebusy API.
   * Returns an array of busy intervals that overlap with the requested windows.
   */
  async checkFreeBusy(
    refreshToken: string,
    windows: Array<{ start: Date; end: Date }>
  ): Promise<Array<{ start: string; end: string }>> {
    const calendar = googleAuthService.getClient(refreshToken);
    const busy: Array<{ start: string; end: string }> = [];

    for (const window of windows) {
      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: window.start.toISOString(),
          timeMax: window.end.toISOString(),
          items: [{ id: "primary" }],
        },
      });
      const periods = response.data.calendars?.["primary"]?.busy ?? [];
      for (const period of periods) {
        if (period.start && period.end) {
          busy.push({ start: period.start, end: period.end });
        }
      }
    }

    return busy;
  },

  /**
   * Delete a Google Calendar event
   */
  async deleteEvent(refreshToken: string, eventId: string) {
    const calendar = googleAuthService.getClient(refreshToken);
    await calendar.events.delete({
      calendarId: "primary",
      eventId: eventId,
    });
  },
};

export const googleAuthService = {
  /**
   * Generate the Google OAuth URL
   */
  getAuthUrl(userId: string, redirectTo?: string): string {
    const state = jwt.sign({ userId, redirectTo }, getJwtSecret(), {
      expiresIn: "10m",
    });
    return oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
      state,
    });
  },

  /**
   * Exchange code for tokens
   */
  async getTokens(code: string) {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  },

  /**
   * Get an authenticated calendar client
   */
  getClient(refreshToken: string) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    client.setCredentials({ refresh_token: refreshToken });
    return google.calendar({ version: "v3", auth: client });
  },
};

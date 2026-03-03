import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
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
      },
      end: {
        dateTime: bookingDetails.endTime.toISOString(),
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
  getAuthUrl(userId: string): string {
    return oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
      state: userId, // Pass userId to identify the user in callback
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

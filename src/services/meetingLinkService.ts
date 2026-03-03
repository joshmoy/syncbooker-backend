import { Booking, BookingStatus } from "../entities/Booking";
import { AppError } from "../middleware/errorHandler";
import { googleCalendarService } from "../utils/google-calendar";

export interface MeetingLinkResult {
  googleEventId: string | null;
  meetingLink: string | null;
}

export async function generateMeetingLink(booking: Booking): Promise<MeetingLinkResult> {
  if (booking.status !== BookingStatus.CONFIRMED) {
    throw new AppError("Meeting links can only be generated for confirmed bookings", 400);
  }
  if (booking.meetingLink) {
    throw new AppError("Booking already has a meeting link", 400);
  }
  if (!booking.eventType.user.googleRefreshToken) {
    throw new AppError("Google Calendar is not connected", 400);
  }

  const googleEvent = await googleCalendarService.createEvent(
    booking.eventType.user.googleRefreshToken,
    {
      title: `${booking.eventType.title}: ${booking.inviteeName}`,
      description: booking.notes || undefined,
      startTime: new Date(booking.startTime),
      endTime: new Date(booking.endTime),
      inviteeEmail: booking.inviteeEmail,
      inviteeName: booking.inviteeName,
    }
  );

  if (!googleEvent.meetingLink) {
    console.warn("Google Calendar event created but no meeting link was returned. Check if Google Meet is enabled for this calendar.");
  }

  return {
    googleEventId: googleEvent.googleEventId || null,
    meetingLink: googleEvent.meetingLink || null,
  };
}

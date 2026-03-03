import cron from "node-cron";
import { Between, IsNull, LessThan } from "typeorm";
import { addHours, subHours } from "date-fns";
import { AppDataSource } from "../config/data-source";
import { Booking, BookingStatus } from "../entities/Booking";
import { emailService } from "./email";

/**
 * Send 24-hour meeting reminders for confirmed bookings.
 * Targets bookings whose startTime falls between 23h and 25h from now
 * that haven't had a reminder sent yet.
 */
async function runMeetingReminders(): Promise<void> {
  const bookingRepository = AppDataSource.getRepository(Booking);
  const now = new Date();
  const windowStart = addHours(now, 23);
  const windowEnd = addHours(now, 25);

  const bookings = await bookingRepository.find({
    where: {
      status: BookingStatus.CONFIRMED,
      meetingReminderSentAt: IsNull(),
      startTime: Between(windowStart, windowEnd),
    },
    relations: ["eventType", "eventType.user"],
  });

  for (const booking of bookings) {
    const host = booking.eventType.user;
    if (!host) continue;

    await Promise.all([
      emailService.sendMeetingReminderToInvitee(
        booking.inviteeEmail,
        booking.inviteeName,
        host.name,
        booking.eventType.title,
        booking.startTime,
        booking.meetingLink ?? undefined
      ),
      emailService.sendMeetingReminderToHost(
        host.email,
        host.name,
        booking.inviteeName,
        booking.eventType.title,
        booking.startTime
      ),
    ]);

    booking.meetingReminderSentAt = now;
    await bookingRepository.save(booking);
    console.log(`📧 Meeting reminder sent for booking ${booking.id}`);
  }
}

/**
 * Nudge hosts who have left a booking request pending for 24+ hours.
 */
async function runPendingReminders(): Promise<void> {
  const bookingRepository = AppDataSource.getRepository(Booking);
  const cutoff = subHours(new Date(), 24);

  const bookings = await bookingRepository.find({
    where: {
      status: BookingStatus.PENDING,
      pendingReminderSentAt: IsNull(),
      createdAt: LessThan(cutoff),
    },
    relations: ["eventType", "eventType.user"],
  });

  for (const booking of bookings) {
    const host = booking.eventType.user;
    if (!host) continue;

    await emailService.sendPendingBookingNudge(
      host.email,
      host.name,
      booking.inviteeName,
      booking.eventType.title,
      booking.startTime
    );

    booking.pendingReminderSentAt = new Date();
    await bookingRepository.save(booking);
    console.log(`📧 Pending nudge sent for booking ${booking.id}`);
  }
}

/**
 * Start all reminder cron jobs.
 * Runs every hour at the top of the hour.
 */
export function startScheduler(): void {
  cron.schedule("0 * * * *", async () => {
    console.log("⏰ Running reminder scheduler...");
    try {
      await runMeetingReminders();
      await runPendingReminders();
    } catch (error) {
      console.error("❌ Scheduler error:", error);
    }
  });

  console.log("✅ Reminder scheduler started (runs hourly)");
}

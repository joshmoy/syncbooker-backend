import { Response, NextFunction } from "express";
import { AppDataSource } from "../config/data-source";
import { Booking, BookingStatus } from "../entities/Booking";
import { EventType } from "../entities/EventType";
import { AuthRequest } from "../middleware/auth";
import { startOfWeek, endOfWeek, subWeeks, isWithinInterval } from "date-fns";

export const getDashboardStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const bookingRepository = AppDataSource.getRepository(Booking);
    const eventTypeRepository = AppDataSource.getRepository(EventType);

    // Get user's event types
    const eventTypes = await eventTypeRepository.find({
      where: { userId },
    });
    const eventTypeIds = eventTypes.map((et) => et.id);

    if (eventTypeIds.length === 0) {
      res.json({
        stats: {
          totalBookings: 0,
          weekBookings: 0,
          eventTypesCount: 0,
          uniqueVisitors: 0,
          totalBookingsChange: "0%",
          weekBookingsChange: "0",
          uniqueVisitorsChange: "0%",
        },
      });
      return;
    }

    // Total bookings (all time)
    const totalBookings = await bookingRepository.count({
      where: eventTypeIds.map((id) => ({ eventTypeId: id, status: BookingStatus.CONFIRMED })),
    });

    // Bookings this week
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const weekBookings = await bookingRepository.count({
      where: eventTypeIds.map((id) => ({
        eventTypeId: id,
        status: BookingStatus.CONFIRMED,
        // We'll filter by date manually or use QueryBuilder for better performance
      })),
    });
    
    // Using QueryBuilder for more complex date filtering
    const allBookings = await bookingRepository.createQueryBuilder("booking")
      .where("booking.eventTypeId IN (:...ids)", { ids: eventTypeIds })
      .andWhere("booking.status = :status", { status: BookingStatus.CONFIRMED })
      .getMany();

    const lastWeekStart = startOfWeek(subWeeks(now, 1));
    const lastWeekEnd = endOfWeek(subWeeks(now, 1));
    const currentWeekBookings = allBookings.filter(b => 
      isWithinInterval(new Date(b.startTime), { start: weekStart, end: weekEnd })
    ).length;

    const lastWeekBookings = allBookings.filter(b => 
      isWithinInterval(new Date(b.startTime), { start: lastWeekStart, end: lastWeekEnd })
    ).length;

    // Calculate Total Bookings Change (comparing current week vs last week)
    let totalChangeStr = "0%";
    if (lastWeekBookings > 0) {
      const change = ((currentWeekBookings - lastWeekBookings) / lastWeekBookings) * 100;
      totalChangeStr = `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`;
    } else if (currentWeekBookings > 0) {
      totalChangeStr = "+100%";
    }

    const weekChange = currentWeekBookings - lastWeekBookings;
    const weekChangeStr = weekChange >= 0 ? `+${weekChange}` : `${weekChange}`;

    // Unique visitors (mocked for now as we don't have a visitors table)
    // In a real app, you'd track this. For now, we'll use unique invitee emails.
    const uniqueInvitees = new Set(allBookings.map(b => b.inviteeEmail)).size;

    res.json({
      stats: {
        totalBookings,
        weekBookings: currentWeekBookings,
        eventTypesCount: eventTypes.length,
        uniqueVisitors: uniqueInvitees,
        totalBookingsChange: totalChangeStr,
        weekBookingsChange: weekChangeStr,
        uniqueVisitorsChange: "+0%", // Placeholder
      },
    });
  } catch (error) {
    next(error);
  }
};

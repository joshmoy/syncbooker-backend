import { Response, NextFunction } from "express";
import { AppDataSource } from "../config/data-source";
import { Booking, BookingStatus } from "../entities/Booking";
import { EventType } from "../entities/EventType";
import { Visitor } from "../entities/Visitor";
import { AuthRequest } from "../middleware/auth";
import { startOfWeek, endOfWeek, subWeeks, isWithinInterval, subDays } from "date-fns";

export const getDashboardStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const bookingRepository = AppDataSource.getRepository(Booking);
    const eventTypeRepository = AppDataSource.getRepository(EventType);
    const visitorRepository = AppDataSource.getRepository(Visitor);

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

    // Real visitor tracking
    const allVisitors = await visitorRepository.find({
      where: { userId },
    });

    const uniqueVisitors = new Set(allVisitors.map(v => v.ipAddress)).size;
    
    // Calculate visitor change (this week vs last week)
    const currentWeekVisitors = allVisitors.filter(v => 
      isWithinInterval(new Date(v.createdAt), { start: weekStart, end: weekEnd })
    ).length;
    
    const lastWeekVisitors = allVisitors.filter(v => 
      isWithinInterval(new Date(v.createdAt), { start: lastWeekStart, end: lastWeekEnd })
    ).length;
    
    let visitorChangeStr = "0%";
    if (lastWeekVisitors > 0) {
      const change = ((currentWeekVisitors - lastWeekVisitors) / lastWeekVisitors) * 100;
      visitorChangeStr = `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`;
    } else if (currentWeekVisitors > 0) {
      visitorChangeStr = "+100%";
    }

    res.json({
      stats: {
        totalBookings,
        weekBookings: currentWeekBookings,
        eventTypesCount: eventTypes.length,
        uniqueVisitors,
        totalBookingsChange: totalChangeStr,
        weekBookingsChange: weekChangeStr,
        uniqueVisitorsChange: visitorChangeStr,
      },
    });
  } catch (error) {
    next(error);
  }
};

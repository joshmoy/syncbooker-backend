import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { EventType } from "./EventType";

export enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
}

@Entity("bookings")
export class Booking {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  eventTypeId: string;

  @ManyToOne(() => EventType, (eventType) => eventType.bookings)
  @JoinColumn({ name: "eventTypeId" })
  eventType: EventType;

  @Column({ type: "varchar", length: 255 })
  inviteeName: string;

  @Column({ type: "varchar", length: 255 })
  inviteeEmail: string;

  @Column({ type: "timestamp" })
  startTime: Date;

  @Column({ type: "timestamp" })
  endTime: Date;

  @Column({
    type: "enum",
    enum: BookingStatus,
    default: BookingStatus.CONFIRMED,
  })
  status: BookingStatus;

  @Column({ type: "text", nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}



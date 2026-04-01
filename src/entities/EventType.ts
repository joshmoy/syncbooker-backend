import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { Booking } from "./Booking";

export interface EventTypeFaq {
  question: string;
  answer: string;
}

@Entity("event_types")
export class EventType {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, (user) => user.eventTypes)
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "int" })
  durationMinutes!: number;

  @Column({ type: "varchar", length: 100, nullable: true })
  color!: string | null;

  @Column({ type: "jsonb", nullable: true })
  faqs!: EventTypeFaq[] | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Booking, (booking) => booking.eventType)
  bookings!: Booking[];
}


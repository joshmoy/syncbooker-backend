import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

@Entity("availabilities")
export class Availability {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne(() => User, (user) => user.availabilities)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "int" })
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  @Column({ type: "time" })
  startTime: string; // Format: HH:mm:ss

  @Column({ type: "time" })
  endTime: string; // Format: HH:mm:ss

  @Column({ type: "varchar", length: 50, default: "UTC" })
  timezone: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}



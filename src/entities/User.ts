import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { EventType } from "./EventType";
import { Availability } from "./Availability";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "varchar", length: 255 })
  passwordHash: string;

  @Column({ type: "varchar", length: 100, nullable: true, unique: true })
  username: string;

  @Column({ type: "text", nullable: true })
  displayPicture: string; // URL or base64 string

  @Column({ type: "text", nullable: true })
  banner: string; // URL or base64 string

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => EventType, (eventType) => eventType.user)
  eventTypes: EventType[];

  @OneToMany(() => Availability, (availability) => availability.user)
  availabilities: Availability[];
}



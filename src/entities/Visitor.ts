import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

@Entity("visitors")
export class Visitor {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({ type: "varchar", length: 255, nullable: true })
  ipAddress!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  userAgent!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  pagePath!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}

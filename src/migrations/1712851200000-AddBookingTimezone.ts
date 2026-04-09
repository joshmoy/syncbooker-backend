import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingTimezone1712851200000 implements MigrationInterface {
  name = "AddBookingTimezone1712851200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "timezone" varchar(50) NOT NULL DEFAULT 'UTC'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN IF EXISTS "timezone"`
    );
  }
}

import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Prevents two non-cancelled bookings for the same event type from ever
 * occupying overlapping time ranges, even under concurrent inserts.
 *
 * Uses a PostgreSQL EXCLUDE constraint with a GiST index over
 * (eventTypeId, [startTime, endTime)). The btree_gist extension is
 * required so the equality operator on UUID can participate in a GiST
 * index alongside the range overlap operator.
 *
 * The range is half-open `[startTime, endTime)` so back-to-back bookings
 * (e.g. 09:00–10:00 and 10:00–11:00) are NOT considered overlapping.
 */
export class AddBookingNoOverlapConstraint1713600000000
  implements MigrationInterface
{
  name = "AddBookingNoOverlapConstraint1713600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    // Defensive: drop any prior version of this constraint before recreating.
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_no_overlap"`
    );

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD CONSTRAINT "bookings_no_overlap"
      EXCLUDE USING gist (
        "eventTypeId" WITH =,
        tsrange("startTime", "endTime", '[)') WITH &&
      )
      WHERE (status <> 'cancelled')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_no_overlap"`
    );
    // We intentionally leave btree_gist installed — other tables may rely on it.
  }
}

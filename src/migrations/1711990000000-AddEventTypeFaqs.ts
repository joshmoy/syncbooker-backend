import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventTypeFaqs1711990000000 implements MigrationInterface {
  name = "AddEventTypeFaqs1711990000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_types" ADD COLUMN IF NOT EXISTS "faqs" jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "event_types" DROP COLUMN IF EXISTS "faqs"`
    );
  }
}

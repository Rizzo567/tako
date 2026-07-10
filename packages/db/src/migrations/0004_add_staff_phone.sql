-- Migration 0004: Add phone field to users

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text;

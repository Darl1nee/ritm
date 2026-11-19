CREATE TABLE `agent_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`token_id` text,
	`tool` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`summary` text NOT NULL,
	`before` text,
	`after` text,
	`undone_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agent_activity_created_idx` ON `agent_activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `mcp_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`prefix` text NOT NULL,
	`scopes` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mcp_tokens_hash_idx` ON `mcp_tokens` (`token_hash`);--> statement-breakpoint
ALTER TABLE `events` ADD `source` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `goals` ADD `source` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `source` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `source` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `source` text DEFAULT 'user' NOT NULL;
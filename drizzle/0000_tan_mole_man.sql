CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`project_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_start_idx` ON `events` (`start_at`);--> statement-breakpoint
CREATE TABLE `focus_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text NOT NULL,
	`duration_min` integer NOT NULL,
	`task_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`target_date` text,
	`category_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'note' NOT NULL,
	`project_id` text,
	`pinned` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `project_sections_project_idx` ON `project_sections` (`project_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'project' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#2e5eff' NOT NULL,
	`emoji` text,
	`start_date` text,
	`due_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`bucket` text DEFAULT 'inbox' NOT NULL,
	`due_date` text,
	`due_time` text,
	`duration_min` integer,
	`priority` integer DEFAULT 0 NOT NULL,
	`category_id` text,
	`project_id` text,
	`section_id` text,
	`goal_id` text,
	`parent_id` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_project_idx` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `tasks_parent_idx` ON `tasks` (`parent_id`);--> statement-breakpoint
CREATE INDEX `tasks_due_idx` ON `tasks` (`due_date`);
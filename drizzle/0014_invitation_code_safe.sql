CREATE TABLE IF NOT EXISTS `invitation_code` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`created_by` text NOT NULL,
	`role` text NOT NULL,
	`mailbox_expiry_ms` integer,
	`used_by` text,
	`used_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`used_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `invitation_code_code_unique` ON `invitation_code` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `invitation_code_code_idx` ON `invitation_code` (`code`);

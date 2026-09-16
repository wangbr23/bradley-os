CREATE TABLE `financial_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`name` text NOT NULL,
	`mask` text,
	`type` text NOT NULL,
	`subtype` text,
	`current_balance` real,
	`available_balance` real,
	`currency_code` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `plaid_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `financial_accounts_item_id` ON `financial_accounts` (`item_id`);--> statement-breakpoint
CREATE TABLE `financial_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`pending` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `financial_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `financial_transactions_account_id_date` ON `financial_transactions` (`account_id`,`date`);--> statement-breakpoint
CREATE TABLE `plaid_items` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`institution_name` text NOT NULL,
	`encrypted_access_token` text NOT NULL,
	`status` text NOT NULL,
	`last_error_code` text,
	`consent_expires_at` integer,
	`dirty` integer DEFAULT false NOT NULL,
	`sync_cursor` text,
	`last_sync_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE TABLE `market_discovery_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`period_key` text NOT NULL,
	`symbol` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `market_discovery_period_idx` ON `market_discovery_cache` (`period_key`);
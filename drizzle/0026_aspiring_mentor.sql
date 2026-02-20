CREATE TABLE `feature_toggles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ftKey` varchar(100) NOT NULL,
	`ftLabel` varchar(255) NOT NULL,
	`ftDescription` text,
	`ftCategory` enum('core','communication','intelligence','operations','experimental') NOT NULL DEFAULT 'core',
	`ftEnabled` boolean NOT NULL DEFAULT true,
	`ftIsLocked` boolean NOT NULL DEFAULT false,
	`ftSortOrder` int NOT NULL DEFAULT 0,
	`ftUpdatedBy` int,
	`ftUpdatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `feature_toggles_id` PRIMARY KEY(`id`),
	CONSTRAINT `feature_toggles_ftKey_unique` UNIQUE(`ftKey`)
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intSlug` varchar(100) NOT NULL,
	`intName` varchar(255) NOT NULL,
	`intDescription` text,
	`intCategory` enum('intelligence','communication','finance','productivity','custom') NOT NULL DEFAULT 'custom',
	`intType` enum('oauth','api_key','webhook','custom') NOT NULL DEFAULT 'api_key',
	`intEnabled` boolean NOT NULL DEFAULT false,
	`intStatus` enum('connected','disconnected','error','pending') NOT NULL DEFAULT 'disconnected',
	`intIconUrl` text,
	`intIconColor` varchar(20),
	`intIconLetter` varchar(5),
	`intApiKey` text,
	`intApiSecret` text,
	`intBaseUrl` varchar(500),
	`intWebhookUrl` text,
	`intWebhookSecret` varchar(500),
	`intOauthConnected` boolean DEFAULT false,
	`intConfig` text,
	`intMetadata` text,
	`intIsBuiltIn` boolean NOT NULL DEFAULT false,
	`intSortOrder` int NOT NULL DEFAULT 0,
	`intLastSyncAt` timestamp,
	`intCreatedBy` int,
	`intCreatedAt` timestamp NOT NULL DEFAULT (now()),
	`intUpdatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `integrations_intSlug_unique` UNIQUE(`intSlug`)
);
--> statement-breakpoint
ALTER TABLE `feature_toggles` ADD CONSTRAINT `feature_toggles_ftUpdatedBy_users_id_fk` FOREIGN KEY (`ftUpdatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integrations` ADD CONSTRAINT `integrations_intCreatedBy_users_id_fk` FOREIGN KEY (`intCreatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ft_key_idx` ON `feature_toggles` (`ftKey`);--> statement-breakpoint
CREATE INDEX `ft_category_idx` ON `feature_toggles` (`ftCategory`);--> statement-breakpoint
CREATE INDEX `int_slug_idx` ON `integrations` (`intSlug`);--> statement-breakpoint
CREATE INDEX `int_category_idx` ON `integrations` (`intCategory`);--> statement-breakpoint
CREATE INDEX `int_enabled_idx` ON `integrations` (`intEnabled`);
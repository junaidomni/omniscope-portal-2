CREATE TABLE `billing_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`type` enum('plan_change','payment','refund','credit','trial_start','trial_end') NOT NULL,
	`amountCents` int NOT NULL DEFAULT 0,
	`fromPlan` varchar(50),
	`toPlan` varchar(50),
	`description` text,
	`performedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	`userId` int,
	`userName` varchar(255),
	`userEmail` varchar(320),
	`accountId` int,
	`accountName` varchar(500),
	`orgId` int,
	`orgName` varchar(500),
	`action` varchar(100) NOT NULL,
	`entityType` varchar(100),
	`entityId` int,
	`details` text,
	`ipAddress` varchar(45),
	CONSTRAINT `platform_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `accountMrrCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `accountTrialEndsAt` timestamp;--> statement-breakpoint
ALTER TABLE `accounts` ADD `accountHealthScore` int DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `accountLastActiveAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `billing_events` ADD CONSTRAINT `billing_events_accountId_accounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_events` ADD CONSTRAINT `billing_events_performedBy_users_id_fk` FOREIGN KEY (`performedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `be_account_idx` ON `billing_events` (`accountId`);--> statement-breakpoint
CREATE INDEX `be_type_idx` ON `billing_events` (`type`);--> statement-breakpoint
CREATE INDEX `be_created_idx` ON `billing_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `pal_timestamp_idx` ON `platform_audit_log` (`timestamp`);--> statement-breakpoint
CREATE INDEX `pal_user_idx` ON `platform_audit_log` (`userId`);--> statement-breakpoint
CREATE INDEX `pal_account_idx` ON `platform_audit_log` (`accountId`);--> statement-breakpoint
CREATE INDEX `pal_org_idx` ON `platform_audit_log` (`orgId`);--> statement-breakpoint
CREATE INDEX `pal_action_idx` ON `platform_audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `pal_entity_idx` ON `platform_audit_log` (`entityType`);
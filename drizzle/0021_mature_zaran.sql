CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` varchar(255) NOT NULL,
	`entityName` varchar(500),
	`details` text,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `activity_user_idx` ON `activity_log` (`userId`);--> statement-breakpoint
CREATE INDEX `activity_action_idx` ON `activity_log` (`action`);--> statement-breakpoint
CREATE INDEX `activity_entity_idx` ON `activity_log` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `activity_created_idx` ON `activity_log` (`createdAt`);
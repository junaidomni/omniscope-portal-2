CREATE TABLE `email_thread_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`threadId` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`summary` text NOT NULL,
	`keyPoints` text,
	`actionItems` text,
	`entities` text,
	`messageCount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_thread_summaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `ets_thread_user_idx` UNIQUE(`threadId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `email_thread_summaries` ADD CONSTRAINT `email_thread_summaries_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ets_user_idx` ON `email_thread_summaries` (`userId`);
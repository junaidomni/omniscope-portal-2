CREATE TABLE `email_entity_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`emailMessageId` int NOT NULL,
	`contactId` int,
	`companyId` int,
	`linkType` enum('from','to','cc','manual') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_entity_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`gmailMessageId` varchar(255) NOT NULL,
	`gmailThreadId` varchar(255) NOT NULL,
	`fromEmail` varchar(320),
	`fromName` varchar(255),
	`toEmails` text,
	`ccEmails` text,
	`subject` varchar(1000),
	`snippet` text,
	`internalDate` bigint,
	`isUnread` boolean NOT NULL DEFAULT true,
	`isStarred` boolean NOT NULL DEFAULT false,
	`labelIds` text,
	`hasAttachments` boolean NOT NULL DEFAULT false,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `email_entity_links` ADD CONSTRAINT `email_entity_links_emailMessageId_email_messages_id_fk` FOREIGN KEY (`emailMessageId`) REFERENCES `email_messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_entity_links` ADD CONSTRAINT `email_entity_links_contactId_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_entity_links` ADD CONSTRAINT `email_entity_links_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_messages` ADD CONSTRAINT `email_messages_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `eel_email_idx` ON `email_entity_links` (`emailMessageId`);--> statement-breakpoint
CREATE INDEX `eel_contact_idx` ON `email_entity_links` (`contactId`);--> statement-breakpoint
CREATE INDEX `eel_company_idx` ON `email_entity_links` (`companyId`);--> statement-breakpoint
CREATE INDEX `em_user_idx` ON `email_messages` (`userId`);--> statement-breakpoint
CREATE INDEX `em_thread_idx` ON `email_messages` (`gmailThreadId`);--> statement-breakpoint
CREATE INDEX `em_message_idx` ON `email_messages` (`gmailMessageId`);--> statement-breakpoint
CREATE INDEX `em_date_idx` ON `email_messages` (`internalDate`);--> statement-breakpoint
CREATE INDEX `em_user_thread_idx` ON `email_messages` (`userId`,`gmailThreadId`);
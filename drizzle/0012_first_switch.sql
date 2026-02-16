CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(500) NOT NULL,
	`domain` varchar(500),
	`industry` varchar(255),
	`notes` text,
	`companyStatus` enum('active','inactive','prospect','partner') NOT NULL DEFAULT 'active',
	`owner` varchar(255),
	`aiMemory` text,
	`logoUrl` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`interactionType` enum('meeting','note','doc_shared','task_update','email','intro','call') NOT NULL,
	`timestamp` timestamp NOT NULL,
	`contactId` int,
	`companyId` int,
	`sourceRecordId` int,
	`sourceType` varchar(50),
	`summary` text,
	`details` text,
	`interactionTags` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contacts` ADD `aiMemory` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `contacts` ADD `source` varchar(100);--> statement-breakpoint
ALTER TABLE `contacts` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `contacts` ADD `relationshipScore` int;--> statement-breakpoint
ALTER TABLE `contacts` ADD `engagementScore` int;--> statement-breakpoint
ALTER TABLE `contacts` ADD `lastInteractionAt` timestamp;--> statement-breakpoint
ALTER TABLE `tasks` ADD `contactId` int;--> statement-breakpoint
ALTER TABLE `tasks` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `interactions` ADD CONSTRAINT `interactions_contactId_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interactions` ADD CONSTRAINT `interactions_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interactions` ADD CONSTRAINT `interactions_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `company_name_idx` ON `companies` (`name`);--> statement-breakpoint
CREATE INDEX `company_domain_idx` ON `companies` (`domain`);--> statement-breakpoint
CREATE INDEX `interaction_contact_idx` ON `interactions` (`contactId`);--> statement-breakpoint
CREATE INDEX `interaction_company_idx` ON `interactions` (`companyId`);--> statement-breakpoint
CREATE INDEX `interaction_type_idx` ON `interactions` (`interactionType`);--> statement-breakpoint
CREATE INDEX `interaction_timestamp_idx` ON `interactions` (`timestamp`);--> statement-breakpoint
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_contactId_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `contact_company_idx` ON `contacts` (`companyId`);
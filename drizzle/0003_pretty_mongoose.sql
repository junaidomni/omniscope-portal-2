CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`organization` varchar(255),
	`title` varchar(255),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meeting_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`meetingId` int NOT NULL,
	`contactId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meeting_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP INDEX `meeting_id_idx` ON `tasks`;--> statement-breakpoint
ALTER TABLE `tasks` ADD `category` varchar(255);--> statement-breakpoint
ALTER TABLE `tasks` ADD `assignedName` varchar(255);--> statement-breakpoint
ALTER TABLE `meeting_contacts` ADD CONSTRAINT `meeting_contacts_meetingId_meetings_id_fk` FOREIGN KEY (`meetingId`) REFERENCES `meetings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `meeting_contacts` ADD CONSTRAINT `meeting_contacts_contactId_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `contacts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `contact_name_idx` ON `contacts` (`name`);--> statement-breakpoint
CREATE INDEX `contact_org_idx` ON `contacts` (`organization`);--> statement-breakpoint
CREATE INDEX `mc_meeting_id_idx` ON `meeting_contacts` (`meetingId`);--> statement-breakpoint
CREATE INDEX `mc_contact_id_idx` ON `meeting_contacts` (`contactId`);--> statement-breakpoint
CREATE INDEX `task_meeting_id_idx` ON `tasks` (`meetingId`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `tasks` (`category`);
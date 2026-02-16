CREATE TABLE `calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`googleEventId` varchar(512) NOT NULL,
	`summary` varchar(500) NOT NULL,
	`description` text,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`isAllDay` boolean NOT NULL DEFAULT false,
	`location` varchar(500),
	`attendees` text,
	`hangoutLink` varchar(500),
	`htmlLink` varchar(500),
	`calendarId` varchar(255) NOT NULL DEFAULT 'primary',
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendar_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `calendar_events_googleEventId_unique` UNIQUE(`googleEventId`)
);
--> statement-breakpoint
CREATE INDEX `google_event_idx` ON `calendar_events` (`googleEventId`);--> statement-breakpoint
CREATE INDEX `start_time_idx` ON `calendar_events` (`startTime`);
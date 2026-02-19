CREATE TABLE `document_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`noteDocId` int NOT NULL,
	`noteUserId` int NOT NULL,
	`noteContent` text NOT NULL,
	`noteCreatedAt` timestamp NOT NULL DEFAULT (now()),
	`noteUpdatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `document_notes` ADD CONSTRAINT `document_notes_noteDocId_documents_id_fk` FOREIGN KEY (`noteDocId`) REFERENCES `documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_notes` ADD CONSTRAINT `document_notes_noteUserId_users_id_fk` FOREIGN KEY (`noteUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `note_doc_idx` ON `document_notes` (`noteDocId`);
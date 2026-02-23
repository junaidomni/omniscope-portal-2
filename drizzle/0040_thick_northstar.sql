CREATE TABLE `workspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceOrgId` int NOT NULL,
	`workspaceName` varchar(500) NOT NULL,
	`workspaceDescription` text,
	`workspaceAvatar` varchar(1000),
	`workspaceIsDefault` boolean NOT NULL DEFAULT false,
	`workspaceCreatedBy` int NOT NULL,
	`workspaceCreatedAt` timestamp NOT NULL DEFAULT (now()),
	`workspaceUpdatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `channels` ADD `channelWorkspaceId` int;--> statement-breakpoint
ALTER TABLE `workspaces` ADD CONSTRAINT `workspaces_workspaceOrgId_organizations_id_fk` FOREIGN KEY (`workspaceOrgId`) REFERENCES `organizations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workspaces` ADD CONSTRAINT `workspaces_workspaceCreatedBy_users_id_fk` FOREIGN KEY (`workspaceCreatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `workspace_org_idx` ON `workspaces` (`workspaceOrgId`);--> statement-breakpoint
CREATE INDEX `workspace_created_by_idx` ON `workspaces` (`workspaceCreatedBy`);--> statement-breakpoint
ALTER TABLE `channels` ADD CONSTRAINT `channels_channelWorkspaceId_workspaces_id_fk` FOREIGN KEY (`channelWorkspaceId`) REFERENCES `workspaces`(`id`) ON DELETE cascade ON UPDATE no action;
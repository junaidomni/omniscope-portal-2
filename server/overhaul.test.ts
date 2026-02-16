import { describe, it, expect } from "vitest";
import * as db from "./db";

describe("Portal Overhaul v2", () => {
  describe("Contacts", () => {
    it("should create and retrieve a contact", async () => {
      const contactId = await db.createContact({
        name: "Test Contact",
        email: "test@example.com",
        organization: "Test Corp",
        title: "CEO",
      });
      expect(contactId).toBeGreaterThan(0);

      const retrieved = await db.getContactById(contactId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("Test Contact");
      expect(retrieved?.email).toBe("test@example.com");
      expect(retrieved?.organization).toBe("Test Corp");

      await db.deleteContact(contactId);
    });

    it("should list contacts", async () => {
      const contacts = await db.getAllContacts();
      expect(Array.isArray(contacts)).toBe(true);
    });

    it("should search contacts by name", async () => {
      const cId = await db.createContact({ name: "Searchable Person", email: "search@test.com" });
      const results = await db.searchContacts("Searchable");
      expect(results.some((r: any) => r.name === "Searchable Person")).toBe(true);
      await db.deleteContact(cId);
    });
  });

  describe("Tasks with Categories", () => {
    it("should create a task with category and assignedName", async () => {
      const taskId = await db.createTask({
        title: "Follow up on gold deal",
        category: "Gold",
        assignedName: "Junaid",
        priority: "high",
        status: "open",
      });
      expect(taskId).toBeGreaterThan(0);

      const tasks = await db.getAllTasks({ status: "open" });
      const found = tasks.find((t: any) => t.id === taskId);
      expect(found).toBeDefined();
      expect(found?.category).toBe("Gold");
      expect(found?.assignedName).toBe("Junaid");

      await db.deleteTask(taskId);
    });

    it("should filter tasks by category", async () => {
      const t1Id = await db.createTask({ title: "BTC task", category: "BTC", status: "open" });
      const t2Id = await db.createTask({ title: "Gold task", category: "Gold", status: "open" });

      const btcTasks = await db.getAllTasks({ category: "BTC" });
      expect(btcTasks.some((t: any) => t.id === t1Id)).toBe(true);
      expect(btcTasks.some((t: any) => t.id === t2Id)).toBe(false);

      await db.deleteTask(t1Id);
      await db.deleteTask(t2Id);
    });

    it("should filter tasks by assignedName", async () => {
      const tId = await db.createTask({ title: "Kyle's task", assignedName: "Kyle", status: "open" });
      const tasks = await db.getAllTasks({ assignedName: "Kyle" });
      expect(tasks.some((task: any) => task.id === tId)).toBe(true);
      await db.deleteTask(tId);
    });

    it("should update task status", async () => {
      const tId = await db.createTask({ title: "Completable task", status: "open" });
      await db.updateTask(tId, { status: "completed" });
      const retrieved = await db.getTaskById(tId);
      expect(retrieved?.status).toBe("completed");
      await db.deleteTask(tId);
    });

    it("should get task categories", async () => {
      const t1Id = await db.createTask({ title: "PP task", category: "Private Placement", status: "open" });
      const t2Id = await db.createTask({ title: "LM task", category: "Little Miracles", status: "open" });

      const categories = await db.getTaskCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.some((c: any) => c.category === "Private Placement")).toBe(true);
      expect(categories.some((c: any) => c.category === "Little Miracles")).toBe(true);

      await db.deleteTask(t1Id);
      await db.deleteTask(t2Id);
    });

    it("should get task assignees", async () => {
      const tId = await db.createTask({ title: "Assignee task", assignedName: "TestAssignee", status: "open" });
      const assignees = await db.getTaskAssignees();
      expect(Array.isArray(assignees)).toBe(true);
      expect(assignees.some((a: any) => a.name === "TestAssignee")).toBe(true);
      await db.deleteTask(tId);
    });
  });

  describe("Meeting Deletion", () => {
    it("should delete a meeting and its associated data", async () => {
      const meetingId = await db.createMeeting({
        meetingDate: new Date(),
        primaryLead: "Test Lead",
        participants: JSON.stringify(["Test Lead"]),
        executiveSummary: "Deletable meeting",
        sourceType: "manual",
      });
      expect(meetingId).toBeGreaterThan(0);

      // Create an associated task
      const taskId = await db.createTask({
        title: "Task for deletable meeting",
        meetingId: meetingId,
        status: "open",
      });

      // Delete the meeting
      await db.deleteMeeting(meetingId);

      // Verify meeting is gone
      const retrieved = await db.getMeetingById(meetingId);
      expect(retrieved).toBeFalsy();
    });
  });

  describe("Calendar Events API", () => {
    it("should serve calendar events from the database", async () => {
      const response = await fetch("http://localhost:3000/api/calendar/events?timeMin=2026-01-01T00:00:00Z&timeMax=2026-12-31T23:59:59Z");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.events).toBeDefined();
      expect(Array.isArray(data.events)).toBe(true);
      expect(data.events.length).toBeGreaterThan(0);
    });

    it("should return sync status", async () => {
      const response = await fetch("http://localhost:3000/api/calendar/sync-status");
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.eventCount).toBeGreaterThan(0);
    });
  });
});

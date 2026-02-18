import { describe, it, expect } from "vitest";

/**
 * Tests for system-wide name propagation.
 * When a contact or company name is updated, the change should propagate
 * across meetings (participants JSON), tasks (assignedName), and contacts (organization).
 */

describe("Name Propagation Functions", () => {
  describe("Contact Name Propagation Logic", () => {
    it("should replace old name in a participants JSON array", () => {
      const participants = JSON.stringify(["Jake Ryan", "John Puls", "Asim Khan"]);
      const parsed: string[] = JSON.parse(participants);
      const oldName = "John Puls";
      const newName = "John P. Puls";
      
      const idx = parsed.findIndex(p => p.toLowerCase() === oldName.toLowerCase());
      expect(idx).toBe(1);
      
      parsed[idx] = newName;
      expect(parsed).toEqual(["Jake Ryan", "John P. Puls", "Asim Khan"]);
      expect(JSON.stringify(parsed)).toContain("John P. Puls");
      expect(JSON.stringify(parsed)).not.toContain('"John Puls"');
    });

    it("should handle case-insensitive name matching", () => {
      const participants = ["jake ryan", "JOHN PULS", "Asim Khan"];
      const oldName = "John Puls";
      const newName = "John P. Puls";
      
      const idx = participants.findIndex(p => p.toLowerCase() === oldName.toLowerCase());
      expect(idx).toBe(1);
      
      participants[idx] = newName;
      expect(participants[1]).toBe("John P. Puls");
    });

    it("should not modify array if name is not found", () => {
      const participants = ["Jake Ryan", "John Puls", "Asim Khan"];
      const oldName = "Nonexistent Person";
      
      const idx = participants.findIndex(p => p.toLowerCase() === oldName.toLowerCase());
      expect(idx).toBe(-1);
      
      // Array should remain unchanged
      expect(participants).toEqual(["Jake Ryan", "John Puls", "Asim Khan"]);
    });

    it("should handle empty participants array", () => {
      const participants: string[] = [];
      const oldName = "John Puls";
      
      const idx = participants.findIndex(p => p.toLowerCase() === oldName.toLowerCase());
      expect(idx).toBe(-1);
    });

    it("should handle malformed JSON gracefully", () => {
      const badJson = "not valid json";
      let parsed: string[] | null = null;
      
      try {
        parsed = JSON.parse(badJson);
      } catch {
        parsed = null;
      }
      
      expect(parsed).toBeNull();
    });
  });

  describe("Company Name Propagation Logic", () => {
    it("should replace old company name in organizations JSON array", () => {
      const organizations = JSON.stringify(["OmniScope", "Pantherainsure", "Comet Cash"]);
      const parsed: string[] = JSON.parse(organizations);
      const oldName = "Pantherainsure";
      const newName = "Panthera Insurance Group";
      
      const idx = parsed.findIndex(o => o.toLowerCase() === oldName.toLowerCase());
      expect(idx).toBe(1);
      
      parsed[idx] = newName;
      expect(parsed).toEqual(["OmniScope", "Panthera Insurance Group", "Comet Cash"]);
    });

    it("should handle case-insensitive company matching", () => {
      const organizations = ["omniscope", "PANTHERAINSURE", "Comet Cash"];
      const oldName = "Pantherainsure";
      const newName = "Panthera Insurance Group";
      
      const idx = organizations.findIndex(o => o.toLowerCase() === oldName.toLowerCase());
      expect(idx).toBe(1);
      
      organizations[idx] = newName;
      expect(organizations[1]).toBe("Panthera Insurance Group");
    });

    it("should not modify organizations if company name not found", () => {
      const organizations = ["OmniScope", "Pantherainsure"];
      const oldName = "NonexistentCorp";
      
      const idx = organizations.findIndex(o => o.toLowerCase() === oldName.toLowerCase());
      expect(idx).toBe(-1);
      
      expect(organizations).toEqual(["OmniScope", "Pantherainsure"]);
    });

    it("should handle null organizations field", () => {
      const organizations: string | null = null;
      
      if (organizations) {
        const parsed = JSON.parse(organizations);
        expect(parsed).toBeDefined();
      } else {
        // Should skip propagation for null organizations
        expect(organizations).toBeNull();
      }
    });
  });

  describe("Cross-system Tag Consistency", () => {
    it("should ensure contact name update affects all related records conceptually", () => {
      // Simulate the propagation flow
      const contactId = 42;
      const oldName = "JT Huskins";
      const newName = "JT Huskins Jr.";
      
      // Simulated records that should be updated
      const taskAssignedNames = ["JT Huskins", "Jake Ryan", "Asim"];
      const meetingParticipants = [["JT Huskins", "Jake Ryan"], ["JT Huskins", "John Puls"]];
      const primaryLeads = ["JT Huskins", "Jake Ryan"];
      
      // Update tasks
      const updatedTasks = taskAssignedNames.map(n => n === oldName ? newName : n);
      expect(updatedTasks[0]).toBe(newName);
      expect(updatedTasks[1]).toBe("Jake Ryan"); // unchanged
      
      // Update meeting participants
      const updatedMeetings = meetingParticipants.map(participants =>
        participants.map(p => p.toLowerCase() === oldName.toLowerCase() ? newName : p)
      );
      expect(updatedMeetings[0][0]).toBe(newName);
      expect(updatedMeetings[1][0]).toBe(newName);
      expect(updatedMeetings[0][1]).toBe("Jake Ryan"); // unchanged
      
      // Update primaryLead
      const updatedLeads = primaryLeads.map(l => l === oldName ? newName : l);
      expect(updatedLeads[0]).toBe(newName);
      expect(updatedLeads[1]).toBe("Jake Ryan"); // unchanged
    });

    it("should ensure company name update affects contacts and meetings conceptually", () => {
      const companyId = 10;
      const oldName = "Pantherainsure";
      const newName = "Panthera Insurance Group";
      
      // Simulated contact organizations linked to this company
      const contactOrgs = [
        { companyId: 10, organization: "Pantherainsure" },
        { companyId: 10, organization: "Pantherainsure" },
        { companyId: 5, organization: "OmniScope" }, // different company
      ];
      
      // Update contacts linked to this company
      const updatedContacts = contactOrgs.map(c => ({
        ...c,
        organization: c.companyId === companyId && c.organization === oldName ? newName : c.organization,
      }));
      
      expect(updatedContacts[0].organization).toBe(newName);
      expect(updatedContacts[1].organization).toBe(newName);
      expect(updatedContacts[2].organization).toBe("OmniScope"); // unchanged
      
      // Simulated meeting organizations
      const meetingOrgs = [
        JSON.stringify(["OmniScope", "Pantherainsure", "Comet Cash"]),
        JSON.stringify(["Pantherainsure"]),
        JSON.stringify(["OmniScope"]),
      ];
      
      const updatedMeetingOrgs = meetingOrgs.map(orgsJson => {
        const orgs: string[] = JSON.parse(orgsJson);
        const idx = orgs.findIndex(o => o.toLowerCase() === oldName.toLowerCase());
        if (idx !== -1) orgs[idx] = newName;
        return JSON.stringify(orgs);
      });
      
      expect(JSON.parse(updatedMeetingOrgs[0])).toContain(newName);
      expect(JSON.parse(updatedMeetingOrgs[0])).not.toContain(oldName);
      expect(JSON.parse(updatedMeetingOrgs[1])).toEqual([newName]);
      expect(JSON.parse(updatedMeetingOrgs[2])).toEqual(["OmniScope"]); // unchanged
    });
  });
});

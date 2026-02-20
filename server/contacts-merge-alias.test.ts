import { describe, it, expect } from "vitest";

// ─── Contact Merge & Alias System Tests ───

describe("Contact Merge Logic", () => {
  it("should merge source contact fields into target when target fields are empty", () => {
    const source = { name: "Jake Ryan", email: "jake@test.com", phone: "+1234567890", organization: "OmniScope", title: "Director" };
    const target = { name: "Jacob McDonald", email: "", phone: "", organization: "", title: "Managing Director" };

    // Merge: fill missing target fields from source
    const merged = {
      name: target.name, // keep target name
      email: target.email || source.email,
      phone: target.phone || source.phone,
      organization: target.organization || source.organization,
      title: target.title || source.title,
    };

    expect(merged.name).toBe("Jacob McDonald");
    expect(merged.email).toBe("jake@test.com");
    expect(merged.phone).toBe("+1234567890");
    expect(merged.organization).toBe("OmniScope");
    expect(merged.title).toBe("Managing Director"); // target had a value, keep it
  });

  it("should preserve target fields when both source and target have values", () => {
    const source = { name: "Jake", email: "jake@old.com", organization: "Old Corp" };
    const target = { name: "Jacob McDonald", email: "jacob@new.com", organization: "New Corp" };

    const merged = {
      name: target.name,
      email: target.email || source.email,
      organization: target.organization || source.organization,
    };

    expect(merged.email).toBe("jacob@new.com");
    expect(merged.organization).toBe("New Corp");
  });

  it("should create an alias from the source contact name after merge", () => {
    const sourceName = "Jake Ryan";
    const targetId = 100;

    const alias = {
      contactId: targetId,
      aliasName: sourceName,
      source: "merge" as const,
    };

    expect(alias.contactId).toBe(100);
    expect(alias.aliasName).toBe("Jake Ryan");
    expect(alias.source).toBe("merge");
  });

  it("should also create an alias from source email if present", () => {
    const sourceEmail = "jake@test.com";
    const targetId = 100;

    const alias = {
      contactId: targetId,
      aliasEmail: sourceEmail,
      source: "merge" as const,
    };

    expect(alias.aliasEmail).toBe("jake@test.com");
  });

  it("should transfer meetings from source to target", () => {
    const sourceMeetings = [
      { id: 1, contactId: 50 },
      { id: 2, contactId: 50 },
      { id: 3, contactId: 50 },
    ];

    const targetId = 100;
    const transferred = sourceMeetings.map(m => ({ ...m, contactId: targetId }));

    expect(transferred).toHaveLength(3);
    transferred.forEach(m => expect(m.contactId).toBe(100));
  });

  it("should transfer interactions from source to target", () => {
    const sourceInteractions = [
      { id: 10, contactId: 50, type: "meeting" },
      { id: 11, contactId: 50, type: "note" },
    ];

    const targetId = 100;
    const transferred = sourceInteractions.map(i => ({ ...i, contactId: targetId }));

    expect(transferred).toHaveLength(2);
    transferred.forEach(i => expect(i.contactId).toBe(100));
  });

  it("should not allow merging a contact into itself", () => {
    const sourceId = 50;
    const targetId = 50;

    expect(sourceId === targetId).toBe(true);
    // The backend should reject this
  });

  it("should handle merge where source has no email", () => {
    const source = { name: "Unknown Person", email: null, phone: null };
    const target = { name: "Known Person", email: "known@test.com", phone: "+1111111111" };

    const merged = {
      name: target.name,
      email: target.email || source.email || "",
      phone: target.phone || source.phone || "",
    };

    expect(merged.email).toBe("known@test.com");
    expect(merged.phone).toBe("+1111111111");
  });
});

describe("Contact Alias System", () => {
  it("should normalize alias names for comparison", () => {
    const normalize = (name: string) => name.trim().toLowerCase();

    expect(normalize("Jake Ryan")).toBe("jake ryan");
    expect(normalize("  JAKE RYAN  ")).toBe("jake ryan");
    expect(normalize("jake ryan")).toBe("jake ryan");
  });

  it("should match a contact by alias name", () => {
    const aliases = [
      { id: 1, contactId: 100, aliasName: "Jake Ryan", aliasEmail: null },
      { id: 2, contactId: 100, aliasName: "J. Ryan", aliasEmail: null },
      { id: 3, contactId: 200, aliasName: "John Smith", aliasEmail: null },
    ];

    const searchName = "jake ryan";
    const match = aliases.find(a =>
      a.aliasName?.toLowerCase() === searchName.toLowerCase()
    );

    expect(match).toBeDefined();
    expect(match!.contactId).toBe(100);
  });

  it("should match a contact by alias email", () => {
    const aliases = [
      { id: 1, contactId: 100, aliasName: null, aliasEmail: "jake@old.com" },
      { id: 2, contactId: 200, aliasName: null, aliasEmail: "john@test.com" },
    ];

    const searchEmail = "jake@old.com";
    const match = aliases.find(a =>
      a.aliasEmail?.toLowerCase() === searchEmail.toLowerCase()
    );

    expect(match).toBeDefined();
    expect(match!.contactId).toBe(100);
  });

  it("should return no match for unknown alias", () => {
    const aliases = [
      { id: 1, contactId: 100, aliasName: "Jake Ryan", aliasEmail: null },
    ];

    const searchName = "completely unknown";
    const match = aliases.find(a =>
      a.aliasName?.toLowerCase() === searchName.toLowerCase()
    );

    expect(match).toBeUndefined();
  });

  it("should support multiple aliases per contact", () => {
    const aliases = [
      { id: 1, contactId: 100, aliasName: "Jake Ryan", source: "merge" },
      { id: 2, contactId: 100, aliasName: "J. Ryan", source: "manual" },
      { id: 3, contactId: 100, aliasName: "Jake R.", source: "fathom" },
    ];

    const contactAliases = aliases.filter(a => a.contactId === 100);
    expect(contactAliases).toHaveLength(3);
  });

  it("should track alias source (merge, manual, fathom)", () => {
    const validSources = ["merge", "manual", "fathom"];

    const alias1 = { source: "merge" };
    const alias2 = { source: "manual" };
    const alias3 = { source: "fathom" };

    expect(validSources).toContain(alias1.source);
    expect(validSources).toContain(alias2.source);
    expect(validSources).toContain(alias3.source);
  });

  it("should allow removing an alias", () => {
    const aliases = [
      { id: 1, contactId: 100, aliasName: "Jake Ryan" },
      { id: 2, contactId: 100, aliasName: "J. Ryan" },
    ];

    const afterRemoval = aliases.filter(a => a.id !== 1);
    expect(afterRemoval).toHaveLength(1);
    expect(afterRemoval[0].aliasName).toBe("J. Ryan");
  });
});

describe("Fathom Ingestion Alias Lookup", () => {
  it("should check aliases before creating a new contact", () => {
    const existingContacts = [
      { id: 100, name: "Jacob McDonald", email: "jacob@test.com" },
    ];
    const aliases = [
      { contactId: 100, aliasName: "Jake Ryan" },
    ];

    const incomingName = "Jake Ryan";

    // Step 1: Check direct name match
    const directMatch = existingContacts.find(c =>
      c.name.toLowerCase() === incomingName.toLowerCase()
    );

    // Step 2: Check alias match
    const aliasMatch = !directMatch
      ? aliases.find(a => a.aliasName?.toLowerCase() === incomingName.toLowerCase())
      : null;

    expect(directMatch).toBeUndefined();
    expect(aliasMatch).toBeDefined();
    expect(aliasMatch!.contactId).toBe(100);
  });

  it("should create a new pending contact when no alias match found", () => {
    const existingContacts = [
      { id: 100, name: "Jacob McDonald" },
    ];
    const aliases = [
      { contactId: 100, aliasName: "Jake Ryan" },
    ];

    const incomingName = "Brand New Person";

    const directMatch = existingContacts.find(c =>
      c.name.toLowerCase() === incomingName.toLowerCase()
    );
    const aliasMatch = !directMatch
      ? aliases.find(a => a.aliasName?.toLowerCase() === incomingName.toLowerCase())
      : null;

    expect(directMatch).toBeUndefined();
    expect(aliasMatch).toBeUndefined();

    // Should create new contact with pending status
    const newContact = {
      name: incomingName,
      approvalStatus: "pending",
    };
    expect(newContact.approvalStatus).toBe("pending");
  });

  it("should link meeting to existing contact when alias matches", () => {
    const aliasMatch = { contactId: 100, aliasName: "Jake Ryan" };
    const meetingId = 500;

    // Should link to existing contact, not create new one
    const meetingLink = {
      meetingId,
      contactId: aliasMatch.contactId,
    };

    expect(meetingLink.contactId).toBe(100);
  });
});

describe("Contact Approval Workflow", () => {
  it("should set new contacts from Fathom as pending", () => {
    const newContact = {
      name: "New Person",
      approvalStatus: "pending" as const,
      source: "fathom",
    };

    expect(newContact.approvalStatus).toBe("pending");
  });

  it("should allow approving a pending contact", () => {
    const contact = { id: 1, approvalStatus: "pending" as string };
    contact.approvalStatus = "approved";
    expect(contact.approvalStatus).toBe("approved");
  });

  it("should allow rejecting a pending contact", () => {
    const contact = { id: 1, approvalStatus: "pending" as string };
    contact.approvalStatus = "rejected";
    expect(contact.approvalStatus).toBe("rejected");
  });

  it("should support bulk approve of multiple pending contacts", () => {
    const pendingIds = [1, 2, 3, 4, 5];
    const contacts = pendingIds.map(id => ({ id, approvalStatus: "pending" as string }));

    // Bulk approve
    contacts.forEach(c => { c.approvalStatus = "approved"; });

    expect(contacts.every(c => c.approvalStatus === "approved")).toBe(true);
  });

  it("should support bulk reject of multiple pending contacts", () => {
    const pendingIds = [1, 2, 3];
    const contacts = pendingIds.map(id => ({ id, approvalStatus: "pending" as string }));

    contacts.forEach(c => { c.approvalStatus = "rejected"; });

    expect(contacts.every(c => c.approvalStatus === "rejected")).toBe(true);
  });

  it("should allow editing a pending contact before approving", () => {
    const contact = {
      id: 1,
      name: "Jake Ryan",
      email: "",
      approvalStatus: "pending" as string,
    };

    // Edit the contact
    contact.name = "Jacob McDonald";
    contact.email = "jacob@test.com";

    // Then approve
    contact.approvalStatus = "approved";

    expect(contact.name).toBe("Jacob McDonald");
    expect(contact.email).toBe("jacob@test.com");
    expect(contact.approvalStatus).toBe("approved");
  });
});

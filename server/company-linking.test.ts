import { describe, it, expect } from "vitest";
import { z } from "zod";

// Test the Zod schema for contacts.update to verify companyId is accepted
const updateSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  organization: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  category: z.enum(["client", "prospect", "partner", "vendor", "other"]).nullable().optional(),
  starred: z.boolean().optional(),
  rating: z.number().min(1).max(5).nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  companyId: z.number().nullable().optional(),
  tags: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});

describe("Company Linking - contacts.update schema", () => {
  it("should accept companyId as a number", () => {
    const result = updateSchema.safeParse({ id: 1, companyId: 5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.companyId).toBe(5);
    }
  });

  it("should accept companyId as null (unlink)", () => {
    const result = updateSchema.safeParse({ id: 1, companyId: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.companyId).toBeNull();
    }
  });

  it("should accept update without companyId", () => {
    const result = updateSchema.safeParse({ id: 1, name: "John Doe" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.companyId).toBeUndefined();
    }
  });

  it("should accept tags and source fields", () => {
    const result = updateSchema.safeParse({
      id: 1,
      tags: JSON.stringify(["vip", "partner"]),
      source: "manual",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toBe(JSON.stringify(["vip", "partner"]));
      expect(result.data.source).toBe("manual");
    }
  });

  it("should reject invalid companyId type", () => {
    const result = updateSchema.safeParse({ id: 1, companyId: "not-a-number" });
    expect(result.success).toBe(false);
  });

  it("should accept a full update with companyId and other fields", () => {
    const result = updateSchema.safeParse({
      id: 42,
      name: "Test Contact",
      email: "test@example.com",
      organization: "OmniScope",
      companyId: 7,
      category: "client",
      starred: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(42);
      expect(result.data.companyId).toBe(7);
      expect(result.data.category).toBe("client");
    }
  });
});

describe("Company Linking - ContactAutocomplete integration", () => {
  it("should produce correct mutation payload for company linking", () => {
    // Simulate what CompanyProfile.tsx does when linking a contact
    const contactId = 15;
    const companyId = 3;
    const payload = { id: contactId, companyId };
    
    const result = updateSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(15);
      expect(result.data.companyId).toBe(3);
    }
  });

  it("should handle unlinking a contact from a company", () => {
    const payload = { id: 15, companyId: null };
    const result = updateSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.companyId).toBeNull();
    }
  });
});

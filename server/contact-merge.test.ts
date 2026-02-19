import { describe, expect, it } from "vitest";

/**
 * Tests for the contact merge/duplicate detection logic.
 * Since the actual tRPC procedures depend on database state,
 * we test the duplicate matching algorithm independently.
 */

// Replicate the duplicate detection logic from findDuplicatesFor
function findDuplicates(
  target: { name: string; email?: string | null; organization?: string | null },
  candidates: { id: number; name: string; email?: string | null; organization?: string | null; approvalStatus: string }[]
) {
  const approvedContacts = candidates.filter(c => c.approvalStatus === "approved");
  const targetName = target.name.toLowerCase().trim();
  const targetParts = targetName.split(/\s+/);
  const targetEmail = target.email?.toLowerCase().trim();
  const targetOrg = target.organization?.toLowerCase().trim();

  const matches: { contact: typeof approvedContacts[0]; confidence: number; reason: string }[] = [];

  for (const c of approvedContacts) {
    const cName = c.name.toLowerCase().trim();
    const cParts = cName.split(/\s+/);
    const cEmail = c.email?.toLowerCase().trim();
    const cOrg = c.organization?.toLowerCase().trim();
    let confidence = 0;
    const reasons: string[] = [];

    // Exact name match
    if (targetName === cName) { confidence = 95; reasons.push("Exact name match"); }
    // Email match (strongest signal)
    else if (targetEmail && cEmail && targetEmail === cEmail) { confidence = 90; reasons.push("Same email address"); }
    // First+last swap
    else if (targetParts.length >= 2 && cParts.length >= 2 &&
      targetParts[0] === cParts[cParts.length - 1] && targetParts[targetParts.length - 1] === cParts[0]) {
      confidence = 80; reasons.push("Name parts swapped");
    }
    // First name match + same org
    else if (targetParts[0] === cParts[0] && targetOrg && cOrg && targetOrg === cOrg) {
      confidence = 75; reasons.push("Same first name + organization");
    }
    // One name contains the other
    else if (targetName.length > 3 && cName.length > 3 && (targetName.includes(cName) || cName.includes(targetName))) {
      confidence = 65; reasons.push("Name overlap");
    }
    // Same last name + same org
    else if (targetParts.length >= 2 && cParts.length >= 2 &&
      targetParts[targetParts.length - 1] === cParts[cParts.length - 1] &&
      targetOrg && cOrg && targetOrg === cOrg) {
      confidence = 55; reasons.push("Same last name + organization");
    }
    // First name match only
    else if (targetParts[0] === cParts[0] && targetParts[0].length >= 3) {
      confidence = 40; reasons.push("Same first name");
    }

    if (confidence > 0) {
      // Boost confidence if org matches
      if (targetOrg && cOrg && targetOrg === cOrg && !reasons.includes("Same first name + organization") && !reasons.includes("Same last name + organization")) {
        confidence = Math.min(confidence + 10, 99);
        reasons.push("Same organization");
      }
      matches.push({
        contact: c,
        confidence,
        reason: reasons.join(", "),
      });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

describe("Contact Duplicate Detection", () => {
  const existingContacts = [
    { id: 1, name: "Jake Ryan", email: "jake@omniscope.com", organization: "OmniScope", approvalStatus: "approved" },
    { id: 2, name: "Sarah Johnson", email: "sarah@acme.com", organization: "Acme Corp", approvalStatus: "approved" },
    { id: 3, name: "Michael Chen", email: "mchen@techco.com", organization: "TechCo", approvalStatus: "approved" },
    { id: 4, name: "Jake McDonald", email: "jake.m@other.com", organization: "Other Inc", approvalStatus: "approved" },
    { id: 5, name: "Ryan Jake", email: "rjake@test.com", organization: null, approvalStatus: "approved" },
    { id: 6, name: "Pending Person", email: "pending@test.com", organization: null, approvalStatus: "pending" },
    { id: 7, name: "Sarah J", email: null, organization: "Acme Corp", approvalStatus: "approved" },
    { id: 8, name: "Jacob McDonald", email: null, organization: "Other Inc", approvalStatus: "approved" },
  ];

  it("detects exact name match with 95% confidence", () => {
    const target = { name: "Jake Ryan", email: null, organization: null };
    const results = findDuplicates(target, existingContacts);
    expect(results.length).toBeGreaterThan(0);
    const exactMatch = results.find(r => r.contact.id === 1);
    expect(exactMatch).toBeDefined();
    expect(exactMatch!.confidence).toBe(95);
    expect(exactMatch!.reason).toContain("Exact name match");
  });

  it("detects email match with 90% confidence", () => {
    const target = { name: "J. Ryan", email: "jake@omniscope.com", organization: null };
    const results = findDuplicates(target, existingContacts);
    const emailMatch = results.find(r => r.contact.id === 1);
    expect(emailMatch).toBeDefined();
    expect(emailMatch!.confidence).toBe(90);
    expect(emailMatch!.reason).toContain("Same email address");
  });

  it("detects name parts swapped (Jake Ryan vs Ryan Jake) with 80% confidence", () => {
    const target = { name: "Jake Ryan", email: "new@test.com", organization: null };
    const results = findDuplicates(target, existingContacts);
    const swapMatch = results.find(r => r.contact.id === 5);
    expect(swapMatch).toBeDefined();
    expect(swapMatch!.confidence).toBe(80);
    expect(swapMatch!.reason).toContain("Name parts swapped");
  });

  it("detects first name match + same org with 75% confidence", () => {
    const target = { name: "Sarah Williams", email: null, organization: "Acme Corp" };
    const results = findDuplicates(target, existingContacts);
    const orgMatch = results.find(r => r.contact.id === 2);
    expect(orgMatch).toBeDefined();
    expect(orgMatch!.confidence).toBe(75);
    expect(orgMatch!.reason).toContain("Same first name + organization");
  });

  it("detects name overlap with 65% confidence", () => {
    const target = { name: "Sarah", email: null, organization: null };
    const results = findDuplicates(target, existingContacts);
    // "Sarah" is contained in "Sarah Johnson" and "Sarah J"
    const overlapMatches = results.filter(r => r.reason.includes("Name overlap"));
    expect(overlapMatches.length).toBeGreaterThan(0);
  });

  it("detects same first name match with 40% confidence", () => {
    const target = { name: "Jake Thompson", email: null, organization: null };
    const results = findDuplicates(target, existingContacts);
    const firstNameMatches = results.filter(r => r.contact.name.toLowerCase().startsWith("jake"));
    expect(firstNameMatches.length).toBeGreaterThan(0);
  });

  it("boosts confidence when org matches on top of other signals", () => {
    const target = { name: "Jake Ryan", email: null, organization: "OmniScope" };
    const results = findDuplicates(target, existingContacts);
    const exactMatch = results.find(r => r.contact.id === 1);
    expect(exactMatch).toBeDefined();
    // 95 + 10 = 99 (capped)
    expect(exactMatch!.confidence).toBe(99);
    expect(exactMatch!.reason).toContain("Same organization");
  });

  it("excludes pending contacts from duplicate suggestions", () => {
    const target = { name: "Pending Person", email: "pending@test.com", organization: null };
    const results = findDuplicates(target, existingContacts);
    const pendingMatch = results.find(r => r.contact.id === 6);
    expect(pendingMatch).toBeUndefined();
  });

  it("returns at most 5 results", () => {
    const manyContacts = Array.from({ length: 20 }, (_, i) => ({
      id: 100 + i,
      name: `Jake Person${i}`,
      email: null,
      organization: null,
      approvalStatus: "approved",
    }));
    const target = { name: "Jake Test", email: null, organization: null };
    const results = findDuplicates(target, manyContacts);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("returns results sorted by confidence descending", () => {
    const target = { name: "Jake Ryan", email: null, organization: null };
    const results = findDuplicates(target, existingContacts);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });

  it("returns empty array when no matches found", () => {
    const target = { name: "Zz Completely Unique Name", email: "unique@unique.com", organization: "Unique Corp" };
    const results = findDuplicates(target, existingContacts);
    expect(results).toEqual([]);
  });

  it("handles case-insensitive matching", () => {
    const target = { name: "JAKE RYAN", email: null, organization: null };
    const results = findDuplicates(target, existingContacts);
    const exactMatch = results.find(r => r.contact.id === 1);
    expect(exactMatch).toBeDefined();
    expect(exactMatch!.confidence).toBe(95);
  });

  it("detects same last name + same org", () => {
    const target = { name: "Robert McDonald", email: null, organization: "Other Inc" };
    const results = findDuplicates(target, existingContacts);
    // Should match Jake McDonald (id: 4) and Jacob McDonald (id: 8) via same last name + org
    const lastNameOrgMatches = results.filter(r => r.reason.includes("Same last name + organization"));
    expect(lastNameOrgMatches.length).toBeGreaterThan(0);
  });
});

describe("Contact Merge Data Transfer", () => {
  it("correctly identifies which fields to transfer from pending to target", () => {
    const target = {
      email: "existing@test.com",
      phone: null,
      organization: "Existing Org",
      title: null,
      dateOfBirth: null,
      address: null,
      website: null,
      linkedin: null,
    };
    const pending = {
      email: "pending@test.com",
      phone: "+1234567890",
      organization: null,
      title: "CEO",
      dateOfBirth: "1990-01-01",
      address: "123 Main St",
      website: "https://example.com",
      linkedin: "https://linkedin.com/in/test",
    };

    // Simulate the merge logic: fill missing fields from pending
    const updates: Record<string, string> = {};
    if (!target.email && pending.email) updates.email = pending.email;
    if (!target.phone && pending.phone) updates.phone = pending.phone;
    if (!target.organization && pending.organization) updates.organization = pending.organization;
    if (!target.title && pending.title) updates.title = pending.title;
    if (!target.dateOfBirth && pending.dateOfBirth) updates.dateOfBirth = pending.dateOfBirth;
    if (!target.address && pending.address) updates.address = pending.address;
    if (!target.website && pending.website) updates.website = pending.website;
    if (!target.linkedin && pending.linkedin) updates.linkedin = pending.linkedin;

    // Should NOT overwrite existing email
    expect(updates.email).toBeUndefined();
    // Should NOT overwrite existing organization
    expect(updates.organization).toBeUndefined();
    // Should fill in missing fields
    expect(updates.phone).toBe("+1234567890");
    expect(updates.title).toBe("CEO");
    expect(updates.dateOfBirth).toBe("1990-01-01");
    expect(updates.address).toBe("123 Main St");
    expect(updates.website).toBe("https://example.com");
    expect(updates.linkedin).toBe("https://linkedin.com/in/test");
  });

  it("does not create updates when pending has no new info", () => {
    const target = {
      email: "existing@test.com",
      phone: "+1111111111",
      organization: "Existing Org",
      title: "CTO",
      dateOfBirth: "1985-05-15",
      address: "456 Oak Ave",
      website: "https://existing.com",
      linkedin: "https://linkedin.com/in/existing",
    };
    const pending = {
      email: null,
      phone: null,
      organization: null,
      title: null,
      dateOfBirth: null,
      address: null,
      website: null,
      linkedin: null,
    };

    const updates: Record<string, string> = {};
    if (!target.email && pending.email) updates.email = pending.email;
    if (!target.phone && pending.phone) updates.phone = pending.phone;
    if (!target.organization && pending.organization) updates.organization = pending.organization;
    if (!target.title && pending.title) updates.title = pending.title;

    expect(Object.keys(updates).length).toBe(0);
  });
});

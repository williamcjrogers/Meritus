import { actionFixture } from "./fixtures.test-support";
import type { ActionView } from "./types";
export function viewFixture(overrides: Partial<ActionView> = {}): ActionView { return { ...actionFixture({ ownerId: "director-1", dueDate: "2026-09-15", originalDueDate: "2026-09-15" }), ownerName: "Mateo Diaz", relatedLabel: "Kubik Construction", relatedHref: "/portal/pursuits/lead-1", isPrimary: false, linkAvailable: true, ...overrides }; }
export const directoryFixture = { available: true, directors: [{ id: "director-1", name: "Mateo Diaz", email: "mateo@example.test", initials: "MD" }] };

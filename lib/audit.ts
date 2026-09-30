export type AuditEvent = {
  id: string;
  at: string;
  actor: "USER" | "SYSTEM" | "CONNECTOR";
  action: string;
  entityType: "PRODUCT" | "SUPPLIER" | "CONNECTOR" | "SALON" | "SYSTEM";
  entityId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
};

export function makeAuditEvent(input: Omit<AuditEvent, "id" | "at">): AuditEvent {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    ...input
  };
}

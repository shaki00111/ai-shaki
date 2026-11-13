export interface VipEntitlementSnapshot {
  vipStatus: boolean;
  vipExpiresAt?: number;
  vipPermissions?: Record<string, boolean>;
  vipLimits?: Record<string, number>;
}

/** Read only entitlement fields from the persisted session, never usage counters. */
export function readVipEntitlementSnapshot(raw: unknown): VipEntitlementSnapshot {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const expiry = Number(value.vipExpiresAt);
  const permissionsRaw = value.vipPermissions && typeof value.vipPermissions === "object"
    ? value.vipPermissions as Record<string, unknown> : null;
  const limitsRaw = value.vipLimits && typeof value.vipLimits === "object"
    ? value.vipLimits as Record<string, unknown> : null;
  const permissions: Record<string, boolean> = {};
  const limits: Record<string, number> = {};
  if (permissionsRaw) {
    for (const [key, enabled] of Object.entries(permissionsRaw)) {
      if (typeof enabled === "boolean") permissions[key] = enabled;
    }
  }
  if (limitsRaw) {
    for (const [key, limit] of Object.entries(limitsRaw)) {
      const n = Number(limit);
      if (Number.isFinite(n) && n >= 0) limits[key] = n;
    }
  }
  return {
    vipStatus: value.vipStatus === true,
    vipExpiresAt: Number.isFinite(expiry) && expiry > 0 ? expiry : undefined,
    vipPermissions: Object.keys(permissions).length ? permissions : undefined,
    vipLimits: Object.keys(limits).length ? limits : undefined,
  };
}

export function isVipEntitlementActive(snapshot: VipEntitlementSnapshot, now = Date.now()): boolean {
  return snapshot.vipStatus && (!snapshot.vipExpiresAt || snapshot.vipExpiresAt > now);
}

/** VIP limits are independent of free-tier per-user overrides. */
export function resolveVipDailyLimit(
  isVip: boolean,
  vipLimit: number | undefined,
  freeTierOverride: number | undefined,
  defaultLimit: number,
): number {
  const override = isVip ? vipLimit : freeTierOverride;
  return typeof override === "number" && Number.isFinite(override) && override >= 0
    ? override
    : defaultLimit;
}

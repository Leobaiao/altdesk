import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { getPool } from "./db.js";

export type AuthUser = { userId: string; tenantId: string; role: string; };

const JWT_SECRET = process.env.JWT_SECRET!;

export function signToken(u: AuthUser) {
  return jwt.sign(u, JWT_SECRET, { expiresIn: "12h" });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser;
}

export async function hashPassword(plain: string) {
  const hash = await bcrypt.hash(plain, 12);
  return Buffer.from(hash, "utf8");
}

export async function verifyPassword(plain: string, hashBytes: Buffer) {
  return bcrypt.compare(plain, hashBytes.toString("utf8"));
}

export async function assertTenantActive(tenantId: string) {
  const pool = await getPool();
  const r = await pool.request()
    .input("tenantId", tenantId)
    .query(`
      SELECT TOP 1 AgentsSeatLimit, ExpiresAt
      FROM omni.Subscription
      WHERE TenantId = @tenantId AND IsActive = 1
      ORDER BY ExpiresAt DESC
    `);

  if (r.recordset.length === 0) throw new Error("Tenant sem assinatura ativa.");
  const sub = r.recordset[0];
  const expiresAt = new Date(sub.ExpiresAt);
  if (expiresAt.getTime() < Date.now()) throw new Error("Assinatura vencida.");
  return { agentsSeatLimit: sub.AgentsSeatLimit as number, expiresAt };
}

export async function assertAgentSeatAvailable(tenantId: string) {
  const { agentsSeatLimit } = await assertTenantActive(tenantId);
  const pool = await getPool();
  const used = await pool.request()
    .input("tenantId", tenantId)
    .query(`SELECT COUNT(1) AS Cnt FROM omni.Agent WHERE TenantId=@tenantId AND IsActive=1`);
  if ((used.recordset[0].Cnt as number) >= agentsSeatLimit) {
    throw new Error("Limite de agentes atingido para o plano.");
  }
}

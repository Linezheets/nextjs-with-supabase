/**
 * Resolve a buyer's email for an order. buyer_name is sometimes the email
 * itself (guest/legacy orders); otherwise look it up from the auth user by id.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveBuyerEmail(admin: any, buyerName: string | null | undefined, buyerId: string | null | undefined): Promise<string | null> {
  if (buyerName && String(buyerName).includes('@')) return String(buyerName);
  if (buyerId) {
    try {
      const { data } = await admin.auth.admin.getUserById(buyerId);
      return data?.user?.email ?? null;
    } catch { return null; }
  }
  return null;
}

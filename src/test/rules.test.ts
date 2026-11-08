import { beforeEach, describe, expect, it } from "vitest";
import { findAccount, isAdminEmail, logout, readSession, resetPassword, signIn, signUp } from "@/lib/auth";
import { revenueOf, stockDelta } from "@/lib/business";
import { getEmailConfig, saveEmailConfig } from "@/lib/email";
import type { Order } from "@/lib/storage";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("auth rules", () => {
  it("treats emails containing admin and the owner email as admin", () => {
    expect(isAdminEmail("admin@eminentbusinesshub.com")).toBe(true);
    expect(isAdminEmail("shopadmin@gmail.com")).toBe(true);
    expect(isAdminEmail("eminentbusinesshubhotmail@gmail.com")).toBe(true);
    expect(isAdminEmail("okechukwudestiny428@gmail.com")).toBe(false);
    expect(isAdminEmail("ada@gmail.com")).toBe(false);
  });

  it("logout keeps email, business, phone and password", async () => {
    await signUp({ email: "ada@gmail.com", business: "Ada Fabrics", phone: "08031234567", password: "secret1", remember: true });
    logout();
    expect(localStorage.getItem("ebh_is_logged_in")).toBeNull();
    expect(localStorage.getItem("ebh_role")).toBeNull();
    expect(localStorage.getItem("ebh_email")).toBe("ada@gmail.com");
    expect(localStorage.getItem("ebh_business")).toBe("Ada Fabrics");
    expect(localStorage.getItem("ebh_phone")).toBe("08031234567");
    expect(localStorage.getItem("ebh_password")).toBeTruthy();
    const again = await signIn({ email: "ada@gmail.com", password: "secret1", remember: true });
    expect(again.ok).toBe(true);
  });

  it("remember me off ends the session when the browser closes", async () => {
    await signUp({ email: "ada@gmail.com", business: "Ada", phone: "08031234567", password: "secret1", remember: false });
    expect(readSession()).not.toBeNull();
    sessionStorage.clear(); // browser closed
    expect(readSession()).toBeNull();
  });

  it("remember me on lasts 30 days", async () => {
    await signUp({ email: "ada@gmail.com", business: "Ada", phone: "08031234567", password: "secret1", remember: true });
    sessionStorage.clear();
    expect(readSession(Date.now() + 29 * 86400000)).not.toBeNull();
    expect(readSession(Date.now() + 31 * 86400000)).toBeNull();
  });
});

describe("password recovery", () => {
  const make = async () => {
    await signUp({ email: "ada@gmail.com", business: "Ada Fabrics", phone: "0803 123 4567", password: "oldpass1", remember: true });
    logout();
  };
  it("finds the account by the sign-up email", async () => {
    await make();
    expect(findAccount("ADA@gmail.com ")?.business).toBe("Ada Fabrics");
    expect(findAccount("nobody@gmail.com")).toBeNull();
  });
  it("resets with the sign-up phone and the new password works", async () => {
    await make();
    const res = await resetPassword({ email: "ada@gmail.com", proof: "+234 803 123 4567", newPassword: "newpass1" });
    expect(res.ok).toBe(true);
    expect(readSession()?.email).toBe("ada@gmail.com");
    logout();
    expect((await signIn({ email: "ada@gmail.com", password: "newpass1", remember: true })).ok).toBe(true);
    expect((await signIn({ email: "ada@gmail.com", password: "oldpass1", remember: true })).ok).toBe(false);
  });
  it("refuses a wrong phone number and keeps the old password", async () => {
    await make();
    const res = await resetPassword({ email: "ada@gmail.com", proof: "08099999999", newPassword: "newpass1" });
    expect(res.ok).toBe(false);
    expect((await signIn({ email: "ada@gmail.com", password: "oldpass1", remember: true })).ok).toBe(true);
  });
});

describe("owner email", () => {
  it("uses the new owner for default welcome-email replies", () => {
    expect(getEmailConfig().replyTo).toBe("eminentbusinesshubhotmail@gmail.com");
  });
  it("replaces the old owner in previously saved email settings", () => {
    saveEmailConfig({ publicKey: "test-public", serviceId: "test-service", templateId: "test-template", replyTo: "okechukwudestiny428@gmail.com" });
    expect(getEmailConfig().replyTo).toBe("eminentbusinesshubhotmail@gmail.com");
  });
});

describe("business rules", () => {
  const o = (status: Order["status"], total: number): Order => ({
    id: status + total, ownerEmail: "a", customerName: "c", customerPhone: "", productId: "p", productName: "P", quantity: 1, total, status, createdAt: new Date().toISOString(),
  });
  it("revenue counts completed orders only", () => {
    expect(revenueOf([o("Completed", 5000), o("Pending", 3000), o("Cancelled", 2000)])).toBe(5000);
  });
  it("cancelling gives stock back, reopening takes it again", () => {
    expect(stockDelta(null, "Pending", 2)).toBe(-2);
    expect(stockDelta("Pending", "Cancelled", 2)).toBe(2);
    expect(stockDelta("Cancelled", "Completed", 2)).toBe(-2);
    expect(stockDelta("Pending", "Completed", 2)).toBe(0);
  });
});

describe("public shop", () => {
  const vendor = { email: "ada@gmail.com", business: "Ada Fabrics", phone: "0803 123 4567" };
  const product = (over: Partial<import("@/lib/storage").Product> = {}) => ({
    id: "p1", ownerEmail: vendor.email, name: "Ankara Dress", price: 18500, stock: 3,
    imageUrl: "", category: "Fashion", createdAt: "2026-11-01T00:00:00.000Z", ...over,
  });

  it("hides products from deleted sellers and filters by category", async () => {
    const { shopListing } = await import("@/lib/business");
    const items = [product(), product({ id: "p2", category: "Beauty" }), product({ id: "p3", ownerEmail: "gone@gmail.com" })];
    expect(shopListing(items, [vendor]).map((p) => p.id).sort()).toEqual(["p1", "p2"]);
    expect(shopListing(items, [vendor], { category: "Beauty" }).map((p) => p.id)).toEqual(["p2"]);
    expect(shopListing(items, [vendor])[0]?.vendor.business).toBe("Ada Fabrics");
  });

  it("refuses orders above stock, sold-out items, or without name/phone", async () => {
    const { validateShopOrder } = await import("@/lib/business");
    const ok = { stock: 3, quantity: 2, name: "Chika", phone: "08031234567" };
    expect(validateShopOrder(ok)).toBeNull();
    expect(validateShopOrder({ ...ok, quantity: 4 })).toBe("Only 3 left in stock");
    expect(validateShopOrder({ ...ok, stock: 0, quantity: 1 })).toBe("This item is sold out");
    expect(validateShopOrder({ ...ok, quantity: 0 })).not.toBeNull();
    expect(validateShopOrder({ ...ok, name: " " })).not.toBeNull();
    expect(validateShopOrder({ ...ok, phone: "0803" })).not.toBeNull();
  });

  it("a shop order goes to the seller as Pending and takes the stock", async () => {
    const { placeShopOrder } = await import("@/lib/actions");
    const { getOrders, getProducts, setProducts } = await import("@/lib/storage");
    setProducts([product()]);
    const res = placeShopOrder({ productId: "p1", quantity: 2, name: "Chika", phone: "08031234567", note: "Rumuola" });
    expect(res.ok).toBe(true);
    const order = getOrders()[0]!;
    expect(order.ownerEmail).toBe("ada@gmail.com");
    expect(order.status).toBe("Pending");
    expect(order.total).toBe(37000);
    expect(order.source).toBe("shop");
    expect(getProducts()[0]?.stock).toBe(1);
    expect(placeShopOrder({ productId: "p1", quantity: 2, name: "Chika", phone: "08031234567", note: "" }).ok).toBe(false);
    expect(getOrders()).toHaveLength(1);
  });

  it("turns Nigerian numbers into WhatsApp format", async () => {
    const { toWhatsAppNumber } = await import("@/lib/business");
    expect(toWhatsAppNumber("0803 123 4567")).toBe("2348031234567");
    expect(toWhatsAppNumber("+234 803 123 4567")).toBe("2348031234567");
  });
});

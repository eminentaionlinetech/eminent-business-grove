import { describe, expect, it } from "vitest";
import {
  THIRTY_DAYS_MS, addToCartList, isAdminEmail, paymentBase, paymentMatches, rememberStillValid, resolveCart,
  retryReference, revenueOf, shopListing, stockDelta, toKobo, toWhatsAppNumber, validateShopOrder,
} from "@/lib/business";
import type { Order, Product } from "@/lib/storage";

const seller = (id: string, extra = {}) => ({ id, business: `Shop ${id}`, phone: "08031234567", ...extra });
const product = (id: string, ownerId: string, extra: Partial<Product> = {}): Product => ({
  id, ownerId, name: `Item ${id}`, price: 1000, stock: 5, imageUrl: "", category: "Fashion", createdAt: "2026-01-01", ...extra,
});

describe("admin", () => {
  it("only the owner email and the EBH admin email are admin", () => {
    expect(isAdminEmail("eminentbusinesshubhotmail@gmail.com")).toBe(true);
    expect(isAdminEmail("admin@eminentbusinesshub.com")).toBe(true);
    expect(isAdminEmail("shopadmin@gmail.com")).toBe(false);
    expect(isAdminEmail("ada@gmail.com")).toBe(false);
  });
});

describe("remember me", () => {
  const now = Date.now();
  it("on: lasts 30 days", () => {
    expect(rememberStillValid({ remember: true, expires: now + THIRTY_DAYS_MS, tabFlag: false, now })).toBe(true);
    expect(rememberStillValid({ remember: true, expires: now - 1, tabFlag: true, now })).toBe(false);
  });
  it("off: ends when the browser closes", () => {
    expect(rememberStillValid({ remember: false, expires: 0, tabFlag: false, now })).toBe(false);
    expect(rememberStillValid({ remember: false, expires: 0, tabFlag: true, now })).toBe(true);
  });
});

describe("business rules", () => {
  it("revenue counts completed orders only", () => {
    const o = (status: Order["status"], total: number) => ({ status, total }) as Order;
    expect(revenueOf([o("Completed", 500), o("Pending", 300), o("Cancelled", 900)])).toBe(500);
  });
  it("cancelling gives stock back, reopening takes it again", () => {
    expect(stockDelta(null, "Pending", 2)).toBe(-2);
    expect(stockDelta("Pending", "Cancelled", 2)).toBe(2);
    expect(stockDelta("Cancelled", "Completed", 2)).toBe(-2);
  });
});

describe("public shop shows every seller's products", () => {
  const users = [seller("a"), seller("b", { shopOpen: false })];
  it("lists products from every open seller, never hidden ones or closed shops", () => {
    const list = shopListing([product("1", "a"), product("2", "a", { hidden: true }), product("3", "b"), product("4", "gone")], users);
    expect(list.map((p) => p.id)).toEqual(["1"]);
  });
  it("search finds products by name", () => {
    const list = shopListing([product("1", "a", { name: "Ankara gown" }), product("2", "a", { name: "Shoes" })], users, { q: "ankara" });
    expect(list.map((p) => p.id)).toEqual(["1"]);
  });
  it("cart never goes above stock and flags over-stock lines", () => {
    expect(addToCartList([{ productId: "1", quantity: 4 }], "1", 3, 5)).toEqual([{ productId: "1", quantity: 5 }]);
    const lines = resolveCart([{ productId: "1", quantity: 9 }], [product("1", "a")], users);
    expect(lines[0]!.problem).toBe("Only 5 left");
  });
  it("refuses orders without name/phone or above stock", () => {
    expect(validateShopOrder({ stock: 5, quantity: 1, name: "", phone: "08031234567" })).toBe("Enter your name");
    expect(validateShopOrder({ stock: 2, quantity: 3, name: "Ada", phone: "08031234567" })).toBe("Only 2 left in stock");
    expect(validateShopOrder({ stock: 2, quantity: 1, name: "Ada", phone: "08031234567" })).toBeNull();
  });
  it("turns Nigerian numbers into WhatsApp format", () => {
    expect(toWhatsAppNumber("0803 123 4567")).toBe("2348031234567");
  });
});

describe("Paystack", () => {
  it("only counts success for the exact naira amount", () => {
    expect(toKobo(1500)).toBe(150000);
    expect(paymentMatches(1500, { status: "success", amountKobo: 150000, currency: "NGN" })).toBe(true);
    expect(paymentMatches(1500, { status: "success", amountKobo: 100000, currency: "NGN" })).toBe(false);
  });
  it("retry attempts point back to the same checkout", () => {
    expect(paymentBase(retryReference("ebh_abc123", 1000))).toBe("ebh_abc123");
    expect(paymentBase("ebh_abc123")).toBe("ebh_abc123");
  });
});

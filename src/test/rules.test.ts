import { beforeEach, describe, expect, it } from "vitest";
import { isAdminEmail, logout, readSession, signIn, signUp } from "@/lib/auth";
import { revenueOf, stockDelta } from "@/lib/business";
import type { Order } from "@/lib/storage";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("auth rules", () => {
  it("treats emails containing admin and the owner email as admin", () => {
    expect(isAdminEmail("admin@eminentbusinesshub.com")).toBe(true);
    expect(isAdminEmail("shopadmin@gmail.com")).toBe(true);
    expect(isAdminEmail("okechukwudestiny428@gmail.com")).toBe(true);
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

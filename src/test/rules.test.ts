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
    const { getOrders, getProducts, setProducts, setUsers } = await import("@/lib/storage");
    setUsers([{ ...vendor, passwordHash: "x", role: "user", createdAt: "2026-11-01T00:00:00.000Z" }]);
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

describe("cart and seller shop controls", () => {
  const vendorA = { email: "ada@gmail.com", business: "Ada Fabrics", phone: "08031234567" };
  const vendorB = { email: "emeka@gmail.com", business: "Emeka Gadgets", phone: "08061234567" };
  const product = (over: Partial<import("@/lib/storage").Product> = {}) => ({
    id: "p1", ownerEmail: vendorA.email, name: "Ankara Dress", price: 18500, stock: 3,
    imageUrl: "", category: "Fashion", createdAt: "2026-11-01T00:00:00.000Z", ...over,
  });
  const asUser = (u: typeof vendorA, over: Partial<import("@/lib/storage").AppUser> = {}) => ({
    ...u, passwordHash: "x", role: "user" as const, createdAt: "2026-11-01T00:00:00.000Z", ...over,
  });

  it("hidden products and closed shops do not appear in the public shop", async () => {
    const { shopListing } = await import("@/lib/business");
    const items = [product(), product({ id: "p2", hidden: true }), product({ id: "p3", ownerEmail: vendorB.email })];
    expect(shopListing(items, [vendorA, vendorB]).map((p) => p.id).sort()).toEqual(["p1", "p3"]);
    expect(shopListing(items, [vendorA, { ...vendorB, shopOpen: false }]).map((p) => p.id)).toEqual(["p1"]);
  });

  it("adding to cart merges the same product and never goes above stock", async () => {
    const { addToCartList } = await import("@/lib/business");
    let cart = addToCartList([], "p1", 2, 3);
    expect(cart).toEqual([{ productId: "p1", quantity: 2 }]);
    cart = addToCartList(cart, "p1", 5, 3);
    expect(cart).toEqual([{ productId: "p1", quantity: 3 }]);
  });

  it("checkout sends one Pending order per item to the right seller and empties the cart", async () => {
    const { addToCart, checkoutCart } = await import("@/lib/actions");
    const { getCart, getOrders, getProducts, setProducts, setUsers } = await import("@/lib/storage");
    setUsers([asUser(vendorA), asUser(vendorB)]);
    setProducts([product(), product({ id: "p3", ownerEmail: vendorB.email, name: "Power Bank", price: 9000, stock: 5 })]);
    addToCart("p1", 2);
    addToCart("p3", 1);
    const res = checkoutCart({ name: "Chika", phone: "08031234567", note: "Rumuola" });
    expect(res.ok).toBe(true);
    const orders = getOrders();
    expect(orders).toHaveLength(2);
    expect(orders.find((o) => o.productId === "p1")).toMatchObject({ ownerEmail: vendorA.email, total: 37000, status: "Pending", source: "shop" });
    expect(orders.find((o) => o.productId === "p3")).toMatchObject({ ownerEmail: vendorB.email, total: 9000, status: "Pending" });
    expect(getProducts().find((p) => p.id === "p1")?.stock).toBe(1);
    expect(getCart()).toEqual([]);
  });

  it("checkout places nothing when any cart item is over stock or hidden", async () => {
    const { checkoutCart } = await import("@/lib/actions");
    const { getOrders, setCart, setProducts, setUsers } = await import("@/lib/storage");
    setUsers([asUser(vendorA)]);
    setProducts([product(), product({ id: "p2", stock: 10 })]);
    setCart([{ productId: "p2", quantity: 1 }, { productId: "p1", quantity: 4 }]);
    expect(checkoutCart({ name: "Chika", phone: "08031234567", note: "" }).ok).toBe(false);
    setProducts([product(), product({ id: "p2", stock: 10, hidden: true })]);
    setCart([{ productId: "p1", quantity: 1 }, { productId: "p2", quantity: 1 }]);
    expect(checkoutCart({ name: "Chika", phone: "08031234567", note: "" }).ok).toBe(false);
    expect(getOrders()).toHaveLength(0);
  });

  it("a closed shop cannot take orders", async () => {
    const { placeShopOrder, addToCart } = await import("@/lib/actions");
    const { setProducts, setUsers } = await import("@/lib/storage");
    setUsers([asUser(vendorA, { shopOpen: false })]);
    setProducts([product()]);
    expect(addToCart("p1", 1).ok).toBe(false);
    expect(placeShopOrder({ productId: "p1", quantity: 1, name: "Chika", phone: "08031234567", note: "" }).ok).toBe(false);
  });
});

describe("Paystack payments", () => {
  const vendor = { email: "ada@gmail.com", business: "Ada Fabrics", phone: "08031234567", passwordHash: "x", role: "user" as const, createdAt: "2026-11-01T00:00:00.000Z" };
  const product = { id: "p1", ownerEmail: vendor.email, name: "Ankara Dress", price: 18500, stock: 3, imageUrl: "", category: "Fashion", createdAt: "2026-11-01T00:00:00.000Z" };

  it("converts naira to kobo for Paystack", async () => {
    const { toKobo } = await import("@/lib/business");
    expect(toKobo(18500)).toBe(1850000);
    expect(toKobo(49.99)).toBe(4999);
  });

  it("only counts a payment when Paystack says success for the exact naira amount", async () => {
    const { paymentMatches } = await import("@/lib/business");
    expect(paymentMatches(37000, { status: "success", amountKobo: 3700000, currency: "NGN" })).toBe(true);
    expect(paymentMatches(37000, { status: "success", amountKobo: 3600000, currency: "NGN" })).toBe(false);
    expect(paymentMatches(37000, { status: "abandoned", amountKobo: 3700000, currency: "NGN" })).toBe(false);
    expect(paymentMatches(37000, { status: "success", amountKobo: 3700000, currency: "USD" })).toBe(false);
  });

  it("pay now needs an email and leaves orders unpaid until Paystack confirms", async () => {
    const { addToCart, checkoutCart, markPaymentPaid } = await import("@/lib/actions");
    const { getOrders, getPendingPayment, setProducts, setUsers } = await import("@/lib/storage");
    setUsers([vendor]);
    setProducts([product]);
    addToCart("p1", 2);
    expect(checkoutCart({ name: "Chika", phone: "08031234567", note: "", payNow: { email: "bad" } }).ok).toBe(false);
    const res = checkoutCart({ name: "Chika", phone: "08031234567", note: "", payNow: { email: "chika@gmail.com" } });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payment?.amount).toBe(37000);
    expect(getOrders()[0]).toMatchObject({ paymentStatus: "unpaid", paymentRef: res.payment?.reference });
    expect(getPendingPayment()?.reference).toBe(res.payment?.reference);
    markPaymentPaid(res.payment!);
    expect(getOrders()[0]?.paymentStatus).toBe("paid");
    expect(getPendingPayment()).toBeNull();
  });

  it("pay later orders are saved without a Paystack payment", async () => {
    const { addToCart, checkoutCart } = await import("@/lib/actions");
    const { getOrders, getPendingPayment, setProducts, setUsers } = await import("@/lib/storage");
    setUsers([vendor]);
    setProducts([product]);
    addToCart("p1", 1);
    const res = checkoutCart({ name: "Chika", phone: "08031234567", note: "" });
    expect(res.ok && res.payment).toBeNull();
    expect(getOrders()[0]?.paymentStatus).toBe("unpaid");
    expect(getPendingPayment()).toBeNull();
  });
});

describe("no fake items", () => {
  it("removes the old example products but keeps real ones", async () => {
    const { removeSampleProducts } = await import("@/lib/actions");
    const { getProducts, setProducts } = await import("@/lib/storage");
    const base = { ownerEmail: "ada@gmail.com", price: 1000, stock: 2, category: "Fashion", createdAt: "2026-11-01T00:00:00.000Z" };
    setProducts([
      { ...base, id: "fake", name: "Ankara Wrap Dress", imageUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=70" },
      { ...base, id: "real", name: "Ankara Wrap Dress", imageUrl: "data:image/jpeg;base64,abc" },
    ]);
    removeSampleProducts();
    expect(getProducts().map((p) => p.id)).toEqual(["real"]);
  });
});

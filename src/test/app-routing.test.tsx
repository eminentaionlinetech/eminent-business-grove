import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});

describe("Shop routing", () => {
  it("matches the shop, a product page and a seller store", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/shop").at(-1)?.routeId).toBe("/shop/");
    expect(router.matchRoutes("/shop/p1").at(-1)?.routeId).toBe("/shop/$productId");
    expect(router.matchRoutes("/shop/cart").at(-1)?.routeId).toBe("/shop/cart");
    expect(router.matchRoutes("/shop/store/ada-x1").at(-1)?.routeId).toBe("/shop/store/$vendor");
  });
});

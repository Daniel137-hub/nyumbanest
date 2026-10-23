import { expect, test } from "@playwright/test";

const mockAuthUrl = "http://127.0.0.1:54329";

function mockAccessToken(userId: string, admin = false, userMetadataRole?: string) {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    app_metadata: admin ? { role: "admin" } : {},
    user_metadata: userMetadataRole ? { role: userMetadataRole } : {},
  })).toString("base64url");
  return `e30.${payload}.mock-signature`;
}

test.beforeEach(async ({ request }) => {
  const response = await request.post(`${mockAuthUrl}/__reset`);
  expect(response.ok()).toBeTruthy();
});

async function signIn(page: import("@playwright/test").Page, next = "/my-listings") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill("member@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Correct123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
}

async function signInAdmin(page: import("@playwright/test").Page, next = "/admin") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Correct123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
}

test("visitors are redirected to sign in with the requested property destination", async ({ page }) => {
  await page.goto("/my-listings/new");
  await expect(page).toHaveURL((url) =>
    url.pathname === "/login" && url.searchParams.get("next") === "/my-listings/new"
  );
});

test("ordinary signed-in users cannot open the admin dashboard", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/my-listings$/);
});

test("admins can review all listings, edit and delete another user's property", async ({ page, request }) => {
  await request.post(`${mockAuthUrl}/__seed-other-property`);
  await signInAdmin(page);

  await expect(page.getByRole("heading", { level: 1, name: "All property listings" })).toBeVisible();
  await expect(page.getByText("Private other-owner draft")).toBeVisible();
  await expect(page.getByText("Owner: Other Property Owner")).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Approve/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("link", { name: "Edit", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Approve/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page).toHaveURL(/\/my-listings\/33333333-3333-4333-8333-333333333333\/edit$/);
  await expect(page.locator('input[name="address"]')).toHaveValue("Near the Arusha clock tower");
  await page.locator('input[name="title"]').fill("Admin corrected listing title");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/admin\?success=updated$/);
  await expect(page.getByText("Admin corrected listing title")).toBeVisible();

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete property" }).click();
  await expect(page.getByRole("heading", { name: "There are no property listings yet." })).toBeVisible();
  const state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.properties).toHaveLength(0);
  expect(state.propertyImages).toHaveLength(0);
  expect(state.storageCount).toBe(0);
});

test("admins can approve pending listings and publish them without setting verified", async ({ page, request }) => {
  await request.post(`${mockAuthUrl}/__seed-other-property`);
  await signInAdmin(page);
  await page.goto("/properties/33333333-3333-4333-8333-333333333333");
  await expect(page.getByRole("heading", { name: "This page could not be found" })).toBeVisible();
  await page.goto("/buy");
  await expect(page.getByText("Private other-owner draft")).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByText("Private other-owner draft")).toBeVisible();
  await page.getByRole("button", { name: /Approve/ }).click();
  await expect(page.getByRole("status")).toContainText("Listing approved and published.");
  const propertyCard = page.locator(".property-card").filter({ hasText: "Private other-owner draft" });
  await expect(propertyCard.locator(".listing-status")).toHaveText("Published");
  await expect(propertyCard.getByRole("button", { name: /Approve/ })).toHaveCount(0);
  const state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.requests.some((entry: { path: string }) => entry.path === "/rest/v1/rpc/approve_property")).toBeTruthy();
  expect(state.properties[0]).toMatchObject({
    status: "published",
    is_verified: false,
  });
  expect(state.properties[0].published_at).toBeTruthy();
  await page.goto("/search?location=Arusha&type=house&transaction=sale");
  await expect(page.getByText("Private other-owner draft")).toBeVisible();
  await page.goto("/buy");
  await expect(page.getByText("Private other-owner draft")).toBeVisible();
  await page.goto("/properties/33333333-3333-4333-8333-333333333333");
  await expect(page.getByRole("heading", { name: "Private other-owner draft" })).toBeVisible();
});

test("normal users see only their own listing actions and cannot approve", async ({ page, request }) => {
  await request.post(`${mockAuthUrl}/__seed-published-property`);
  await request.post(`${mockAuthUrl}/__seed-other-property`);
  await signIn(page);

  const cards = page.locator(".property-card");
  await expect(cards).toHaveCount(1);
  await expect(cards.first().getByRole("link", { name: "Edit", exact: true })).toBeVisible();
  await expect(cards.first().getByRole("button", { name: "Preview" })).toBeVisible();
  await expect(cards.first().getByRole("button", { name: "Delete", exact: true })).toBeVisible();
  await expect(cards.first().getByRole("button", { name: /Approve/ })).toHaveCount(0);
  await expect(page.getByText("Private other-owner draft")).toHaveCount(0);
});

test("approval database failure leaves listing pending and shows an error", async ({ page, request }) => {
  await request.post(`${mockAuthUrl}/__seed-other-property`);
  await request.post(`${mockAuthUrl}/__configure`, { data: { approvalRpcFailure: true } });
  await signInAdmin(page);
  await page.getByRole("button", { name: /Approve Private other-owner draft/ }).click();

  await expect(page.locator(".auth-message--error")).toContainText("We couldn't approve this listing.");
  await expect(page.getByRole("status")).toHaveCount(0);
  const state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.properties[0].status).toBe("pending_review");
});

test("direct mock RPC rejects ordinary users and repeated approval", async ({ request }) => {
  await request.post(`${mockAuthUrl}/__seed-other-property`);
  const propertyId = "33333333-3333-4333-8333-333333333333";
  const rpcUrl = `${mockAuthUrl}/rest/v1/rpc/approve_property`;

  const denied = await request.post(rpcUrl, {
    headers: { authorization: `Bearer ${mockAccessToken("11111111-1111-4111-8111-111111111111")}` },
    data: { target_property_id: propertyId },
  });
  expect(denied.status()).toBe(403);

  const adminHeaders = {
    authorization: `Bearer ${mockAccessToken("88888888-8888-4888-8888-888888888888", true)}`,
  };
  const approved = await request.post(rpcUrl, {
    headers: adminHeaders,
    data: { target_property_id: propertyId },
  });
  expect(approved.status()).toBe(204);

  const repeated = await request.post(rpcUrl, {
    headers: adminHeaders,
    data: { target_property_id: propertyId },
  });
  expect(repeated.status()).toBe(404);
  expect(await repeated.json()).toMatchObject({ code: "P0002" });
});

test("user_metadata admin claims cannot approve listings or read private locations", async ({ request }) => {
  await request.post(`${mockAuthUrl}/__seed-other-property`);
  const propertyId = "33333333-3333-4333-8333-333333333333";
  const headers = {
    authorization: `Bearer ${mockAccessToken("11111111-1111-4111-8111-111111111111", false, "admin")}`,
  };

  const approval = await request.post(`${mockAuthUrl}/rest/v1/rpc/approve_property`, {
    headers,
    data: { target_property_id: propertyId },
  });
  expect(approval.status()).toBe(403);

  const privateLocation = await request.post(
    `${mockAuthUrl}/rest/v1/rpc/get_admin_property_private_location`,
    { headers, data: { target_property_id: propertyId } },
  );
  expect(await privateLocation.json()).toEqual([]);

  const state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.properties[0]).toMatchObject({
    id: propertyId,
    status: "pending_review",
    is_verified: false,
  });
});

test("owners cannot edit or delete another user's listing through direct requests", async ({ request }) => {
  await request.post(`${mockAuthUrl}/__seed-other-property`);
  const propertyId = "33333333-3333-4333-8333-333333333333";
  const headers = {
    authorization: `Bearer ${mockAccessToken("11111111-1111-4111-8111-111111111111")}`,
    prefer: "return=representation",
  };

  const update = await request.patch(
    `${mockAuthUrl}/rest/v1/properties?id=eq.${propertyId}&select=id`,
    { headers, data: { title: "Unauthorized change" } },
  );
  expect(await update.json()).toEqual([]);

  const deletion = await request.delete(
    `${mockAuthUrl}/rest/v1/properties?id=eq.${propertyId}&select=id`,
    { headers },
  );
  expect(await deletion.json()).toEqual([]);

  const state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.properties).toHaveLength(1);
  expect(state.properties[0]).toMatchObject({
    id: propertyId,
    title: "Private other-owner draft",
    status: "pending_review",
  });
});

test("an authenticated owner sees the empty state and can open the new property form", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "My Listings" })).toBeVisible();
  await expect(page.getByText("Manage your properties, update listing details, and track their status.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "You haven't listed any properties yet." })).toBeVisible();
  await page.getByRole("link", { name: "Upload Your First Property" }).click();
  await expect(page).toHaveURL(/\/my-listings\/new$/);
  await expect(page.getByRole("heading", { name: "Add a property" })).toBeVisible();
  await expect(page.getByLabel("Property title")).toBeVisible();
});

test("creates a reviewed listing with photos, edits it, then deletes its row and files", async ({ page, request }) => {
  test.setTimeout(60_000);
  await signIn(page);
  await page.getByRole("link", { name: "Add Property" }).click();
  await page.getByLabel("Property title").fill("Mikocheni family home");
  await page.getByLabel("Description", { exact: true }).fill("A bright family home near local amenities.");
  await page.getByLabel("Transaction type").selectOption("sale");
  await page.getByLabel("Property type").selectOption("house");
  await page.getByLabel("Price in TSh").fill("350000000");
  await page.getByLabel("Property area (m²)").fill("240");
  await page.getByLabel("Region").fill("Dar es Salaam");
  await page.getByLabel("District").fill("Kinondoni");
  await page.getByLabel("Neighborhood").fill("Mikocheni");
  await page.getByLabel("Address or location description").fill("Near the Mikocheni market");
  await page.getByLabel("Bedrooms").fill("4");
  await page.getByLabel("Bathrooms").fill("3");
  await page.getByLabel("Parking spaces").fill("2");
  await page.getByLabel("Furnished").selectOption("false");
  await page.getByLabel("Amenities (comma-separated)").fill("Garden, Water tank");
  await page.getByLabel("Latitude (optional)").fill("-6.77");
  await page.getByLabel("Longitude (optional)").fill("39.25");
  await page.getByLabel("Choose property photos").setInputFiles({
    name: "front.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await expect(page.getByRole("img", { name: /front\.jpg/ })).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();

  await expect(page).toHaveURL(/\/my-listings\?success=created$/);
  await expect(page.getByRole("status")).toContainText("Your property was saved successfully");
  await expect(page.getByText("Mikocheni family home")).toBeVisible();
  await expect(page.getByText("Pending review").first()).toBeVisible();

  let state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.properties).toHaveLength(1);
  expect(state.properties[0]).toMatchObject({
    title: "Mikocheni family home",
    status: "pending_review",
    is_verified: false,
    bedrooms: 4,
    bathrooms: 3,
    amenities: ["Garden", "Water tank"],
  });
  expect(state.propertyImages).toHaveLength(1);
  expect(state.storageCount).toBe(1);

  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("dialog", { name: "Mikocheni family home" })).toBeVisible();
  await page.getByRole("button", { name: "Close preview" }).click();

  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page).toHaveURL(/\/my-listings\/[0-9a-f-]+\/edit$/);
  await expect(page.locator('input[name="address"]:visible').first()).toHaveValue("Near the Mikocheni market");
  await expect(page.locator('input[name="latitude"]:visible').first()).toHaveValue("-6.77");
  await expect(page.locator('input[name="longitude"]:visible').first()).toHaveValue("39.25");
  await page.locator('input[name="title"]:visible').fill("Updated Mikocheni family home");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/my-listings\?success=updated$/);
  await expect(page.getByText("Updated Mikocheni family home")).toBeVisible();

  state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.properties[0].title).toBe("Updated Mikocheni family home");
  expect(state.properties[0].status).toBe("draft");

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Delete/ })).toBeVisible();
  await page.getByRole("button", { name: "Delete property" }).click();
  await expect(page.getByRole("heading", { name: "You haven't listed any properties yet." })).toBeVisible();

  state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.properties).toHaveLength(0);
  expect(state.propertyImages).toHaveLength(0);
  expect(state.storageCount).toBe(0);
});

test("another owner's private draft is not listed or editable", async ({ page, request }) => {
  await request.post(`${mockAuthUrl}/__seed-other-property`);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "You haven't listed any properties yet." })).toBeVisible();
  await expect(page.getByText("Private other-owner draft")).toHaveCount(0);
  await page.goto("/my-listings/33333333-3333-4333-8333-333333333333/edit");
  await expect(page).toHaveURL(/\/my-listings$/);
});

test("editing a live property returns it to review without keeping verification", async ({ page, request }) => {
  await request.post(`${mockAuthUrl}/__seed-published-property`);
  await signIn(page);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.locator('input[name="title"]:visible').fill("Updated live listing");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/my-listings\?success=updated$/);

  const state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.properties[0]).toMatchObject({
    title: "Updated live listing",
    status: "pending_review",
    is_verified: false,
    published_at: null,
  });
});

test("a failed listing query displays an error and never the empty state", async ({ page, request }) => {
  await request.post(`${mockAuthUrl}/__configure`, { data: { propertyQueryFailure: true } });
  await signIn(page);
  await expect(page.getByRole("heading", { name: "We couldn't load your listings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "You haven't listed any properties yet." })).toHaveCount(0);
});

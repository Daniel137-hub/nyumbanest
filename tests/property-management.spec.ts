import { expect, test } from "@playwright/test";

const mockAuthUrl = "http://127.0.0.1:54329";

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

test("visitors are redirected to sign in with the requested property destination", async ({ page }) => {
  await page.goto("/my-listings/new");
  await expect(page).toHaveURL((url) =>
    url.pathname === "/login" && url.searchParams.get("next") === "/my-listings/new"
  );
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

import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const mockAuthUrl = "http://127.0.0.1:54329";
const publishedId = "44444444-4444-4444-8444-444444444444";

test.beforeEach(async ({ request }) => {
  const response = await request.post(`${mockAuthUrl}/__reset`);
  expect(response.ok()).toBeTruthy();
});

async function seedMarketplace(request: import("@playwright/test").APIRequestContext) {
  const response = await request.post(`${mockAuthUrl}/__seed-marketplace`);
  expect(response.ok()).toBeTruthy();
}

async function signIn(page: import("@playwright/test").Page, next = "/saved") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address").fill("member@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Correct123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
}

test("homepage and category routes use only published Supabase listings", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "No properties are listed yet" })).toBeVisible();
  await expect(page.getByText("Modern 4 Bedroom House")).toHaveCount(0);

  await seedMarketplace(request);
  await page.goto("/buy");
  await expect(page.getByText("Owner published listing")).toBeVisible();
  await expect(page.getByText("Kigamboni residential plot")).toBeVisible();
  await expect(page.getByText("Garden apartment for rent")).toHaveCount(0);

  await page.goto("/rent");
  await expect(page.getByText("Garden apartment for rent")).toBeVisible();
  await expect(page.getByText("Downtown office space")).toBeVisible();

  await page.goto("/land");
  await expect(page.getByText("Kigamboni residential plot")).toBeVisible();
  await expect(page.getByText("Owner published listing")).toHaveCount(0);

  await page.goto("/commercial");
  await expect(page.getByText("Downtown office space")).toBeVisible();
  await expect(page.getByText("Kigamboni residential plot")).toHaveCount(0);

  await page.goto("/properties");
  await expect(page.getByText("Private street address")).toHaveCount(0);
  await expect(page.getByText("Private other-owner draft")).toHaveCount(0);
  await expect(page.getByText("Owner published listing")).toBeVisible();
});

test("homepage carousel loads its three local images and stays accessible without horizontal overflow", async ({
  page,
  request,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("requestfailed", (failedRequest) => {
    browserErrors.push(`${failedRequest.url()}: ${failedRequest.failure()?.errorText ?? "request failed"}`);
  });
  const imagePaths = [
    "/Hero-1.png",
    "/Hero-2.png",
    "/Hero-3.png",
  ];
  const imageResponses = await Promise.all(imagePaths.map((path) => request.get(path)));
  expect(imageResponses.every((response) => response.ok())).toBe(true);

  await page.goto("/");
  const carousel = page.getByRole("group", { name: "Featured homes" });
  const slides = carousel.getByRole("group", { name: /\d of 3/ });
  await expect(slides).toHaveCount(3);
  await expect(carousel.locator(".hero__slide")).toHaveCount(3);
  await expect(carousel.locator("img")).toHaveCount(3);
  await expect(slides.nth(0).getByRole("img", {
    name: "Modern villa overlooking the city at sunset",
  })).toBeAttached();
  await expect(slides.nth(1).getByRole("img", {
    name: "Contemporary apartment complex at sunset",
  })).toBeAttached();
  await expect(slides.nth(2).getByRole("img", {
    name: "Residential plot of land in a green landscape at sunset",
  })).toBeAttached();

  const sampleActiveSlide = async (time: number) => carousel.evaluate((element, currentTime) => {
    const slides = [...element.querySelectorAll<HTMLElement>(".hero__slide")];
    const animations = slides.map((slide) => {
      const animation = slide.getAnimations()[0];
      animation.pause();
      animation.currentTime = currentTime;
      return animation;
    });
    const opacities = slides.map((slide) => Number(getComputedStyle(slide).opacity));
    animations.forEach((animation) => animation.play());
    return opacities.indexOf(Math.max(...opacities));
  }, time);
  await expect.poll(() => slides.nth(0).evaluate((element) =>
    getComputedStyle(element).animationDuration,
  )).toBe("21s");
  expect(await sampleActiveSlide(500)).toBe(0);
  expect(await sampleActiveSlide(7500)).toBe(1);
  expect(await sampleActiveSlide(14500)).toBe(2);
  expect(await sampleActiveSlide(20500)).toBe(0);

  await page.locator(".hero").hover();
  await expect.poll(() => slides.nth(0).evaluate((element) =>
    getComputedStyle(element).animationPlayState,
  )).toBe("paused");
  await page.mouse.move(0, 0);
  await page.getByLabel("Location").focus();
  await expect.poll(() => slides.nth(0).evaluate((element) =>
    getComputedStyle(element).animationPlayState,
  )).toBe("paused");

  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(width);
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => slides.nth(0).evaluate((element) =>
    getComputedStyle(element).animationName,
  )).toBe("none");
  await expect(carousel.locator(".hero__slide:visible")).toHaveCount(1);
  await expect.poll(() => slides.nth(0).locator("img").evaluate((image) =>
    (image as HTMLImageElement).naturalWidth,
  )).toBeGreaterThan(0);
  expect(browserErrors).toEqual([]);
});

test("search query filters and sorting are bounded and shareable in the URL", async ({ page, request }) => {
  await seedMarketplace(request);
  await page.goto("/search?location=Arusha&type=apartment&transaction=rent&minPrice=1000000&maxPrice=2500000&bedrooms=2&sort=price_asc");
  await expect(page.getByText("Garden apartment for rent")).toBeVisible();
  await expect(page.getByText("Owner published listing")).toHaveCount(0);

  await page.goto("/properties?sort=price_asc");
  const priceAmounts = await page.locator(".property-card__price").allTextContents();
  const numericPrices = priceAmounts.map((value) => Number(value.replace(/\D/g, "")));
  expect(numericPrices).toEqual([...numericPrices].sort((left, right) => left - right));
  await page.goto("/properties?sort=price_desc");
  const descendingAmounts = await page.locator(".property-card__price").allTextContents();
  const descendingPrices = descendingAmounts.map((value) => Number(value.replace(/\D/g, "")));
  expect(descendingPrices).toEqual([...descendingPrices].sort((left, right) => right - left));

  await page.goto("/search?location=Arusha&type=apartment&transaction=rent&minPrice=1000000&maxPrice=2500000&bedrooms=2&sort=price_asc");
  await page.getByLabel("Minimum price (TSh)").fill("2500000");
  await page.getByLabel("Maximum price (TSh)").fill("1000000");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("status")).toContainText("invalid search filters");
  await expect(page).toHaveURL(/minPrice=2500000/);

  await page.goto("/search?minPrice=999999999999999999999999&page=999999999999");
  await expect(page.getByRole("status")).toContainText("invalid search filters");
});

test("property details show public details, gallery, similar listings, and 404 for unpublished records", async ({ page, request }) => {
  await seedMarketplace(request);
  await request.post(`${mockAuthUrl}/__seed-other-property`);
  await page.goto(`/properties/${publishedId}`);
  await expect(page.getByRole("heading", { name: "Owner published listing" })).toBeVisible();
  await expect(page.getByText("3 bedrooms")).toBeVisible();
  await expect(page.getByText("Verified listing")).toBeVisible();
  await expect(page.getByRole("img", { name: "Owner published listing photo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Similar listings" })).toBeVisible();
  await expect(page.getByText("Private street address")).toHaveCount(0);

  await page.goto("/properties/33333333-3333-4333-8333-333333333333");
  await expect(page.getByRole("heading", { name: "This page could not be found" })).toBeVisible();
});

test("favorites prompt sign-in, persist, and can be removed", async ({ page, request }) => {
  await seedMarketplace(request);
  await page.goto(`/properties/${publishedId}`);
  await page.getByRole("link", { name: "Sign in to save Owner published listing" }).click();
  await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(`/properties/${publishedId}`)}`));

  await signIn(page, `/properties/${publishedId}`);
  await page.getByRole("button", { name: "Save Owner published listing" }).click();
  await expect(page.getByRole("button", { name: "Remove Owner published listing from saved homes" })).toBeVisible();
  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: "Saved properties" })).toBeVisible();
  await expect(page.getByText("Owner published listing")).toBeVisible();

  await page.getByRole("button", { name: "Remove Owner published listing from saved homes" }).click();
  await expect(page.getByRole("heading", { name: "You haven't saved any properties yet" })).toBeVisible();
  const state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.favorites).toHaveLength(0);
});

test("favorite and inquiry failures are visible and do not report success", async ({ page, request }) => {
  await seedMarketplace(request);
  await request.post(`${mockAuthUrl}/__configure`, {
    data: { favoriteMutationFailure: true, inquiryMutationFailure: true },
  });
  await signIn(page, `/properties/${publishedId}`);
  await page.goto(`/properties/${publishedId}`);
  await page.getByRole("button", { name: "Save Owner published listing" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "couldn't save this property" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Owner published listing" })).toHaveAttribute("aria-pressed", "false");

  const form = page.getByRole("form", { name: "Interested in this property?" });
  await form.getByLabel("Your name").fill("Marketplace Visitor");
  await form.getByLabel("Email address").fill("error@example.com");
  await form.getByLabel("Message").fill("I would like more information about the available property.");
  await form.getByRole("button", { name: "Send inquiry" }).click();
  await expect(page.locator(".form-message--error")).toContainText("couldn't send your inquiry");
  await expect(page.locator(".form-message--success")).toHaveCount(0);
  const state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.favorites).toHaveLength(0);
  expect(state.inquiries).toHaveLength(0);
});

test("inquiries validate, submit for published properties, and rate-limit repeated senders", async ({ page, request }) => {
  await seedMarketplace(request);
  await page.goto(`/properties/${publishedId}`);
  const form = page.getByRole("form", { name: "Interested in this property?" });
  await form.getByLabel("Your name").fill("Marketplace Visitor");
  await form.getByLabel("Email address").fill("visitor@example.com");
  await form.getByLabel("Phone number").fill("+255 700 000 000");
  await form.getByLabel("Message").fill("I would like to arrange a viewing of this property.");
  const sendButton = form.getByRole("button", { name: "Send inquiry" });
  await sendButton.click();
  await expect(page.getByRole("status")).toContainText("Your inquiry was sent");

  let state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.inquiries).toHaveLength(1);
  expect(state.inquiries[0]).toMatchObject({
    property_id: publishedId,
    sender_id: null,
    sender_email: "visitor@example.com",
  });

  for (let index = 0; index < 3; index += 1) {
    await page.getByLabel("Your name").fill("Marketplace Visitor");
    await page.getByLabel("Email address").fill("visitor@example.com");
    await page.getByLabel("Message").fill("Please send me more information about this home.");
    await sendButton.click();
    if (index < 2) {
      const expectedCount = index + 2;
      await expect.poll(async () => {
        const response = await request.get(`${mockAuthUrl}/__state`);
        const current = await response.json();
        return current.inquiries.length;
      }).toBe(expectedCount);
      await expect(sendButton).toBeEnabled();
    } else {
      await expect.poll(async () => {
        const response = await request.get(`${mockAuthUrl}/__state`);
        const current = await response.json();
        return current.requests.filter((item: { path: string }) => item.path.endsWith("/inquiries")).length;
      }).toBe(4);
      await expect(page.locator(".form-message--error")).toContainText("sent several messages recently", {
        timeout: 10_000,
      });
    }
  }
  state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.inquiries).toHaveLength(3);
});

test("failed public property queries display an error instead of an empty result", async ({ page, request }) => {
  await request.post(`${mockAuthUrl}/__configure`, { data: { propertyQueryFailure: true } });
  await page.goto("/properties");
  await expect(page.getByRole("heading", { name: "Properties are temporarily unavailable" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No matching properties" })).toHaveCount(0);
});

test("property search remains usable on a narrow viewport", async ({ page, request }) => {
  await seedMarketplace(request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/properties");
  await expect(page.getByRole("heading", { name: "All properties" })).toBeVisible();
  await expect(page.getByLabel("Location")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Mobile shortcuts" })).toBeVisible();
});

test("marketplace and authentication layouts fit mobile, tablet, and desktop widths", async ({ page, request }) => {
  await seedMarketplace(request);
  const widths = [320, 390, 680, 768, 820, 821, 900, 1024, 1440];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const dimensions = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.documentWidth, `homepage at ${width}px`).toBeLessThanOrEqual(dimensions.viewportWidth);
  }

  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/properties", `/properties/${publishedId}`, "/signup"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const dimensions = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.documentWidth, `${route} at ${width}px`).toBeLessThanOrEqual(dimensions.viewportWidth);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/properties");
  await page.evaluate(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
  });
  const mobileContentBounds = await page.evaluate(() => {
    const mainBottom = document.querySelector("main")?.getBoundingClientRect().bottom ?? Infinity;
    const navigationTop = document.querySelector(".mobile-bottom-nav")?.getBoundingClientRect().top ?? -Infinity;
    return { mainBottom, navigationTop };
  });
  expect(mobileContentBounds.mainBottom).toBeLessThanOrEqual(mobileContentBounds.navigationTop);
});

test("desktop navigation dropdowns expose the expected routes and support keyboard dismissal", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  await expect(navigation.getByRole("link", { name: "My Listings" })).toHaveAttribute("href", "/my-listings");
  await expect(navigation.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
  await expect(page.getByRole("link", { name: "Open your profile" })).toHaveAttribute("href", "/profile");

  const headerBounds = await page.locator(".desktop-header").evaluate((header) => {
    const nav = header.querySelector(".desktop-header__links")?.getBoundingClientRect();
    return nav ? nav.left + nav.width / 2 : 0;
  });
  expect(Math.abs(headerBounds - 640)).toBeLessThanOrEqual(2);

  const propertiesButton = navigation.getByRole("button", { name: "Properties" });
  await propertiesButton.click();
  const propertiesMenu = page.getByRole("menu", { name: "Property categories" });
  await expect(propertiesMenu.getByRole("menuitem")).toHaveText([
    "All Properties",
    "Buy",
    "Rent",
    "Land",
    "Commercial",
  ]);
  await expect(propertiesMenu.getByRole("menuitem", { name: "All Properties" })).toHaveAttribute("href", "/properties");
  await expect(propertiesMenu.getByRole("menuitem", { name: "Buy" })).toHaveAttribute("href", "/buy");
  await expect(propertiesMenu.getByRole("menuitem", { name: "Rent" })).toHaveAttribute("href", "/rent");
  await expect(propertiesMenu.getByRole("menuitem", { name: "Land" })).toHaveAttribute("href", "/land");
  await expect(propertiesMenu.getByRole("menuitem", { name: "Commercial" })).toHaveAttribute("href", "/commercial");

  await propertiesMenu.getByRole("menuitem", { name: "All Properties" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(propertiesMenu.getByRole("menuitem", { name: "Buy" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(propertiesMenu).toHaveCount(0);
  await expect(propertiesButton).toBeFocused();

  await page.getByRole("link", { name: "Open your profile" }).click();
  await expect(page).toHaveURL((url) =>
    url.pathname === "/login" && url.searchParams.get("next") === "/profile",
  );

  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Pricing information" })).toBeVisible();
  await expect(page.getByText(/does not currently offer published pricing/)).toBeVisible();
});

test("mobile menu and profile navigation preserve protected account workflows", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const hamburger = page.getByRole("button", { name: "Open navigation menu" });
  await expect(hamburger).toBeVisible();
  await page.getByRole("link", { name: "Open your profile" }).click();
  await expect(page).toHaveURL((url) =>
    url.pathname === "/login" && url.searchParams.get("next") === "/profile",
  );
  await page.goto("/");

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile main navigation" });
  await expect(mobileNavigation.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "My Listings" })).toHaveAttribute("href", "/my-listings");
  await expect(mobileNavigation.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
  await page.getByRole("heading", { name: "Find a place to call yours." }).click();
  await expect(mobileNavigation).toBeHidden();
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(mobileNavigation).toBeVisible();
  await mobileNavigation.getByRole("button", { name: "Properties" }).click();
  await expect(mobileNavigation.getByRole("link", { name: "All Properties" })).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Commercial" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(mobileNavigation.getByRole("link", { name: "All Properties" })).toHaveCount(0);
  await expect(mobileNavigation.getByRole("button", { name: "Properties" })).toBeFocused();
  await expect(mobileNavigation).toBeVisible();
  await mobileNavigation.getByRole("button", { name: "Properties" }).click();
  await mobileNavigation.getByRole("link", { name: "Rent" }).click();
  await expect(page).toHaveURL(/\/rent$/);
  await expect(page.getByRole("navigation", { name: "Mobile shortcuts" })).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page.getByRole("navigation", { name: "Mobile main navigation" })
    .getByRole("link", { name: "My Listings" }).click();
  await expect(page).toHaveURL((url) =>
    url.pathname === "/login" && url.searchParams.get("next") === "/my-listings",
  );

  await signIn(page, "/profile");
  await expect(page.getByRole("heading", { name: "Test Member" })).toBeVisible();
  await expect(page.getByText("member@example.com")).toBeVisible();
  await expect(page.getByRole("link", { name: /My Listings Manage your property listings/ })).toHaveAttribute("href", "/my-listings");
  await expect(page.getByRole("link", { name: /Saved Properties View properties you have saved/ })).toHaveAttribute("href", "/saved");
  await expect(page.getByRole("link", { name: /Subscription & Billing Manage your plan and payments/ })).toHaveAttribute("href", "/pricing");

  const photoUploadLabel = page.locator(".profile-photo-form__label");
  async function waitForPhotoUpload() {
    await expect(photoUploadLabel).toHaveText("Uploading photo…");
    await expect(photoUploadLabel).toHaveText("Edit profile photo");
  }

  const avatar = page.locator(".profile-card__avatar");
  const editPhotoButton = page.getByRole("button", { name: "Edit profile photo" }).first();
  const avatarBounds = await avatar.boundingBox();
  const editButtonBounds = await editPhotoButton.boundingBox();
  expect(avatarBounds).not.toBeNull();
  expect(editButtonBounds).not.toBeNull();
  if (!avatarBounds || !editButtonBounds) throw new Error("Profile photo controls are not visible.");
  const editButtonCenter = {
    x: editButtonBounds.x + editButtonBounds.width / 2 - avatarBounds.x,
    y: editButtonBounds.y + editButtonBounds.height / 2 - avatarBounds.y,
  };
  expect(editButtonCenter.x / avatarBounds.width).toBeGreaterThan(0.8);
  expect(editButtonCenter.y / avatarBounds.height).toBeGreaterThan(0.8);

  const photoChooserPromise = page.waitForEvent("filechooser");
  await editPhotoButton.click();
  const photoChooser = await photoChooserPromise;
  await photoChooser.setFiles({
    name: "profile.jpg",
    mimeType: "image/jpeg",
    buffer: readFileSync("public/images/hero-exterior.jpg"),
  });
  await waitForPhotoUpload();
  await expect(page.getByRole("status")).toContainText("Profile photo updated.");
  await expect(page.locator(".profile-card__avatar-image")).toBeVisible();
  const navigationAvatar = page.locator(".profile-button:visible img");
  await expect(navigationAvatar).toHaveCount(1);
  await expect.poll(() => navigationAvatar.evaluate(
    (image) => (image as HTMLImageElement).naturalWidth,
  )).toBeGreaterThan(0);
  const navigationProfileLink = page.locator(".profile-button:visible");
  const navigationAvatarBounds = await navigationAvatar.boundingBox();
  const navigationLinkBounds = await navigationProfileLink.boundingBox();
  expect(navigationAvatarBounds).not.toBeNull();
  expect(navigationLinkBounds).not.toBeNull();
  if (!navigationAvatarBounds || !navigationLinkBounds) {
    throw new Error("The navigation profile photo is not visible.");
  }
  expect(navigationLinkBounds.width).toBe(40);
  expect(navigationLinkBounds.height).toBe(40);
  expect(navigationAvatarBounds.width).toBe(navigationLinkBounds.width);
  expect(navigationAvatarBounds.height).toBe(navigationLinkBounds.height);
  expect(await navigationAvatar.evaluate((image) => getComputedStyle(image).borderRadius)).toBe("50%");

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".profile-button:visible img")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });

  let state = await (await page.request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.profiles[0].avatar_url).toMatch(/^11111111-1111-4111-8111-111111111111\/[0-9a-f-]{36}\.jpg$/i);
  expect(state.profilePhotoPaths).toHaveLength(1);

  await page.request.post(`${mockAuthUrl}/__configure`, { data: { expireNextSignedPhotoUrl: true } });
  await page.reload();
  await expect(page.locator(".profile-card__avatar-image")).toBeVisible();
  await expect.poll(async () => {
    const refreshedState = await (await page.request.get(`${mockAuthUrl}/__state`)).json();
    return refreshedState.signedProfilePhotoUrlCount;
  }).toBeGreaterThan(state.signedProfilePhotoUrlCount + 1);
  await expect.poll(() => page.locator(".profile-card__avatar-image").evaluate(
    (image) => (image as HTMLImageElement).naturalWidth,
  )).toBeGreaterThan(0);

  await page.getByLabel("Choose a profile photo").setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/T5sAAAAASUVORK5CYII=", "base64"),
  });
  await waitForPhotoUpload();
  await expect.poll(async () => {
    const latestState = await (await page.request.get(`${mockAuthUrl}/__state`)).json();
    return latestState.profiles[0].avatar_url;
  }).toMatch(/\.png$/i);
  await expect(page.getByRole("status")).toContainText("Profile photo updated.");
  state = await (await page.request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.profiles[0].avatar_url).toMatch(/\.png$/i);
  expect(state.profilePhotoPaths).toHaveLength(1);

  await page.getByLabel("Choose a profile photo").setInputFiles({
    name: "replacement.webp",
    mimeType: "image/webp",
    buffer: Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
  });
  await waitForPhotoUpload();
  await expect.poll(async () => {
    const latestState = await (await page.request.get(`${mockAuthUrl}/__state`)).json();
    return latestState.profiles[0].avatar_url;
  }).toMatch(/\.webp$/i);
  await expect(page.getByRole("status")).toContainText("Profile photo updated.");
  state = await (await page.request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.profiles[0].avatar_url).toMatch(/\.webp$/i);
  expect(state.profilePhotoPaths).toHaveLength(1);

  await page.getByLabel("Choose a profile photo").setInputFiles({
    name: "invalid.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(photoUploadLabel).toHaveText("Uploading photo…");
  await expect(page.getByText("Use a valid JPEG, PNG, or WebP photo.", { exact: true }))
    .toBeVisible();
  state = await (await page.request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.profiles[0].avatar_url).toMatch(/\.webp$/i);

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.documentWidth, `profile at ${width}px`).toBeLessThanOrEqual(dimensions.viewportWidth);
  }
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page).toHaveURL("/");
});

test("profile photo validates type and size before uploading", async ({ page, request }) => {
  await signIn(page, "/profile");

  await page.getByLabel("Choose a profile photo").setInputFiles({
    name: "profile.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("GIF89a"),
  });
  await expect(page.locator(".profile-photo-form__message--error"))
    .toContainText("Choose a JPEG, PNG, or WebP photo.");

  await page.getByLabel("Choose a profile photo").setInputFiles({
    name: "large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.locator(".profile-photo-form__message--error"))
    .toContainText("Choose a photo no larger than 5 MiB.");

  let state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.profiles[0].avatar_url).toBeNull();
  expect(state.profilePhotoPaths).toHaveLength(0);
  expect(state.requests.filter((entry: { path: string }) => entry.path.includes("/storage/v1/object/profile-photos/"))).toHaveLength(0);

  const maxSizePng = Buffer.alloc(5 * 1024 * 1024);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(maxSizePng);
  await page.getByLabel("Choose a profile photo").setInputFiles({
    name: "maximum-size.png",
    mimeType: "image/png",
    buffer: maxSizePng,
  });
  const uploadLabel = page.locator(".profile-photo-form__label");
  await expect(uploadLabel).toHaveText("Uploading photo…");
  await expect(uploadLabel).toHaveText("Edit profile photo");
  await expect.poll(async () => {
    state = await (await request.get(`${mockAuthUrl}/__state`)).json();
    return state.profiles[0].avatar_url;
  }).toMatch(/\.png$/i);
  expect(state.profilePhotoPaths).toHaveLength(1);
});

test("profile photo reports storage setup and profile-save failures without leaving orphaned photos", async ({ page, request }) => {
  await signIn(page, "/profile");
  const photo = {
    name: "profile.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64"),
  };

  await request.post(`${mockAuthUrl}/__configure`, { data: { profilePhotoUploadFailure: true } });
  await page.getByLabel("Choose a profile photo").setInputFiles(photo);
  await expect(page.locator(".profile-photo-form__message--error"))
    .toContainText("Profile photo storage is not set up yet");
  let state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.profiles[0].avatar_url).toBeNull();
  expect(state.profilePhotoPaths).toHaveLength(0);

  await request.post(`${mockAuthUrl}/__configure`, { data: { profileUpdateFailure: true } });
  await page.getByLabel("Choose a profile photo").setInputFiles(photo);
  await expect(page.locator(".profile-photo-form__message--error"))
    .toContainText("Your profile could not be updated.");
  state = await (await request.get(`${mockAuthUrl}/__state`)).json();
  expect(state.profiles[0].avatar_url).toBeNull();
  expect(state.profilePhotoPaths).toHaveLength(0);
});

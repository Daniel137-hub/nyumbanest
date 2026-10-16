import { generateKeyPairSync, sign } from "node:crypto";
import { createServer } from "node:http";

const port = 54329;
const timestamp = new Date().toISOString();
const issuer = `http://127.0.0.1:${port}/auth/v1`;
const keyId = "nyumbanest-playwright";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: keyId,
  alg: "RS256",
  use: "sig",
};

function makeUser(email, fullName = "Test Member", confirmed = true) {
  return {
    id: email === "member@example.com" ? "11111111-1111-4111-8111-111111111111" : "22222222-2222-4222-8222-222222222222",
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: confirmed ? timestamp : null,
    phone: "",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: fullName },
    identities: [],
    created_at: timestamp,
    updated_at: timestamp,
  };
}

let users;
let passwords;
let profiles;
let consumedTokens;
let requests;
let properties;
let propertyImages;
let favorites;
let inquiries;
let storageObjects;
let signedPhotoTokens;
let signedPhotoUrlCounter;
let expireNextSignedPhotoUrl;
let propertyQueryFailure;
let favoriteQueryFailure;
let favoriteMutationFailure;
let inquiryMutationFailure;
let profilePhotoUploadFailure;
let profileUpdateFailure;
let expireNextSession;
let passwordAuthFailure;

function reset() {
  users = new Map([["member@example.com", makeUser("member@example.com")]]);
  passwords = new Map([["member@example.com", "Correct123"]]);
  profiles = new Map([["11111111-1111-4111-8111-111111111111", {
    id: "11111111-1111-4111-8111-111111111111",
    full_name: "Test Member",
    email: "member@example.com",
    avatar_url: null,
    phone: null,
  }]]);
  consumedTokens = new Set();
  requests = [];
  properties = [];
  propertyImages = [];
  favorites = [];
  inquiries = [];
  storageObjects = new Map();
  signedPhotoTokens = new Map();
  signedPhotoUrlCounter = 0;
  expireNextSignedPhotoUrl = false;
  propertyQueryFailure = false;
  favoriteQueryFailure = false;
  favoriteMutationFailure = false;
  inquiryMutationFailure = false;
  profilePhotoUploadFailure = false;
  profileUpdateFailure = false;
  expireNextSession = false;
  passwordAuthFailure = false;
}

reset();

function json(response, status, value) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(value));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function readBuffer(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function extractMultipartFile(data, boundary) {
  const content = data.toString("latin1");
  const fileHeader = /content-disposition:\s*form-data;[^\r\n]*filename="[^"]*"/i.exec(content);
  if (!fileHeader) return null;

  const headerEnd = content.indexOf("\r\n\r\n", fileHeader.index);
  const imageEnd = content.indexOf(`\r\n--${boundary}`, headerEnd);
  if (headerEnd < 0 || imageEnd < 0) return null;

  const headers = content.slice(fileHeader.index, headerEnd);
  const contentType = headers.match(/content-type:\s*(image\/[a-z0-9.+-]+)/i)?.[1];
  if (!contentType) return null;

  return {
    data: data.subarray(headerEnd + 4, imageEnd),
    contentType,
  };
}

function requestUserId(request) {
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const payload = bearer?.split(".")[1];
  try {
    return payload ? JSON.parse(Buffer.from(payload, "base64url").toString()).sub : null;
  } catch {
    return null;
  }
}

function pathFilter(url, key, value) {
  const filter = url.searchParams.get(key);
  if (!filter) return true;
  if (filter.startsWith("eq.")) return value === filter.slice(3);
  if (filter.startsWith("in.(")) return filter.slice(4, -1).split(",").includes(value);
  if (filter.startsWith("gte.")) return Number(value) >= Number(filter.slice(4));
  if (filter.startsWith("lte.")) return Number(value) <= Number(filter.slice(4));
  return false;
}

function matchesLocationFilter(url, property) {
  const expression = url.searchParams.get("or");
  if (!expression) return true;
  const terms = [...expression.matchAll(/(?:region|district|neighborhood)\.ilike\.%([^,]*?)%/g)]
    .map((match) => match[1].toLowerCase());
  if (!terms.length) return false;
  const location = [property.region, property.district, property.neighborhood]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return terms.some((term) => location.includes(term));
}

function projectSelectedColumns(url, row) {
  const select = url.searchParams.get("select");
  if (!select || select === "*") return row;
  const columns = select.split(",");
  return Object.fromEntries(columns.filter((column) => Object.hasOwn(row, column)).map((column) => [column, row[column]]));
}

function restJson(response, status, value, total = Array.isArray(value) ? value.length : 1) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Content-Range", `0-${Array.isArray(value) ? value.length - 1 : 0}/${total}`);
  response.end(JSON.stringify(value));
}

function matchesProperty(url, property) {
  return pathFilter(url, "id", property.id) &&
    pathFilter(url, "owner_id", property.owner_id);
}

function matchesImage(url, image) {
  return pathFilter(url, "id", image.id) &&
    pathFilter(url, "property_id", image.property_id);
}

function seedPublishedProperty(overrides = {}) {
  const property = {
    id: overrides.id ?? "44444444-4444-4444-8444-444444444444",
    owner_id: "11111111-1111-4111-8111-111111111111",
    title: "Owner published listing",
    description: "A published owner property.",
    transaction_type: "sale",
    property_type: "apartment",
    price: 500000000,
    currency: "TZS",
    region: "Dar es Salaam",
    district: "Kinondoni",
    neighborhood: "Masaki",
    address: "Private street address",
    area_sqm: 180,
    bedrooms: 3,
    bathrooms: 3,
    parking_spaces: 1,
    furnished: false,
    amenities: ["Pool", "Security"],
    latitude: null,
    longitude: null,
    status: "published",
    is_verified: true,
    published_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides,
  };
  properties.push(property);
  const imagePath = `${property.owner_id}/${property.id}/marketplace.png`;
  propertyImages.push({
    id: `eeeeeeee-eeee-4eee-8eee-${String(propertyImages.length + 1).padStart(12, "0")}`,
    property_id: property.id,
    storage_path: imagePath,
    alt_text: `${property.title} photo`,
    sort_order: 0,
    created_at: timestamp,
  });
  storageObjects.set(imagePath, {
    data: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64"),
    contentType: "image/png",
  });
  return property;
}

function sessionFor(user, expired = false) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (expired ? -60 : 3600);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: keyId })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    aud: "authenticated",
    email: user.email,
    exp: expiresAt,
    iat: now,
    iss: issuer,
    role: "authenticated",
    sub: user.id,
  })).toString("base64url");
  const unsignedToken = `${header}.${payload}`;
  const accessToken = `${unsignedToken}.${sign("RSA-SHA256", Buffer.from(unsignedToken), privateKey).toString("base64url")}`;
  return {
    access_token: accessToken,
    refresh_token: "nyumbanest-test-refresh-token",
    expires_in: Math.max(0, expiresAt - now),
    expires_at: expiresAt,
    token_type: "bearer",
    user,
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const origin = request.headers.origin;
  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Headers", "apikey, authorization, content-type, prefer, x-client-info, x-supabase-api-version, x-upsert, cache-control");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/storage/v1/")) {
    requests.push({ method: request.method, path: url.pathname, query: url.search });
  }
  if (url.pathname === "/__health") {
    json(response, 200, { ok: true });
    return;
  }
  if (url.pathname === "/__reset" && request.method === "POST") {
    reset();
    json(response, 200, { ok: true });
    return;
  }
  if (url.pathname === "/__configure" && request.method === "POST") {
    const body = await readBody(request);
    propertyQueryFailure = body.propertyQueryFailure === true;
    favoriteQueryFailure = body.favoriteQueryFailure === true;
    favoriteMutationFailure = body.favoriteMutationFailure === true;
    inquiryMutationFailure = body.inquiryMutationFailure === true;
    profilePhotoUploadFailure = body.profilePhotoUploadFailure === true;
    profileUpdateFailure = body.profileUpdateFailure === true;
    expireNextSignedPhotoUrl = body.expireNextSignedPhotoUrl === true;
    expireNextSession = body.expireNextSession === true;
    passwordAuthFailure = body.passwordAuthFailure === true;
    json(response, 200, { ok: true });
    return;
  }
  if (url.pathname === "/__seed-other-property" && request.method === "POST") {
    properties.push({
      id: "33333333-3333-4333-8333-333333333333",
      owner_id: "99999999-9999-4999-8999-999999999999",
      title: "Private other-owner draft",
      description: null,
      transaction_type: "sale",
      property_type: "house",
      price: 250000000,
      currency: "TZS",
      region: "Arusha",
      district: null,
      neighborhood: null,
      address: null,
      area_sqm: null,
      bedrooms: null,
      bathrooms: null,
      parking_spaces: null,
      furnished: null,
      amenities: [],
      latitude: null,
      longitude: null,
      status: "draft",
      is_verified: false,
      published_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    });
    json(response, 200, { ok: true });
    return;
  }
  if (url.pathname === "/__seed-published-property" && request.method === "POST") {
    seedPublishedProperty();
    json(response, 200, { ok: true });
    return;
  }
  if (url.pathname === "/__seed-marketplace" && request.method === "POST") {
    seedPublishedProperty();
    seedPublishedProperty({
      id: "55555555-5555-4555-8555-555555555555",
      title: "Garden apartment for rent",
      transaction_type: "rent",
      property_type: "apartment",
      price: 1800000,
      region: "Arusha",
      district: "Arusha Urban",
      neighborhood: "Njiro",
      bedrooms: 2,
      bathrooms: 2,
      is_verified: false,
    });
    seedPublishedProperty({
      id: "66666666-6666-4666-8666-666666666666",
      title: "Kigamboni residential plot",
      property_type: "land",
      price: 125000000,
      region: "Dar es Salaam",
      district: "Temeke",
      neighborhood: "Kigamboni",
      area_sqm: 600,
      bedrooms: null,
      bathrooms: null,
      furnished: null,
      parking_spaces: null,
      amenities: ["Road access"],
    });
    seedPublishedProperty({
      id: "77777777-7777-4777-8777-777777777777",
      title: "Downtown office space",
      transaction_type: "rent",
      property_type: "commercial",
      price: 5500000,
      region: "Dar es Salaam",
      district: "Ilala",
      neighborhood: "Kariakoo",
      area_sqm: 240,
      bedrooms: null,
      bathrooms: null,
      furnished: null,
      parking_spaces: 3,
    });
    seedPublishedProperty({
      id: "88888888-8888-4888-8888-888888888888",
      title: "Kinondoni apartment for sale",
      property_type: "apartment",
      price: 425000000,
      region: "Dar es Salaam",
      district: "Kinondoni",
      neighborhood: "Mikocheni",
      bedrooms: 2,
      bathrooms: 2,
    });
    json(response, 200, { ok: true });
    return;
  }
  if (url.pathname === "/__state") {
    json(response, 200, {
      requests,
      users: [...users.keys()],
      profiles: [...profiles.values()],
      memberPasswordMatchesUpdate: passwords.get("member@example.com") === "UpdatedPass2",
      properties,
      propertyImages,
      favorites,
      inquiries,
      storageCount: storageObjects.size,
      profilePhotoPaths: [...storageObjects.keys()].filter((path) => path.startsWith("profile-photos/")),
      signedProfilePhotoUrlCount: signedPhotoUrlCounter,
    });
    return;
  }
  if (url.pathname.endsWith("/.well-known/jwks.json")) {
    json(response, 200, { keys: [publicJwk] });
    return;
  }

  if (url.pathname === "/rest/v1/rpc/get_owned_property_private_location" && request.method === "POST") {
    const userId = requestUserId(request);
    const body = await readBody(request);
    const property = properties.find((item) =>
      item.id === body.target_property_id && item.owner_id === userId);
    json(response, 200, property
      ? [{ address: property.address, latitude: property.latitude, longitude: property.longitude }]
      : []);
    return;
  }

  if (url.pathname.startsWith("/storage/v1/object/public/property-images/") && request.method === "GET") {
    const path = decodeURIComponent(url.pathname.slice("/storage/v1/object/public/property-images/".length));
    const file = storageObjects.get(path);
    if (!file) {
      json(response, 404, { message: "Object not found" });
      return;
    }
    response.statusCode = 200;
    response.setHeader("Content-Type", file.contentType);
    response.end(file.data);
    return;
  }
  if (url.pathname.startsWith("/storage/v1/object/sign/profile-photos/") && request.method === "POST") {
    const userId = requestUserId(request);
    const path = decodeURIComponent(url.pathname.slice("/storage/v1/object/sign/profile-photos/".length));
    const file = storageObjects.get(`profile-photos/${path}`);
    if (!userId || !path.startsWith(`${userId}/`) || !file) {
      json(response, 404, { message: "Object not found" });
      return;
    }
    const token = `mock-signed-token-${++signedPhotoUrlCounter}`;
    signedPhotoTokens.set(token, {
      path,
      expired: expireNextSignedPhotoUrl,
    });
    expireNextSignedPhotoUrl = false;
    json(response, 200, { signedURL: `/object/sign/profile-photos/${path}?token=${token}` });
    return;
  }
  if (url.pathname.startsWith("/storage/v1/object/sign/profile-photos/") && request.method === "GET") {
    const path = decodeURIComponent(url.pathname.slice("/storage/v1/object/sign/profile-photos/".length).split("?")[0]);
    const file = storageObjects.get(`profile-photos/${path}`);
    const token = url.searchParams.get("token");
    const signedPhoto = token ? signedPhotoTokens.get(token) : null;
    if (!file || !signedPhoto || signedPhoto.path !== path || signedPhoto.expired) {
      json(response, 404, { message: "Object not found" });
      return;
    }
    response.statusCode = 200;
    response.setHeader("Content-Type", file.contentType);
    response.end(file.data);
    return;
  }
  if (url.pathname.startsWith("/storage/v1/object/profile-photos/") && request.method === "POST") {
    if (profilePhotoUploadFailure) {
      json(response, 404, { message: "Bucket not found" });
      return;
    }
    const userId = requestUserId(request);
    const path = decodeURIComponent(url.pathname.slice("/storage/v1/object/profile-photos/".length));
    const fileName = path.split("/")[1] ?? "";
    const requestContentType = request.headers["content-type"] ?? "";
    const multipartBoundary = requestContentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.slice(1).find(Boolean);
    let data = await readBuffer(request);
    let contentType = requestContentType.split(";")[0];
    if (multipartBoundary) {
      const file = extractMultipartFile(data, multipartBoundary);
      if (!file) {
        json(response, 400, { message: "Malformed profile photo upload" });
        return;
      }
      data = file.data;
      contentType = file.contentType;
    }
    const validPath = path.startsWith(`${userId}/`) &&
      /^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(fileName);
    if (!userId || !validPath || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      json(response, 403, { message: "Profile photo policy denied this upload" });
      return;
    }
    if (!data.length || data.length > 5 * 1024 * 1024) {
      json(response, 413, { message: "Profile photo is empty or too large" });
      return;
    }
    storageObjects.set(`profile-photos/${path}`, { data, contentType });
    json(response, 200, { Key: `profile-photos/${path}` });
    return;
  }
  if (url.pathname === "/storage/v1/object/profile-photos" && request.method === "DELETE") {
    const userId = requestUserId(request);
    const body = await readBody(request);
    const paths = Array.isArray(body.prefixes) ? body.prefixes : [];
    if (!userId || paths.some((path) => !path.startsWith(`${userId}/`))) {
      json(response, 403, { message: "Profile photo policy denied this delete" });
      return;
    }
    for (const path of paths) storageObjects.delete(`profile-photos/${path}`);
    json(response, 200, { removed: paths });
    return;
  }
  if (url.pathname.startsWith("/storage/v1/object/property-images/") && request.method === "POST") {
    const userId = requestUserId(request);
    const path = decodeURIComponent(url.pathname.slice("/storage/v1/object/property-images/".length));
    const [ownerId, propertyId] = path.split("/");
    const parent = properties.find((property) => property.id === propertyId && property.owner_id === userId);
    const requestContentType = request.headers["content-type"];
    const multipartBoundary = requestContentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.slice(1).find(Boolean);
    let data = await readBuffer(request);
    let contentType = requestContentType.split(";")[0];
    if (multipartBoundary) {
      const file = extractMultipartFile(data, multipartBoundary);
      if (!file) {
        json(response, 400, { message: "Malformed property image upload" });
        return;
      }
      data = file.data;
      contentType = file.contentType;
    }
    if (!userId || ownerId !== userId || !parent ||
      !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(contentType)) {
      json(response, 403, {
        message: "Storage policy denied this upload",
      });
      return;
    }
    if (!data.length || data.length > 10 * 1024 * 1024) {
      json(response, 413, { message: "Image is empty or too large" });
      return;
    }
    storageObjects.set(path, { data, contentType });
    json(response, 200, { Key: `property-images/${path}` });
    return;
  }
  if (url.pathname === "/storage/v1/object/property-images" && request.method === "DELETE") {
    const userId = requestUserId(request);
    const body = await readBody(request);
    const paths = Array.isArray(body.prefixes) ? body.prefixes : [];
    const permitted = paths.every((path) => {
      const [ownerId, propertyId] = path.split("/");
      return ownerId === userId && properties.some((property) => property.id === propertyId && property.owner_id === userId);
    });
    if (!userId || !permitted) {
      json(response, 403, { message: "Storage policy denied this delete" });
      return;
    }
    for (const path of paths) storageObjects.delete(path);
    json(response, 200, { removed: paths });
    return;
  }

  if (url.pathname === "/rest/v1/profiles") {
    const userId = requestUserId(request);
    if (!userId) {
      json(response, 401, { message: "Not authenticated" });
      return;
    }
    const profile = profiles.get(userId);
    if (request.method === "GET") {
      const rows = profile && pathFilter(url, "id", userId) ? [projectSelectedColumns(url, profile)] : [];
      restJson(response, 200, rows);
      return;
    }
    if (request.method === "PATCH") {
      const body = await readBody(request);
      if (profileUpdateFailure && Object.hasOwn(body, "avatar_url")) {
        json(response, 500, { code: "mock_profile_update_failed", message: "Profile update failed" });
        return;
      }
      if (!profile || !pathFilter(url, "id", userId) ||
        Object.keys(body).some((key) => !["full_name", "avatar_url", "phone"].includes(key)) ||
        (body.avatar_url !== undefined && body.avatar_url !== null && !body.avatar_url.startsWith(`${userId}/`))) {
        json(response, 403, { message: "Profile policy denied this update" });
        return;
      }
      Object.assign(profile, body);
      const result = request.headers.prefer?.includes("return=representation")
        ? [projectSelectedColumns(url, profile)]
        : [];
      restJson(response, 200, result);
      return;
    }
  }
  if (url.pathname === "/rest/v1/properties" && request.method === "GET" && propertyQueryFailure) {
    json(response, 500, { code: "mock_query_failed", message: "Database request failed" });
    return;
  }
  if (url.pathname === "/rest/v1/properties") {
    const userId = requestUserId(request);
    let body = {};
    if (request.method !== "GET") {
      try {
        body = await readBody(request);
      } catch {
        json(response, 400, { message: "Invalid property body" });
        return;
      }
    }
    if (request.method === "GET") {
      let rows = properties.filter((property) =>
        matchesProperty(url, property) &&
        (property.status === "published" || property.owner_id === userId) &&
        pathFilter(url, "status", property.status) &&
        pathFilter(url, "transaction_type", property.transaction_type) &&
        pathFilter(url, "property_type", property.property_type) &&
        pathFilter(url, "price", property.price) &&
        pathFilter(url, "bedrooms", property.bedrooms) &&
        pathFilter(url, "area_sqm", property.area_sqm) &&
        matchesLocationFilter(url, property));
      const orderTerms = (url.searchParams.get("order") ?? "").split(",").filter(Boolean);
      for (const term of [...orderTerms].reverse()) {
        const [field, direction] = term.split(".");
        rows.sort((left, right) => {
          const a = left[field] ?? "";
          const b = right[field] ?? "";
          const comparison = typeof a === "number" && typeof b === "number"
            ? a - b
            : String(a).localeCompare(String(b));
          return direction === "asc" ? comparison : -comparison;
        });
      }
      const total = rows.length;
      const [rangeStart, rangeEnd] = (request.headers.range ?? "0-23").split("-").map(Number);
      rows = rows.slice(rangeStart || 0, Number.isFinite(rangeEnd) ? rangeEnd + 1 : undefined)
        .map((property) => projectSelectedColumns(url, property));
      restJson(response, 200, rows, total);
      return;
    }
    if (!userId) {
      json(response, 401, { message: "Not authenticated" });
      return;
    }
    if (request.method === "POST") {
      if (body.owner_id !== userId || !["draft", "pending_review"].includes(body.status) ||
        body.is_verified !== undefined || body.published_at !== undefined) {
        json(response, 403, { message: "Property policy denied this insert" });
        return;
      }
      const property = {
        ...body,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        created_at: timestamp,
        updated_at: timestamp,
        is_verified: false,
        published_at: null,
      };
      properties.push(property);
      const represented = request.headers.prefer?.includes("return=representation");
      const singular = request.headers.accept?.includes("application/vnd.pgrst.object+json");
      restJson(response, 201, represented ? singular ? property : [property] : []);
      return;
    }
    if (request.method === "PATCH") {
      const index = properties.findIndex((property) => property.owner_id === userId && matchesProperty(url, property));
      if (index < 0) {
        restJson(response, 200, []);
        return;
      }
      const current = properties[index];
      const updated = { ...current, ...body, updated_at: new Date().toISOString() };
      if (["published", "rented", "sold"].includes(current.status) &&
        Object.keys(body).some((key) => key !== "status")) {
        updated.status = "pending_review";
        updated.is_verified = false;
        updated.published_at = null;
      }
      properties[index] = updated;
      restJson(response, 200, request.headers.prefer?.includes("return=representation") ? [{ id: updated.id }] : []);
      return;
    }
    if (request.method === "DELETE") {
      const index = properties.findIndex((property) => property.owner_id === userId && matchesProperty(url, property));
      if (index < 0) {
        restJson(response, 200, []);
        return;
      }
      const [deleted] = properties.splice(index, 1);
      propertyImages = propertyImages.filter((image) => image.property_id !== deleted.id);
      restJson(response, 200, request.headers.prefer?.includes("return=representation") ? [{ id: deleted.id }] : []);
      return;
    }
  }
  if (url.pathname === "/rest/v1/property_images") {
    const userId = requestUserId(request);
    let body = {};
    if (request.method !== "GET") {
      try {
        body = await readBody(request);
      } catch {
        json(response, 400, { message: "Invalid image row body" });
        return;
      }
    }
    if (request.method === "GET") {
      const rows = propertyImages.filter((image) => matchesImage(url, image) &&
        properties.some((property) => property.id === image.property_id &&
          (property.owner_id === userId || property.status === "published")))
        .map((image) => projectSelectedColumns(url, image));
      restJson(response, 200, rows);
      return;
    }
    if (!userId) {
      json(response, 401, { message: "Not authenticated" });
      return;
    }
    if (request.method === "POST") {
      const entries = Array.isArray(body) ? body : [body];
      const ownerProperties = new Set(properties.filter((property) => property.owner_id === userId).map((property) => property.id));
      if (entries.some((image) => !ownerProperties.has(image.property_id))) {
        json(response, 403, { message: "Image policy denied this insert" });
        return;
      }
      const inserted = entries.map((image, index) => ({
        ...image,
        id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 1).padStart(12, "0")}`,
        created_at: timestamp,
      }));
      propertyImages.push(...inserted);
      restJson(response, 201, request.headers.prefer?.includes("return=representation") ? inserted : []);
      return;
    }
    if (request.method === "DELETE") {
      const matching = propertyImages.filter((image) => matchesImage(url, image) &&
        properties.some((property) => property.id === image.property_id && property.owner_id === userId));
      propertyImages = propertyImages.filter((image) => !matching.includes(image));
      restJson(response, 200, request.headers.prefer?.includes("return=representation") ? matching : []);
      return;
    }
  }
  if (url.pathname === "/rest/v1/favorites") {
    const userId = requestUserId(request);
    if (!userId) {
      json(response, 401, { code: "not_authenticated", message: "Not authenticated" });
      return;
    }
    if (request.method === "GET") {
      if (favoriteQueryFailure) {
        json(response, 500, { code: "mock_favorite_query_failed", message: "Favorite query failed" });
        return;
      }
      const rows = favorites.filter((favorite) =>
        favorite.user_id === userId &&
        pathFilter(url, "user_id", favorite.user_id) &&
        pathFilter(url, "property_id", favorite.property_id));
      restJson(response, 200, rows.map((favorite) => projectSelectedColumns(url, favorite)));
      return;
    }
    let body;
    try {
      body = await readBody(request);
    } catch {
      json(response, 400, { message: "Invalid favorite body" });
      return;
    }
    if (request.method === "POST") {
      if (favoriteMutationFailure) {
        json(response, 500, { code: "mock_favorite_insert_failed", message: "Favorite insert failed" });
        return;
      }
      const propertyId = body.property_id;
      if (body.user_id !== userId || !properties.some((property) =>
        property.id === propertyId && property.status === "published")) {
        json(response, 403, { message: "Favorite policy denied this insert" });
        return;
      }
      if (favorites.some((favorite) => favorite.user_id === userId && favorite.property_id === propertyId)) {
        json(response, 409, { code: "23505", message: "Favorite already exists" });
        return;
      }
      favorites.push({
        id: `dddddddd-dddd-4ddd-8ddd-${String(favorites.length + 1).padStart(12, "0")}`,
        user_id: userId,
        property_id: propertyId,
        created_at: timestamp,
      });
      restJson(response, 201, []);
      return;
    }
    if (request.method === "DELETE") {
      favorites = favorites.filter((favorite) =>
        !(favorite.user_id === userId && pathFilter(url, "user_id", favorite.user_id) &&
          pathFilter(url, "property_id", favorite.property_id)));
      restJson(response, 200, []);
      return;
    }
  }
  if (url.pathname === "/rest/v1/inquiries" && request.method === "POST") {
    if (inquiryMutationFailure) {
      json(response, 500, { code: "mock_inquiry_insert_failed", message: "Inquiry insert failed" });
      return;
    }
    const userId = requestUserId(request);
    let body;
    try {
      body = await readBody(request);
    } catch {
      json(response, 400, { message: "Invalid inquiry body" });
      return;
    }
    const property = properties.find((item) => item.id === body.property_id && item.status === "published");
    if (!property || (body.sender_id && body.sender_id !== userId)) {
      json(response, 403, { code: "42501", message: "Inquiry policy denied this insert" });
      return;
    }
    if (!body.sender_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.sender_email)) {
      json(response, 400, { code: "23514", message: "A valid email is required" });
      return;
    }
    const recentCount = inquiries.filter((inquiry) =>
      inquiry.sender_email.toLowerCase() === body.sender_email.toLowerCase() &&
      Date.now() - Date.parse(inquiry.created_at) < 10 * 60 * 1000).length;
    if (recentCount >= 3) {
      json(response, 400, { code: "23514", message: "Inquiry rate limit reached" });
      return;
    }
    inquiries.push({
      id: `cccccccc-cccc-4ccc-8ccc-${String(inquiries.length + 1).padStart(12, "0")}`,
      ...body,
      status: "new",
      created_at: new Date().toISOString(),
    });
    restJson(response, 201, []);
    return;
  }

  if (!url.pathname.startsWith("/auth/v1/")) {
    json(response, 404, { message: "Not found" });
    return;
  }

  let body = {};
  if (request.method === "POST" || request.method === "PUT") {
    try {
      body = await readBody(request);
    } catch {
      json(response, 400, { message: "Invalid request body" });
      return;
    }
  }
  requests.push({
    method: request.method,
    path: url.pathname,
    query: url.search,
    fullName: body.data?.full_name,
    otpType: body.type,
  });

  if (url.pathname === "/auth/v1/signup" && request.method === "POST") {
    const user = makeUser(body.email, body.data?.full_name, false);
    users.set(user.email, user);
    profiles.set(user.id, {
      id: user.id,
      full_name: body.data?.full_name ?? null,
      email: user.email,
      avatar_url: null,
      phone: null,
    });
    passwords.set(user.email, body.password);
    json(response, 200, { user, session: null });
    return;
  }
  if (url.pathname === "/auth/v1/verify" && request.method === "POST") {
    const type = body.type;
    const user = body.email
      ? users.get(body.email)
      : type === "signup"
        ? [...users.values()].find((candidate) => !candidate.email_confirmed_at)
        : users.get("member@example.com");
    const tokenKey = `${user?.email}:${type}:${body.token ?? body.token_hash}`;
    const validSignupCode = type === "email" && body.token === "123456" && user && !user.email_confirmed_at;
    const validRecoveryCode = type === "recovery" && body.token === "654321" && user?.email === "member@example.com";
    const validSignupLink = type === "signup" && body.token_hash === "signup-confirm-token-hash" && user && !user.email_confirmed_at;
    const validRecoveryLink = type === "recovery" && body.token_hash === "recovery-token-hash" && user?.email === "member@example.com";
    const valid = validSignupCode || validRecoveryCode || validSignupLink || validRecoveryLink;
    if (!user || !valid || consumedTokens.has(tokenKey)) {
      json(response, 403, {
        code: "otp_expired",
        error_code: "otp_expired",
        msg: "Token has expired or is invalid",
      });
      return;
    }
    consumedTokens.add(tokenKey);
    user.email_confirmed_at = timestamp;
    json(response, 200, sessionFor(user));
    return;
  }
  if (url.pathname === "/auth/v1/resend" && request.method === "POST") {
    json(response, 200, {});
    return;
  }
  if (url.pathname === "/auth/v1/token" && request.method === "POST" && url.searchParams.get("grant_type") === "password") {
    if (passwordAuthFailure) {
      json(response, 500, { code: "mock_auth_unavailable", msg: "Authentication service unavailable" });
      return;
    }
    const user = users.get(body.email);
    if (!user || passwords.get(body.email) !== body.password) {
      json(response, 400, {
        code: "invalid_credentials",
        error_code: "invalid_credentials",
        msg: "Invalid login credentials",
      });
      return;
    }
    if (!user.email_confirmed_at) {
      json(response, 400, {
        code: "email_not_confirmed",
        error_code: "email_not_confirmed",
        msg: "Email not confirmed",
      });
      return;
    }
    json(response, 200, sessionFor(user, expireNextSession));
    expireNextSession = false;
    return;
  }
  if (url.pathname === "/auth/v1/token" && request.method === "POST" && url.searchParams.get("grant_type") === "refresh_token") {
    json(response, 200, sessionFor(users.get("member@example.com")));
    return;
  }
  if (url.pathname === "/auth/v1/token" && request.method === "POST" && url.searchParams.get("grant_type") === "pkce") {
    json(response, 200, sessionFor(users.get("member@example.com")));
    return;
  }
  if (url.pathname === "/auth/v1/user" && request.method === "GET") {
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    const payload = bearer?.split(".")[1];
    const subject = payload ? JSON.parse(Buffer.from(payload, "base64url").toString()).sub : null;
    const user = [...users.values()].find((candidate) => candidate.id === subject);
    if (!user) {
      json(response, 401, { message: "Invalid token" });
      return;
    }
    json(response, 200, user);
    return;
  }
  if (url.pathname === "/auth/v1/user" && request.method === "PUT") {
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    const payload = bearer?.split(".")[1];
    const subject = payload ? JSON.parse(Buffer.from(payload, "base64url").toString()).sub : null;
    const user = [...users.values()].find((candidate) => candidate.id === subject);
    if (!user) {
      json(response, 401, { message: "Invalid token" });
      return;
    }
    if (user) passwords.set(user.email, body.password);
    json(response, 200, user);
    return;
  }
  if (url.pathname === "/auth/v1/logout" && request.method === "POST") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (url.pathname === "/auth/v1/recover" && request.method === "POST") {
    json(response, 200, {});
    return;
  }

  json(response, 404, { message: "Unsupported mock auth request" });
});

server.listen(port, "127.0.0.1");

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Buffer } from "node:buffer";

const getAuthSession = vi.fn();
const checkRateLimit = vi.fn(() => ({ success: true, retryAfter: 60, remaining: 59 }));
const prismaMock = {
  document: {
    aggregate: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

const recordAuditLog = vi.fn();
const createSignedUploadUrl = vi.fn();
const createSignedDownloadUrl = vi.fn();
const readObjectChunk = vi.fn();
const deleteObject = vi.fn();
const moveObject = vi.fn();
const calculateObjectHash = vi.fn();
const detectMimeFromBuffer = vi.fn(() => "application/pdf");
const isMimeCompatible = vi.fn(() => true);
const randomUUID = vi.fn(() => "doc-uuid");

vi.mock("@/lib/auth", () => ({
  getAuthSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/audit", () => ({
  recordAuditLog,
}));

vi.mock("@/lib/storage", () => ({
  createSignedUploadUrl,
  createSignedDownloadUrl,
  readObjectChunk,
  deleteObject,
  moveObject,
  calculateObjectHash,
}));

vi.mock("@/lib/mime-sniffer", () => ({
  detectMimeFromBuffer,
  isMimeCompatible,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit,
  RATE_LIMIT_DEFAULT: { limit: 60, windowMs: 60_000 },
}));

vi.mock("node:crypto", () => ({
  randomUUID,
}));

const uploadsRoutePromise = import("../../app/api/uploads/route");
const documentsRoutePromise = import("../../app/api/documents/route");
const documentIdRoutePromise = import("../../app/api/documents/[id]/route");
const downloadRoutePromise = import("../../app/api/documents/[id]/download/route");

function nextRequest(url: string, init?: RequestInit) {
  const request = new Request(url, init);
  return new NextRequest(request);
}

beforeEach(() => {
  vi.clearAllMocks();
  getAuthSession.mockResolvedValue({ user: { id: "user-1", role: "LAWYER" } });
  checkRateLimit.mockReturnValue({ success: true, retryAfter: 60, remaining: 59 });
  detectMimeFromBuffer.mockReturnValue("application/pdf");
  isMimeCompatible.mockReturnValue(true);
  createSignedUploadUrl.mockResolvedValue("https://storage/upload");
  createSignedDownloadUrl.mockResolvedValue("https://storage/download");
  readObjectChunk.mockResolvedValue(Buffer.from("%PDF-"));
  calculateObjectHash.mockResolvedValue("hash-value");
  prismaMock.document.findFirst.mockResolvedValue(null);
});

describe("/api/uploads", () => {
  it("returns a signed upload target", async () => {
    prismaMock.document.aggregate.mockResolvedValue({ _max: { version: 1 } });

    const { POST } = await uploadsRoutePromise;
    const response = await POST(
      nextRequest("http://localhost/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "example.pdf",
          mime: "application/pdf",
          size: 2048,
        }),
      }),
      { params: undefined },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.storageKey).toMatch(/documents\/doc-uuid\/v2\//);
    expect(payload.upload).toMatchObject({ method: "PUT", url: "https://storage/upload" });
    expect(createSignedUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ key: payload.storageKey, contentType: "application/pdf" }),
    );
  });

  it("returns 413 when file exceeds limit", async () => {
    prismaMock.document.aggregate.mockResolvedValue({ _max: { version: null } });

    const { POST } = await uploadsRoutePromise;
    const response = await POST(
      nextRequest("http://localhost/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "huge.pdf",
          mime: "application/pdf",
          size: 101 * 1024 * 1024,
        }),
      }),
      { params: undefined },
    );

    expect(response.status).toBe(413);
  });

  it("returns 401 when session is missing", async () => {
    getAuthSession.mockResolvedValueOnce(null);
    const { POST } = await uploadsRoutePromise;
    const response = await POST(
      nextRequest("http://localhost/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "file.pdf", mime: "application/pdf", size: 1024 }),
      }),
      { params: undefined },
    );
    expect(response.status).toBe(401);
  });

  it("returns 422 for invalid payload", async () => {
    prismaMock.document.aggregate.mockResolvedValue({ _max: { version: null } });
    const { POST } = await uploadsRoutePromise;
    const response = await POST(
      nextRequest("http://localhost/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "file.pdf", mime: "invalid", size: 1024 }),
      }),
      { params: undefined },
    );
    expect(response.status).toBe(422);
  });
});

describe("/api/documents", () => {
  it("creates metadata and records audit log", async () => {
    prismaMock.document.aggregate.mockResolvedValue({ _max: { version: 1 } });
    const createdAt = new Date("2024-01-01T10:00:00Z");
    prismaMock.document.create.mockResolvedValue({
      id: "doc-uuid",
      filename: "example.pdf",
      mime: "application/pdf",
      size: 2048,
      version: 2,
      tags: ["imza"],
      storageKey: "documents/doc-uuid/v2/example.pdf",
      hash: "hash-value",
      matterId: null,
      contactId: null,
      signedAt: null,
      createdAt,
      matter: null,
      contact: null,
      uploader: { id: "user-1", name: "Test", email: "test@example.com" },
    });

    const { POST } = await documentsRoutePromise;
    const response = await POST(
      nextRequest("http://localhost/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: "doc-uuid",
          filename: "example.pdf",
          mime: "application/pdf",
          size: 2048,
          storageKey: "documents/doc-uuid/v2/example.pdf",
          version: 2,
          tags: ["imza"],
        }),
      }),
      { params: undefined },
    );

    expect(response.status).toBe(201);
    expect(calculateObjectHash).toHaveBeenCalledWith({ key: "documents/doc-uuid/v2/example.pdf" });
    expect(prismaMock.document.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hash: "hash-value" }),
      }),
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "doc-uuid", action: "document.version" }),
    );
    const payload = await response.json();
    expect(payload.id).toBe("doc-uuid");
    expect(payload.version).toBe(2);
  });

  it("returns 401 when creating without session", async () => {
    getAuthSession.mockResolvedValueOnce(null);
    const { POST } = await documentsRoutePromise;
    const response = await POST(
      nextRequest("http://localhost/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: "doc-uuid",
          filename: "example.pdf",
          mime: "application/pdf",
          size: 1024,
          storageKey: "documents/doc-uuid/v1/example.pdf",
        }),
      }),
      { params: undefined },
    );

    expect(response.status).toBe(401);
  });

  it("returns 409 when duplicate hash exists for matter", async () => {
    prismaMock.document.aggregate.mockResolvedValue({ _max: { version: null } });
    prismaMock.document.findFirst.mockResolvedValueOnce({ id: "doc-existing" });

    const { POST } = await documentsRoutePromise;
    const response = await POST(
      nextRequest("http://localhost/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: "doc-uuid",
          filename: "example.pdf",
          mime: "application/pdf",
          size: 2048,
          storageKey: "documents/doc-uuid/v1/example.pdf",
          matterId: "matter-1",
        }),
      }),
      { params: undefined },
    );

    expect(response.status).toBe(409);
    expect(prismaMock.document.create).not.toHaveBeenCalled();
  });

  it("lists documents with pagination", async () => {
    const now = new Date("2025-01-01T09:00:00Z");
    prismaMock.document.findMany.mockResolvedValue([
      {
        id: "doc-1",
        filename: "contract.pdf",
        mime: "application/pdf",
        size: 4096,
        version: 1,
        tags: [],
        storageKey: "documents/doc-1/v1/contract.pdf",
        createdAt: now,
        signedAt: null,
        matter: { id: "matter-1", title: "Acme" },
        contact: null,
        uploader: { id: "user-1", name: "Test", email: "test@example.com" },
      },
    ]);
    prismaMock.document.count.mockResolvedValue(1);

    const { GET } = await documentsRoutePromise;
    const response = await GET(
      nextRequest("http://localhost/api/documents?q=contract&page=1&pageSize=10"),
      { params: undefined },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.pagination).toMatchObject({ page: 1, total: 1, totalPages: 1 });
    expect(payload.data[0].filename).toBe("contract.pdf");
    expect(prismaMock.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({}) }),
    );
  });
});

describe("/api/documents/[id]", () => {
  it("returns document detail", async () => {
    prismaMock.document.findUnique.mockResolvedValueOnce({
      id: "doc-1",
      filename: "contract.pdf",
      mime: "application/pdf",
      size: 4096,
      version: 1,
      tags: [],
      storageKey: "documents/doc-1/v1/contract.pdf",
      createdAt: new Date("2025-01-01T09:00:00Z"),
      signedAt: null,
      matter: null,
      contact: null,
      uploader: { id: "user-1", name: "Test", email: "test@example.com" },
    });

    const { GET } = await documentIdRoutePromise;
    const response = await GET(nextRequest("http://localhost/api/documents/doc-1"), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(response.status).toBe(200);
  });

  it("updates tags", async () => {
    prismaMock.document.findUnique.mockResolvedValueOnce({
      id: "doc-1",
      filename: "contract.pdf",
      mime: "application/pdf",
      size: 4096,
      version: 1,
      tags: [],
      storageKey: "documents/doc-1/v1/contract.pdf",
      createdAt: new Date("2025-01-01T09:00:00Z"),
      signedAt: null,
      matter: null,
      contact: null,
      uploader: { id: "user-1", name: "Test", email: "test@example.com" },
    });
    prismaMock.document.update.mockResolvedValueOnce({
      id: "doc-1",
      filename: "contract.pdf",
      mime: "application/pdf",
      size: 4096,
      version: 1,
      tags: ["kanit"],
      storageKey: "documents/doc-1/v1/contract.pdf",
      createdAt: new Date("2025-01-01T09:00:00Z"),
      signedAt: null,
      matter: null,
      contact: null,
      uploader: { id: "user-1", name: "Test", email: "test@example.com" },
    });

    const { PATCH } = await documentIdRoutePromise;
    const response = await PATCH(
      nextRequest("http://localhost/api/documents/doc-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: ["kanit"] }),
      }),
      {
        params: Promise.resolve({ id: "doc-1" }),
      },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.tags).toEqual(["kanit"]);
  });

  it("deletes document", async () => {
    prismaMock.document.findUnique.mockResolvedValueOnce({
      id: "doc-1",
      storageKey: "documents/doc-1/v1/contract.pdf",
      filename: "contract.pdf",
      version: 1,
      matterId: "matter-1",
      contactId: null,
    });
    prismaMock.document.delete.mockResolvedValueOnce({});

    const { DELETE } = await documentIdRoutePromise;
    const response = await DELETE(nextRequest("http://localhost/api/documents/doc-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(response.status).toBe(204);
    expect(deleteObject).toHaveBeenCalledWith({ key: "documents/doc-1/v1/contract.pdf" });
    expect(prismaMock.document.delete).toHaveBeenCalledWith({ where: { id: "doc-1" } });
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "document.delete",
        entityId: "doc-1",
      }),
    );
  });
});

describe("/api/documents/[id]/download", () => {
  it("returns signed download url", async () => {
    prismaMock.document.findUnique.mockResolvedValueOnce({
      storageKey: "documents/doc-1/v1/contract.pdf",
      mime: "application/pdf",
    });

    const { GET } = await downloadRoutePromise;
    const response = await GET(nextRequest("http://localhost/api/documents/doc-1/download"), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ getUrl: "https://storage/download" });
  });

  it("returns 404 when document is missing", async () => {
    prismaMock.document.findUnique.mockResolvedValueOnce(null);
    const { GET } = await downloadRoutePromise;
    const response = await GET(nextRequest("http://localhost/api/documents/doc-1/download"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(response.status).toBe(404);
  });
});

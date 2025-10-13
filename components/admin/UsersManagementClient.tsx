"use client";

import { useCallback, useMemo, useState } from "react";
import { Role } from "@prisma/client";
import Link from "next/link";

type InternalUser = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  status: string;
  isActive: boolean;
  invitedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
};

type ClientUser = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  status: string;
  isActive: boolean;
  invitedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

type UsersManagementClientProps = {
  currentRole: Role;
  internalUsers: InternalUser[];
  clientUsers: ClientUser[];
};

type FeedbackState = {
  type: "success" | "error";
  message: string;
} | null;

export function UsersManagementClient({
  currentRole,
  internalUsers: initialInternalUsers,
  clientUsers: initialClientUsers,
}: UsersManagementClientProps) {
  const [internalUsers, setInternalUsers] = useState(initialInternalUsers);
  const [clientUsers, setClientUsers] = useState(initialClientUsers);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [search, setSearch] = useState("");
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const canChangeRole = currentRole === Role.ADMIN;

  const filteredInternalUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return internalUsers;
    return internalUsers.filter((user) =>
      [user.name ?? "", user.email ?? ""].some((value) => value.toLowerCase().includes(term)),
    );
  }, [internalUsers, search]);

  const filteredClientUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clientUsers;
    return clientUsers.filter((user) =>
      [
        user.name ?? "",
        user.email ?? "",
        user.contact ? `${user.contact.firstName} ${user.contact.lastName}` : "",
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }, [clientUsers, search]);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    window.setTimeout(() => setFeedback(null), 3500);
  }, []);

  async function updateUser(userId: string, body: Record<string, unknown>, type: "internal" | "client") {
    try {
      setLoadingUserId(userId);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Güncelleme başarısız oldu.");
      }
      const updated = (await response.json()) as {
        id: string;
        role: Role;
        isActive: boolean;
        invitedAt: string | null;
        activatedAt: string | null;
      };

      if (type === "internal") {
        setInternalUsers((prev) =>
          prev.map((user) =>
            user.id === updated.id
              ? {
                  ...user,
                  role: updated.role,
                  isActive: updated.isActive,
                  invitedAt: updated.invitedAt,
                  activatedAt: updated.activatedAt,
                }
              : user,
          ),
        );
      } else {
        setClientUsers((prev) =>
          prev.map((user) =>
            user.id === updated.id
              ? {
                  ...user,
                  isActive: updated.isActive,
                  activatedAt: updated.activatedAt,
                }
              : user,
          ),
        );
      }
      showToast("success", "Kullanıcı bilgileri güncellendi.");
    } catch (error) {
      console.error(error);
      showToast("error", error instanceof Error ? error.message : "İşlem sırasında hata oluştu.");
    } finally {
      setLoadingUserId(null);
    }
  }

  async function resendInvite(userId: string) {
    try {
      setLoadingUserId(userId);
      const response = await fetch(`/api/admin/users/${userId}/resend-invite`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Davet gönderilemedi.");
      }
      const result = (await response.json()) as { invitedAt: string };
      setClientUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? {
                ...user,
                invitedAt: result.invitedAt,
              }
            : user,
        ),
      );
      showToast("success", "Davet e-postası gönderildi.");
    } catch (error) {
      console.error(error);
      showToast("error", error instanceof Error ? error.message : "Davet gönderilemedi.");
    } finally {
      setLoadingUserId(null);
    }
  }

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Kullanıcı Yönetimi</h1>
          <p className="text-sm text-slate-500">
            Sistem rolleri ve portal kullanıcılarını görüntüleyip aktifleştirin, davet gönderin.
          </p>
        </div>
        <input
          type="search"
          placeholder="Ad veya e-posta ara"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
        />
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">İç Ekip</h2>
          <p className="text-xs uppercase tracking-widest text-slate-400">
            ADMIN · LAWYER · PARALEGAL
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Ad</th>
                <th className="px-4 py-3 text-left">E-posta</th>
                <th className="px-4 py-3 text-left">Rol</th>
                <th className="px-4 py-3 text-left">Durum</th>
                <th className="px-4 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredInternalUsers.length ? (
                filteredInternalUsers.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 last:border-none">
                    <td className="px-4 py-3 text-slate-900">
                      {user.name ?? "—"}
                      <div className="text-xs text-slate-400">
                        Oluşturma: {new Date(user.createdAt).toLocaleDateString("tr-TR")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3">
                      {canChangeRole ? (
                        <select
                          className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-accent focus:outline-none"
                          value={user.role}
                          onChange={(event) =>
                            updateUser(user.id, { role: event.target.value as Role }, "internal")
                          }
                          disabled={loadingUserId === user.id}
                        >
                          {[Role.ADMIN, Role.LAWYER, Role.PARALEGAL].map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {user.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {user.isActive ? "Aktif" : "Pasif"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => updateUser(user.id, { isActive: !user.isActive }, "internal")}
                        disabled={loadingUserId === user.id}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {user.isActive ? "Pasifleştir" : "Aktifleştir"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    Sonuç bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Portal Kullanıcıları</h2>
          <p className="text-xs uppercase tracking-widest text-slate-400">CLIENT</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Ad</th>
                <th className="px-4 py-3 text-left">E-posta</th>
                <th className="px-4 py-3 text-left">Durum</th>
                <th className="px-4 py-3 text-left">Davet</th>
                <th className="px-4 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredClientUsers.length ? (
                filteredClientUsers.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 last:border-none">
                    <td className="px-4 py-3 text-slate-900">
                      {user.contact
                        ? `${user.contact.firstName} ${user.contact.lastName}`.trim()
                        : user.name ?? "—"}
                      <div className="text-xs text-slate-400">
                        {user.contact ? (
                          <Link
                            href={`/contacts/${user.contact.id}`}
                            className="text-accent hover:underline"
                          >
                            Contact kaydını aç
                          </Link>
                        ) : (
                          "Contact ilişkisi yok"
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {user.isActive
                        ? "Aktif"
                        : user.activatedAt
                          ? "Beklemede"
                          : "Pasif"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {user.activatedAt
                        ? `Aktifleştirildi: ${new Date(user.activatedAt).toLocaleDateString("tr-TR")}`
                        : user.invitedAt
                          ? `Davet: ${new Date(user.invitedAt).toLocaleDateString("tr-TR")}`
                          : "Davet gönderilmedi"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => updateUser(user.id, { isActive: !user.isActive }, "client")}
                          disabled={loadingUserId === user.id}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {user.isActive ? "Pasifleştir" : "Aktifleştir"}
                        </button>
                        <button
                          type="button"
                          onClick={() => resendInvite(user.id)}
                          disabled={loadingUserId === user.id}
                          className="rounded-lg border border-accent px-3 py-1 text-xs font-semibold text-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Daveti Gönder
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    Sonuç bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {feedback ? (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm shadow-lg ${
            feedback.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}
    </section>
  );
}

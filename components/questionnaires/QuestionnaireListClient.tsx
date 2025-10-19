"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { QuestionnaireCreateDialog } from "@/components/questionnaires/QuestionnaireCreateDialog";
import type { QuestionnaireListItem } from "@/components/questionnaires/types";

const QUESTIONNAIRE_PAGE_SIZE = 20;

type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

type Filters = {
  q?: string;
  isActive?: string;
};

type QuestionnaireListClientProps = {
  initialQuestionnaires: QuestionnaireListItem[];
  initialPagination: PaginationState;
  filters: Filters;
};

function buildQueryString(filters: Filters, overrides: { page?: number }) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.isActive) params.set("isActive", filters.isActive);
  params.set("page", String(overrides.page ?? 1));
  params.set("pageSize", String(QUESTIONNAIRE_PAGE_SIZE));
  return `?${params.toString()}`;
}

export function QuestionnaireListClient({
  initialQuestionnaires,
  initialPagination,
  filters,
}: QuestionnaireListClientProps) {
  const [questionnaires, setQuestionnaires] = useState(initialQuestionnaires);
  const [pagination, setPagination] = useState(initialPagination);
  const [toast, setToast] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setQuestionnaires(initialQuestionnaires);
    setPagination(initialPagination);
  }, [initialQuestionnaires, initialPagination]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filterState = useMemo(
    () => ({
      q: filters.q ?? "",
      isActive: filters.isActive ?? "",
    }),
    [filters],
  );

  const handleQuestionnaireCreated = (questionnaire: QuestionnaireListItem) => {
    setQuestionnaires((prev) => {
      const existing = prev.filter((item) => item.id !== questionnaire.id);
      return [questionnaire, ...existing].slice(0, pagination.pageSize);
    });
    setPagination((prev) => {
      const newTotal = prev.total + 1;
      return {
        ...prev,
        total: newTotal,
        totalPages: Math.max(1, Math.ceil(newTotal / prev.pageSize)),
        hasNext: newTotal > prev.pageSize,
      };
    });
    setToast(`"${questionnaire.title}" başarıyla oluşturuldu.`);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`"${title}" anketini silmek istediğinizden emin misiniz?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/questionnaires/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Silme işlemi başarısız");
      }

      setQuestionnaires((prev) => prev.filter((q) => q.id !== id));
      setPagination((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }));
      setToast(`"${title}" başarıyla silindi.`);
    } catch (error) {
      console.error("Delete error:", error);
      setToast(error instanceof Error ? error.message : "Bir hata oluştu");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/questionnaires/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Güncelleme başarısız");
      }

      const data = await res.json();
      setQuestionnaires((prev) =>
        prev.map((q) =>
          q.id === id ? { ...q, isActive: data.questionnaire.isActive } : q
        )
      );
      setToast(`Anket ${data.questionnaire.isActive ? "aktif edildi" : "pasif edildi"}.`);
    } catch (error) {
      console.error("Toggle error:", error);
      setToast(error instanceof Error ? error.message : "Bir hata oluştu");
    }
  };

  return (
    <section className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Questionnaires</h2>
          <p className="text-sm text-slate-500">
            Anket şablonlarını oluşturun ve yönetin.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/questionnaires/ai"
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white hover:from-emerald-700 hover:to-teal-700 shadow-lg hover:shadow-xl transition-all"
          >
            <Sparkles className="h-4 w-4" />
            AI ile Oluştur
          </Link>
          <QuestionnaireCreateDialog onCreated={handleQuestionnaireCreated} />
        </div>
      </div>

      {/* Filters */}
      <form
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card md:grid-cols-4"
        method="get"
      >
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={String(QUESTIONNAIRE_PAGE_SIZE)} />
        
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 md:col-span-2">
          Ara
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
            type="search"
            name="q"
            defaultValue={filterState.q}
            placeholder="Anket başlığı veya açıklama"
          />
        </label>

        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Durum
          <select
            name="isActive"
            defaultValue={filterState.isActive}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-accent focus:outline-none"
          >
            <option value="">Hepsi</option>
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </select>
        </label>

        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
          >
            Filtrele
          </button>
          <Link
            href="/questionnaires?page=1"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Temizle
          </Link>
        </div>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
        <table className="w-full table-auto text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3">Başlık</th>
              <th className="px-4 py-3">Açıklama</th>
              <th className="px-4 py-3">Sorular</th>
              <th className="px-4 py-3">Cevaplar</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Oluşturan</th>
              <th className="px-4 py-3">Oluşturma</th>
              <th className="px-4 py-3">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {questionnaires.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Anket bulunamadı
                </td>
              </tr>
            ) : (
              questionnaires.map((questionnaire) => (
                <tr
                  key={questionnaire.id}
                  className="border-b border-slate-100 transition hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/questionnaires/${questionnaire.id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {questionnaire.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-600">
                    {questionnaire.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                      {questionnaire._count.questions}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                      {questionnaire._count.responses}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {questionnaire.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                        Pasif
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {questionnaire.createdBy.name || questionnaire.createdBy.email}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(questionnaire.createdAt).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleActive(questionnaire.id, questionnaire.isActive)}
                        className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        {questionnaire.isActive ? "Pasif Yap" : "Aktif Yap"}
                      </button>
                      <button
                        onClick={() => handleDelete(questionnaire.id, questionnaire.title)}
                        disabled={deletingId === questionnaire.id}
                        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === questionnaire.id ? "Siliniyor..." : "Sil"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-card">
          <div className="text-sm text-slate-600">
            Toplam <span className="font-semibold">{pagination.total}</span> anket,{" "}
            <span className="font-semibold">{pagination.page}</span> /{" "}
            <span className="font-semibold">{pagination.totalPages}</span> sayfa
          </div>
          <div className="flex gap-2">
            {pagination.hasPrev ? (
              <Link
                href={buildQueryString(filters, { page: pagination.page - 1 })}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Önceki
              </Link>
            ) : (
              <button
                disabled
                className="cursor-not-allowed rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-400"
              >
                Önceki
              </button>
            )}
            {pagination.hasNext ? (
              <Link
                href={buildQueryString(filters, { page: pagination.page + 1 })}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Sonraki
              </Link>
            ) : (
              <button
                disabled
                className="cursor-not-allowed rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-400"
              >
                Sonraki
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

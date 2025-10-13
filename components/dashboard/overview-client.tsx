"use client";

import useSWR from "swr";
import { DashboardCards, type DashboardOverview } from "@/components/dashboard/cards";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Dashboard verileri alınamadı");
  }
  return (await response.json()) as DashboardOverview;
};

export function DashboardOverviewClient({ initialData }: { initialData: DashboardOverview }) {
  const { data, error } = useSWR("/api/dashboard/overview", fetcher, {
    fallbackData: initialData,
    revalidateOnFocus: false,
  });

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Dashboard verileri alınırken hata oluştu.
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return <DashboardCards overview={data} />;
}

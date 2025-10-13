import { headers } from "next/headers";
import { DashboardCards, type DashboardOverview } from "@/components/dashboard/cards";

async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const headersList = await headers();
  const hostHeader = headersList.get("host") ?? "localhost:3000";
  const protocolHeader = headersList.get("x-forwarded-proto");
  const baseEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const protocol =
    protocolHeader ?? (baseEnv?.startsWith("https") ? "https" : "http");
  const baseUrl = baseEnv ?? `${protocol}://${hostHeader}`;

  const response = await fetch(`${baseUrl}/api/dashboard/overview`, {
    headers: {
      cookie: headersList.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Dashboard overview isteği başarısız oldu");
  }

  return (await response.json()) as DashboardOverview;
}

export default async function DashboardHomePage() {
  const overview = await fetchDashboardOverview();
  return <DashboardCards overview={overview} />;
}

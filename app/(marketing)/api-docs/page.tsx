"use client";

import { useCallback, useEffect } from "react";
import Script from "next/script";

declare global {
  interface Window {
    Redoc?: {
      init: (
        specUrl: string,
        options: Record<string, unknown>,
        element: HTMLElement
      ) => void;
    };
  }
}

const SPEC_URL = "/openapi.json";

export default function ApiDocsPage() {
  const renderRedoc = useCallback(() => {
    const container = document.getElementById("redoc-container");
    if (!container || !window.Redoc) return;

    container.innerHTML = "";
    window.Redoc.init(
      SPEC_URL,
      {
        hideHostname: true,
        expandResponses: "200,201,204,400,422,500",
        theme: {
          colors: {
            primary: {
              main: "#0f172a"
            }
          },
          sidebar: {
            backgroundColor: "#f8fafc"
          }
        }
      },
      container
    );
  }, []);

  useEffect(() => {
    if (window.Redoc) {
      renderRedoc();
    }
  }, [renderRedoc]);

  return (
    <div className="px-6 py-8">
      <Script
        src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"
        strategy="afterInteractive"
        onLoad={renderRedoc}
      />

      <div className="mx-auto max-w-6xl">
        <header className="border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-semibold text-slate-900">API documentation</h1>
          <p className="mt-2 text-slate-600">
            Explore the Legal CRM API using the interactive ReDoc viewer below.
          </p>
        </header>

        <div className="mt-8 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div id="redoc-container" className="min-h-[70vh]" />
        </div>
      </div>
    </div>
  );
}

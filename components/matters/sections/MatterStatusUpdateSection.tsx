/**
 * MatterStatusUpdateSection Component
 * 
 * Provides form to update matter status and next hearing date.
 * Extracted from MatterDetailClient for better modularity and reusability.
 * 
 * Features:
 * - Status dropdown with all MATTER_STATUS options
 * - Hearing date picker (datetime-local input)
 * - "Kaydet" (Save) button with loading state
 * - Form validation and submission
 */

import { MATTER_STATUS } from "@/lib/validation/matter";
import type { MatterStatusUpdateSectionProps } from "./types";

export function MatterStatusUpdateSection({
  status,
  nextHearingAt,
  loading,
  onStatusChange,
  onHearingDateChange,
  onSubmit,
}: MatterStatusUpdateSectionProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <h3 className="text-lg font-semibold text-slate-900">Durum Güncelle</h3>
      <div className="mt-4 grid gap-4">
        <label className="text-sm font-medium text-slate-700">
          Durum
          <select
            name="status"
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
          >
            {MATTER_STATUS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Son Duruşma
          <input
            name="nextHearingAt"
            type="datetime-local"
            value={nextHearingAt ? nextHearingAt.slice(0, 16) : ""}
            onChange={(event) => onHearingDateChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={loading}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Kaydediliyor..." : "Kaydet"}
      </button>
    </div>
  );
}

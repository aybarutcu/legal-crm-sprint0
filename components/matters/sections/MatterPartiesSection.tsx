/**
 * MatterPartiesSection Component
 * 
 * Displays and manages parties (contacts) associated with a matter.
 * Extracted from MatterDetailClient for better modularity and reusability.
 * 
 * Features:
 * - List of parties with role badges
 * - "Taraf Ekle" (Add Party) button
 * - Party removal functionality
 * - Empty state display
 * - Integration with PartyCard component
 */

import { PartyCard } from "../PartyCard";
import type { MatterPartiesSectionProps } from "./types";

export function MatterPartiesSection({
  parties,
  onAddParty,
  onRemoveParty,
}: MatterPartiesSectionProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Taraflar</h3>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          onClick={onAddParty}
        >
          Taraf Ekle
        </button>
      </div>
      <ul className="mt-4 space-y-3 text-sm text-slate-600">
        {parties.length ? (
          parties.map((party) => (
            <PartyCard key={party.id} party={party} onRemove={onRemoveParty} />
          ))
        ) : (
          <li className="text-slate-400">Taraf bulunmuyor.</li>
        )}
      </ul>
    </div>
  );
}

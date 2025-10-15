"use client";

import { useState } from "react";
import Link from "next/link";
import type { MatterParty } from "./types";

type PartyCardProps = {
  party: MatterParty;
  onRemove: (partyId: string) => void;
};

export function PartyCard({ party, onRemove }: PartyCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li className="rounded-xl bg-slate-50 p-3">
      <div onClick={() => setIsExpanded(!isExpanded)} className="cursor-pointer flex items-center justify-between">
        <div>
          <div className="font-medium text-slate-900">
            {party.contact.firstName} {party.contact.lastName}
          </div>
          <div className="text-xs uppercase tracking-widest text-slate-500">
            {party.role}
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(party.id);
          }}
        >
          Sil
        </button>
      </div>
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-slate-200">
          <p className="text-sm text-slate-600">Email: {party.contact.email || "N/A"}</p>
          <Link href={`/contacts/${party.contact.id}`} className="text-sm text-accent hover:underline">
            View Contact
          </Link>
        </div>
      )}
    </li>
  );
}

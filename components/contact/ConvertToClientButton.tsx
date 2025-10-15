"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ConvertToClientButtonProps {
  contactId: string;
  contactEmail: string;
  contactName: string;
  onSuccess?: () => void;
}

/**
 * Button to convert a LEAD to CLIENT and optionally send portal invitation
 * Uses the existing /api/clients/invite endpoint for invitations
 */
export function ConvertToClientButton({
  contactId,
  contactEmail,
  contactName,
  onSuccess
}: ConvertToClientButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConvert() {
    if (!window.confirm(`Convert ${contactName} to a client?`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Convert contact type to CLIENT
      const convertResponse = await fetch("/api/contacts/convert-to-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId })
      });

      if (!convertResponse.ok) {
        const data = await convertResponse.json();
        throw new Error(data.error || "Failed to convert contact");
      }

      const convertData = await convertResponse.json();

      // Step 2: If needs invitation, send it via existing endpoint
      if (convertData.needsInvitation && contactEmail) {
        const inviteResponse = await fetch("/api/clients/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: contactEmail,
            name: contactName
          })
        });

        if (!inviteResponse.ok) {
          // Contact was converted but invitation failed - that's okay
          console.warn("Failed to send invitation, but contact was converted");
          window.alert(`✅ ${contactName} converted to client. Use the "Invite" button to send portal invitation.`);
        } else {
          window.alert(`✅ ${contactName} converted to client and invitation sent!`);
        }
      } else {
        window.alert(`✅ ${contactName} converted to client.`);
      }

      onSuccess?.();
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to convert contact";
      setError(message);
      window.alert(`❌ ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleConvert}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Converting..." : "Convert to Client"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

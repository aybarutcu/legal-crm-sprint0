"use client";

interface ContactActivitySectionProps {
  contactId: string;
  onRefresh?: () => void;
}

export function ContactActivitySection(_props: ContactActivitySectionProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-gray-500 mb-2">Activity feed coming soon</p>
      <p className="text-sm text-gray-400">
        This will show timeline of all actions, status changes, and notes for this contact
      </p>
    </div>
  );
}

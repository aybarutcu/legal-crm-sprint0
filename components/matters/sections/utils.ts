/**
 * Utility functions and constants for Matter sections
 */

/**
 * Date formatter for Turkish locale
 */
export const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Role badge styling based on party role
 */
export function getRoleBadgeStyle(role: string): string {
  switch (role) {
    case "PLAINTIFF":
      return "bg-blue-100 text-blue-700";
    case "DEFENDANT":
      return "bg-rose-100 text-rose-700";
    case "WITNESS":
      return "bg-amber-100 text-amber-700";
    case "OPPOSING_COUNSEL":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

/**
 * Get display label for party role (Turkish)
 */
export function getRoleLabel(role: string): string {
  switch (role) {
    case "PLAINTIFF":
      return "Davacı";
    case "DEFENDANT":
      return "Davalı";
    case "WITNESS":
      return "Tanık";
    case "OPPOSING_COUNSEL":
      return "Karşı Taraf Avukatı";
    default:
      return role;
  }
}

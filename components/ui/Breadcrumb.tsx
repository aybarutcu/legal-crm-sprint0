import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-2 text-sm ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <div key={index} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-slate-600 hover:text-blue-600 transition-colors font-medium"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-slate-900 font-semibold" : "text-slate-600"}>
                {item.label}
              </span>
            )}
            
            {!isLast && (
              <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

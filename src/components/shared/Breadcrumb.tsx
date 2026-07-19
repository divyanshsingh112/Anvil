"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbSegment {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
}

export default function Breadcrumb({ segments }: BreadcrumbProps) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <Link href="/dashboard" className="flex items-center gap-1.5">
        <Home className="h-3.5 w-3.5" />
        <span>Home</span>
      </Link>

      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={segment.href} className="flex items-center gap-2">
            <ChevronRight className="breadcrumb__separator h-3 w-3" />
            {isLast ? (
              <span className="breadcrumb__current">{segment.label}</span>
            ) : (
              <Link href={segment.href}>{segment.label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

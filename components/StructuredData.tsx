// components/StructuredData.tsx
import { ReactNode } from "react";

interface StructuredDataProps {
  data: Record<string, any>;
  children?: ReactNode;
}

export function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

import { cn } from "@myslot/utils";

interface BrandLockupProps {
  brand: string;
  className?: string;
}

/**
 * Wordmark lockup: stem in ink, TLD suffix after the final dot in the brand
 * green — "MySlot" + ".LK". Brands without a dot render entirely in ink.
 */
export function BrandLockup({ brand, className }: BrandLockupProps) {
  const dotIndex = brand.lastIndexOf(".");
  if (dotIndex === -1) {
    return <span className={className}>{brand}</span>;
  }
  return (
    <span className={className}>
      {brand.slice(0, dotIndex)}
      <span className="text-primary">{brand.slice(dotIndex)}</span>
    </span>
  );
}
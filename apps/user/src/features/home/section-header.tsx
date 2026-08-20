import Link from "next/link";

export function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="font-semibold tracking-tight text-ink">{title}</h2>
      <Link href="/explore" className="press text-sm font-semibold text-primary hover:text-primary-hover">
        View all
      </Link>
    </div>
  );
}
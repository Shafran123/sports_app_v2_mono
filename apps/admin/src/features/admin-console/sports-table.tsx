"use client";

import { useQuery } from "@tanstack/react-query";
import { sports } from "@myslot/api";
import {
  EmptyState,
  ErrorState,
  Skeleton,
  Table,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th
} from "@myslot/ui";
import { sportGlyph } from "@myslot/utils";

export function SportsTable() {
  const listQuery = useQuery({
    queryKey: ["sports"],
    queryFn: () => sports.list()
  });

  const rows = listQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">Sports</h1>
        <p className="mt-1 text-sm text-ink-2">The sports available on the platform (read-only).</p>
      </div>

      {listQuery.isLoading ? (
        <Table>
          <TableHead>
            <Th>Sport</Th>
            <Th>Name</Th>
            <Th>Slug</Th>
          </TableHead>
          <TableBody>
            {[0, 1, 2, 3].map((i) => (
              <TableRow key={i}>
                <Td>
                  <Skeleton className="h-9 w-9 rounded-xl" />
                </Td>
                <Td>
                  <Skeleton className="h-4 w-40" />
                </Td>
                <Td>
                  <Skeleton className="h-4 w-24" />
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : listQuery.isError ? (
        <ErrorState
          title="Could not load sports"
          message="We could not fetch the sports list right now."
          onRetry={() => listQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No sports yet" message="The backend hasn't registered any sports yet." />
      ) : (
        <Table>
          <TableHead>
            <Th>Sport</Th>
            <Th>Name</Th>
            <Th>Slug</Th>
          </TableHead>
          <TableBody>
            {rows.map((sport) => (
              <TableRow key={sport.id}>
                <Td>
                  <span className="text-xl" aria-hidden="true">
                    {sport.icon || sportGlyph(sport.slug)}
                  </span>
                </Td>
                <Td className="font-semibold text-ink">{sport.name}</Td>
                <Td>
                  <code className="rounded-lg bg-surface-2 px-2 py-0.5 text-xs text-ink-2">{sport.slug}</code>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
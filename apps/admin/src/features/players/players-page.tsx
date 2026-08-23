"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { admin } from "@myslot/api";
import { Badge, Button, Card, EmptyState, Input, Skeleton } from "@myslot/ui";
import type { User } from "@myslot/types";

export function PlayersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const listQuery = useQuery({
    queryKey: ["admin-players", search],
    queryFn: () => admin.listPlayers(search)
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => admin.verifyPlayer(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-players"] })
  });

  const players = listQuery.data ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
            Players
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Verify a phone for test Players before they book.
          </p>
        </div>
        <Input
          aria-label="Search players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or phone"
          className="w-72"
        />
      </div>

      {listQuery.isLoading ? (
        <Card className="mt-6 p-6">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        </Card>
      ) : players.length === 0 ? (
        <Card className="mt-6">
          <EmptyState title="No players found" message={search ? "Try a different search." : "Players appear here after they sign up."} />
        </Card>
      ) : (
        <Card className="mt-6 divide-y divide-border">
          {players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              verifying={verifyMutation.isPending && verifyMutation.variables === player.id}
              onVerify={() => verifyMutation.mutate(player.id)}
            />
          ))}
        </Card>
      )}
    </main>
  );
}

function PlayerRow({
  player,
  verifying,
  onVerify
}: {
  player: User;
  verifying: boolean;
  onVerify: () => void;
}) {
  const verified = !!player.phone_verified_at;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-ink">{player.name || "Unnamed player"}</p>
          {verified ? (
            <Badge variant="success">
              <ShieldCheck className="h-3 w-3" /> Verified
            </Badge>
          ) : (
            <Badge variant="outline">
              <ShieldQuestion className="h-3 w-3" /> Unverified
            </Badge>
          )}
        </div>
        <p className="truncate text-sm text-ink-2">
          {player.email ?? "no email"} {player.phone ? `· ${player.phone}` : ""}
        </p>
      </div>
      {!verified && (
        <Button variant="outline" size="sm" loading={verifying} onClick={onVerify}>
          {verifying ? "Marking…" : "Mark verified"}
        </Button>
      )}
    </div>
  );
}
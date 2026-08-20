"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Input,
  Progress,
  Select,
  Skeleton,
  StatusPill,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@spots/ui";

export function StyleGuide() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">Style guide</h1>
        <p className="mt-1 text-sm text-ink-2">The light-premium identity rendered on its own tokens.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-3">Tokens</h2>
        <div className="flex flex-wrap gap-3">
          {["bg-paper", "bg-surface", "bg-surface-2", "bg-primary", "bg-primary-light", "bg-accent", "bg-accent-light", "bg-success", "bg-warning", "bg-error"].map((c) => (
            <span key={c} className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2 text-xs text-ink-2">
              <span className={`h-4 w-4 rounded-full ring-1 ring-border ${c}`} /> {c}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-3">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="link">Link</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" loading>Loading</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-3">Badges & status</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="primary">Primary</Badge>
          <Badge variant="accent">Accent</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <StatusPill status="confirmed" />
          <StatusPill status="pending" />
          <StatusPill status="checked_in" />
          <StatusPill status="cancelled" />
          <StatusPill status="no_show" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-3">Inputs</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Input" />
          <Input placeholder="With error" error />
          <Select defaultValue="badminton">
            <option value="badminton">Badminton</option>
            <option value="tennis">Tennis</option>
          </Select>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-3">Progress & skeletons</h2>
        <Progress value={62} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-3">Tabs</h2>
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">Upcoming</TabsTrigger>
            <TabsTrigger value="b">Past</TabsTrigger>
          </TabsList>
          <TabsContent value="a">Upcoming content</TabsContent>
          <TabsContent value="b">Past content</TabsContent>
        </Tabs>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-3">Empty & error</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <EmptyState title="Nothing here yet" message="This state shows when data is missing." />
          <ErrorState title="Something went wrong" message="This state shows when loading fails." onRetry={() => {}} />
        </div>
      </section>
    </div>
  );
}
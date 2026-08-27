export function GET() {
  return new Response(`v${process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown"}\n`, {
    headers: { "Content-Type": "text/plain" }
  });
}
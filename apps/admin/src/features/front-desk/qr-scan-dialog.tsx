"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import jsQR from "jsqr";
import { Button, Dialog, DialogContent, ErrorState, Input, StatusPill } from "@myslot/ui";
import { toApiFailure, business } from "@myslot/api";
import { SHEET_CLASS } from "@myslot/ui";
import { formatDateLong, formatLkr, formatTime12 } from "@myslot/utils";
import type { Booking } from "@myslot/types";

export function QrScanDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [manualToken, setManualToken] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanned, setScanned] = useState<Booking | null>(null);

  const lookup = useMutation({
    mutationFn: (token: string) => business.qrLookup(token)
  });

  const checkin = useMutation({
    mutationFn: (token: string) => business.qrCheckin(token),
    onSuccess: (booking) => {
      setScanned(booking);
      queryClient.invalidateQueries({ queryKey: ["front-desk-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    }
  });

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      setScanned(null);
      setCameraError(null);
      setManualToken("");
      lookup.reset();
      checkin.reset();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not available on this device. Paste the code below instead.");
      return;
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !lookup.isPending) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
          if (result && result.data) {
            lookup.mutate(result.data);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        tick();
      } catch {
        setCameraError("Could not start the camera. Paste the code below instead.");
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submitManual = () => {
    if (!manualToken.trim()) return;
    lookup.mutate(manualToken.trim());
  };

  const failure = lookup.error ? toApiFailure(lookup.error) : null;
  const alreadyUsed = !!scanned && scanned.status !== "confirmed";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent
        className={SHEET_CLASS}
        title="Scan booking QR"
        description="Point the camera at the player's QR code to validate them."
        onClose={() => onOpenChange(false)}
      >
        <div className="mt-4 space-y-4">
          {!scanned && (
            <>
              {cameraError ? (
                <div className="overflow-hidden rounded-2xl border border-border bg-surface-2 px-4 py-8 text-center text-sm text-ink-2">
                  {cameraError}
                </div>
              ) : (
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-ink">
                  <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  {!lookup.isPending && (
                    <p className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white/80">
                      Align the QR code within the frame
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Or paste the booking code here"
                  onKeyDown={(e) => e.key === "Enter" && submitManual()}
                  className="min-w-0 flex-1"
                />
                <Button variant="secondary" onClick={submitManual} disabled={!manualToken.trim()} className="shrink-0">
                  Look up
                </Button>
              </div>

              {lookup.isPending && <p className="text-center text-sm text-ink-2">Looking up booking…</p>}
            </>
          )}

          {scanned && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <StatusPill status={scanned.status} />
                <p className="font-display text-lg font-extrabold text-ink">
                  {formatLkr(scanned.total_price)}
                </p>
              </div>
              <dl className="space-y-1 text-sm">
                <Row label="Venue" value={scanned.venue_name ?? "—"} />
                <Row label="Court" value={scanned.court_name ?? "—"} />
                <Row label="Player" value={scanned.player_name ?? "—"} />
                <Row label="Date" value={formatDateLong(scanned.start_at)} />
                <Row
                  label="Time"
                  value={`${formatTime12(scanned.start_at)}–${formatTime12(scanned.end_at)}`}
                />
              </dl>

              {alreadyUsed ? (
                <div className="rounded-2xl bg-warning-light px-4 py-3 text-sm text-warning">
                  This QR code has already been used (status: {scanned.status.replace("_", " ")}).
                </div>
              ) : (
                <Button
                  className="w-full"
                  loading={checkin.isPending}
                  onClick={() => checkin.mutate(scanned.qr_token ?? scanned.id)}
                >
                  Check in
                </Button>
              )}

              {checkin.data?.status === "checked_in" && (
                <p className="rounded-2xl bg-success-light px-4 py-3 text-sm font-semibold text-success">
                  Checked in successfully at {formatTime12(checkin.data.checked_in_at ?? new Date().toISOString())}.
                </p>
              )}
              {checkin.error && (
                <ErrorState
                  title="Could not check in"
                  message={toApiFailure(checkin.error).message}
                />
              )}
            </div>
          )}

          {failure && (
            <ErrorState
              title={failure.status === 404 ? "No booking for this code" : "Could not look up"}
              message={failure.status === 404 ? "This code is not a valid booking QR." : failure.message}
            />
          )}

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setScanned(null);
              setManualToken("");
              lookup.reset();
              checkin.reset();
            }}
          >
            Scan another
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
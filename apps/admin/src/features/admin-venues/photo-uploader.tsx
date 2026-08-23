"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toApiFailure, uploads } from "@myslot/api";

const MAX_PHOTOS = 8;

export function PhotoUploader({
  photos,
  onChange
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const pickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (photos.length + files.length > MAX_PHOTOS) {
      setError(`You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setError("");
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const dataUrl = await readAsDataUrl(file);
        const base64 = dataUrl.split(",")[1];
        if (!base64) throw new Error("Could not read file as image");
        const { url } = await uploads.upload({ filename: file.name, data: base64 });
        uploaded.push(url);
      }
      onChange([...photos, ...uploaded].slice(0, MAX_PHOTOS));
    } catch (err) {
      setError(toApiFailure(err).message);
    } finally {
      setUploading(false);
    }
  };

  const remove = (url: string) => onChange(photos.filter((p) => p !== url));

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((url) => (
          <div key={url} className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Venue" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(url)}
              aria-label="Remove photo"
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink/60 text-white backdrop-blur transition-colors hover:bg-error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border text-ink-3 transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span className="text-xs font-medium">{uploading ? "Uploading…" : "Add photos"}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          void pickFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="mt-2 text-xs text-ink-3">
        PNG, JPG or WebP · up to {MAX_PHOTOS} photos · max 8MB each
      </p>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}
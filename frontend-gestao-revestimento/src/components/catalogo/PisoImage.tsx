import { useEffect, useMemo, useState } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

type PisoImageProps = {
  primaryUrl?: string | null;
  fallbackUrl?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  onUnavailable?: () => void;
};

export function legacyProductImageFallback(
  primaryUrl?: string | null,
  originalUrl?: string | null,
): string | undefined {
  return primaryUrl?.startsWith("/product-images/legacy/")
    ? originalUrl || undefined
    : undefined;
}

function imageCandidates(
  primaryUrl?: string | null,
  fallbackUrl?: string | null,
) {
  const candidates = new Set<string>();

  for (const rawUrl of [primaryUrl, fallbackUrl]) {
    const value = rawUrl?.trim();
    if (!value) continue;

    candidates.add(value);

    try {
      const url = new URL(value);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;

      if (url.hostname.startsWith("www.")) {
        url.hostname = url.hostname.slice(4);
        candidates.add(url.toString());
      }
    } catch {
      // A URL original continua na lista para que o navegador informe a falha.
    }
  }

  return [...candidates];
}

export function PisoImage({
  primaryUrl,
  fallbackUrl,
  alt,
  className,
  fallbackClassName,
  onUnavailable,
}: PisoImageProps) {
  const candidates = useMemo(
    () => imageCandidates(primaryUrl, fallbackUrl),
    [primaryUrl, fallbackUrl],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [primaryUrl, fallbackUrl]);

  const currentUrl = candidates[candidateIndex];

  const handleError = () => {
    const nextIndex = candidateIndex + 1;
    setCandidateIndex(nextIndex);
    if (nextIndex >= candidates.length) {
      onUnavailable?.();
    }
  };

  if (!currentUrl) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-md bg-muted text-center text-xs text-muted-foreground",
          fallbackClassName,
        )}
      >
        <ImageOff className="h-5 w-5" />
        <span>Imagem indisponível</span>
      </div>
    );
  }

  return (
    <img
      key={currentUrl}
      src={currentUrl}
      alt={alt}
      className={className}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={handleError}
    />
  );
}

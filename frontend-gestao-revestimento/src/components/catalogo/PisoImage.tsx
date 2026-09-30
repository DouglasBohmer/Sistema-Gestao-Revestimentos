import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

const IMAGE_LOAD_TIMEOUT_MS = 10_000;

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
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const failedCandidateRef = useRef<string | null>(null);
  const onUnavailableRef = useRef(onUnavailable);

  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    setCandidateIndex(0);
    setLoadedUrl(null);
    failedCandidateRef.current = null;
  }, [primaryUrl, fallbackUrl]);

  const currentUrl = candidates[candidateIndex];

  useEffect(() => {
    if (isNearViewport || !currentUrl) return;

    const image = imageRef.current;
    if (!image || typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "400px" },
    );
    observer.observe(image);

    return () => observer.disconnect();
  }, [currentUrl, isNearViewport]);

  const handleError = useCallback(() => {
    if (!currentUrl || failedCandidateRef.current === currentUrl) return;

    failedCandidateRef.current = currentUrl;
    const nextIndex = candidateIndex + 1;
    setLoadedUrl(null);
    setCandidateIndex(nextIndex);
    if (nextIndex >= candidates.length) {
      onUnavailableRef.current?.();
    }
  }, [candidateIndex, candidates.length, currentUrl]);

  useEffect(() => {
    if (!isNearViewport || !currentUrl || loadedUrl === currentUrl) return;

    const timeoutId = window.setTimeout(handleError, IMAGE_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [currentUrl, handleError, isNearViewport, loadedUrl]);

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
      ref={imageRef}
      key={currentUrl}
      src={currentUrl}
      alt={alt}
      className={className}
      decoding="async"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={handleError}
      onLoad={() => setLoadedUrl(currentUrl)}
    />
  );
}

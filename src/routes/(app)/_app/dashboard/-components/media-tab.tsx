import { useState, useRef, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import {
  UploadSimple as Upload,
  SpinnerGap as Loader2,
  MagnifyingGlass as Search,
  Check,
  Copy,
  ArrowSquareOut as ExternalLink,
  Trash as Trash2,
  CheckSquare,
  Square,
  File as FileIcon,
  Image as ImageIcon,
} from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { useConfirmModal } from "#/components/providers/modal-providers";
import { bulkDeleteMedia } from "../-fn/dashboard.fn";

export interface MediaItem {
  key: string;
  size: number;
  uploaded: string;
  url: string;
}

interface UploadProgressState {
  isUploading: boolean;
  totalFiles: number;
  completedFiles: number;
  currentFileName: string;
  currentPercent: number;
  overallPercent: number;
}

interface MediaTabProps {
  initialMedia: MediaItem[];
}

export function MediaTab({ initialMedia: initialMediaProp }: MediaTabProps) {
  const { confirm } = useConfirmModal();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [initialMedia, setInitialMedia] = useState<MediaItem[]>(initialMediaProp);
  const [mediaSearch, setMediaSearch] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [batchCopied, setBatchCopied] = useState(false);

  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({
    isUploading: false,
    totalFiles: 0,
    completedFiles: 0,
    currentFileName: "",
    currentPercent: 0,
    overallPercent: 0,
  });

  const handleCopyUrl = useCallback(async (url: string, key: string) => {
    try {
      const fullUrl = `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleToggleSelect = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const filteredMediaData = useMemo(() => {
    if (!mediaSearch) return initialMedia;
    const s = mediaSearch.toLowerCase();
    return initialMedia.filter((m) => m.key.toLowerCase().includes(s));
  }, [initialMedia, mediaSearch]);

  const allFilteredSelected = useMemo(() => {
    if (filteredMediaData.length === 0) return false;
    return filteredMediaData.every((item) => selectedKeys.has(item.key));
  }, [filteredMediaData, selectedKeys]);

  const handleToggleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredMediaData.map((item) => item.key)));
    }
  }, [allFilteredSelected, filteredMediaData]);

  const handleBatchCopyUrls = useCallback(async () => {
    if (selectedKeys.size === 0) return;
    const urlsToCopy = filteredMediaData
      .filter((item) => selectedKeys.has(item.key))
      .map((item) => `${window.location.origin}${item.url}`)
      .join("\n");

    try {
      await navigator.clipboard.writeText(urlsToCopy);
      setBatchCopied(true);
      setTimeout(() => setBatchCopied(false), 2000);
    } catch (err) {
      console.error("Batch copy error:", err);
    }
  }, [filteredMediaData, selectedKeys]);

  const handleBulkDelete = useCallback(
    async (keysToDelete: string[]) => {
      if (!keysToDelete.length) return;

      confirm({
        title: "Delete Storage Assets",
        description: `Are you sure you want to permanently delete ${keysToDelete.length} asset(s)? This action cannot be undone.`,
        confirmText: `Delete ${keysToDelete.length === 1 ? "Asset" : "Assets"}`,
        variant: "destructive",
        onConfirm: async () => {
          try {
            await bulkDeleteMedia({ data: { keys: keysToDelete } });
            const keysSet = new Set(keysToDelete);
            setInitialMedia((prev) => prev.filter((item) => !keysSet.has(item.key)));
            setSelectedKeys((prev) => {
              const next = new Set(prev);
              keysToDelete.forEach((k) => next.delete(k));
              return next;
            });
          } catch (err: any) {
            console.error("Bulk delete error:", err);
            alert(err?.message || "Failed to delete files.");
          }
        },
      });
    },
    [confirm],
  );

  const handleMultipleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    setUploadProgress({
      isUploading: true,
      totalFiles: fileList.length,
      completedFiles: 0,
      currentFileName: fileList[0].name,
      currentPercent: 0,
      overallPercent: 0,
    });

    let completed = 0;
    const uploadPromises = fileList.map(async (file) => {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/storage/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Upload failed for ${file.name}`);
        }

        const data = (await res.json()) as { key: string; url: string; size: number };
        completed += 1;
        setUploadProgress((prev) => ({
          ...prev,
          completedFiles: completed,
          currentFileName: file.name,
          overallPercent: Math.round((completed / fileList.length) * 100),
        }));

        return {
          key: data.key,
          size: data.size || file.size,
          uploaded: new Date().toISOString(),
          url: data.url,
        };
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    const newUploadedItems = results.filter((item): item is MediaItem => item !== null);

    setInitialMedia((prev) => [...newUploadedItems, ...prev]);

    setTimeout(() => {
      setUploadProgress({
        isUploading: false,
        totalFiles: 0,
        completedFiles: 0,
        currentFileName: "",
        currentPercent: 0,
        overallPercent: 0,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    }, 1000);
  };

  return (
    <div className="space-y-4">
      {/* Header & Upload Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 sm:p-5 rounded-2xl ring-1 ring-foreground/10">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Media &amp; Asset Storage</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage and organize uploaded images and documents for your articles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleMultipleFileUpload}
          />
          <Button
            type="button"
            size="sm"
            disabled={uploadProgress.isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="h-8 px-4 rounded-full text-xs font-semibold gap-1.5 shadow-xs cursor-pointer"
          >
            {uploadProgress.isUploading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>
                  Uploading ({uploadProgress.completedFiles}/{uploadProgress.totalFiles})...
                </span>
              </>
            ) : (
              <>
                <Upload className="size-3.5" />
                <span>Upload Assets</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Upload Progress Bar */}
      {uploadProgress.isUploading && (
        <div className="bg-card p-4 rounded-2xl ring-1 ring-primary/30 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
              <span className="font-semibold text-foreground truncate">
                Uploading {uploadProgress.currentFileName}
              </span>
              <span className="text-muted-foreground text-[11px] font-mono">
                ({uploadProgress.completedFiles + 1} of {uploadProgress.totalFiles})
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-primary shrink-0">
              {uploadProgress.overallPercent}%
            </span>
          </div>

          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-200 rounded-full"
              style={{ width: `${uploadProgress.overallPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Search and Multi-Select Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 sm:p-4 rounded-2xl ring-1 ring-foreground/10">
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search assets by name or path..."
              value={mediaSearch}
              onChange={(e) => setMediaSearch(e.target.value)}
              className="pl-9 h-8 text-xs rounded-full bg-muted/40 border-border/70"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {filteredMediaData.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleToggleSelectAll}
              className="h-7.5 px-3 rounded-full text-xs gap-1.5 cursor-pointer"
            >
              {allFilteredSelected ? (
                <>
                  <CheckSquare className="size-3.5 text-primary" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="size-3.5 text-muted-foreground" />
                  <span>Select All ({filteredMediaData.length})</span>
                </>
              )}
            </Button>
          )}

          {selectedKeys.size > 0 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleBatchCopyUrls}
                className="h-7.5 px-3 rounded-full text-xs gap-1.5 cursor-pointer animate-in fade-in"
              >
                {batchCopied ? (
                  <>
                    <Check className="size-3.5 text-emerald-500" />
                    <span>Copied {selectedKeys.size} URLs</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>Copy URLs ({selectedKeys.size})</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="xs"
                onClick={() => handleBulkDelete(Array.from(selectedKeys))}
                className="h-7.5 px-3 rounded-full text-xs gap-1.5 shadow-xs cursor-pointer animate-in fade-in"
              >
                <Trash2 className="size-3.5" />
                <span>Delete ({selectedKeys.size})</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Pure Responsive Media Grid */}
      {filteredMediaData.length === 0 ? (
        <div className="bg-card rounded-2xl ring-1 ring-foreground/10 p-12 text-center space-y-3">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <ImageIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">No media assets found</p>
            <p className="text-xs text-muted-foreground">
              {mediaSearch
                ? "No uploaded assets match your search keyword."
                : "Upload images, diagrams, and media to embed directly into your articles."}
            </p>
          </div>
          <div className="pt-2">
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full px-4 h-8 text-xs cursor-pointer"
            >
              <Upload className="size-3.5 mr-1" />
              <span>Upload Your First Asset</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {filteredMediaData.map((item) => {
            const isSelected = selectedKeys.has(item.key);
            const isImage = /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(item.key);
            const isCopied = copiedKey === item.key;

            return (
              <div
                key={item.key}
                className={`bg-card rounded-2xl overflow-hidden flex flex-col justify-between group transition-all duration-200 ${
                  isSelected
                    ? "ring-2 ring-primary bg-primary/5 shadow-2xs"
                    : "ring-1 ring-foreground/10 hover:ring-foreground/25"
                }`}
              >
                {/* Media Thumbnail Container with Checkbox Overlay */}
                <div className="aspect-video bg-muted/40 relative overflow-hidden flex items-center justify-center">
                  {isImage ? (
                    <img
                      src={item.url}
                      alt={item.key}
                      loading="lazy"
                      className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <FileIcon className="size-8" />
                      <span className="text-[10px] font-mono uppercase">
                        {item.key.split(".").pop() || "FILE"}
                      </span>
                    </div>
                  )}

                  {/* Multi-Select Checkbox Overlay */}
                  <button
                    type="button"
                    onClick={() => handleToggleSelect(item.key)}
                    aria-label={`Select ${item.key}`}
                    className={`absolute top-2 left-2 size-6 rounded-md flex items-center justify-center transition-all cursor-pointer z-10 ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-background/80 text-foreground opacity-0 group-hover:opacity-100 backdrop-blur-xs border border-border"
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="size-4" />
                    ) : (
                      <Square className="size-4 text-muted-foreground" />
                    )}
                  </button>
                </div>

                {/* Card Content & Actions */}
                <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate" title={item.key}>
                      {item.key}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
                      {(item.size / 1024).toFixed(1)} KB •{" "}
                      {dayjs(item.uploaded).format("MMM D, YYYY")}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => handleCopyUrl(item.url, item.key)}
                      className="h-6.5 px-2.5 rounded-full text-[10px] gap-1 cursor-pointer font-medium"
                    >
                      {isCopied ? (
                        <>
                          <Check className="size-3 text-emerald-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </Button>

                    <div className="flex items-center gap-0.5">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="size-6.5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Open asset in new tab"
                        aria-label="Open asset"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleBulkDelete([item.key])}
                        className="size-6.5 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        title="Delete asset"
                        aria-label="Delete asset"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

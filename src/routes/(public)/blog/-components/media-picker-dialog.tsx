import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import {
  Image as ImageIcon,
  UploadSimple as Upload,
  SpinnerGap as Loader2,
  Check,
  MagnifyingGlass as Search,
  Plus,
} from "@phosphor-icons/react";

export interface MediaItem {
  key: string;
  size: number;
  uploaded: string;
  url: string;
}

interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectImage: (url: string, alt?: string) => void;
}

export function MediaPickerDialog({ open, onOpenChange, onSelectImage }: MediaPickerDialogProps) {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState("");

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/storage/upload");
      if (res.ok) {
        const data = (await res.json()) as { objects?: any[] };
        const items: MediaItem[] = (data.objects || []).map((obj) => ({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded,
          url: `/api/storage/file/${obj.key}`,
        }));
        setMediaList(items);
      }
    } catch (e) {
      console.error("Failed to load media assets:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMedia();
      setSelectedUrl(null);
      setCustomUrl("");
    }
  }, [open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/storage/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const result = (await res.json()) as { key?: string };
          if (result.key) {
            const newUrl = `/api/storage/file/${result.key}`;
            setSelectedUrl(newUrl);
          }
        }
      }
      await fetchMedia();
    } catch (err) {
      console.error("Failed to upload file:", err);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleInsertSelected = () => {
    const targetUrl = selectedUrl || customUrl.trim();
    if (targetUrl) {
      onSelectImage(targetUrl);
      onOpenChange(false);
    }
  };

  const filteredMedia = mediaList.filter((m) => m.key.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-4 sm:p-6 gap-4">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <ImageIcon className="size-4 text-primary" />
            <span>Insert Image Asset</span>
          </DialogTitle>
        </DialogHeader>

        {/* Custom URL Option */}
        <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-lg border border-border/60">
          <input
            type="url"
            placeholder="Paste external image URL (https://...)"
            value={customUrl}
            onChange={(e) => {
              setCustomUrl(e.target.value);
              setSelectedUrl(null);
            }}
            className="flex-1 bg-transparent text-xs text-foreground focus:outline-none placeholder:text-muted-foreground/50 px-2"
          />
          <Button
            type="button"
            size="xs"
            disabled={!customUrl.trim()}
            onClick={handleInsertSelected}
            className="h-7 px-3 text-xs"
          >
            Insert URL
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search uploaded assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-muted/40 rounded-lg text-xs text-foreground focus:outline-none border border-border/50"
            />
          </div>

          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
              {uploading ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="size-3" />
                  <span>Upload Image</span>
                </>
              )}
            </span>
          </label>
        </div>

        {/* Asset Grid Gallery */}
        <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[340px] pr-1">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg bg-muted/60" />
              ))}
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center space-y-2 border border-dashed rounded-xl">
              <ImageIcon className="size-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">No uploaded images found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {filteredMedia.map((item) => {
                const isSelected = selectedUrl === item.url;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSelectedUrl(item.url);
                      setCustomUrl("");
                    }}
                    className={`relative aspect-square rounded-lg overflow-hidden border transition-all text-left group cursor-pointer ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.key}
                      loading="lazy"
                      className="size-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                        <Check className="size-3" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 pt-4">
                      <p className="text-[10px] text-white font-mono truncate">{item.key}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onOpenChange(false)}
            className="h-8 px-3 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="xs"
            disabled={!selectedUrl && !customUrl.trim()}
            onClick={handleInsertSelected}
            className="h-8 px-4 text-xs font-semibold gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Insert Image</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

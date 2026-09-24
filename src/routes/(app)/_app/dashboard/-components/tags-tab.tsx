import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";

interface TagsTabProps {
  allTags: Array<{ name: string; count: number }>;
}

export function TagsTab({ allTags }: TagsTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-card p-4 sm:p-5 rounded-2xl ring-1 ring-foreground/10">
        <h3 className="text-xs font-bold text-foreground">Content Tags &amp; Taxonomies</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Tags organized across all your published articles.
        </p>
      </div>

      {allTags.length === 0 ? (
        <div className="bg-card rounded-2xl ring-1 ring-foreground/10 p-12 text-center text-xs text-muted-foreground">
          No tags created yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {allTags.map((tag) => (
            <div
              key={tag.name}
              className="bg-card rounded-2xl ring-1 ring-foreground/10 p-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  #
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-foreground truncate">{tag.name}</h4>
                  <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
                    {tag.count} {tag.count === 1 ? "article" : "articles"}
                  </p>
                </div>
              </div>

              <Button
                render={
                  <Link to="/blog" search={{ tag: tag.name }}>
                    <span>Explore</span>
                    <ArrowUpRight className="size-3 ml-1" />
                  </Link>
                }
                size="xs"
                variant="outline"
                className="h-7 px-3 rounded-full text-xs shrink-0"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

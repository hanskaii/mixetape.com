import { Link } from "@tanstack/react-router";
import { siteConfig } from "#/config/site";

interface AuthorCardProps {
  name: string;
  username: string;
  avatar?: string | null;
  bio?: string | null;
}

export function AuthorCard({ name, username, avatar, bio }: AuthorCardProps) {
  const cleanUsername = (username || name || siteConfig.author.handle)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

  return (
    <div className="rounded-lg border bg-card p-4 shadow-xs flex items-start gap-3.5">
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className="size-12 rounded-full object-cover border shrink-0"
        />
      ) : (
        <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
          {name.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-foreground">{name}</h4>
            <p className="text-[11px] font-mono text-muted-foreground">@{cleanUsername}</p>
          </div>
          <Link to="/about" className="text-[11px] font-medium text-primary hover:underline">
            About &rarr;
          </Link>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {bio || siteConfig.author.bio}
        </p>
      </div>
    </div>
  );
}

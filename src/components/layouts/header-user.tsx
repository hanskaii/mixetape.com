import { Link, useRouter } from "@tanstack/react-router";
import { Gear, SignOut, PencilSimple, Shield, SquaresFour } from "@phosphor-icons/react";
import { authClient } from "#/modules/auth/auth-client";
import { Route as RootRoute } from "#/routes/__root";
import { Button } from "#/components/ui/button";
import { siteConfig } from "#/config/site";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useModal } from "#/components/providers/modal-providers";

export function HeaderUser() {
  const router = useRouter();
  const { session } = RootRoute.useRouteContext();
  const user = session?.user;
  const { openLogin } = useModal();

  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-opacity hover:opacity-80 cursor-pointer"
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name || "User avatar"}
                  className="size-7 rounded-full object-cover border"
                />
              ) : (
                <div className="size-7 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs">
                  {(user.name || user.email || "U").charAt(0).toUpperCase()}
                </div>
              )}
            </button>
          }
        />

        <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-md">
          <DropdownMenuLabel className="font-normal p-2 pb-1.5">
            <div className="flex flex-col space-y-0.5">
              <p className="text-xs font-bold leading-none text-foreground truncate">
                {user.name || "Developer"}
              </p>
              <p className="text-[11px] leading-none text-muted-foreground truncate font-mono">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <Link to="/dashboard" className="flex items-center gap-2">
                  <SquaresFour className="size-3.5 text-muted-foreground" />
                  <span>Dashboard</span>
                </Link>
              }
            />

            <DropdownMenuItem
              render={
                <Link to="/settings/profile" className="flex items-center gap-2">
                  <Gear className="size-3.5 text-muted-foreground" />
                  <span>Profile Settings</span>
                </Link>
              }
            />

            <DropdownMenuItem
              render={
                <Link to="/settings/account" className="flex items-center gap-2">
                  <Shield className="size-3.5 text-muted-foreground" />
                  <span>Account Settings</span>
                </Link>
              }
            />

            <DropdownMenuItem
              render={
                <Link to="/blog/new" className="flex items-center gap-2">
                  <PencilSimple className="size-3.5 text-muted-foreground" />
                  <span>Write Article</span>
                </Link>
              }
            />
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={async () => {
              await authClient.signOut();
              router.invalidate();
            }}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive gap-2 cursor-pointer"
          >
            <SignOut className="size-3.5" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      variant="outline"
      size="xs"
      onClick={() =>
        openLogin({
          title: `Welcome to ${siteConfig.name}`,
          description: "Sign in with Email OTP for fast, passwordless edge access.",
        })
      }
    >
      Sign in
    </Button>
  );
}

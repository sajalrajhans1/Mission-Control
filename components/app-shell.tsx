"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain, CheckSquare, Folder, Home, LogOut, Settings, WalletCards
} from "lucide-react";
import { useActiveUser, useUserNames, useUserColors } from "@/components/data-provider";
import { GlobalSearch } from "@/components/global-search";
import { QuickAdd } from "@/components/quick-add";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/projects", label: "Projects", icon: Folder },
  { href: "/vault", label: "Vault", icon: Brain },
  { href: "/money", label: "Money", icon: WalletCards },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeUser, activeUserName, login, logout, isPasswordSet } = useActiveUser();
  const names = useUserNames();
  const userColors = useUserColors();

  // Clear dark mode elements
  useEffect(() => {
    localStorage.removeItem("mc_theme");
    document.documentElement.classList.remove("dark");
  }, []);

  // Auth/Login State
  const [selectedProfile, setSelectedProfile] = useState<"user1" | "user2" | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    setAuthError(null);
    const res = await login(selectedProfile, password);
    if (res.success) {
      setPassword("");
      setSelectedProfile(null);
    } else {
      setAuthError(res.error || "Failed to log in.");
    }
  };

  if (!activeUser) {
    const uName = selectedProfile === "user1" ? names.user1 : selectedProfile === "user2" ? names.user2 : "";
    const isFirstTime = selectedProfile ? !isPasswordSet(selectedProfile) : false;

    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <Card className="w-full max-w-[420px] shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold tracking-tight text-zinc-900 tracking-wider">
              MISSION CONTROL
            </CardTitle>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {selectedProfile
                ? isFirstTime
                  ? `Set a password to secure your profile, ${uName}.`
                  : `Enter your password to unlock ${uName}'s profile.`
                : "Select your profile to enter the workspace."}
            </p>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!selectedProfile ? (
              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="h-16 justify-start gap-4 rounded-xl text-base font-semibold hover:border-black"
                  onClick={() => setSelectedProfile("user1")}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white font-bold shrink-0"
                    style={{ backgroundColor: userColors.user1 }}
                  >
                    {names.user1[0].toUpperCase()}
                  </div>
                  {names.user1}
                </Button>
                <Button
                  variant="outline"
                  className="h-16 justify-start gap-4 rounded-xl text-base font-semibold hover:border-black"
                  onClick={() => setSelectedProfile("user2")}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white font-bold shrink-0"
                    style={{ backgroundColor: userColors.user2 }}
                  >
                    {names.user2[0].toUpperCase()}
                  </div>
                  {names.user2}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="grid gap-3">
                <Input
                  type="password"
                  placeholder={isFirstTime ? "Create new password" : "Enter password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="h-12 rounded-xl"
                />
                {authError && <p className="text-xs text-destructive">{authError}</p>}
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1 rounded-xl"
                    onClick={() => {
                      setSelectedProfile(null);
                      setPassword("");
                      setAuthError(null);
                    }}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="flex-1 rounded-xl">
                    {isFirstTime ? "Set & Enter" : "Enter"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-white px-4 py-5 lg:block">
        <Link href="/" className="mb-8 block px-2">
          <div className="text-xl font-bold tracking-tight">Mission Control</div>
          <div className="text-xs text-muted-foreground">Private two-person OS</div>
        </Link>
        <nav className="grid gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
                pathname === item.href && "bg-black text-white hover:bg-black hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b bg-[#fafafa]/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-xl border bg-white p-2",
                    pathname === item.href && "bg-black text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </Link>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <GlobalSearch />
              <div className="h-4 w-px bg-zinc-200" />
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: activeUser === "user1" ? userColors.user1 : userColors.user2 }}
                >
                  {(activeUserName ? activeUserName[0] : "").toUpperCase()}
                </div>
                <span className="hidden text-sm font-medium sm:inline">{activeUserName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={logout}
                  className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>
        {!isSupabaseConfigured ? (
          <div className="border-b bg-white px-4 py-3 text-sm text-muted-foreground sm:px-6">
            Add Supabase environment variables from <code>.env.example</code> to connect live data.
          </div>
        ) : null}
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      </div>
      <QuickAdd />
    </div>
  );
}

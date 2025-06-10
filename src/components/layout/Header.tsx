
"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from "@/lib/i18n";
import { Home, LogIn, LogOut, PlusCircle, UserPlus, UserCircle, Settings, ShoppingCart, UserCog } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user, logOut, loading, isAdmin, isUserApproved } = useAuth();
  const { t } = useTranslation();

  const avatarName = user?.displayName || user?.email || "User";
  const avatarFallback = (user?.displayName || user?.email || "U").charAt(0).toUpperCase();


  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md shadow-sm">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <Link href="/" className="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
            <path d="M5 11h14C19 7 15 4 12 4S5 7 5 11Z"/>
            <path d="M19 11v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6"/>
            <path d="M12 4V2"/>
            <path d="M10 4V2"/>
            <path d="M14 4V2"/>
          </svg>
          <span className="text-xl font-bold text-primary">{siteConfig.name}</span>
        </Link>

        <div className="flex flex-1 items-center justify-end space-x-2 sm:space-x-4">
          <nav className="hidden sm:flex items-center space-x-2">
            {user && (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/">{t('my_recipes')}</Link>
                </Button>
                {isUserApproved && (
                  <Button variant="ghost" asChild>
                    <Link href="/recipes/new">{t('add_recipe')}</Link>
                  </Button>
                )}
                <Button variant="ghost" asChild>
                  <Link href="/shopping-list">{t('shopping_list')}</Link>
                </Button>
              </>
            )}
          </nav>
          <LanguageSwitcher />
          {loading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted"></div>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.displayName || user.email}</p>
                    {user.displayName && user.email && <p className="text-xs leading-none text-muted-foreground">{user.email}</p>}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard"><Home className="mr-2 h-4 w-4" /> {t('dashboard')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                   <Link href="/profile"><UserCircle className="mr-2 h-4 w-4" /> {t('profile')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                   <Link href="/settings"><Settings className="mr-2 h-4 w-4" /> {t('settings')}</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/users"><UserCog className="mr-2 h-4 w-4" /> {t('admin_manage_users_link')}</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logOut}>
                  <LogOut className="mr-2 h-4 w-4" /> {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">
                  <LogIn className="mr-1 h-4 w-4 sm:mr-2" />
                  {t('login')}
                </Link>
              </Button>
              <Button asChild>
                <Link href="/signup">
                  <UserPlus className="mr-1 h-4 w-4 sm:mr-2" />
                  {t('signup')}
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

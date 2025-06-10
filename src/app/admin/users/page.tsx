
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/firebase";
import { collection, getDocs, doc, updateDoc, query, orderBy, deleteDoc } from "firebase/firestore";
import type { User as AppUserType } from "@/types"; 
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Loader2, ShieldAlert, UserCog, ShieldCheck, ShieldX, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserForAdmin extends AppUserType {
  createdAt?: string; 
}

export default function AdminUsersPage() {
  const { user: currentUser, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserForAdmin[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [togglingAdminUserId, setTogglingAdminUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isAdmin) {
        router.replace("/"); 
      }
    }
  }, [currentUser, isAdmin, authLoading, router]);

  const fetchUsers = async () => {
    if (!db) {
      console.error("Firestore (db) is not initialized.");
      toast({ title: t('error_generic_title'), description: "Firestore not available.", variant: "destructive" });
      setIsLoadingUsers(false);
      return;
    }
    setIsLoadingUsers(true);
    try {
      const usersCollectionRef = collection(db, "users");
      const q = query(usersCollectionRef, orderBy("createdAt", "desc")); 
      const querySnapshot = await getDocs(q);
      const fetchedUsers = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          email: data.email,
          displayName: data.displayName,
          isApproved: data.isApproved,
          roles: data.roles || ['user'],
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        } as UserForAdmin;
      });
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ title: t('error_fetching_users_title'), description: t('error_fetching_users_desc'), variant: "destructive" });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleApproveUser = async (userId: string) => {
    if (!db) {
      toast({ title: t('error_generic_title'), description: "Firestore not available.", variant: "destructive" });
      return;
    }
    setUpdatingUserId(userId);
    try {
      const userDocRef = doc(db, "users", userId);
      await updateDoc(userDocRef, { isApproved: true, updatedAt: new Date().toISOString() });
      toast({ title: t('user_approved_successfully_title') });
      setUsers(prevUsers => prevUsers.map(u => u.uid === userId ? { ...u, isApproved: true } : u));
    } catch (error) {
      console.error("Error approving user:", error);
      toast({ title: t('error_approving_user_title'), description: t('error_generic_desc'), variant: "destructive" });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleToggleAdminRole = async (userId: string, currentRoles: string[] = [], isCurrentlyAdmin: boolean) => {
    if (!db || !currentUser || userId === currentUser.uid) { 
      toast({ title: t('error_generic_title'), description: t('cannot_change_own_admin_role'), variant: "destructive" });
      return;
    }
    setTogglingAdminUserId(userId);
    const newRoles = isCurrentlyAdmin 
      ? currentRoles.filter(role => role !== 'admin') 
      : [...new Set([...currentRoles, 'admin'])]; 

    if (!newRoles.includes('user')) newRoles.push('user');

    try {
      const userDocRef = doc(db, "users", userId);
      await updateDoc(userDocRef, { roles: newRoles, updatedAt: new Date().toISOString() });
      toast({ title: isCurrentlyAdmin ? t('admin_role_removed_title') : t('admin_role_granted_title') });
      setUsers(prevUsers => prevUsers.map(u => u.uid === userId ? { ...u, roles: newRoles } : u));
    } catch (error) {
      console.error("Error toggling admin role:", error);
      toast({ title: t('error_toggling_admin_role_title'), description: t('error_generic_desc'), variant: "destructive" });
    } finally {
      setTogglingAdminUserId(null);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string | null) => {
     if (!db || !currentUser || userId === currentUser.uid) { 
      toast({ title: t('error_generic_title'), description: t('cannot_delete_own_account_admin'), variant: "destructive" });
      return;
    }
    setDeletingUserId(userId);
    try {
      const userDocRef = doc(db, "users", userId);
      await deleteDoc(userDocRef);
      toast({ 
        title: t('user_deleted_firestore_title'), 
        description: t('user_deleted_firestore_desc', { email: userEmail || 'N/A' }),
        duration: 7000 
      });
      setUsers(prevUsers => prevUsers.filter(u => u.uid !== userId));
    } catch (error) {
      console.error("Error deleting user from Firestore:", error);
      toast({ title: t('error_deleting_user_title'), description: t('error_generic_desc'), variant: "destructive" });
    } finally {
      setDeletingUserId(null);
    }
  };


  if (authLoading || (!isAdmin && currentUser) ) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{t('loading_auth_status')}</p>
      </div>
    );
  }

  if (!isAdmin && !authLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">{t('access_denied_title')}</h1>
        <p className="text-muted-foreground">{t('admin_only_area_desc')}</p>
        <Button onClick={() => router.push('/')} className="mt-6">{t('go_to_homepage')}</Button>
      </div>
    );
  }
  

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('admin_manage_users_title')}</h1>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>{t('user_list_title')}</CardTitle>
          <CardDescription>{t('admin_users_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between items-center p-2 border-b">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              ))}
            </div>
          ) : users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('email')}</TableHead>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('roles')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const isCurrentUserAdmin = user.uid === currentUser?.uid;
                  const targetUserIsAdmin = user.roles?.includes('admin') || false;
                  return (
                    <TableRow key={user.uid}>
                      <TableCell className="font-medium break-all max-w-xs">{user.email}</TableCell>
                      <TableCell>{user.displayName || "N/A"}</TableCell>
                      <TableCell>
                        {user.isApproved ? (
                          <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> {t('approved_status')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900">
                            <XCircle className="mr-1 h-3.5 w-3.5" /> {t('pending_approval_status')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.roles?.map(role => (
                            <Badge key={role} variant={role === 'admin' ? 'destructive' : 'secondary'}>
                              {role === 'admin' && <UserCog className="mr-1 h-3.5 w-3.5" />}
                              {t(`role_${role}`, role)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        {!user.isApproved && (
                          <Button
                            size="sm"
                            onClick={() => handleApproveUser(user.uid)}
                            disabled={updatingUserId === user.uid || (isCurrentUserAdmin && user.uid === currentUser?.uid)}
                          >
                            {updatingUserId === user.uid ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                            )}
                            {t('approve_user_button')}
                          </Button>
                        )}
                        {!isCurrentUserAdmin && ( 
                          <>
                            <Button
                              size="sm"
                              variant={targetUserIsAdmin ? "destructive" : "outline"}
                              onClick={() => handleToggleAdminRole(user.uid, user.roles, targetUserIsAdmin)}
                              disabled={togglingAdminUserId === user.uid}
                            >
                              {togglingAdminUserId === user.uid ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (targetUserIsAdmin ? <ShieldX className="mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />)}
                              {targetUserIsAdmin ? t('remove_admin_button') : t('make_admin_button')}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="bg-red-600 hover:bg-red-700"
                                  disabled={deletingUserId === user.uid}
                                >
                                  {deletingUserId === user.uid ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                                  {t('delete_user_button')}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('confirm_delete_user_title', {email: user.email || 'N/A'})}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('confirm_delete_user_desc_firestore_only')}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUser(user.uid, user.email)} className="bg-destructive hover:bg-destructive/90">
                                    {t('delete_user_confirm_button')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-6">{t('no_users_found')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

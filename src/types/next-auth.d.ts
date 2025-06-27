import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      isApproved: boolean;
      roles: string[];
      theme: string;
    };
  }

  interface User extends DefaultUser {
    isApproved: boolean;
    roles: string[];
    theme: string;
  }
}

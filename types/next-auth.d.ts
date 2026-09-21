import type { DefaultSession } from "next-auth";
declare module "next-auth" {
  interface Session {
    authMethod: string;
    user: DefaultSession["user"] & { id: string };
  }
}

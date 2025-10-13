import { prisma } from "@/lib/prisma";
import { Role, UserStatus } from "@prisma/client";
import { NextAuthOptions, getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { verifyPassword } from "@/lib/security/password";

type NonEmptyProviders = NonNullable<NextAuthOptions["providers"]>;

const providers: NonEmptyProviders = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.toLowerCase().trim();
      if (!email) return null;

      const user =
        (await prisma.user.findUnique({
          where: { email },
        })) ??
        (await prisma.user.create({
          data: { email, role: Role.LAWYER, status: UserStatus.ACTIVE },
        }));

      if (user.status !== UserStatus.ACTIVE || user.isActive === false) {
        return null;
      }

      if (user.passwordHash) {
        const password = credentials?.password ?? "";
        if (!password) {
          return null;
        }
        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          return null;
        }
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        role: user.role,
        isActive: user.isActive,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_CLIENT_SECRET &&
  process.env.AZURE_AD_TENANT_ID
) {
  providers.push(
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID,
    }),
  );
}

declare module "next-auth" {
  interface Session {
    user?: Session["user"] & { id: string; role?: Role; status?: UserStatus; isActive?: boolean };
  }

  interface User {
    role?: Role;
    status?: UserStatus;
    isActive?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    status?: UserStatus;
    isActive?: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token }) {
      if (!token.email) return token;

      const user = await prisma.user.findUnique({
        where: { email: token.email },
        select: { id: true, role: true, status: true, isActive: true },
      });

      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.status = user.status;
        token.isActive = user.isActive;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role;
        session.user.status = token.status;
        session.user.isActive = token.isActive;
      }
      return session;
    },
  },
};

export function getAuthSession() {
  return getServerSession(authOptions);
}

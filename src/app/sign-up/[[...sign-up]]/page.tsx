import { SignUp } from "@clerk/nextjs";

import { isClerkConfigured } from "@/lib/env";

export default function Page() {
  if (!isClerkConfigured()) {
    return <AuthNotConfigured mode="sign up" />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <SignUp />
    </main>
  );
}

function AuthNotConfigured({ mode }: { mode: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Clerk {mode} is not configured</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to enable
          hosted authentication. Demo mode keeps the dashboard open.
        </p>
      </div>
    </main>
  );
}

import type { ReactNode } from "react";
import { Pill } from 'lucide-react';

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-text">
      <div className="w-full max-w-[430px]">
        <header className="mb-6 text-center">
          {/* <div className="mx-auto flex size-20 items-center justify-center text-sm font-bold text-subdued">
            <img src="/pharma-logo.png" alt="PharmaDoc" className="rounded-full" /> 
          </div> */}
          <div className="mt-3 flex items-center justify-center gap-2 text-lg font-semibold">
            <img src="/pharmasynapse-lockup.svg" alt="PharmaDoc AI Logo" className="h-6 w-22 mt-1" />
            {/* <span className="text-subdued">· Brainy Neurals</span> */}
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}

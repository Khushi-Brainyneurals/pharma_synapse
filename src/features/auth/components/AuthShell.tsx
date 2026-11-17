import type { ReactNode } from "react";
import { useViewportWidth } from "../hooks/useViewportWidth";
import { AuthFooter } from "./AuthFooter";
import { LoginPhotoPanel } from "./LoginPhotoPanel";

/** Photo panel width from the design: half the screen at 1440 and up, 45% from 1280, 40% from 1024, none below. */
function photoWidth(vw: number) {
  if (vw < 1024) return 0;
  const ratio = vw >= 1440 ? 0.5 : vw >= 1280 ? 0.45 : 0.4;
  return Math.min(1120, Math.round(vw * ratio) + 16);
}

export function AuthShell({ children }: { children: ReactNode }) {
  const photo = photoWidth(useViewportWidth());
  const hasPhoto = photo > 0;

  return (
    <>
      {hasPhoto ? <LoginPhotoPanel width={photo} /> : null}
      <div
        className="ps-app ps-public relative isolate box-border flex min-h-screen flex-col items-center justify-start overflow-clip bg-card py-6 pr-7 font-sans text-text"
        style={{ paddingLeft: hasPhoto ? photo + 24 : 28 }}
      >
        <div aria-hidden="true" className="auth-glow pointer-events-none absolute bottom-0 right-0 top-0 -z-[1] dark:hidden" style={{ left: hasPhoto ? photo : 0 }} />
        <div className="my-auto flex w-full max-w-[560px] flex-col gap-3">
          <div className="relative flex min-w-0 flex-col">
            <span aria-hidden="true" className="card-glow-harbor pointer-events-none absolute -inset-[15%] z-0" />
            <div className="relative z-[1] flex-1">{children}</div>
          </div>
          <AuthFooter />
        </div>
      </div>
    </>
  );
}

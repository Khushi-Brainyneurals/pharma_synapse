import { useNavigate } from "react-router-dom";
import { getLoginRoute } from "../../../app/routing/routes";
import { rememberModule } from "../model/selectedModule";
import { Button } from "../../../shared/ps/Button";
import { Logo } from "../../../shared/ps/Logo";
import { ThemeToggle } from "../../../shared/ui/ThemeToggle";
import { ModuleCard } from "../components/ModuleCard";
import { modulesByGroup, type AppModule } from "../model/modules";

/** The public module map. Opening any module goes to its sign-in. */
export function ModuleMapPage() {
  const navigate = useNavigate();
  const groups = modulesByGroup();
  const openModule = (m: AppModule) => {
    rememberModule(m.key);
    navigate(getLoginRoute(m.key));
  };

  return (
    <div className="ps-app ps-public app-glow relative isolate flex min-h-screen flex-col overflow-x-clip bg-page text-text">
      <header className="sticky top-0 z-[5] flex items-center gap-3 border-b border-border bg-page px-7 py-3.5">
        <Logo width={240} />
        <span className="flex-auto" />
        <ThemeToggle />
        <Button onClick={() => navigate(getLoginRoute())}>Sign in</Button>
      </header>

      <main className="mx-auto box-border flex w-full max-w-[1180px] flex-auto flex-col gap-6 px-6 pb-14 pt-7">
        <p className="m-0 text-[12.5px] leading-[18px] text-text-3">Open a module to sign in.</p>
        {groups.map(({ group, modules }) => (
          <section key={group} className="flex flex-col gap-2.5">
            <h2 className="m-0 text-base font-medium leading-[22px] tracking-[-0.015em] text-text">{group}</h2>
            <div className="grid auto-rows-[152px] grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
              {modules.map((m) => (
                <ModuleCard key={m.key} module={m} onOpen={openModule} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getLoginRoute } from "../../../app/routing/routes";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { Callout } from "../../../shared/ui/Callout";
import { rememberModule } from "../model/selectedModule";
import { Logo } from "../../../shared/ps/Logo";
import { ThemeToggle } from "../../../shared/ui/ThemeToggle";
import { ModuleCard } from "../components/ModuleCard";
import { getModules, type ModulesResponse } from "../api/modules.api";
import { modulesByGroup, type AppModule } from "../model/modules";

/** The public module map. Opening any module goes to its sign-in. */
export function ModuleMapPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ModulesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getModules()
      .then((response) => {
        if (active) setData(response);
      })
      .catch((cause: unknown) => {
        if (active) setError(getApiErrorMessage(cause, "Modules could not be loaded. Please try again."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const groups = data ? modulesByGroup(data.sections, data.module_login_available) : [];
  const singletonGroups = groups.filter(({ modules }) => modules.length === 1);
  const groupSingletonsInRow = singletonGroups.length > 1;
  const openModule = (m: AppModule) => {
    rememberModule(m.key, m.name, m.description);
    navigate(getLoginRoute(m.key));
  };
  const renderSection = (section: (typeof groups)[number], compact = false) => (
    <section key={section.group} className="flex flex-col gap-3">
      <h2 className="m-0 text-base font-medium leading-[22px] tracking-[-0.015em] text-text text-[17px]">{section.group}</h2>
      <div className={compact ? "grid flex-1 auto-rows-fr grid-cols-1 gap-3" : "grid auto-rows-fr grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3"}>
        {section.modules.map((module) => (
          <ModuleCard key={module.key} module={module} onOpen={openModule} />
        ))}
      </div>
    </section>
  );

  return (
    <div className="ps-app ps-public app-glow relative isolate flex min-h-screen flex-col overflow-x-clip bg-page text-text">
      <header className="sticky top-0 z-[5] flex items-center gap-3 border-b border-border bg-page px-7 py-2.5">
        <Logo width={240} />
        <span className="flex-auto" />
        <ThemeToggle />
      </header>

      <main className="mx-auto box-border flex w-full max-w-[1180px] flex-auto flex-col gap-5 pb-5 pt-4">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-12 text-small text-text-2" role="status">
            <span className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden="true" />
            Loading modules…
          </div>
        ) : null}
        {!loading && error ? <Callout tone="danger" title="Unable to load modules">{error}</Callout> : null}
        {!loading && !error && groups.length === 0 ? (
          <Callout title="No modules available">There are no modules to display right now.</Callout>
        ) : null}
        {groups.map((section) => {
          if (!groupSingletonsInRow || section.modules.length !== 1) return renderSection(section);
          if (section.group !== singletonGroups[0].group) return null;
          return (
            <div key="single-module-sections" className="grid auto-rows-fr grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
              {singletonGroups.map((singleton) => renderSection(singleton, true))}
            </div>
          );
        })}
      </main>
    </div>
  );
}

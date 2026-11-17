import { Icon } from "./Icon";

export type Family = "harbor" | "sage" | "iris" | "honey" | "clay" | "rose";

export const TILE_FAMILY: Record<Family, string> = {
  harbor: "bg-harbor-100 text-harbor-700",
  sage: "bg-sage-100 text-sage-700",
  iris: "bg-iris-100 text-iris-700",
  honey: "bg-honey-100 text-honey-700",
  clay: "bg-clay-100 text-clay-700",
  rose: "bg-rose-100 text-rose-700",
};

/** 30px module icon tile in a family tint. */
export function IconTile({ family, icon }: { family: Family; icon: string }) {
  return (
    <span className={`inline-flex size-[30px] flex-none items-center justify-center rounded-card ${TILE_FAMILY[family]}`}>
      <Icon name={icon} size={18} />
    </span>
  );
}

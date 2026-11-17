import { useState } from "react";
import { Icon } from "../../../shared/ps/Icon";
import { Tooltip } from "../../../shared/ps/Tooltip";

const PHOTOS = ["/signin-photos/login-plant-1.jpg", "/signin-photos/login-plant-2.jpg"];
const STORAGE_KEY = "ps-login-photo";

function readPhoto() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "2" ? 1 : 0;
  } catch {
    return 0;
  }
}

/** The fixed plant photo down the left of the sign-in screen, with the change photo button. */
export function LoginPhotoPanel({ width }: { width: number }) {
  const [index, setIndex] = useState(readPhoto);

  function swap() {
    const next = index === 0 ? 1 : 0;
    setIndex(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next + 1));
    } catch {
      /* storage blocked: keep the choice for this visit only */
    }
  }

  return (
    <div className="fixed bottom-0 left-0 top-0 z-[1]" style={{ width }}>
      <div className="absolute inset-0 overflow-hidden bg-card">
        {PHOTOS.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover dark:brightness-[0.88]"
            style={{ objectPosition: "30% 35%", visibility: i === index ? "visible" : "hidden" }}
          />
        ))}
      </div>
      <span className="absolute bottom-3 right-3 inline-flex">
        <Tooltip text="Change photo" wrap={false}>
          <button
            type="button"
            aria-label="Change photo"
            onClick={swap}
            className="inline-flex size-8 flex-none items-center justify-center rounded-full border border-chip-rim bg-chip-fill p-0 text-text opacity-40 transition-[opacity,box-shadow] duration-100 hover:opacity-100 hover:shadow-halo focus-visible:opacity-100"
          >
            <Icon name="photo_library" size={16} />
          </button>
        </Tooltip>
      </span>
    </div>
  );
}

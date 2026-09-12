import Image from "next/image";

const mascotAssets = {
  welcome: {
    src: "/mascot/studigo-hugging.jpg",
    alt: "Studigo welcoming you to study."
  },
  asking: {
    src: "/mascot/studigo-asking.jpg",
    alt: "Studigo inviting you to ask a question."
  },
  explaining: {
    src: "/mascot/studigo-pointing.jpg",
    alt: "Studigo explaining the next step."
  },
  "found-source": {
    src: "/mascot/studigo-showing-source.jpg",
    alt: "Studigo presenting a source from your study materials."
  },
  "looking-right": {
    src: "/mascot/studigo-looking-right.jpg",
    alt: "Studigo looking toward supporting content."
  }
} as const;

export type StudigoMascotState = keyof typeof mascotAssets;

type StudigoMascotProps = {
  state: StudigoMascotState;
  className?: string;
  priority?: boolean;
  sizes?: string;
  alt?: string;
  decorative?: boolean;
};

export function StudigoMascot({
  state,
  className,
  priority = false,
  sizes = "(max-width: 780px) 290px, 440px",
  alt,
  decorative = false
}: StudigoMascotProps) {
  const asset = mascotAssets[state];

  return (
    <Image
      src={asset.src}
      alt={decorative ? "" : (alt ?? asset.alt)}
      className={className}
      width={3276}
      height={1312}
      priority={priority}
      sizes={sizes}
      aria-hidden={decorative || undefined}
    />
  );
}
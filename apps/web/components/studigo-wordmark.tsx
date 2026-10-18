import Image from "next/image";

/** Official two-color Studigo wordmark, traced from the approved artwork. */
export function StudigoWordmark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/studigo-official-wordmark.svg"
      alt="Studigo"
      className={className}
      width={1290}
      height={386}
      unoptimized
    />
  );
}

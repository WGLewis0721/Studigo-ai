import { notFound } from "next/navigation";
import { StudigoShowroom } from "./showroom";

export default function StudigoShowroomPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <StudigoShowroom />;
}

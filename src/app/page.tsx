import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { homePathFor } from "@/lib/auth/roles";

export default async function IndexPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(homePathFor(user.role));
}

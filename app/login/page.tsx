import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Log ind · Karltoffel Business Manager" };

// ?next= sættes af middleware, når en udløbet session afbrød et dybt link —
// login-action'en sender brugeren videre dertil efter validering.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : undefined} />;
}

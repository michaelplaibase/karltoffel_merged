import ChangePasswordForm from "@/components/ChangePasswordForm";

export const metadata = { title: "Skift password · Karltoffel" };

export default function ChangePasswordPage() {
  return (
    <div className="container-1140" style={{ maxWidth: 620 }}>
      <div className="card">
        <div className="card-body">
          <h1 className="page-title">Skift password</h1>
          <p className="page-desc">Vælg en ny adgangskode til din konto.</p>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}

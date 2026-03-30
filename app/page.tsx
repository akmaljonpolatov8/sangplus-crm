export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16 sm:px-10 lg:px-12">
        <div className="inline-flex w-fit items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-medium text-cyan-200">
          SangPlus CRM Backend MVP
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              CRM API is deployed and ready for client applications.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              This project exposes authentication, students, teachers, groups,
              lessons, attendance, and payment APIs for the SangPlus learning
              center.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                href="/api/health"
              >
                Open health check
              </a>
              <a
                className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900"
                href="https://github.com/akmaljonpolatov8/sangplus-crm"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open repository
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-cyan-950/30">
            <h2 className="text-lg font-semibold text-white">Important for Vercel</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <li>
                Set <code className="rounded bg-slate-800 px-1.5 py-0.5">DATABASE_URL</code>{" "}
                to your PostgreSQL database.
              </li>
              <li>
                Set <code className="rounded bg-slate-800 px-1.5 py-0.5">AUTH_SECRET</code>{" "}
                to a long random secret.
              </li>
              <li>
                Optional SMS variables can stay empty until you connect a provider.
              </li>
              <li>
                Use <code className="rounded bg-slate-800 px-1.5 py-0.5">/api/setup/bootstrap-owner</code>{" "}
                once if the database has no users yet.
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfoCard
            title="Auth"
            description="Login, current user, and password change routes."
            href="/api/auth/me"
          />
          <InfoCard
            title="Students"
            description="Student CRUD endpoints for the learning center."
            href="/api/students"
          />
          <InfoCard
            title="Groups"
            description="Group, teacher assignment, and roster management."
            href="/api/groups"
          />
          <InfoCard
            title="Payments"
            description="Billing, summaries, overdue detection, and reminders."
            href="/api/payments/summary"
          />
        </div>
      </section>
    </main>
  );
}

function InfoCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-cyan-400/40 hover:bg-slate-900"
    >
      <div className="text-base font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      <div className="mt-4 text-sm font-medium text-cyan-300">{href}</div>
    </a>
  );
}

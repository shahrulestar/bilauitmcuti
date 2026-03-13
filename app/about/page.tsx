export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          About <span className="text-[#8b5cf6]">Bila UiTM Cuti?</span>
        </h1>

        <div className="mt-6 space-y-6 text-muted-foreground">
          <section className="space-y-3">
            <p>
              Bila UiTM Cuti? is a student-focused web app that helps users track the latest UiTM academic calendar details in one clean and accessible place. The app is designed for quick checking of important timelines such as registration windows, lecture periods, examination phases, and semester breaks.
            </p>
            <p>
              The current web app version includes both grid and list views, regional calendar coverage for Kedah, Kelantan, and Terengganu, and a responsive layout that works smoothly across phone, tablet, and desktop screens. It also supports light and dark themes and can be installed as a Progressive Web App (PWA) for faster home-screen access.
            </p>
            <p>
              To support faster understanding of schedule context, the app also includes an AI chat assistant that helps explain date ranges and related calendar information. Even with this support, users should always verify critical dates with official UiTM announcements when making important academic decisions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Terms and Conditions</h2>
            <p>
              By using Bila UiTM Cuti?, you agree that all information is provided on a best-effort basis for educational and informational use only. While we try to keep data updated, we do not guarantee completeness, accuracy, or uninterrupted availability at all times.
            </p>
            <p>
              You are responsible for verifying any date, deadline, or academic requirement with official UiTM channels before taking action. The app owner is not liable for direct or indirect loss caused by reliance on unofficial or outdated schedule information.
            </p>
            <p>
              We may update features, content, and terms without prior notice to improve service quality. Continued use of the app after updates indicates acceptance of the revised terms and conditions.
            </p>
          </section>

          <section className="space-y-3 pb-8">
            <h2 className="text-lg font-semibold text-foreground">Disclaimer</h2>
            <p>
              This app is <strong className="font-semibold text-foreground">not affiliated with UiTM</strong> (Universiti Teknologi MARA). It is created for educational and informational purposes only. Calendar data is sourced from publicly available HEA UiTM academic calendar information. Please verify important dates directly with official UiTM sources.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

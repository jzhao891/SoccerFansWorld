export const metadata = {
  title: 'Support — FandarAI',
};

export default function SupportPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Support</h1>
      <p className="text-gray-500 mb-12">We&apos;re here to help.</p>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-3">Contact</h2>
        <p className="text-gray-600">
          Email us at{' '}
          <a href="mailto:footballfansworld.labs@gmail.com" className="text-blue-600 underline">
            footballfansworld.labs@gmail.com
          </a>
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">FAQ</h2>
        <div>
          <h3 className="font-semibold mb-2">How do I delete my account and data?</h3>
          <p className="text-gray-600">
            Email us at{' '}
            <a href="mailto:footballfansworld.labs@gmail.com" className="text-blue-600 underline">
              footballfansworld.labs@gmail.com
            </a>{' '}
            with the subject line <strong>&ldquo;Data Deletion Request&rdquo;</strong> and we will
            permanently remove your account, associated user identifiers, and history within 30
            days.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Service Health</h2>
        <p className="text-gray-500 text-sm">No events.</p>
      </section>
    </main>
  );
}

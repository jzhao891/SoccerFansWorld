export const metadata = {
  title: 'Privacy Policy — Fandar AI',
};

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

      <p className="mb-8 text-gray-600">
        This privacy policy applies to the mobile and web application Fandar (herein referred to as
        &ldquo;Application&rdquo;), which was created as a Commercial service. This service is
        intended for use &ldquo;AS IS&rdquo;.
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Information Collection and Use</h2>
        <p className="mb-4 text-gray-600">
          The Application collects specific personal information and device metrics when you
          download, create an account, or interact with its core features. This data is utilized
          strictly to provide the Application&apos;s services, verify user identity, process
          background tasks, and evaluate basic usage performance.
        </p>

        <h3 className="font-semibold mb-2">A. Personal Information Provided by You</h3>
        <p className="mb-2 text-gray-600">
          During account registration, we collect the following explicitly provided information:
        </p>
        <ul className="list-disc pl-6 mb-4 text-gray-600 space-y-1">
          <li><strong>Identification Data:</strong> First name and last name.</li>
          <li><strong>Contact Information:</strong> Email address.</li>
        </ul>
        <p className="mb-4 text-gray-500 text-sm italic">
          Note: The Application does NOT collect or access your phone number, physical mailing
          address, social media profiles, or local contact lists.
        </p>

        <h3 className="font-semibold mb-2">B. Device and Hardware Permissions</h3>
        <ul className="list-disc pl-6 text-gray-600 space-y-1">
          <li>
            <strong>Location (GPS):</strong> Location data is processed to position you accurately
            on the interactive map and display nearby events or venues.
          </li>
          <li>
            <strong>Camera / Media Library:</strong> Access to your device camera and photo/video
            gallery is required to upload files for generative video and image modification
            features.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Third-Party Core Frameworks</h2>
        <p className="mb-3 text-gray-600">
          The Application integrates specific third-party developer infrastructure tools to operate
          core mapping, system performance, and analytics features:
        </p>
        <ul className="list-disc pl-6 mb-4 text-gray-600 space-y-2">
          <li>
            <strong>Firebase Authentication &amp; Firestore:</strong> Manages user registration
            sessions securely and maintains transaction/token history logs.
          </li>
          <li>
            <strong>Google Places API:</strong> Utilized to power location autocomplete, address
            lookups, and identify physical venues on the map layout.
          </li>
          <li>
            <strong>Google Analytics:</strong> A free web and mobile analytics service provided by
            Google, Inc. We utilize this framework to collect anonymous, aggregated data regarding
            application stability, performance metrics, and general user engagement trends to
            improve our service.
          </li>
          <li>
            <strong>Google Play Services &amp; Apple Developer Systems:</strong> Core operating
            infrastructure required to distribute the Application onto mobile systems.
          </li>
        </ul>
        <p className="text-gray-500 text-sm italic">
          Note: The Application does NOT use tracking cookies or third-party behavioral advertising
          networks.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Asynchronous Media Processing</h2>
        <p className="text-gray-600">
          The Application features background cloud processing tools for image and video
          modifications. Media files uploaded via your device camera or library are securely
          transmitted to our backend cloud servers for <strong>asynchronous processing</strong>.
          This media is handled strictly to generate your requested edits and deliver the final
          output payload back to your device screen.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Payment Processing and Financial Data</h2>
        <p className="mb-3 text-gray-600">
          The Application offers premium digital goods or credit/token packages.
        </p>
        <ul className="list-disc pl-6 text-gray-600 space-y-2">
          <li>
            <strong>Financial Protection:</strong> All real-money financial processing is handled
            entirely outside of our application code or servers.
          </li>
          <li>
            <strong>Approved Infrastructure:</strong> Payments are processed natively or via mobile
            web links using secure, certified third-party providers, specifically: Apple Store
            In-App Payments, Google Play In-App Payments, Stripe, and PayPal.
          </li>
          <li>
            <strong>Zero Card Retention:</strong> We do not collect, view, or store raw credit card
            numbers or banking credentials. Our backend receives only metadata transaction receipts
            from these providers to successfully apply token balances to your User ID.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Data Deletion Rights</h2>
        <p className="text-gray-600">
          We retain your basic account profile and transaction metadata logs for as long as you
          maintain an active account. Users retain full rights to request complete data erasure. You
          can request the removal of your account, associated user identifiers, and history files
          directly through the Application settings or by utilizing the support contact options
          listed below.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Children&apos;s Privacy</h2>
        <p className="text-gray-600">
          The Application does not knowingly target, market to, or collect any personal information
          from children under the age of 13. If we discover that a child under 13 has bypassed
          restrictions and provided personal identifiers, we immediately delete that data from our
          databases.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Changes to This Privacy Policy</h2>
        <p className="text-gray-600">
          We may update our Privacy Policy periodically to reflect infrastructure adjustments. Any
          modifications become effective immediately upon posting the updated Privacy Policy URL.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Contact Us</h2>
        <p className="mb-2 text-gray-600">
          If you have questions regarding this Privacy Policy or wish to request data deletion, you
          can reach us:
        </p>
        <ul className="list-disc pl-6 text-gray-600 space-y-1">
          <li>
            <strong>By Email:</strong>{' '}
            <a href="mailto:footballfansworld.labs@gmail.com" className="text-blue-600 underline">
              footballfansworld.labs@gmail.com
            </a>
          </li>
          <li>
            <strong>By Support Page:</strong>{' '}
            <a href="https://fandar.ai/support" className="text-blue-600 underline">
              https://fandar.ai/support
            </a>
          </li>
        </ul>
      </section>
    </main>
  );
}

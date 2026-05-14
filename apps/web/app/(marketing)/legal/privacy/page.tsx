import type { Metadata } from 'next';
import { LegalDoc } from '../../_components/LegalDoc';

export const metadata: Metadata = {
  title: 'Privacy Policy — Splash',
  description: 'How Splash collects, uses, and protects personal information.',
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      effectiveDate="May 13, 2026"
      intro={
        <p>
          This Privacy Policy explains how Splash Software, Inc.
          (&ldquo;Splash&rdquo;, &ldquo;we&rdquo;) collects, uses, and shares
          information when you use our websites, mobile experiences, and the
          Splash platform (collectively, the &ldquo;Service&rdquo;). It also
          describes your rights and how to contact us.
        </p>
      }
      sections={[
        {
          heading: 'Information we collect',
          body: (
            <>
              <p>
                <span className="font-medium text-white">
                  Account information.
                </span>{' '}
                When you create a Splash account we collect your name, email
                address, business details, and authentication information.
              </p>
              <p>
                <span className="font-medium text-white">
                  Customer and booking data.
                </span>{' '}
                Splash stores the customer records, vehicles, bookings,
                photos, and notes that you and your team submit to the
                Service.
              </p>
              <p>
                <span className="font-medium text-white">Payment data.</span>{' '}
                Payment card information is collected and processed by Stripe
                directly. Splash receives metadata such as the last four
                digits, brand, and status — never full card numbers.
              </p>
              <p>
                <span className="font-medium text-white">Usage data.</span> We
                collect technical information about how the Service is used,
                including device, browser, IP address, and basic event logs,
                for security and product improvement.
              </p>
            </>
          ),
        },
        {
          heading: 'How we use information',
          body: (
            <p>
              We use information to provide and improve the Service, process
              transactions through Stripe, deliver transactional notifications
              by email and SMS, prevent abuse and fraud, comply with legal
              obligations, and communicate with you about your account.
            </p>
          ),
        },
        {
          heading: 'How we share information',
          body: (
            <>
              <p>
                <span className="font-medium text-white">Subprocessors.</span>{' '}
                We share information with vetted infrastructure providers
                (such as our hosting, database, object storage, email, and SMS
                providers) strictly to deliver the Service.
              </p>
              <p>
                <span className="font-medium text-white">Stripe.</span>{' '}
                Payments flow through Stripe under their own terms and privacy
                policy.
              </p>
              <p>
                <span className="font-medium text-white">
                  Legal & safety.
                </span>{' '}
                We may disclose information when required by law or to protect
                the rights, property, or safety of Splash, our customers, or
                others.
              </p>
              <p>
                We do not sell personal information.
              </p>
            </>
          ),
        },
        {
          heading: 'Data retention',
          body: (
            <p>
              We retain account and transaction data for as long as your
              account is active or as needed to comply with our legal
              obligations. Photo evidence is retained per your subscription
              plan. You may request deletion of your data subject to legal and
              accounting requirements.
            </p>
          ),
        },
        {
          heading: 'Security',
          body: (
            <p>
              Splash uses industry-standard safeguards including encryption in
              transit (TLS 1.2+), encryption at rest, hashed passwords,
              least-privilege access, and audit logging. See our Security page
              for details.
            </p>
          ),
        },
        {
          heading: 'Your rights',
          body: (
            <p>
              Depending on your jurisdiction, you may have rights to access,
              correct, delete, or port your personal information, and to
              object to or restrict certain processing. To exercise these
              rights, contact us through the contact page.
            </p>
          ),
        },
        {
          heading: 'International transfers',
          body: (
            <p>
              Splash and our subprocessors may process information in
              countries other than your own. Where required, we rely on
              recognized transfer mechanisms such as the EU Standard
              Contractual Clauses.
            </p>
          ),
        },
        {
          heading: "Children's privacy",
          body: (
            <p>
              The Service is not directed to children under 13, and we do not
              knowingly collect personal information from children. If you
              believe a child has provided personal information, please
              contact us so we can delete it.
            </p>
          ),
        },
        {
          heading: 'Changes to this policy',
          body: (
            <p>
              We may update this Privacy Policy from time to time. For
              material changes, we will provide reasonable advance notice by
              email or through the Service.
            </p>
          ),
        },
        {
          heading: 'Contact',
          body: (
            <p>
              Privacy questions or requests? Reach the Splash team via our
              contact page.
            </p>
          ),
        },
      ]}
    />
  );
}

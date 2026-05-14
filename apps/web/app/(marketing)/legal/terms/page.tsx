import type { Metadata } from 'next';
import { LegalDoc } from '../../_components/LegalDoc';

export const metadata: Metadata = {
  title: 'Terms of Service — Splash',
  description: 'The terms that govern your use of the Splash platform.',
};

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      effectiveDate="May 13, 2026"
      intro={
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
          use of the Splash platform, websites, mobile experiences, and APIs
          (collectively, the &ldquo;Service&rdquo;) provided by Splash
          Software, Inc. (&ldquo;Splash&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;). By creating an account or using the Service you
          agree to these Terms.
        </p>
      }
      sections={[
        {
          heading: 'Accounts and eligibility',
          body: (
            <>
              <p>
                To use Splash you must be at least 18 years old and capable of
                forming a binding contract. You are responsible for the
                accuracy of the information you provide and for any activity
                on your account, including activity by your team members.
              </p>
              <p>
                You agree to keep your credentials confidential and to notify
                us promptly of any suspected unauthorized access. We may
                suspend or terminate accounts that violate these Terms.
              </p>
            </>
          ),
        },
        {
          heading: 'The Service',
          body: (
            <p>
              Splash provides a software platform for mobile car wash and
              detailing teams, including bookings, scheduling, deposits and
              payments through Stripe Connect, photo evidence, customer
              records, and related features. We may add, modify, or remove
              features over time. We will use reasonable efforts to notify
              customers of material changes.
            </p>
          ),
        },
        {
          heading: 'Customer data and your customers',
          body: (
            <p>
              You retain ownership of the data you submit to the Service,
              including data about your end customers. You are responsible for
              providing your end customers with appropriate notices and
              obtaining any consents required by applicable law. Splash
              processes this data on your behalf as described in our Privacy
              Policy and DPA.
            </p>
          ),
        },
        {
          heading: 'Payments and Stripe Connect',
          body: (
            <>
              <p>
                Splash uses Stripe Connect to process deposits and balance
                payments. You are required to maintain a valid Stripe account
                and to comply with the Stripe Services Agreement. Splash does
                not custody your funds; payouts are made by Stripe to your
                connected account.
              </p>
              <p>
                Subscription fees for the Service are billed in advance and
                are non-refundable except where required by law. You may
                cancel at any time, with cancellation taking effect at the end
                of the current billing period.
              </p>
            </>
          ),
        },
        {
          heading: 'Acceptable use',
          body: (
            <p>
              You agree not to misuse the Service. Prohibited activities
              include, without limitation: reverse engineering the Service;
              uploading malicious code; using the Service to send unsolicited
              communications; infringing third-party rights; or using the
              Service for unlawful purposes. We may suspend access for
              violations.
            </p>
          ),
        },
        {
          heading: 'Beta features',
          body: (
            <p>
              Splash may make beta or preview features available. These are
              provided &ldquo;as is&rdquo;, may change or be discontinued at
              any time, and are excluded from any service-level commitments.
            </p>
          ),
        },
        {
          heading: 'Disclaimers and limitation of liability',
          body: (
            <p>
              To the maximum extent permitted by law, the Service is provided
              &ldquo;as is&rdquo; without warranties of any kind, and
              Splash&apos;s aggregate liability arising out of or relating to
              these Terms is limited to the amount paid by you to Splash in
              the twelve months preceding the event giving rise to the
              liability.
            </p>
          ),
        },
        {
          heading: 'Termination',
          body: (
            <p>
              You may stop using the Service at any time. We may suspend or
              terminate the Service to you for material breach of these Terms.
              Upon termination, we will make your data available for export
              for a reasonable period and then delete it in accordance with
              our retention policies.
            </p>
          ),
        },
        {
          heading: 'Changes to these Terms',
          body: (
            <p>
              We may update these Terms from time to time. For material
              changes, we will provide reasonable advance notice by email or
              through the Service. Your continued use after the effective date
              constitutes acceptance of the updated Terms.
            </p>
          ),
        },
        {
          heading: 'Contact',
          body: (
            <p>
              Questions about these Terms? Reach the Splash team via our
              contact page.
            </p>
          ),
        },
      ]}
    />
  );
}

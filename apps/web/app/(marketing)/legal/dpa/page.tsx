import type { Metadata } from 'next';
import { LegalDoc } from '../../_components/LegalDoc';

export const metadata: Metadata = {
  title: 'Data Processing Addendum — Splash',
  description:
    'The Splash Data Processing Addendum (DPA) for customers subject to GDPR, UK GDPR, or comparable laws.',
};

export default function DpaPage() {
  return (
    <LegalDoc
      title="Data Processing Addendum"
      effectiveDate="May 13, 2026"
      intro={
        <>
          <p>
            This Data Processing Addendum (&ldquo;DPA&rdquo;) forms part of
            the agreement between Splash Software, Inc. (&ldquo;Splash&rdquo;,
            the &ldquo;Processor&rdquo;) and the customer identified in the
            order or account (&ldquo;Customer&rdquo;, the
            &ldquo;Controller&rdquo;) for the processing of personal data in
            connection with the Splash Service.
          </p>
          <p className="mt-3">
            This DPA is intended to satisfy obligations under the EU General
            Data Protection Regulation (GDPR), the UK GDPR, and comparable
            laws. Customers requiring a countersigned copy may request one
            from the Splash team.
          </p>
        </>
      }
      sections={[
        {
          heading: 'Definitions',
          body: (
            <p>
              Capitalized terms not defined here have the meaning given in
              applicable data protection law. &ldquo;Personal Data&rdquo;,
              &ldquo;Processing&rdquo;, &ldquo;Controller&rdquo;,
              &ldquo;Processor&rdquo;, and &ldquo;Data Subject&rdquo; carry
              their GDPR meanings.
            </p>
          ),
        },
        {
          heading: 'Scope and roles',
          body: (
            <p>
              Customer is the Controller of Personal Data submitted to the
              Service (including end-customer records, vehicles, bookings,
              and photos). Splash acts as Processor on Customer&apos;s behalf
              for the limited purpose of providing the Service in accordance
              with the agreement and Customer&apos;s documented instructions.
            </p>
          ),
        },
        {
          heading: 'Subject matter, duration, and nature',
          body: (
            <p>
              <span className="font-medium text-white">Subject matter:</span>{' '}
              provision of the Splash Service.{' '}
              <span className="font-medium text-white">Duration:</span> the
              term of the agreement plus any required retention period.{' '}
              <span className="font-medium text-white">Nature:</span> hosting,
              storage, processing, and display of Personal Data necessary to
              operate bookings, payments via Stripe, photo evidence, and
              related features.
            </p>
          ),
        },
        {
          heading: 'Categories of data and data subjects',
          body: (
            <p>
              Personal Data may include contact details, vehicle details,
              booking history, photos of vehicles and surrounding location,
              and IP address. Data subjects include Customer&apos;s
              employees, contractors, and end customers.
            </p>
          ),
        },
        {
          heading: 'Subprocessors',
          body: (
            <p>
              Customer authorizes Splash to engage subprocessors for hosting,
              database, object storage, email, SMS, and payment processing
              (Stripe). Splash maintains a current list of subprocessors and
              will notify Customer of changes with reasonable advance notice.
              Splash imposes data protection obligations on subprocessors no
              less protective than those in this DPA.
            </p>
          ),
        },
        {
          heading: 'International transfers',
          body: (
            <p>
              Where Personal Data is transferred outside the EEA, UK, or
              Switzerland to a country without an adequacy decision, the
              parties rely on the EU Standard Contractual Clauses (Module
              Two, Controller to Processor) and, where applicable, the UK
              International Data Transfer Addendum.
            </p>
          ),
        },
        {
          heading: 'Security',
          body: (
            <p>
              Splash implements appropriate technical and organizational
              measures to protect Personal Data, including encryption in
              transit and at rest, access controls, audit logging, secure
              software development practices, and regular vulnerability
              management. A summary is published on our Security page.
            </p>
          ),
        },
        {
          heading: 'Personal data breaches',
          body: (
            <p>
              Splash will notify Customer without undue delay after becoming
              aware of a Personal Data breach affecting Customer Data, and
              will provide information reasonably necessary to enable
              Customer to comply with its own breach-notification obligations.
            </p>
          ),
        },
        {
          heading: 'Data subject rights',
          body: (
            <p>
              Splash will provide reasonable assistance to enable Customer to
              respond to requests from data subjects to exercise their
              rights, including access, rectification, erasure, restriction,
              portability, and objection.
            </p>
          ),
        },
        {
          heading: 'Audits',
          body: (
            <p>
              Customer may audit Splash&apos;s compliance with this DPA on
              reasonable prior written notice and no more than once per year,
              unless required more frequently by a competent supervisory
              authority. Splash may satisfy audit obligations by providing
              third-party reports where available.
            </p>
          ),
        },
        {
          heading: 'Return and deletion of data',
          body: (
            <p>
              Upon termination of the agreement, Splash will, at
              Customer&apos;s choice, return or delete Customer Personal Data
              within a reasonable period, except to the extent retention is
              required by applicable law.
            </p>
          ),
        },
        {
          heading: 'Order of precedence',
          body: (
            <p>
              In the event of a conflict between this DPA and the agreement,
              this DPA controls with respect to the processing of Personal
              Data.
            </p>
          ),
        },
      ]}
    />
  );
}

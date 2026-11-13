/**
 * Future capabilities that are not built yet. The page describes what is planned and what is missing, shows no
 * data, and offers no sign-up: nothing here works yet, so nothing pretends to.
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { GUIDE_PATH } from "@/app/nav";
import { buttonVariants } from "@/components/ui/button";
import { StatusTag, type StatusKind } from "@/components/ui/status-tag";

function PlannedFrame({ title, status, intro, children }: { title: string; status: StatusKind; intro: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8 sm:px-6">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 data-page-heading tabIndex={-1} className="text-3xl font-bold">
            {title}
          </h1>
          <StatusTag status={status} />
        </div>
        <p className="max-w-prose text-muted-foreground">{intro}</p>
      </div>
      {children}
    </div>
  );
}

function Card({ title, status, children }: { title: string; status?: StatusKind; children: ReactNode }) {
  return (
    <section className="grid gap-2 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {status && <StatusTag status={status} />}
      </div>
      <div className="grid gap-2 text-sm">{children}</div>
    </section>
  );
}

export function PlannedFeaturesPage() {
  return (
    <PlannedFrame
      title="What's planned"
      status="planned"
      intro="Ideas the team plans to build. None of them exists yet. Listing them here does not mean that any partnership, review process or scientific approval is in place."
    >
      <Card title="Mobile app experience" status="planned">
        <p>A phone-first way to follow possible fires. Today this is a design concept only; the website works on phones.</p>
      </Card>
      <Card title="Alerts and notifications" status="unavailable">
        <p>
          Be told about heat spots near places you save. Saving places already works in this browser; alerts need accounts, live data and a way to
          send notifications.{" "}
          <Link to="/places" className="font-medium text-primary underline underline-offset-2">
            My Places & Alerts
          </Link>
        </p>
      </Card>
      <Card title="Ask Astera (chatbot)" status="soon">
        <p>
          A chatbot that answers only from verified Astera Watch data and the User Guide, names its sources, says when data is demo, and never gives
          evacuation instructions. The{" "}
          <Link to={GUIDE_PATH} className="font-medium text-primary underline underline-offset-2">
            User Guide
          </Link>{" "}
          is available now.
        </p>
      </Card>
      <Card title="Research Hub" status="planned">
        <ul className="grid list-disc gap-1 pl-5">
          <li>Researcher profiles.</li>
          <li>Choosing a study area on the map by drawing its boundary, with areas filled by fire event.</li>
          <li>Submitting research about an area or event.</li>
          <li>Review by experts and institutions.</li>
          <li>A library of research that has passed that review.</li>
        </ul>
        <p className="text-muted-foreground">No researcher accounts, submissions, reviewers or library exist yet.</p>
      </Card>
      <div>
        <Link to="/" className={buttonVariants()}>
          Back to the Fire map
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </PlannedFrame>
  );
}

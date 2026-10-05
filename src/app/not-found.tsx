import { ButtonLink } from "@/ui/Button";
import { Empty } from "@/ui/Empty";
import { Page } from "@/ui/Page";

export default function NotFound() {
  return (
    <Page title="Wrong stop.">
      <Empty title="That page isn't on the map.">It may have closed, or the link has a typo.</Empty>
      <p style={{ marginTop: 16 }}>
        <ButtonLink href="/" variant="primary">
          Back to Explore
        </ButtonLink>
      </p>
    </Page>
  );
}

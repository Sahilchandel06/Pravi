import { useState } from "react";
import { Button, IconButton } from "../../components/ui/Button";
import {
  Card,
  ConditionGauge,
  EmptyState,
  RatingBadge,
  RiskBadge,
  ScoreBar,
  StatusBadge,
} from "../../components/ui/Primitives";
import { PageHeader, Tabs } from "../../components/ui/Navigation";
export default function UiGallery() {
  const [tab, setTab] = useState("Overview");
  return (
    <main className="gallery">
      <PageHeader
        eyebrow="Design system"
        title="UI gallery"
        subtitle="InfraLife foundation primitives"
        actions={<Button>Primary action</Button>}
      />
      <div className="gallery-grid">
        <Card>
          <h2>Buttons and badges</h2>
          <Button>Primary</Button>{" "}
          <Button variant="secondary">Secondary</Button>
          <div className="badge-row">
            <StatusBadge value="HEALTHY" />
            <StatusBadge value="CRITICAL" />
            <RiskBadge value="HIGH" />
            <RatingBadge value="MODERATE" />
          </div>
        </Card>
        <Card>
          <h2>Scores</h2>
          <ConditionGauge score={64} />
          <ScoreBar score={64} />
        </Card>
        <Card>
          <h2>Navigation</h2>
          <Tabs
            items={["Overview", "Digital Twin", "Audit"]}
            value={tab}
            onChange={setTab}
          />
          <EmptyState title="Empty state example" />
        </Card>
      </div>
    </main>
  );
}

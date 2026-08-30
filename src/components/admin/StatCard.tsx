import { Card, CardBody } from "@/components/ui/Card";

/** A single dashboard statistic tile (T171), reused across every `/admin` summary metric. */
export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-text-primary/70">{label}</p>
        <p className="mt-1 font-display text-3xl text-brand-burgundy">{value}</p>
      </CardBody>
    </Card>
  );
}

import { CheckCircle2, Clock3 } from "lucide-react";
import { LastPayoutEvent } from "@/lib/insuranceDemo";

interface PayoutStatusCardProps {
  event: LastPayoutEvent | null;
}

const formatTimestamp = (value: string) => {
  return new Date(value).toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const eventLabel = (eventType: LastPayoutEvent["eventType"]) => {
  if (eventType === "Rain") return "Heavy Rain 🌧️";
  return "Severe Pollution 🌫️";
};

const PayoutStatusCard = ({ event }: PayoutStatusCardProps) => {
  if (!event) {
    return (
      <div className="glass-card-elevated p-5 border-2 border-dashed border-border/80">
        <h3 className="font-display font-semibold text-foreground mb-2">Last Payout Event</h3>
        <p className="text-sm text-muted-foreground">No event yet</p>
      </div>
    );
  }

  return (
    <div className="glass-card-elevated p-5 border-2 border-accent/20 bg-accent/5">
      <h3 className="font-display font-semibold text-foreground mb-3">Last Payout Event</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Last Event Type</p>
          <p className="font-semibold text-foreground">{eventLabel(event.eventType)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Payout Amount</p>
          <p className="font-semibold text-foreground">₹{event.amount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className={`inline-flex items-center gap-1 font-semibold ${event.status === "Credited" ? "text-accent" : "text-risk-medium"}`}>
            {event.status === "Credited" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
            {event.status === "Credited" ? "Credited ✅" : "Under Review"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Timestamp</p>
          <p className="font-medium text-foreground">{formatTimestamp(event.timestamp)}</p>
        </div>
      </div>
    </div>
  );
};

export default PayoutStatusCard;

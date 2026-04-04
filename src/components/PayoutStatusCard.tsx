import { CheckCircle2, Clock3 } from "lucide-react";
import { LastPayoutEvent } from "@/lib/insuranceDemo";
import { tx, useAppLanguage } from "@/lib/preferences";

interface PayoutStatusCardProps {
  event: LastPayoutEvent | null;
}

const formatTimestamp = (value: string) => {
  return new Date(value).toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const eventLabel = (eventType: LastPayoutEvent["eventType"], language: "English" | "Hindi") => {
  if (eventType === "Rain") return tx(language, "Heavy Rain 🌧️", "तेज बारिश 🌧️");
  return tx(language, "Severe Pollution 🌫️", "गंभीर प्रदूषण 🌫️");
};

const PayoutStatusCard = ({ event }: PayoutStatusCardProps) => {
  const language = useAppLanguage();

  if (!event) {
    return (
      <div className="glass-card-elevated p-5 border-2 border-dashed border-border/80">
        <h3 className="font-display font-semibold text-foreground mb-2">{tx(language, "Last Payout Event", "आखिरी पेआउट इवेंट")}</h3>
        <p className="text-sm text-muted-foreground">{tx(language, "No event yet", "अभी कोई इवेंट नहीं")}</p>
      </div>
    );
  }

  return (
    <div className="glass-card-elevated p-5 border-2 border-accent/20 bg-accent/5">
      <h3 className="font-display font-semibold text-foreground mb-3">{tx(language, "Last Payout Event", "आखिरी पेआउट इवेंट")}</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{tx(language, "Last Event Type", "आखिरी इवेंट प्रकार")}</p>
          <p className="font-semibold text-foreground">{eventLabel(event.eventType, language)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{tx(language, "Payout Amount", "पेआउट राशि")}</p>
          <p className="font-semibold text-foreground">₹{event.amount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{tx(language, "Status", "स्थिति")}</p>
          <p className={`inline-flex items-center gap-1 font-semibold ${event.status === "Credited" ? "text-accent" : event.status === "Rejected" ? "text-risk-high" : "text-risk-medium"}`}>
            {event.status === "Credited" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
            {event.status === "Credited"
              ? tx(language, "Credited ✅", "जमा ✅")
              : event.status === "Rejected"
                ? tx(language, "Rejected", "अस्वीकृत")
                : tx(language, "Processing", "प्रोसेसिंग")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{tx(language, "Timestamp", "समय")}</p>
          <p className="font-medium text-foreground">{formatTimestamp(event.timestamp)}</p>
        </div>
      </div>
    </div>
  );
};

export default PayoutStatusCard;

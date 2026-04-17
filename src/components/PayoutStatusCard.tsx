import { CheckCircle2, Clock3, AlertCircle } from "lucide-react";
import { LastPayoutEvent } from "@/lib/insuranceDemo";
import { tx, useAppLanguage } from "@/lib/preferences";

interface Claim {
  id: number;
  worker_id: number;
  trigger_type?: string;
  payout_amount: number;
  status: "Credited" | "pending" | "rejected" | "Under Review";
  created_at: string;
  notes?: string;
}

interface PayoutStatusCardProps {
  event?: LastPayoutEvent | null;
  claim?: Claim | null;
}

const formatTimestamp = (value: string | Date) => {
  return new Date(value).toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getTriggerLabel = (triggerType?: string, language: "English" | "Hindi" = "English") => {
  if (!triggerType) return tx(language, "Auto-triggered", "ऑटो-ट्रिगर");
  const lower = String(triggerType).toLowerCase();
  if (lower.includes("rain")) return tx(language, "Heavy Rain 🌧️", "तेज बारिश 🌧️");
  if (lower.includes("aqi") || lower.includes("pollution")) return tx(language, "Severe Pollution 🌫️", "गंभीर प्रदूषण 🌫️");
  if (lower.includes("heat") || lower.includes("temperature")) return tx(language, "Heatwave ☀️", "लू ☀️");
  if (lower.includes("flood")) return tx(language, "Flood Risk 🌊", "बाढ़ का खतरा 🌊");
  return tx(language, "Weather Alert", "मौसम सतर्कता");
};

const eventLabel = (eventType?: string, language: "English" | "Hindi" = "English") => {
  if (!eventType) return getTriggerLabel(undefined, language);
  if (eventType === "Rain") return tx(language, "Heavy Rain 🌧️", "तेज बारिश 🌧️");
  return tx(language, "Severe Pollution 🌫️", "गंभीर प्रदूषण 🌫️");
};

const PayoutStatusCard = ({ event, claim }: PayoutStatusCardProps) => {
  const language = useAppLanguage();

  // Prefer real claim from DB over demo event
  const activeEvent = claim ? {
    status: claim.status === "Credited" ? "Credited" : claim.status === "rejected" ? "Rejected" : "Processing",
    amount: claim.payout_amount,
    timestamp: claim.created_at,
    eventType: claim.trigger_type as any,
  } : event;

  if (!activeEvent) {
    return (
      <div className="glass-card-elevated p-5 border-2 border-dashed border-border/80">
        <h3 className="font-display font-semibold text-foreground mb-2">{tx(language, "Last Payout Event", "आखिरी पेआउट इवेंट")}</h3>
        <p className="text-sm text-muted-foreground">{tx(language, "No event yet", "अभी कोई इवेंट नहीं")}</p>
      </div>
    );
  }

  const statusColorMap = {
    Credited: "text-accent",
    Processing: "text-risk-medium",
    Rejected: "text-risk-high",
    pending: "text-risk-medium",
    rejected: "text-risk-high",
    "Under Review": "text-risk-medium",
  };

  const statusTextMap = {
    Credited: tx(language, "Credited ✅", "जमा ✅"),
    Processing: tx(language, "Processing", "प्रोसेसिंग"),
    Rejected: tx(language, "Rejected", "अस्वीकृत"),
    pending: tx(language, "Under Review", "समीक्षा में"),
    rejected: tx(language, "Rejected", "अस्वीकृत"),
    "Under Review": tx(language, "Under Review", "समीक्षा में"),
  };

  const statusColor = statusColorMap[activeEvent.status as keyof typeof statusColorMap] || "text-muted-foreground";
  const statusText = statusTextMap[activeEvent.status as keyof typeof statusTextMap] || activeEvent.status;
  const statusIcon = activeEvent.status === "Credited" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />;

  return (
    <div className="glass-card-elevated p-5 border-2 border-accent/20 bg-accent/5">
      <h3 className="font-display font-semibold text-foreground mb-3">{tx(language, "Last Payout Event", "आखिरी पेआउट इवेंट")}</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{tx(language, "Last Event Type", "आखिरी इवेंट प्रकार")}</p>
          <p className="font-semibold text-foreground">{getTriggerLabel(activeEvent.eventType, language)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{tx(language, "Payout Amount", "पेआउट राशि")}</p>
          <p className="font-semibold text-foreground">₹{activeEvent.amount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{tx(language, "Status", "स्थिति")}</p>
          <p className={`inline-flex items-center gap-1 font-semibold ${statusColor}`}>
            {statusIcon}
            {statusText}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{tx(language, "Timestamp", "समय")}</p>
          <p className="font-medium text-foreground">{formatTimestamp(activeEvent.timestamp)}</p>
        </div>
      </div>
    </div>
  );
};

export default PayoutStatusCard;

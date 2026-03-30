import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { tx, useAppLanguage } from "@/lib/preferences";

const NotFound = () => {
  const location = useLocation();
  const language = useAppLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">{tx(language, "Oops! Page not found", "उफ़! पेज नहीं मिला")}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {tx(language, "Return to Home", "होम पर वापस जाएं")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;

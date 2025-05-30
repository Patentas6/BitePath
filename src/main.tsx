import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

// Import the landing page check logic
import { checkLandingPage } from './landingPageCheck';

// Run the landing page check when the app loads
checkLandingPage();

createRoot(document.getElementById("root")!).render(<App />);


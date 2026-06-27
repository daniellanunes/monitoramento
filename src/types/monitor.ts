export interface SiteData {
  id: number;
  name: string;
  url: string;
  status: 'online' | 'offline';
  visitors: number;
  position: [number, number, number];
  type?: 'site' | 'server';
  
  // Real-time server telemetry
  gaPropertyId?: string;    // Google Analytics 4 Property ID
  latency?: number;         // Response latency (ping) in milliseconds
  uptime?: number;          // Historical stability/uptime percentage
  cpuLoad?: number;         // Server processing load (0-100%)
  lastChecked?: string;     // ISO timestamp of last telemetry query
  errorMessage?: string;    // Failure details if node is offline
  domainExpiration?: string; // Domain expiration date (YYYY-MM-DD)
  lastWhoisChecked?: string; // Date when WHOIS was last successfully checked (YYYY-MM-DD)
  hostingFrontend?: string;  // Hosting provider for frontend
  hostingBackend?: string;   // Hosting provider for backend
  hostingDatabase?: string;  // Hosting provider for database
}
import { NextResponse } from 'next/server';
import { SiteData } from '@/types/monitor';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { collection, getDocs, setDoc, doc, addDoc, getDoc } from 'firebase/firestore';
import { getSaoPauloDateString } from '@/lib/date';

export const dynamic = 'force-dynamic';
// Firebase integration active

// Global in-memory cache for server checks to implement the 180s interval
const serverCache: Record<number, {
  status: 'online' | 'offline';
  latency: number;
  error?: string;
  lastCheckedTime: number;
}> = {};




/**
 * Deterministic PRNG helper to generate consistent mock values
 */
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Template function for GA4 integration.
 * To use this, you must run: npm install @google-analytics/data
 * And configure GOOGLE_PRIVATE_KEY and GOOGLE_CLIENT_EMAIL in your .env.local
 */
async function fetchGA4ActiveUsers(propertyId: string): Promise<number | null> {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail || propertyId.startsWith("YOUR_GA4")) {
    return null; // Fallback to mock data if credentials are not set up
  }

  try {
    // Hide require from Next.js static trace to suppress compiler warnings when the package is not installed yet
    const req = eval('require');
    const { BetaAnalyticsDataClient } = req('@google-analytics/data');
    
    const analyticsClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
    });

    const [response] = await analyticsClient.runRealtimeReport({
      property: `properties/${propertyId}`,
      metrics: [
        {
          name: 'activeUsers', // Get unique active users in the last 30 minutes
        },
      ],
    });

    const activeUsersValue = response.rows?.[0]?.metricValues?.[0]?.value;
    return activeUsersValue ? parseInt(activeUsersValue, 10) : 0;
  } catch (error) {
    console.error(`[GA4 API Error] Failed to fetch data for property ${propertyId}:`, error);
    return null; // Fallback on failure
  }
}

/**
 * Performs a server-side health check (ping) on a target URL
 */
async function checkSiteHealth(url: string, timeoutMs: number = 4000): Promise<{ status: 'online' | 'offline'; latency: number; error?: string }> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs); // Custom timeout limit

  const requestHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  try {
    let res = await fetch(url, {
      method: 'HEAD', // HEAD only fetches response headers (very fast and lightweight)
      mode: 'cors',
      cache: 'no-store',
      headers: requestHeaders,
      signal: controller.signal,
    });
    
    // Some CDNs/Servers (like Cloudflare or Netflix) block HEAD requests with a 403 or 405.
    // In that case, we fallback to a normal GET request.
    if (res.status === 403 || res.status === 405) {
      res = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        headers: requestHeaders,
        signal: controller.signal,
      });
    }
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    // 200-399 are normal success/redirect codes.
    // 401 (Unauthorized), 403 (Forbidden) and 429 (Too Many Requests) mean the target server is active
    // and responding (online), but refusing our automated requests or rate-limiting us. We treat these as online to prevent false alarms.
    if ((res.status >= 200 && res.status < 400) || res.status === 401 || res.status === 403 || res.status === 429) {
      return { status: 'online', latency };
    } else {
      return { status: 'offline', latency, error: `HTTP Status ${res.status}` };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const errorMessage = isAbort ? `Timeout (>${(timeoutMs / 1000).toFixed(1)}s)` : 'Falha na conexão';
    return { status: 'offline', latency, error: errorMessage };
  }
}

/**
 * Extract the apex/root domain from any URL or hostname,
 * handling common Brazilian TLD configurations (e.g., .com.br, .net.br).
 */
function getApexDomain(urlOrHostname: string): string {
  try {
    let hostname = urlOrHostname.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    const parts = hostname.split('.');
    if (parts.length <= 2) {
      return hostname;
    }

    // Common Brazilian dual-part TLD patterns
    const isBrDualTLD = parts[parts.length - 1] === 'br' && 
                        ['com', 'net', 'org', 'gov', 'adm', 'adv', 'arq', 'art', 'bio', 'cng', 'cnt', 'ecn', 'eng', 'esp', 'etc', 'eti', 'far', 'fmd', 'fot', 'fst', 'g12', 'ggf', 'imb', 'ind', 'inf', 'jor', 'lel', 'mat', 'med', 'mus', 'odo', 'ong', 'psi', 'pro', 'psc', 'qsl', 'rec', 'slg', 'srv', 'tmp', 'trd', 'tur', 'vet', 'zlg'].includes(parts[parts.length - 2]);

    if (isBrDualTLD && parts.length >= 3) {
      return parts.slice(-3).join('.');
    }

    return parts.slice(-2).join('.');
  } catch (e) {
    return urlOrHostname;
  }
}

/**
 * Queries RDAP registry servers to fetch domain expiration dates in the background.
 * Updates Firestore with both the expiration date and the lastChecked date.
 */
async function syncDomainExpiration(siteId: number, domain: string) {
  try {
    let rdapUrl = `https://rdap.org/domain/${domain}`;
    if (domain.endsWith('.br')) {
      rdapUrl = `https://rdap.registro.br/domain/${domain}`;
    } else if (domain.endsWith('.com') || domain.endsWith('.net')) {
      rdapUrl = `https://rdap.verisign.com/com/v1/domain/${domain}`;
    }

    const res = await fetch(rdapUrl, {
      headers: {
        'Accept': 'application/rdap+json, application/json'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const data = await res.json();
      const expirationEvent = data.events?.find((e: any) => e.eventAction === 'expiration');
      
      if (expirationEvent && expirationEvent.eventDate) {
        const isoDate = expirationEvent.eventDate;
        const expirationDate = isoDate.split('T')[0]; // YYYY-MM-DD
        const todayStr = getSaoPauloDateString();

        if (isFirebaseConfigured && db) {
          const docRef = doc(db, 'sites', String(siteId));
          await setDoc(docRef, {
            domainExpiration: expirationDate,
            lastWhoisChecked: todayStr
          }, { merge: true });
          console.log(`[RDAP Sync] Updated site ${siteId} (${domain}) to expire on ${expirationDate}`);
        }
      } else {
        console.warn(`[RDAP Sync] No expiration event found in RDAP response for ${domain}`);
        await markWhoisCheckedForToday(siteId);
      }
    } else {
      console.warn(`[RDAP Sync] RDAP query failed for ${domain} with status ${res.status}`);
      await markWhoisCheckedForToday(siteId);
    }
  } catch (err) {
    console.error(`[RDAP Sync] Error syncing domain ${domain}:`, err);
    await markWhoisCheckedForToday(siteId);
  }
}

async function markWhoisCheckedForToday(siteId: number) {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'sites', String(siteId));
      await setDoc(docRef, {
        lastWhoisChecked: getSaoPauloDateString()
      }, { merge: true });
    } catch (e) {
      console.error(`[RDAP Sync] Error writing failure check date for site ${siteId}:`, e);
    }
  }
}

export async function GET() {
  let sitesMetadata: any[] = [];
  let pingTimeout = 4000;
  let whoisSyncEnabled = true;

  if (isFirebaseConfigured && db) {
    try {
      // Load global settings
      const settingsDocRef = doc(db, 'settings', 'global');
      const settingsSnap = await getDoc(settingsDocRef);
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        if (typeof data.pingTimeout === 'number') pingTimeout = data.pingTimeout;
        if (typeof data.whoisSyncEnabled === 'boolean') whoisSyncEnabled = data.whoisSyncEnabled;
      }

      // Load sites
      const sitesCollection = collection(db, 'sites');
      const sitesSnapshot = await getDocs(sitesCollection);
      
      if (sitesSnapshot.empty) {
        sitesMetadata = [];
      } else {
        const fetchedSites: any[] = [];
        sitesSnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedSites.push({
            id: typeof data.id === 'number' ? data.id : (parseInt(doc.id, 10) || fetchedSites.length + 1),
            name: data.name || "Sem Nome",
            url: data.url || "",
            type: data.type || "site",
            gaPropertyId: data.gaPropertyId || "",
            position: Array.isArray(data.position) ? data.position : [0, 0, 0],
            domainExpiration: data.domainExpiration || "",
            lastWhoisChecked: data.lastWhoisChecked || "",
            hostingFrontend: data.hostingFrontend || "",
            hostingBackend: data.hostingBackend || "",
            hostingDatabase: data.hostingDatabase || ""
          });
        });
        fetchedSites.sort((a, b) => a.id - b.id);
        sitesMetadata = fetchedSites;
      }
    } catch (error) {
      console.error('[Firebase] Failed to fetch sites or settings from Firestore:', error);
      sitesMetadata = [];
    }
  }

  // Compute current hour in Sao Paulo fuso to trigger night checks (between 22h and 5h)
  const now = new Date();
  const spHour = parseInt(
    new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false
    }).format(now),
    10
  );
  const isNight = spHour >= 22 || spHour < 5;
  const todayStr = getSaoPauloDateString();

  const telemetryData = await Promise.all(
    sitesMetadata.map(async (metadata: any) => {
      // 1. Perform server-side health check ping
      let health: { status: 'online' | 'offline'; latency: number; error?: string };
      
      if (metadata.type === 'server') {
        const cached = serverCache[metadata.id];
        const nowTime = Date.now();
        // Dynamic interval: 10 seconds if offline (fast re-check), 180 seconds if online
        const checkInterval = (cached && cached.status === 'offline') ? 10000 : 180000;
        
        if (cached && (nowTime - cached.lastCheckedTime) < checkInterval) {
          health = {
            status: cached.status,
            latency: cached.latency,
            error: cached.error
          };
        } else {
          health = await checkSiteHealth(metadata.url, pingTimeout);
          serverCache[metadata.id] = {
            status: health.status,
            latency: health.latency,
            error: health.error,
            lastCheckedTime: nowTime
          };
        }
      } else {
        health = await checkSiteHealth(metadata.url, pingTimeout);
      }

      // 2. Automatical RDAP Sync (Nightly check or immediate check if never run)
      const domain = getApexDomain(metadata.url);
      const isCheckableDomain = domain && 
                                domain !== 'localhost' && 
                                !domain.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
      
      const hasNeverBeenChecked = !metadata.lastWhoisChecked;
      const needsDailyNightCheck = isNight && metadata.lastWhoisChecked !== todayStr;

      if (whoisSyncEnabled && isCheckableDomain && (hasNeverBeenChecked || needsDailyNightCheck)) {
        // Run asynchronously in background so we don't delay telemetry response
        syncDomainExpiration(metadata.id, domain);
      }

      // 2. Fetch live users from Google Analytics 4 (only if configured and not placeholder)
      let activeUsers = 0;
      const hasGA4 = metadata.gaPropertyId && 
                     metadata.gaPropertyId.trim() !== '' && 
                     !metadata.gaPropertyId.startsWith('YOUR_GA4');

      if (hasGA4) {
        const gaUsers = await fetchGA4ActiveUsers(metadata.gaPropertyId!);
        if (gaUsers === null) {
          // Fallback to mock visitor telemetry if GA4 credentials are not active
          if (health.status === 'online') {
            const timeFactor = Math.floor(Date.now() / 60000); // Changes every minute
            const seed = metadata.id + timeFactor;
            activeUsers = Math.floor(12 + seededRandom(seed) * 138);
          } else {
            activeUsers = 0;
          }
        } else {
          activeUsers = gaUsers;
        }
      } else {
        activeUsers = 0;
      }

      // 4. Generate mock server telemetry data
      const seedMetrics = metadata.id + (activeUsers % 9);
      const cpuLoad = health.status === 'online' ? Math.floor(8 + seededRandom(seedMetrics) * 62) : 0;
      const uptime = parseFloat((99.6 + seededRandom(metadata.id) * 0.38).toFixed(2));

      return {
        id: metadata.id,
        name: metadata.name,
        url: metadata.url,
        type: metadata.type || "site",
        status: health.status,
        visitors: activeUsers,
        position: metadata.position as [number, number, number],
        gaPropertyId: metadata.gaPropertyId,
        latency: health.latency,
        cpuLoad,
        uptime,
        lastChecked: new Date().toISOString(),
        errorMessage: health.error,
        domainExpiration: metadata.domainExpiration,
        lastWhoisChecked: metadata.lastWhoisChecked,
        hostingFrontend: metadata.hostingFrontend,
        hostingBackend: metadata.hostingBackend,
        hostingDatabase: metadata.hostingDatabase
      };
    })
  );

  // Persist offline incidents to Firestore for the history page
  if (isFirebaseConfigured && db) {
    try {
      const today = getSaoPauloDateString(); // "YYYY-MM-DD"
      const incidentsCol = collection(db, 'history', today, 'incidents');

      const savePromises = telemetryData
        .filter((site) => site.status === 'offline')
        .map((site) =>
          addDoc(incidentsCol, {
            siteId: site.id,
            siteName: site.name,
            url: site.url,
            timestamp: new Date().toISOString(),
            errorType: site.errorMessage || 'Sem resposta',
            latency: site.latency ?? null,
          })
        );

      await Promise.all(savePromises);
    } catch (histErr) {
      console.warn('[Firebase] Erro ao salvar histórico:', histErr);
    }
  }

  // Respond with telemetry data and prevent caching
  return NextResponse.json(telemetryData, {
    headers: {
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
    }
  });
}

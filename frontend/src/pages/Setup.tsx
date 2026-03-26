import { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Search,
  Hotel,
  Plus,
  Check,
  Star,
  MapPin,
  ChevronRight,
  Loader2,
  X,
  Users,
  Sparkles,
} from 'lucide-react';
import { useSearchHotels, useAddCompetitor, useProperties, type HotelSearchResult } from '../hooks/useApi';
import { useSelectedProperty } from '../components/Layout';

const API_BASE = '/api';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

type WizardStep = 'search-property' | 'search-competitors' | 'review';

export default function Setup() {
  const { selectedProperty, setSelectedPropertyId } = useSelectedProperty();
  const { refetch: refetchProperties } = useProperties();
  const addCompetitorMutation = useAddCompetitor();

  const [step, setStep] = useState<WizardStep>(
    selectedProperty ? 'search-competitors' : 'search-property'
  );

  // Property search
  const [propertyQuery, setPropertyQuery] = useState('');
  const [propertySearchTerm, setPropertySearchTerm] = useState('');
  const { data: propertyResults, isLoading: propertyLoading } = useSearchHotels(propertySearchTerm);

  // Competitor search
  const [compQuery, setCompQuery] = useState('');
  const [compSearchTerm, setCompSearchTerm] = useState('');
  const { data: compResults, isLoading: compLoading } = useSearchHotels(compSearchTerm);

  // Selected items
  const [selectedHotel, setSelectedHotel] = useState<HotelSearchResult | null>(null);
  const [selectedCompetitors, setSelectedCompetitors] = useState<HotelSearchResult[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  const handlePropertySearch = useCallback(() => {
    if (propertyQuery.trim().length >= 3) {
      setPropertySearchTerm(propertyQuery.trim());
    }
  }, [propertyQuery]);

  const handleCompSearch = useCallback(() => {
    if (compQuery.trim().length >= 3) {
      setCompSearchTerm(compQuery.trim());
    }
  }, [compQuery]);

  const selectProperty = (hotel: HotelSearchResult) => {
    setSelectedHotel(hotel);
    setStep('search-competitors');
  };

  const toggleCompetitor = (hotel: HotelSearchResult) => {
    setSelectedCompetitors((prev) => {
      const exists = prev.find((c) => c.property_token === hotel.property_token);
      if (exists) {
        return prev.filter((c) => c.property_token !== hotel.property_token);
      }
      if (prev.length >= 6) return prev; // Max 6 competitors
      return [...prev, hotel];
    });
  };

  const isCompetitorSelected = (token: string) =>
    selectedCompetitors.some((c) => c.property_token === token);

  const handleFinishSetup = async () => {
    setIsCreating(true);
    try {
      // Step 1: Create our property
      const myHotel = selectedHotel;
      if (!myHotel) return;

      const propResult = await apiFetch<{ data: { id: string; name: string } }>('/properties', {
        method: 'POST',
        body: JSON.stringify({
          name: myHotel.name,
          address: myHotel.address,
          google_hotels_url: myHotel.property_token,
        }),
      });

      const propertyId = propResult.data?.id ?? (propResult as unknown as { id: string }).id;

      // Step 2: Add competitors
      for (const comp of selectedCompetitors) {
        await apiFetch('/competitors', {
          method: 'POST',
          body: JSON.stringify({
            property_id: propertyId,
            name: comp.name,
            google_hotels_url: comp.property_token,
          }),
        });
      }

      // Step 3: Trigger initial refresh
      try {
        await apiFetch(`/refresh`, {
          method: 'POST',
          body: JSON.stringify({ property_id: propertyId }),
        });
      } catch {
        // Refresh is best-effort on setup
      }

      // Refresh properties list and select the new one
      await refetchProperties();
      setSelectedPropertyId(propertyId);
      setSetupComplete(true);
    } catch (err) {
      console.error('Setup failed:', err);
    } finally {
      setIsCreating(false);
    }
  };

  if (setupComplete) {
    return (
      <div className="max-w-2xl mx-auto mt-16 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-success" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Setup Complete!</h1>
        <p className="text-slate-400 mb-4">
          Your hotel and {selectedCompetitors.length} competitor{selectedCompetitors.length !== 1 ? 's' : ''} have been added.
          An initial rate refresh has been triggered.
        </p>
        <p className="text-sm text-slate-500 mb-8">
          Rates will auto-refresh 3 times daily. Head to the Dashboard to view results.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-accent text-background font-semibold hover:bg-accent-light transition-all hover:shadow-[0_0_20px_rgba(56,189,248,0.3)]"
        >
          Go to Dashboard
          <ChevronRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-accent" />
          Rate Shopper Setup
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Find your hotel and select 2-6 competitors to monitor
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {[
          { key: 'search-property', label: '1. Your Hotel' },
          { key: 'search-competitors', label: '2. Competitors' },
          { key: 'review', label: '3. Review' },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-3">
            <div
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                step === s.key
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : s.key === 'search-property' && selectedHotel
                    ? 'bg-success/10 text-success border border-success/20'
                    : 'bg-white/5 text-slate-500 border border-white/10'
              )}
            >
              {s.key === 'search-property' && selectedHotel ? (
                <Check className="w-3 h-3" />
              ) : null}
              {s.label}
            </div>
            {i < 2 && <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
          </div>
        ))}
      </div>

      {/* Step 1: Search Your Hotel */}
      {step === 'search-property' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-surface border border-white/5 p-5">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Hotel className="w-4 h-4 text-accent" />
              Search for Your Hotel
            </h2>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="e.g. Grand Hyatt Bangkok, Marriott Sukhumvit..."
                value={propertyQuery}
                onChange={(e) => setPropertyQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePropertySearch()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-colors"
              />
              <button
                onClick={handlePropertySearch}
                disabled={propertyQuery.trim().length < 3 || propertyLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {propertyLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Search
              </button>
            </div>
          </div>

          {/* Results */}
          {propertyResults?.data && propertyResults.data.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 px-1">
                {propertyResults.data.length} hotels found — select yours
              </p>
              {propertyResults.data.map((hotel) => (
                <HotelCard
                  key={hotel.property_token}
                  hotel={hotel}
                  onClick={() => selectProperty(hotel)}
                  selected={false}
                  actionLabel="This is my hotel"
                  actionIcon={<Hotel className="w-3.5 h-3.5" />}
                />
              ))}
            </div>
          )}

          {propertyResults?.data && propertyResults.data.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              No hotels found. Try a different search term.
            </div>
          )}
        </div>
      )}

      {/* Step 2: Search Competitors */}
      {step === 'search-competitors' && (
        <div className="space-y-4">
          {/* Selected hotel banner */}
          {selectedHotel && (
            <div className="rounded-xl bg-accent/5 border border-accent/20 p-4 flex items-center gap-4">
              {selectedHotel.thumbnail && (
                <img
                  src={selectedHotel.thumbnail}
                  alt={selectedHotel.name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{selectedHotel.name}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {selectedHotel.address}
                </p>
              </div>
              <div className="px-2 py-1 rounded bg-accent/20 text-accent text-xs font-medium">
                Your Hotel
              </div>
            </div>
          )}

          <div className="rounded-xl bg-surface border border-white/5 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" />
                Search Competitors
              </h2>
              <span className="text-xs text-slate-500">
                {selectedCompetitors.length}/6 selected (min 2)
              </span>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search nearby hotels, e.g. hotels in Sukhumvit Bangkok..."
                value={compQuery}
                onChange={(e) => setCompQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCompSearch()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-colors"
              />
              <button
                onClick={handleCompSearch}
                disabled={compQuery.trim().length < 3 || compLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {compLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Search
              </button>
            </div>
          </div>

          {/* Selected competitors chips */}
          {selectedCompetitors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedCompetitors.map((comp) => (
                <div
                  key={comp.property_token}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-xs text-accent"
                >
                  {comp.name}
                  <button
                    onClick={() => toggleCompetitor(comp)}
                    className="hover:text-white transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search results */}
          {compResults?.data && compResults.data.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 px-1">
                {compResults.data.length} hotels found — select competitors
              </p>
              {compResults.data
                .filter((h) => h.property_token !== selectedHotel?.property_token)
                .map((hotel) => (
                  <HotelCard
                    key={hotel.property_token}
                    hotel={hotel}
                    onClick={() => toggleCompetitor(hotel)}
                    selected={isCompetitorSelected(hotel.property_token)}
                    actionLabel={
                      isCompetitorSelected(hotel.property_token)
                        ? 'Selected'
                        : selectedCompetitors.length >= 6
                          ? 'Max reached'
                          : 'Add competitor'
                    }
                    actionIcon={
                      isCompetitorSelected(hotel.property_token) ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )
                    }
                    disabled={!isCompetitorSelected(hotel.property_token) && selectedCompetitors.length >= 6}
                  />
                ))}
            </div>
          )}

          {/* Next button */}
          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep('search-property')}
              className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 text-sm hover:bg-white/10 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep('review')}
              disabled={selectedCompetitors.length < 2}
              className={clsx(
                'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all',
                selectedCompetitors.length >= 2
                  ? 'bg-accent text-background hover:bg-accent-light hover:shadow-[0_0_20px_rgba(56,189,248,0.3)]'
                  : 'bg-white/10 text-slate-500 cursor-not-allowed'
              )}
            >
              Review Setup
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          {/* Your hotel */}
          <div className="rounded-xl bg-surface border border-white/5 p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Your Hotel
            </h3>
            {selectedHotel && (
              <div className="flex items-center gap-4">
                {selectedHotel.thumbnail && (
                  <img
                    src={selectedHotel.thumbnail}
                    alt={selectedHotel.name}
                    className="w-14 h-14 rounded-lg object-cover"
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-white">{selectedHotel.name}</p>
                  <p className="text-xs text-slate-400">{selectedHotel.address}</p>
                  {selectedHotel.stars && (
                    <div className="flex items-center gap-1 mt-1">
                      {Array.from({ length: selectedHotel.stars }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Competitors */}
          <div className="rounded-xl bg-surface border border-white/5 p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Competitors ({selectedCompetitors.length})
            </h3>
            <div className="space-y-3">
              {selectedCompetitors.map((comp, i) => (
                <div key={comp.property_token} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs text-slate-400">
                    {i + 1}
                  </span>
                  {comp.thumbnail && (
                    <img
                      src={comp.thumbnail}
                      alt={comp.name}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{comp.name}</p>
                    <p className="text-xs text-slate-500 truncate">{comp.address}</p>
                  </div>
                  {comp.rate_per_night && (
                    <span className="text-xs font-rate text-slate-300">
                      {comp.currency} {comp.rate_per_night.toLocaleString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* What happens next */}
          <div className="rounded-xl bg-accent/5 border border-accent/20 p-4">
            <h3 className="text-xs font-semibold text-accent mb-2">What happens next</h3>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>- Your hotel and competitors will be saved</li>
              <li>- An initial rate scrape will run immediately</li>
              <li>- Rates will auto-refresh 3x daily (6am, 2pm, 10pm)</li>
              <li>- Parity alerts trigger when rates differ by more than the threshold</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep('search-competitors')}
              className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 text-sm hover:bg-white/10 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleFinishSetup}
              disabled={isCreating}
              className={clsx(
                'flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-bold transition-all duration-300',
                'bg-accent text-background hover:bg-accent-light',
                'hover:shadow-[0_0_25px_rgba(56,189,248,0.4)]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Start Monitoring
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hotel Card Component ────────────────────────────────────────────────────

function HotelCard({
  hotel,
  onClick,
  selected,
  actionLabel,
  actionIcon,
  disabled,
}: {
  hotel: HotelSearchResult;
  onClick: () => void;
  selected: boolean;
  actionLabel: string;
  actionIcon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className={clsx(
        'rounded-xl border p-4 transition-all cursor-pointer group',
        selected
          ? 'bg-accent/5 border-accent/30 shadow-[0_0_15px_rgba(56,189,248,0.1)]'
          : 'bg-surface border-white/5 hover:border-white/15',
        disabled && !selected && 'opacity-50 cursor-not-allowed'
      )}
      onClick={() => !disabled && onClick()}
    >
      <div className="flex items-start gap-4">
        {hotel.thumbnail ? (
          <img
            src={hotel.thumbnail}
            alt={hotel.name}
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
            <Hotel className="w-6 h-6 text-slate-600" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{hotel.name}</h3>
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{hotel.address}</span>
          </p>

          <div className="flex items-center gap-3 mt-2">
            {hotel.stars && (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: hotel.stars }).map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
            )}
            {hotel.overall_rating && (
              <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded font-medium">
                {hotel.overall_rating.toFixed(1)}
              </span>
            )}
            {hotel.reviews && (
              <span className="text-xs text-slate-500">{hotel.reviews.toLocaleString()} reviews</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {hotel.rate_per_night && (
            <div className="text-right">
              <p className="text-xs text-slate-500">from</p>
              <p className="text-sm font-rate font-semibold text-white">
                {hotel.currency} {hotel.rate_per_night.toLocaleString()}
              </p>
            </div>
          )}
          <div
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              selected
                ? 'bg-accent/20 text-accent'
                : 'bg-white/5 text-slate-400 group-hover:bg-accent/10 group-hover:text-accent'
            )}
          >
            {actionIcon}
            {actionLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

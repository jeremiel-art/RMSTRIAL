import { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  Shield,
  CalendarDays,
  Coins,
  Globe,
  Save,
  Search,
  X,
  Star,
  MapPin,
  Loader2,
} from 'lucide-react';
import { useSelectedProperty } from '../components/Layout';
import {
  useCompetitors,
  useAddCompetitor,
  useDeleteCompetitor,
  useToggleCompetitor,
  useUpdateProperty,
  useSearchHotels,
} from '../hooks/useApi';
import type { HotelSearchResult } from '../hooks/useApi';
import { PageSkeleton } from '../components/LoadingSkeleton';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'THB', 'JPY', 'AUD', 'SGD', 'INR', 'AED'];

export default function Settings() {
  const { selectedProperty } = useSelectedProperty();
  const { data: competitors, isLoading } = useCompetitors(selectedProperty?.id);
  const addMutation = useAddCompetitor();
  const deleteMutation = useDeleteCompetitor();
  const toggleMutation = useToggleCompetitor();
  const updateMutation = useUpdateProperty();

  // Search-based competitor adding
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const { data: searchResults, isLoading: isSearching } = useSearchHotels(
    showSearch ? searchQuery : ''
  );

  const [parityThreshold, setParityThreshold] = useState('3');
  const [lookAheadDays, setLookAheadDays] = useState('30');
  const [currency, setCurrency] = useState('THB');

  const handleAddFromSearch = useCallback(
    (hotel: HotelSearchResult) => {
      if (!selectedProperty) return;
      addMutation.mutate(
        {
          property_id: selectedProperty.id,
          name: hotel.name,
          google_hotels_url: hotel.name,
        },
        {
          onSuccess: () => {
            // Don't close search - user may want to add more
          },
        }
      );
    },
    [selectedProperty, addMutation]
  );

  const handleAddManual = useCallback(
    (name: string) => {
      if (!selectedProperty || !name.trim()) return;
      addMutation.mutate({
        property_id: selectedProperty.id,
        name: name.trim(),
        google_hotels_url: name.trim(),
      });
    },
    [selectedProperty, addMutation]
  );

  const handleSaveSettings = () => {
    if (!selectedProperty) return;
    updateMutation.mutate({
      propertyId: selectedProperty.id,
      data: {
        parityThreshold: parseFloat(parityThreshold),
        lookAheadDays: parseInt(lookAheadDays, 10),
        currency,
      },
    });
  };

  // Check if a hotel is already added as competitor
  const isAlreadyAdded = useCallback(
    (hotelName: string) => {
      return competitors?.some(
        (c) => c.name.toLowerCase() === hotelName.toLowerCase()
      );
    },
    [competitors]
  );

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Configure monitoring parameters for {selectedProperty?.name ?? 'your property'}
        </p>
      </div>

      {/* Competitors Management */}
      <div className="rounded-xl bg-surface border border-white/5">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-accent" />
              Competitor Hotels
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {competitors?.length ?? 0} competitor{(competitors?.length ?? 0) !== 1 ? 's' : ''} configured
            </p>
          </div>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              showSearch
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20'
            )}
          >
            {showSearch ? (
              <>
                <X className="w-4 h-4" />
                Close
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Competitor
              </>
            )}
          </button>
        </div>

        {/* Search panel */}
        {showSearch && (
          <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search hotels by name (e.g., 'Marriott Bangkok')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-colors"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent animate-spin" />
              )}
            </div>

            {/* Search results */}
            {searchResults?.data && searchResults.data.length > 0 && (
              <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
                {searchResults.data.map((hotel) => {
                  const alreadyAdded = isAlreadyAdded(hotel.name);
                  return (
                    <div
                      key={hotel.property_token}
                      className={clsx(
                        'flex items-center gap-3 p-3 rounded-lg border transition-all',
                        alreadyAdded
                          ? 'bg-success/5 border-success/20'
                          : 'bg-white/[0.02] border-white/5 hover:border-accent/20 hover:bg-white/[0.04]'
                      )}
                    >
                      {/* Thumbnail */}
                      {hotel.thumbnail ? (
                        <img
                          src={hotel.thumbnail}
                          alt={hotel.name}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                          <Globe className="w-5 h-5 text-slate-600" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">
                            {hotel.name}
                          </span>
                          {hotel.stars && (
                            <span className="flex items-center gap-0.5 text-yellow-500 flex-shrink-0">
                              {Array.from({ length: hotel.stars }).map((_, i) => (
                                <Star key={i} className="w-3 h-3 fill-current" />
                              ))}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {hotel.address && (
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              {hotel.address}
                            </span>
                          )}
                          {hotel.rate_per_night && (
                            <span className="text-[10px] text-accent font-rate flex-shrink-0">
                              {hotel.currency} {hotel.rate_per_night.toLocaleString()}/night
                            </span>
                          )}
                          {hotel.overall_rating && (
                            <span className="text-[10px] text-slate-400 flex-shrink-0">
                              {hotel.overall_rating}/5
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Add button */}
                      <button
                        onClick={() => handleAddFromSearch(hotel)}
                        disabled={alreadyAdded || addMutation.isPending}
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0',
                          alreadyAdded
                            ? 'bg-success/10 text-success border border-success/20 cursor-default'
                            : 'bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 disabled:opacity-50'
                        )}
                      >
                        {alreadyAdded ? (
                          'Added'
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            Add
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* No results */}
            {searchQuery.length >= 3 && !isSearching && searchResults?.data?.length === 0 && (
              <div className="mt-3 text-center py-4">
                <p className="text-sm text-slate-500">No hotels found for "{searchQuery}"</p>
              </div>
            )}

            {/* Quick add manual */}
            {searchQuery.length >= 3 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <button
                  onClick={() => {
                    handleAddManual(searchQuery);
                    setSearchQuery('');
                  }}
                  disabled={addMutation.isPending || isAlreadyAdded(searchQuery)}
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-accent transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3 h-3" />
                  Can't find it? Add "{searchQuery}" manually
                </button>
              </div>
            )}

            {searchQuery.length < 3 && searchQuery.length > 0 && (
              <p className="mt-2 text-xs text-slate-600">Type at least 3 characters to search...</p>
            )}
          </div>
        )}

        {/* Competitors list */}
        <div className="divide-y divide-white/5">
          {competitors?.length === 0 && (
            <div className="px-5 py-8 text-center text-slate-500 text-sm">
              No competitors configured yet. Click "Add Competitor" to search and add hotels.
            </div>
          )}
          {competitors?.map((comp) => (
            <div
              key={comp.id}
              className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      'text-sm font-medium',
                      comp.is_active ? 'text-slate-200' : 'text-slate-500 line-through'
                    )}
                  >
                    {comp.name}
                  </span>
                  {comp.is_active ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                      Active
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/20">
                      Inactive
                    </span>
                  )}
                </div>
                {comp.google_hotels_url && comp.google_hotels_url !== comp.name && (
                  <p className="text-[10px] text-slate-600 truncate mt-0.5">{comp.google_hotels_url}</p>
                )}
              </div>

              {/* Toggle */}
              <button
                onClick={() =>
                  toggleMutation.mutate({
                    competitorId: comp.id,
                    enabled: !comp.is_active,
                  })
                }
                className="text-slate-400 hover:text-accent transition-colors"
                title={comp.is_active ? 'Disable' : 'Enable'}
              >
                {comp.is_active ? (
                  <ToggleRight className="w-6 h-6 text-accent" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-slate-600" />
                )}
              </button>

              {/* Delete */}
              <button
                onClick={() => {
                  if (confirm(`Delete competitor "${comp.name}"?`)) {
                    deleteMutation.mutate(comp.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="p-1.5 rounded-lg hover:bg-danger/10 text-slate-500 hover:text-danger transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration */}
      <div className="rounded-xl bg-surface border border-white/5">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent" />
            Monitoring Configuration
          </h2>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Refresh schedule display */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1.5">
              <Clock className="w-3.5 h-3.5" />
              Refresh Schedule
            </label>
            <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 font-rate">
              3x daily
              <span className="text-slate-500 ml-2">(6:00 AM, 2:00 PM, 10:00 PM)</span>
            </div>
          </div>

          {/* Parity threshold */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1.5">
              <Shield className="w-3.5 h-3.5" />
              Parity Threshold (%)
            </label>
            <input
              type="number"
              min="0"
              max="50"
              step="0.5"
              value={parityThreshold}
              onChange={(e) => setParityThreshold(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white font-rate focus:outline-none focus:border-accent/50 transition-colors"
            />
            <p className="text-[10px] text-slate-600 mt-1">
              Rate differences above this threshold will trigger parity alerts
            </p>
          </div>

          {/* Look-ahead days */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              Look-ahead Days
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={lookAheadDays}
              onChange={(e) => setLookAheadDays(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white font-rate focus:outline-none focus:border-accent/50 transition-colors"
            />
            <p className="text-[10px] text-slate-600 mt-1">
              Number of future check-in dates to monitor
            </p>
          </div>

          {/* Currency selector */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1.5">
              <Coins className="w-3.5 h-3.5" />
              Base Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors appearance-none cursor-pointer"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Save button */}
          <button
            onClick={handleSaveSettings}
            disabled={updateMutation.isPending}
            className={clsx(
              'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300',
              'bg-accent text-background hover:bg-accent-light',
              'hover:shadow-[0_0_20px_rgba(56,189,248,0.3)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save Configuration'}
          </button>
          {updateMutation.isSuccess && (
            <p className="text-xs text-success animate-fade-in">Settings saved successfully.</p>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
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
} from 'lucide-react';
import { useSelectedProperty } from '../components/Layout';
import {
  useCompetitors,
  useAddCompetitor,
  useDeleteCompetitor,
  useToggleCompetitor,
  useUpdateProperty,
} from '../hooks/useApi';
import ChannelBadge from '../components/ChannelBadge';
import { PageSkeleton } from '../components/LoadingSkeleton';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'THB', 'JPY', 'AUD', 'SGD', 'INR', 'AED'];

export default function Settings() {
  const { selectedProperty } = useSelectedProperty();
  const { data: competitors, isLoading } = useCompetitors(selectedProperty?.id);
  const addMutation = useAddCompetitor();
  const deleteMutation = useDeleteCompetitor();
  const toggleMutation = useToggleCompetitor();
  const updateMutation = useUpdateProperty();

  const [newName, setNewName] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const [parityThreshold, setParityThreshold] = useState(
    selectedProperty?.parityThreshold?.toString() ?? '3'
  );
  const [lookAheadDays, setLookAheadDays] = useState(
    selectedProperty?.lookAheadDays?.toString() ?? '30'
  );
  const [currency, setCurrency] = useState(selectedProperty?.currency ?? 'USD');

  const handleAddCompetitor = () => {
    if (!selectedProperty || !newName.trim() || !newSource.trim()) return;
    addMutation.mutate(
      {
        propertyId: selectedProperty.id,
        name: newName.trim(),
        source: newSource.trim(),
        url: newUrl.trim(),
      },
      {
        onSuccess: () => {
          setNewName('');
          setNewSource('');
          setNewUrl('');
        },
      }
    );
  };

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
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-accent" />
            Competitor Sources
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage the OTA and competitor channels being monitored
          </p>
        </div>

        {/* Add form */}
        <div className="px-5 py-4 border-b border-white/5 bg-white/[0.01]">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Competitor name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-colors"
            />
            <input
              type="text"
              placeholder="Source (e.g., Booking.com)"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-colors"
            />
            <input
              type="text"
              placeholder="URL (optional)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent/50 transition-colors"
            />
            <button
              onClick={handleAddCompetitor}
              disabled={addMutation.isPending || !newName.trim() || !newSource.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {/* Competitors list */}
        <div className="divide-y divide-white/5">
          {competitors?.length === 0 && (
            <div className="px-5 py-8 text-center text-slate-500 text-sm">
              No competitors configured yet. Add one above.
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
                      comp.enabled ? 'text-slate-200' : 'text-slate-500'
                    )}
                  >
                    {comp.name}
                  </span>
                  <ChannelBadge source={comp.source} />
                </div>
                {comp.url && (
                  <p className="text-[10px] text-slate-600 truncate mt-0.5">{comp.url}</p>
                )}
              </div>

              {/* Toggle */}
              <button
                onClick={() =>
                  toggleMutation.mutate({
                    competitorId: comp.id,
                    enabled: !comp.enabled,
                  })
                }
                className="text-slate-400 hover:text-accent transition-colors"
                title={comp.enabled ? 'Disable' : 'Enable'}
              >
                {comp.enabled ? (
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
              {selectedProperty?.refreshCron ?? '0 */4 * * *'}
              <span className="text-slate-500 ml-2">(Every 4 hours)</span>
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
              Rate differences below this threshold will trigger parity alerts
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

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { getIndianCollegeNames } from '@/src/services/collegeService';

interface InstitutionComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function InstitutionCombobox({
  value,
  onChange,
  placeholder = 'Search institution',
  className,
}: InstitutionComboboxProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const colleges = await getIndianCollegeNames(120);
      setOptions(colleges);
      setLoading(false);
    };

    void load();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options.slice(0, 10);
    }

    return options
      .filter((option) => option.toLowerCase().includes(normalized))
      .slice(0, 10);
  }, [options, query]);

  const handlePick = (selected: string) => {
    setQuery(selected);
    onChange(selected);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <input
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          onChange(next);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full bg-bg-elevated border border-white/5 rounded-xl py-2.5 px-3 pr-10 text-sm outline-none focus:border-accent-teal"
      />
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
      >
        <ChevronDown className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full bg-bg-card border border-white/10 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {loading ? (
            <p className="px-3 py-2 text-xs text-text-secondary">Loading Indian colleges...</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text-secondary">No matching institutions</p>
          ) : (
            filtered.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handlePick(option)}
                className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-white/5 transition-colors"
              >
                {option}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

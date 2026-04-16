import { useMemo, useState } from 'react';
import { cn } from '@/src/lib/utils';

const COUNTRY_CODES = [
  { code: 'IN', name: 'India', dial: '+91' },
  { code: 'US', name: 'United States', dial: '+1' },
  { code: 'GB', name: 'United Kingdom', dial: '+44' },
  { code: 'CA', name: 'Canada', dial: '+1' },
  { code: 'AU', name: 'Australia', dial: '+61' },
  { code: 'DE', name: 'Germany', dial: '+49' },
  { code: 'FR', name: 'France', dial: '+33' },
  { code: 'IT', name: 'Italy', dial: '+39' },
  { code: 'ES', name: 'Spain', dial: '+34' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971' },
  { code: 'SG', name: 'Singapore', dial: '+65' },
  { code: 'MY', name: 'Malaysia', dial: '+60' },
  { code: 'JP', name: 'Japan', dial: '+81' },
  { code: 'KR', name: 'South Korea', dial: '+82' },
  { code: 'CN', name: 'China', dial: '+86' },
  { code: 'BR', name: 'Brazil', dial: '+55' },
  { code: 'ZA', name: 'South Africa', dial: '+27' },
  { code: 'NG', name: 'Nigeria', dial: '+234' },
];

interface CountryPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function splitPhoneValue(value: string) {
  const normalized = value.trim();
  const match = COUNTRY_CODES.find((item) => normalized.startsWith(item.dial));
  if (!match) {
    return {
      dial: '+91',
      number: normalized.replace(/^\+\d+\s*/, ''),
    };
  }

  return {
    dial: match.dial,
    number: normalized.slice(match.dial.length).trim(),
  };
}

export default function CountryPhoneInput({ value, onChange, className }: CountryPhoneInputProps) {
  const initial = useMemo(() => splitPhoneValue(value), [value]);
  const [dial, setDial] = useState(initial.dial);
  const [number, setNumber] = useState(initial.number);

  const updateValue = (nextDial: string, nextNumber: string) => {
    const cleaned = nextNumber.replace(/[^\d\s()-]/g, '').trim();
    onChange(cleaned ? `${nextDial} ${cleaned}` : nextDial);
  };

  return (
    <div className={cn('grid grid-cols-[120px_minmax(0,1fr)] gap-3', className)}>
      <select
        value={dial}
        onChange={(e) => {
          const nextDial = e.target.value;
          setDial(nextDial);
          updateValue(nextDial, number);
        }}
        className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal"
      >
        {COUNTRY_CODES.map((country) => (
          <option key={`${country.code}-${country.dial}`} value={country.dial}>
            {country.name} ({country.dial})
          </option>
        ))}
      </select>

      <input
        type="tel"
        value={number}
        onChange={(e) => {
          const nextNumber = e.target.value;
          setNumber(nextNumber);
          updateValue(dial, nextNumber);
        }}
        placeholder="Phone number"
        inputMode="numeric"
        maxLength={20}
        className="w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal"
      />
    </div>
  );
}

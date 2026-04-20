interface CountryPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function CountryPhoneInput({
  value,
  onChange,
  placeholder = 'Phone number with country code',
  className = '',
}: CountryPhoneInputProps) {
  return (
    <input
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-2xl border border-white/8 bg-bg-elevated px-4 py-3 text-sm outline-none focus:border-accent-teal ${className}`.trim()}
    />
  );
}

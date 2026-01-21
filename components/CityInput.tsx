
import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

interface CityInputProps {
  label: string;
  value: string; // Format attendu: "Ville, Pays"
  onChange: (value: string) => void;
  required?: boolean;
}

// Simulation d'une base de données de villes pour l'exemple
const CITIES_DB = [
  { city: "Paris", country: "France" },
  { city: "Lyon", country: "France" },
  { city: "Marseille", country: "France" },
  { city: "Bordeaux", country: "France" },
  { city: "Lille", country: "France" },
  { city: "Douala", country: "Cameroun" },
  { city: "Yaoundé", country: "Cameroun" },
  { city: "Bafoussam", country: "Cameroun" },
  { city: "Garoua", country: "Cameroun" },
  { city: "Montréal", country: "Canada" },
  { city: "Québec", country: "Canada" },
  { city: "Bruxelles", country: "Belgique" },
  { city: "Liège", country: "Belgique" },
  { city: "Genève", country: "Suisse" },
  { city: "Lausanne", country: "Suisse" },
  { city: "Abidjan", country: "Côte d'Ivoire" },
  { city: "Yamoussoukro", country: "Côte d'Ivoire" },
  { city: "Dakar", country: "Sénégal" },
  { city: "Libreville", country: "Gabon" },
  { city: "Brazzaville", country: "Congo" },
  { city: "Cotonou", country: "Bénin" },
  { city: "Lomé", country: "Togo" },
  { city: "Bamako", country: "Mali" },
  { city: "Casablanca", country: "Maroc" },
  { city: "Rabat", country: "Maroc" },
  { city: "Tunis", country: "Tunisie" },
  { city: "Alger", country: "Algérie" },
  { city: "New York", country: "États-Unis" },
  { city: "Berlin", country: "Allemagne" },
  { city: "Londres", country: "Royaume-Uni" }
];

const CityInput: React.FC<CityInputProps> = ({ label, value, onChange, required }) => {
  const [query, setQuery] = useState(value ? value.split(',')[0].trim() : '');
  const [suggestions, setSuggestions] = useState<typeof CITIES_DB>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && !value.startsWith(query)) {
        setQuery(value.split(',')[0].trim());
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setQuery(text);
    
    if (!text) {
        onChange('');
        setSuggestions([]);
        return;
    }

    const filtered = CITIES_DB.filter(c => 
        c.city.toLowerCase().includes(text.toLowerCase())
    ).slice(0, 5);
    
    setSuggestions(filtered);
    setIsOpen(true);
    onChange(text); 
  };

  const handleSelect = (item: typeof CITIES_DB[0]) => {
    const formatted = `${item.city}, ${item.country}`;
    setQuery(item.city);
    onChange(formatted);
    setIsOpen(false);
  };

  return (
    <div className="space-y-1 relative w-full" ref={wrapperRef}>
      <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        <input 
          required={required}
          type="text" 
          placeholder="Commencez à taper (ex: Paris)" 
          value={query}
          onChange={handleSearch}
          onFocus={() => {
            if (query) {
              setSuggestions(CITIES_DB.filter(c => c.city.toLowerCase().includes(query.toLowerCase())).slice(0,5));
              setIsOpen(true);
            }
          }}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm bg-white" 
          autoComplete="off"
        />
        {/* On masque le badge pays ici car il est affiché séparément dans le formulaire parent pour plus de clarté */}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-top-2">
            {suggestions.map((item, idx) => (
                <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex justify-between items-center group transition-colors"
                >
                    <span className="font-medium text-slate-700">{item.city}</span>
                    <span className="text-xs text-slate-400 uppercase font-bold group-hover:text-indigo-500">{item.country}</span>
                </button>
            ))}
        </div>
      )}
    </div>
  );
};

export default CityInput;

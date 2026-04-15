'use client';

import { useState } from 'react';

interface Props {
  defaultValue?: string;
}

export function AssetSearchForm({ defaultValue = '' }: Props) {
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (value.trim()) params.set('filter', value.trim());
    window.location.href = `/assets?${params.toString()}`;
  }

  function handleClear() {
    setValue('');
    window.location.href = '/assets';
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by name…"
        className="input flex-1"
      />
      <button type="submit" className="btn-primary shrink-0">Search</button>
      {value && (
        <button type="button" onClick={handleClear} className="btn-secondary shrink-0">
          Clear
        </button>
      )}
    </form>
  );
}

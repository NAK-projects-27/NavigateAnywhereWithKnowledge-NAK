"use client";
import { useState } from "react";

export default function Destination() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    const res = await fetch(`/api/destination?query=${query}`);
    const out = await res.json();
    setData(out);
    setLoading(false);
  }

  return (
    <div className="w-full min-h-screen flex flex-col items-center pt-24">
      <h1 className="text-4xl font-bold gradient-text mb-8">
        Explore a Destination
      </h1>

      <div className="flex gap-4">
        <input
          type="text"
          className="w-72"
          placeholder="Search a city or country"
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={search}>Search</button>
      </div>

      {loading && <div className="spinner mt-8"></div>}

      {data && (
        <div className="card w-[600px] mt-10">
          <h2 className="text-2xl font-bold">{data.name}</h2>
          <p className="mt-4 text-gray-300 whitespace-pre-line">
            <DestinationMap lat={data.latitude} lon={data.longitude} />

          </p>
        </div>
      )}
    </div>
  );
}

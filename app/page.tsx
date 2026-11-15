import { Dynads } from "@/components/dynads";

export default function Home() {
  return (
    <main>
      <header>
        <span className="eyebrow">REAL-TIME SPORTS × GENERATIVE VIDEO</span>
        <h1>dynads<span className="brand-dot">.</span></h1>
        <p>
          The game makes the moment. The moment makes the ad.
        </p>
      </header>
      <Dynads />
    </main>
  );
}
